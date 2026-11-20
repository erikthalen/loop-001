import { describe, expect, it } from 'vitest'
import { autoPatch, checkCable, type PatchModule, type Port } from './patch'

const port = (
  id: string,
  direction: Port['direction'],
  group?: string,
): Port => ({ id, label: id, direction, group })
const audioIn = port('in', 'in')
const audioOut = port('out', 'out')
/** One jack per channel, in a group (like the core makes them): out-1, out-2, ... */
const channels = (direction: Port['direction'], count: number) =>
  Array.from({ length: count }, (_, k) =>
    port(`${direction}-${k + 1}`, direction, `1–${count}`),
  )

// Modules like the app's (only their jacks).
// Master plays straight into the speakers: only an input, and it is the end.
const master: PatchModule = { id: 'master', ports: [audioIn], end: true }
const sampler: PatchModule = {
  id: 'sampler',
  ports: channels('out', 3),
}
const mixer: PatchModule = {
  id: 'mixer',
  ports: [
    ...channels('in', 3),
    port('return-a', 'in'),
    audioOut,
    port('send-a', 'out'),
  ],
  routes: [
    ...[1, 2, 3].flatMap(
      (k) =>
        [
          [`in-${k}`, 'out'],
          [`in-${k}`, 'send-a'],
        ] as const,
    ),
    ['return-a', 'out'],
  ],
}
const delay: PatchModule = { id: 'delay', ports: [audioIn, audioOut] }
const filter: PatchModule = { id: 'filter', ports: [audioIn, audioOut] }
const meter: PatchModule = { id: 'meter', ports: [audioIn] }
const metronome: PatchModule = { id: 'metronome', ports: [audioOut] }

const all = [master, sampler, mixer, delay, filter, meter, metronome]
const cable = (from: string, to: string) => {
  const [fm, fp] = from.split('.') as [string, string]
  const [tm, tp] = to.split('.') as [string, string]
  return { from: { module: fm, port: fp }, to: { module: tm, port: tp } }
}
const names = (
  cables: readonly {
    from: { module: string; port: string }
    to: { module: string; port: string }
  }[],
) =>
  cables.map(
    ({ from, to }) => `${from.module}.${from.port}>${to.module}.${to.port}`,
  )

describe('checkCable', () => {
  it('takes the two ends in any order, and puts the output first', () => {
    const check = checkCable(
      all,
      [],
      { module: 'filter', port: 'in' },
      { module: 'mixer', port: 'out' },
    )
    expect(check).toEqual({
      ok: true,
      from: { module: 'mixer', port: 'out' },
      to: { module: 'filter', port: 'in' },
    })
  })

  it('only joins an output to an input', () => {
    expect(
      checkCable(
        all,
        [],
        { module: 'delay', port: 'in' },
        { module: 'filter', port: 'in' },
      ).ok,
    ).toBe(false)
  })

  it('joins one channel to any input, and any output to one channel', () => {
    expect(
      checkCable(
        all,
        [],
        { module: 'sampler', port: 'out-2' },
        { module: 'filter', port: 'in' },
      ).ok,
    ).toBe(true)
    expect(
      checkCable(
        all,
        [],
        { module: 'metronome', port: 'out' },
        { module: 'mixer', port: 'in-3' },
      ).ok,
    ).toBe(true)
  })

  it('does not plug in the same cable twice', () => {
    const cables = [cable('mixer.out', 'filter.in')]
    expect(
      checkCable(
        all,
        cables,
        { module: 'mixer', port: 'out' },
        { module: 'filter', port: 'in' },
      ).ok,
    ).toBe(false)
  })

  it('stops a loop, also one through several modules', () => {
    expect(
      checkCable(
        all,
        [],
        { module: 'delay', port: 'out' },
        { module: 'delay', port: 'in' },
      ).ok,
    ).toBe(false)
    const cables = [cable('delay.out', 'filter.in')]
    expect(
      checkCable(
        all,
        cables,
        { module: 'filter', port: 'out' },
        { module: 'delay', port: 'in' },
      ).ok,
    ).toBe(false)
  })

  it("allows a send and return: the mixer's return does not reach its send", () => {
    const cables = [cable('mixer.send-a', 'delay.in')]
    expect(
      checkCable(
        all,
        cables,
        { module: 'delay', port: 'out' },
        { module: 'mixer', port: 'return-a' },
      ).ok,
    ).toBe(true)
  })
})

describe('autoPatch', () => {
  const order = [master, sampler, mixer, filter, meter]
  /** Add the modules one by one, like restoring an old project. */
  const build = (modules: PatchModule[]) => {
    let cables: ReturnType<typeof cable>[] = []
    modules.forEach((_, i) => {
      const change = autoPatch(modules.slice(0, i + 1), cables, modules[i]!.id)
      cables = cables.filter(
        (c) => !change.remove.some((r) => names([r])[0] === names([c])[0]),
      )
      cables.push(
        ...change.add.map((c) => ({ from: { ...c.from }, to: { ...c.to } })),
      )
    })
    return cables
  }

  it('patches a whole rack like the old chain', () => {
    expect(names(build(order)).sort()).toEqual(
      [
        'filter.out>master.in',
        'filter.out>meter.in',
        'mixer.out>filter.in',
        'sampler.out-1>mixer.in-1',
        'sampler.out-2>mixer.in-2',
        'sampler.out-3>mixer.in-3',
      ].sort(),
    )
  })

  it("puts a new effect in after the module above it, and keeps that module's cables", () => {
    const cables = build(order)
    const second: PatchModule = { id: 'filter2', ports: [audioIn, audioOut] }
    const change = autoPatch([...order, second], cables, 'filter2')
    // The meter has no output, so the filter is the closest module above with one.
    expect(names(change.remove).sort()).toEqual([
      'filter.out>master.in',
      'filter.out>meter.in',
    ])
    expect(names(change.add).sort()).toEqual([
      'filter.out>filter2.in',
      'filter2.out>master.in',
      'filter2.out>meter.in',
    ])
  })

  it('plays a new sound source into the end module (Master)', () => {
    const cables = build(order)
    expect(
      names(autoPatch([...order, metronome], cables, 'metronome').add),
    ).toEqual(['metronome.out>master.in'])
  })

  it('leaves a sound source unplugged when there is no end module', () => {
    expect(names(autoPatch([metronome], [], 'metronome').add)).toEqual([])
  })

  it('plugs Master in after the modules above it, when it comes last', () => {
    expect(names(autoPatch([filter, master], [], 'master').add)).toEqual([
      'filter.out>master.in',
    ])
  })
})

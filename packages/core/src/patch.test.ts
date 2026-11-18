import { describe, expect, it } from 'vitest'
import { autoPatch, checkCable, routeTrigger, type PatchModule, type Port } from './patch'

const port = (id: string, kind: Port['kind'], direction: Port['direction']): Port => ({ id, label: id, kind, direction })
const audioIn = port('in', 'audio', 'in')
const audioOut = port('out', 'audio', 'out')

// Modules like the app's (only their jacks).
// Master plays straight into the speakers: only an input, and it is the end.
const master: PatchModule = { id: 'master', ports: [audioIn], end: true }
const sequencer: PatchModule = { id: 'seq', ports: [port('trigger-out', 'trigger', 'out')] }
const sampler: PatchModule = { id: 'sampler', ports: [port('trigger-in', 'trigger', 'in'), port('channels-out', 'channels', 'out')] }
const mixer: PatchModule = {
  id: 'mixer',
  ports: [
    port('channels-in', 'channels', 'in'), port('return-a', 'audio', 'in'),
    audioOut, port('send-a', 'audio', 'out'),
  ],
  routes: [['channels-in', 'out'], ['channels-in', 'send-a'], ['return-a', 'out']],
}
const delay: PatchModule = { id: 'delay', ports: [audioIn, audioOut] }
const filter: PatchModule = { id: 'filter', ports: [audioIn, audioOut] }
const meter: PatchModule = { id: 'meter', ports: [audioIn] }
const metronome: PatchModule = { id: 'metronome', ports: [audioOut] }

const all = [master, sequencer, sampler, mixer, delay, filter, meter, metronome]
const cable = (from: string, to: string) => {
  const [fm, fp] = from.split('.') as [string, string]
  const [tm, tp] = to.split('.') as [string, string]
  return { from: { module: fm, port: fp }, to: { module: tm, port: tp } }
}
const names = (cables: readonly { from: { module: string; port: string }; to: { module: string; port: string } }[]) =>
  cables.map(({ from, to }) => `${from.module}.${from.port}>${to.module}.${to.port}`)

describe('checkCable', () => {
  it('takes the two ends in any order, and puts the output first', () => {
    const check = checkCable(all, [], { module: 'filter', port: 'in' }, { module: 'mixer', port: 'out' })
    expect(check).toEqual({ ok: true, from: { module: 'mixer', port: 'out' }, to: { module: 'filter', port: 'in' } })
  })

  it('only joins an output to an input, of the same kind', () => {
    expect(checkCable(all, [], { module: 'delay', port: 'in' }, { module: 'filter', port: 'in' }).ok).toBe(false)
    expect(checkCable(all, [], { module: 'seq', port: 'trigger-out' }, { module: 'filter', port: 'in' }).ok).toBe(false)
    expect(checkCable(all, [], { module: 'sampler', port: 'channels-out' }, { module: 'filter', port: 'in' }).ok).toBe(false)
  })

  it('does not plug in the same cable twice', () => {
    const cables = [cable('mixer.out', 'filter.in')]
    expect(checkCable(all, cables, { module: 'mixer', port: 'out' }, { module: 'filter', port: 'in' }).ok).toBe(false)
  })

  it('stops a loop, also one through several modules', () => {
    expect(checkCable(all, [], { module: 'delay', port: 'out' }, { module: 'delay', port: 'in' }).ok).toBe(false)
    const cables = [cable('delay.out', 'filter.in')]
    expect(checkCable(all, cables, { module: 'filter', port: 'out' }, { module: 'delay', port: 'in' }).ok).toBe(false)
  })

  it('allows a send and return: the mixer\'s return does not reach its send', () => {
    const cables = [cable('mixer.send-a', 'delay.in')]
    expect(checkCable(all, cables, { module: 'delay', port: 'out' }, { module: 'mixer', port: 'return-a' }).ok).toBe(true)
  })
})

describe('autoPatch', () => {
  const order = [master, sequencer, sampler, mixer, filter, meter]
  /** Add the modules one by one, like restoring an old project. */
  const build = (modules: PatchModule[]) => {
    let cables: ReturnType<typeof cable>[] = []
    modules.forEach((_, i) => {
      const change = autoPatch(modules.slice(0, i + 1), cables, modules[i]!.id)
      cables = cables.filter((c) => !change.remove.some((r) => names([r])[0] === names([c])[0]))
      cables.push(...change.add.map((c) => ({ from: { ...c.from }, to: { ...c.to } })))
    })
    return cables
  }

  it('patches a whole rack like the old chain', () => {
    expect(names(build(order)).sort()).toEqual([
      'filter.out>master.in',
      'filter.out>meter.in',
      'mixer.out>filter.in',
      'sampler.channels-out>mixer.channels-in',
      'seq.trigger-out>sampler.trigger-in',
    ].sort())
  })

  it('puts a new effect in after the module above it, and keeps that module\'s cables', () => {
    const cables = build(order)
    const second: PatchModule = { id: 'filter2', ports: [audioIn, audioOut] }
    const change = autoPatch([...order, second], cables, 'filter2')
    // The meter has no output, so the filter is the closest module above with one.
    expect(names(change.remove).sort()).toEqual(['filter.out>master.in', 'filter.out>meter.in'])
    expect(names(change.add).sort()).toEqual(['filter.out>filter2.in', 'filter2.out>master.in', 'filter2.out>meter.in'])
  })

  it('plays a new sound source into the end module (Master)', () => {
    const cables = build(order)
    expect(names(autoPatch([...order, metronome], cables, 'metronome').add)).toEqual(['metronome.out>master.in'])
  })

  it('leaves a sound source unplugged when there is no end module', () => {
    expect(names(autoPatch([metronome], [], 'metronome').add)).toEqual([])
  })

  it('plugs Master in after the modules above it, when it comes last', () => {
    expect(names(autoPatch([filter, master], [], 'master').add)).toEqual(['filter.out>master.in'])
  })
})

describe('routeTrigger', () => {
  it('sends a trigger only to the modules plugged into the trigger out', () => {
    const heard: string[] = []
    const cables = [cable('seq.trigger-out', 'a.trigger-in'), cable('other.trigger-out', 'b.trigger-in')]
    routeTrigger(cables, 'seq', 1, (id) => ({ listeners: [(t: number) => heard.push(`${id}:${t}`)] }))
    expect(heard).toEqual(['a:1'])
  })

  it('goes on through a module that passes it, changed', () => {
    const heard: string[] = []
    const cables = [cable('seq.trigger-out', 'box.trigger-in'), cable('box.trigger-out', 'sampler.trigger-in')]
    routeTrigger(cables, 'seq', 1, (id) => ({
      listeners: [(t: number) => heard.push(`${id}:${t}`)],
      pass: id === 'box' ? (t: number) => t * 10 : undefined,
    }))
    expect(heard).toEqual(['box:1', 'sampler:10'])
  })
})

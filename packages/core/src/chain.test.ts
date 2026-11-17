import { describe, expect, it } from 'vitest'
import { modulesAfter, planChain, planChannels, routeTrigger } from './chain'

// Nodes are plain strings here: the plan does not need real audio nodes.
const names = (connections: readonly (readonly [string, string])[]) => connections.map(([from, to]) => `${from}>${to}`)

describe('planChain', () => {
  it('connects start to end when there are no modules', () => {
    expect(names(planChain('in', [], 'out'))).toEqual(['in>out'])
  })

  it('sends the sound through a module with input and output (an effect)', () => {
    const plan = planChain('in', [{ input: 'fx.in', output: 'fx.out', jack: 'fx.jack' }], 'out')
    expect(names(plan)).toEqual(['in>fx.in', 'fx.out>fx.jack', 'fx.jack>out'])
  })

  it('passes the sound past a module with only an output (a source), and mixes the source in', () => {
    const plan = planChain('in', [{ output: 'src.out', jack: 'src.jack' }], 'out')
    expect(names(plan)).toEqual(['in>src.jack', 'src.out>src.jack', 'src.jack>out'])
  })

  it('sends the sound to a module with only an input (a meter), and also past it', () => {
    const plan = planChain('in', [{ input: 'meter.in', jack: 'meter.jack' }], 'out')
    expect(names(plan)).toEqual(['in>meter.in', 'in>meter.jack', 'meter.jack>out'])
  })

  it('passes the sound past a module without audio', () => {
    expect(names(planChain('in', [{ jack: 'ui.jack' }], 'out'))).toEqual(['in>ui.jack', 'ui.jack>out'])
  })

  it('chains the modules in order: a source, then an effect after it', () => {
    const plan = planChain(
      'in',
      [
        { output: 'metronome.out', jack: 'metronome.jack' },
        { input: 'filter.in', output: 'filter.out', jack: 'filter.jack' },
      ],
      'out',
    )
    expect(names(plan)).toEqual([
      'in>metronome.jack',
      'metronome.out>metronome.jack',
      'metronome.jack>filter.in',
      'filter.out>filter.jack',
      'filter.jack>out',
    ])
  })
})

describe('modulesAfter', () => {
  it('gives the modules after the sender, in chain order', () => {
    expect(modulesAfter(['sampler-a', 'sequencer', 'sampler-b', 'meter'], 'sequencer')).toEqual(['sampler-b', 'meter'])
  })

  it('gives nothing to modules before the sender', () => {
    expect(modulesAfter(['sampler', 'sequencer'], 'sequencer')).toEqual([])
  })

  it('gives nothing when the sender is not in the chain', () => {
    expect(modulesAfter(['a', 'b'], 'gone')).toEqual([])
  })
})

describe('routeTrigger', () => {
  type T = { channel: number; volume: number }
  const run = (order: string[], from: string, stops: Record<string, { pass?: (t: T) => T | null }>) => {
    const heard: string[] = []
    routeTrigger<T>(order, from, { channel: 0, volume: 1 }, (id) => ({
      listeners: [(t) => heard.push(`${id}:${t.volume}`)],
      pass: stops[id]?.pass,
    }))
    return heard
  }

  it('reaches only the modules after the sender, in order', () => {
    expect(run(['a', 'seq', 'b', 'c'], 'seq', {})).toEqual(['b:1', 'c:1'])
  })

  it('lets a module change the trigger for the modules after it', () => {
    const mixer = { pass: (t: T) => ({ ...t, volume: t.volume * 0.5 }) }
    expect(run(['seq', 'mixer', 'sampler'], 'seq', { mixer })).toEqual(['mixer:1', 'sampler:0.5'])
  })

  it('stops the trigger when a module returns null', () => {
    expect(run(['seq', 'gate', 'sampler'], 'seq', { gate: { pass: () => null } })).toEqual(['gate:1'])
  })
})

describe('planChannels', () => {
  const plan = (slots: Parameters<typeof planChannels<string>>[0]) => names(planChannels(slots))

  it('sends each channel of a sampler to the same channel of the mixer after it', () => {
    expect(
      plan([
        { jack: 'J1', channelOutputs: ['s1', 's2'] },
        { jack: 'J2' },
        { jack: 'J3', channelInputs: ['m1', 'm2'] },
      ]),
    ).toEqual(['s1>m1', 's2>m2'])
  })

  it('mixes two samplers into the same mixer channel', () => {
    expect(
      plan([
        { jack: 'J1', channelOutputs: ['a1'] },
        { jack: 'J2', channelOutputs: ['b1'] },
        { jack: 'J3', channelInputs: ['m1'] },
      ]),
    ).toEqual(['a1>m1', 'b1>m1'])
  })

  it('without a mixer after it, joins the main chain at the sampler', () => {
    expect(
      plan([
        { jack: 'M', channelInputs: ['m1'] },
        { jack: 'S', channelOutputs: ['s1', 's2'] },
      ]),
    ).toEqual(['s1>S', 's2>S'])
  })
})

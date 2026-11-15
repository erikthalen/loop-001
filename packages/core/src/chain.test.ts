import { describe, expect, it } from 'vitest'
import { modulesAfter, planChain } from './chain'

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

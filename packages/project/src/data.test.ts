import { describe, expect, it } from 'vitest'
import { parseProject } from './data'

describe('parseProject', () => {
  it('accepts a valid project', () => {
    const project = {
      version: 2,
      bpm: 90,
      modules: [
        { type: 'metronome', state: { volume: 0.3 } },
        { type: 'master' },
      ],
      cables: [
        { from: { module: 0, port: 'out' }, to: { module: 1, port: 'in' } },
      ],
    }
    expect(parseProject(project)).toEqual(project)
  })

  it('reads a version 1 project as version 2 without cables', () => {
    expect(
      parseProject({ version: 1, bpm: 90, modules: [{ type: 'a' }] }),
    ).toEqual({
      version: 2,
      bpm: 90,
      modules: [{ type: 'a', state: undefined }],
    })
  })

  it('rejects data that is not a project', () => {
    expect(parseProject(null)).toBeUndefined()
    expect(parseProject('hello')).toBeUndefined()
    expect(parseProject({ version: 3, bpm: 90, modules: [] })).toBeUndefined()
    expect(
      parseProject({ version: 2, bpm: 'fast', modules: [] }),
    ).toBeUndefined()
    expect(parseProject({ version: 2, bpm: -5, modules: [] })).toBeUndefined()
    expect(parseProject({ version: 2, bpm: 90 })).toBeUndefined()
  })

  it('drops broken module entries, and moves the cables to the new places', () => {
    const parsed = parseProject({
      version: 2,
      bpm: 90,
      extra: true,
      modules: [{ nope: 1 }, { type: 'a', x: 1 }, 'b', { type: 'c' }],
      cables: [
        { from: { module: 1, port: 'out' }, to: { module: 3, port: 'in' } },
        { from: { module: 0, port: 'out' }, to: { module: 1, port: 'in' } },
        { from: { module: 3, port: 'out' }, to: { module: 1, port: 'in' } },
        'broken',
      ],
    })
    expect(parsed).toEqual({
      version: 2,
      bpm: 90,
      modules: [
        { type: 'a', state: undefined },
        { type: 'c', state: undefined },
      ],
      cables: [
        { from: { module: 0, port: 'out' }, to: { module: 1, port: 'in' } },
        { from: { module: 1, port: 'out' }, to: { module: 0, port: 'in' } },
      ],
    })
  })
})

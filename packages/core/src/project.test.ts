import { describe, expect, it } from 'vitest'
import { parseProject } from './project'

describe('parseProject', () => {
  it('accepts a valid project', () => {
    const project = { version: 1, bpm: 90, modules: [{ type: 'metronome', state: { volume: 0.3 } }] }
    expect(parseProject(project)).toEqual(project)
  })

  it('rejects data that is not a project', () => {
    expect(parseProject(null)).toBeUndefined()
    expect(parseProject('hello')).toBeUndefined()
    expect(parseProject({ version: 2, bpm: 90, modules: [] })).toBeUndefined()
    expect(parseProject({ version: 1, bpm: 'fast', modules: [] })).toBeUndefined()
    expect(parseProject({ version: 1, bpm: -5, modules: [] })).toBeUndefined()
    expect(parseProject({ version: 1, bpm: 90 })).toBeUndefined()
  })

  it('drops broken module entries and extra fields', () => {
    const parsed = parseProject({ version: 1, bpm: 90, extra: true, modules: [{ type: 'a', x: 1 }, { nope: 1 }, 'b'] })
    expect(parsed).toEqual({ version: 1, bpm: 90, modules: [{ type: 'a', state: undefined }] })
  })
})

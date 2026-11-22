import { describe, expect, it } from 'vitest'
import type { ProjectData } from './data'
import { createProjectFile, readProjectFile } from './file'

const project: ProjectData = {
  version: 2,
  bpm: 100,
  modules: [{ type: 'metronome', state: { volume: 0.5 } }],
  cables: [],
}

const fileOf = (content: string, name = 'beat.loop.json') =>
  new File([content], name, { type: 'application/json' })

describe('project files', () => {
  it('reads back the file it made', async () => {
    const file = createProjectFile('My beat', project)
    expect(file.name).toBe('My beat.loop.json')
    expect(await readProjectFile(file)).toEqual({ name: 'My beat', project })
  })

  it('makes a safe file name', () => {
    expect(createProjectFile('a/b:c?', project).name).toBe('a-b-c-.loop.json')
    expect(createProjectFile('   ', project).name).toBe('project.loop.json')
  })

  it('takes the name from the file name when the file has none', async () => {
    const file = fileOf(JSON.stringify({ format: 'loop-project', project }))
    expect((await readProjectFile(file)).name).toBe('beat')
  })

  it('says which file is not a project file', async () => {
    await expect(readProjectFile(fileOf('{ not json'))).rejects.toThrow(
      '"beat.loop.json" is not a project file.',
    )
    await expect(
      readProjectFile(fileOf(JSON.stringify({ format: 'other', project }))),
    ).rejects.toThrow('is not a project file')
    await expect(
      readProjectFile(
        fileOf(JSON.stringify({ format: 'loop-project', project: { bpm: 1 } })),
      ),
    ).rejects.toThrow('is not a project file')
  })
})

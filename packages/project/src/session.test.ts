import {
  type AnyAudioModuleDefinition,
  type AudioModule,
  type Core,
  type CoreEventMap,
  createEmitter,
} from '@loop/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectData } from './data'
import { createProjectSession } from './session'
import type { ProjectStore, StoredProject } from './store'

/**
 * A core with no sound: only what the session uses (the modules, the bpm, the events). A real core
 * needs Web Audio, which Node does not have. A module saves the options it got.
 */
function createFakeCore() {
  const events = createEmitter<CoreEventMap>()
  const modules = new Map<string, AudioModule>()
  let bpm = 120
  let next = 0
  const core = {
    events,
    modules,
    cables: [],
    get bpm() {
      return bpm
    },
    setBpm(value: number) {
      bpm = value
    },
    add(definition: AnyAudioModuleDefinition, state?: unknown) {
      const id = `m${next++}`
      const module = {
        id,
        type: definition.type,
        save: () => state,
      } as unknown as AudioModule
      modules.set(id, module)
      events.emit('moduleadd', { module })
      return module
    },
    remove(module: AudioModule) {
      modules.delete(module.id)
      events.emit('moduleremove', { module })
    },
    connect() {},
    autoPatch() {},
  }
  return core as typeof core & Core
}

/** A store in memory, in place of IndexedDB and localStorage. */
function createMemoryStore(projects: StoredProject[] = []) {
  const saved = new Map(projects.map((p) => [p.id, p]))
  let currentId: string | undefined
  let backup: StoredProject | undefined
  const store: ProjectStore = {
    list: async () =>
      [...saved.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    get: async (id) => saved.get(id),
    put: async (project) => {
      saved.set(project.id, project)
    },
    delete: async (id) => {
      saved.delete(id)
    },
    getCurrentId: () => currentId,
    setCurrentId: (id) => {
      currentId = id
    },
    writeBackup: (project) => {
      backup = project
    },
    readBackup: () => backup,
    clearBackup: () => {
      backup = undefined
    },
  }
  return { store, saved }
}

const definitions: AnyAudioModuleDefinition[] = [
  { type: 'a', name: 'A', label: 'A', setup: () => ({}) },
  { type: 'b', name: 'B', label: 'B', setup: () => ({}) },
]

const project = (modules: string[], bpm = 120): ProjectData => ({
  version: 2,
  bpm,
  modules: modules.map((type) => ({ type })),
  cables: [],
})

const stored = (
  id: string,
  updatedAt: number,
  data = project(['a']),
): StoredProject => ({ id, name: id, updatedAt, data })

const typesIn = (core: Core) =>
  [...core.modules.values()].map((module) => module.type)

describe('createProjectSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('makes a new project when there is none', async () => {
    const core = createFakeCore()
    const { store, saved } = createMemoryStore()
    const session = createProjectSession({
      core,
      store,
      definitions,
      newProject: project(['a', 'b'], 90),
    })
    await session.start()
    expect(saved.size).toBe(1)
    expect(session.current.name).toBe('Untitled project')
    expect(typesIn(core)).toEqual(['a', 'b'])
    expect(core.bpm).toBe(90)
  })

  it('opens the project that was open last time', async () => {
    const core = createFakeCore()
    const { store } = createMemoryStore([
      stored('old', 1, project(['b'])),
      stored('newer', 2),
    ])
    store.setCurrentId('old')
    const session = createProjectSession({ core, store, definitions })
    await session.start()
    expect(session.current.id).toBe('old')
    expect(typesIn(core)).toEqual(['b'])
  })

  it('brings an old project up to date before it loads', async () => {
    const core = createFakeCore()
    const { store } = createMemoryStore([stored('p', 1, project(['a']))])
    const upgrade = (data: ProjectData) => ({
      ...data,
      modules: [...data.modules, { type: 'b' }],
    })
    const session = createProjectSession({ core, store, definitions, upgrade })
    await session.start()
    expect(typesIn(core)).toEqual(['a', 'b'])
  })

  it('saves a moment after a change, not at once', async () => {
    const core = createFakeCore()
    const { store, saved } = createMemoryStore([stored('p', 1)])
    const session = createProjectSession({
      core,
      store,
      definitions,
      saveDelay: 400,
    })
    await session.start()
    expect(session.status).toBe('saved')

    core.setBpm(140)
    core.events.emit('bpmchange', { bpm: 140 } as CoreEventMap['bpmchange'])
    expect(session.status).toBe('saving')
    await vi.advanceTimersByTimeAsync(399)
    expect(saved.get('p')!.data.bpm).toBe(120)
    await vi.advanceTimersByTimeAsync(1)
    expect(saved.get('p')!.data.bpm).toBe(140)
    expect(session.status).toBe('saved')
  })

  it('does not count loading a project as a change', async () => {
    const core = createFakeCore()
    const { store } = createMemoryStore([
      stored('one', 1),
      stored('two', 2, project(['b'])),
    ])
    const put = vi.spyOn(store, 'put')
    const session = createProjectSession({ core, store, definitions })
    await session.start()
    await session.open('one')
    await vi.advanceTimersByTimeAsync(1000)
    expect(put).not.toHaveBeenCalled()
    expect(session.status).toBe('saved')
  })

  it('keeps a backup from a closed page if it is newer than the saved project', async () => {
    const core = createFakeCore()
    const { store, saved } = createMemoryStore([stored('p', 1)])
    store.writeBackup(stored('p', 2, project(['b'])))
    const session = createProjectSession({ core, store, definitions })
    await session.start()
    expect(saved.get('p')!.updatedAt).toBe(2)
    expect(typesIn(core)).toEqual(['b'])
    expect(store.readBackup()).toBeUndefined()
  })

  it('ignores a backup that is older than the saved project', async () => {
    const core = createFakeCore()
    const { store, saved } = createMemoryStore([stored('p', 5)])
    store.writeBackup(stored('p', 2, project(['b'])))
    const session = createProjectSession({ core, store, definitions })
    await session.start()
    expect(saved.get('p')!.updatedAt).toBe(5)
    expect(typesIn(core)).toEqual(['a'])
  })

  it('opens the next project when the open one is erased, or a new one when none is left', async () => {
    const core = createFakeCore()
    const { store, saved } = createMemoryStore([
      stored('one', 1, project(['b'])),
      stored('two', 2),
    ])
    const session = createProjectSession({ core, store, definitions })
    await session.start()
    expect(session.current.id).toBe('two')

    await session.delete('two')
    expect(session.current.id).toBe('one')
    expect(typesIn(core)).toEqual(['b'])

    await session.delete('one')
    expect(saved.size).toBe(1)
    expect(session.current.id).not.toBe('one')
  })

  it('saves the new name at once', async () => {
    const core = createFakeCore()
    const { store, saved } = createMemoryStore([stored('p', 1)])
    const session = createProjectSession({ core, store, definitions })
    await session.start()
    await session.rename('  Beat  ')
    expect(saved.get('p')!.name).toBe('Beat')
    await session.rename('   ')
    expect(saved.get('p')!.name).toBe('Untitled project')
  })
})

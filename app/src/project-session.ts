import {
  restoreProject,
  serializeProject,
  type AnyAudioModuleDefinition,
  type Core,
  type ProjectData,
} from '@loop/core'
import type { ProjectStore, StoredProject } from './project-store'

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface ProjectSession {
  /** The open project's id and name. */
  readonly current: { readonly id: string; readonly name: string }
  readonly status: SaveStatus
  /** Open the last project, or make a new one. Call once at start. */
  start(): Promise<void>
  list(): Promise<StoredProject[]>
  open(id: string): Promise<void>
  create(name?: string, data?: ProjectData): Promise<void>
  rename(name: string): Promise<void>
  delete(id: string): Promise<void>
  /** Save now, if a save is waiting. */
  flush(): Promise<void>
  /** The open project's data, as it is right now. */
  snapshot(): ProjectData
}

export interface ProjectSessionOptions {
  core: Core
  store: ProjectStore
  /** The modules that saved projects may contain. */
  definitions: readonly AnyAudioModuleDefinition[]
  /** The data of a new project. Default: no modules. */
  newProject?: ProjectData
  /** Wait this long (ms) after the last change before saving. Default: 400. */
  saveDelay?: number
  /** Called when the open project, its name, or the save status changes. */
  onChange?: (session: ProjectSession) => void
}

const EMPTY_PROJECT: ProjectData = { version: 1, bpm: 120, modules: [] }
const DEFAULT_NAME = 'Untitled project'

/**
 * Keeps the open project saved (local first: everything stays in this browser).
 * Every change in the core is saved automatically, a moment later.
 */
export function createProjectSession(options: ProjectSessionOptions): ProjectSession {
  const { core, store, definitions, newProject = EMPTY_PROJECT, saveDelay = 400, onChange } = options

  let current = { id: '', name: DEFAULT_NAME }
  let status: SaveStatus = 'saved'
  let timer: ReturnType<typeof setTimeout> | undefined
  /** True while a project is being loaded into the core: its events are not changes. */
  let loading = false

  const notify = () => onChange?.(session)

  const setStatus = (value: SaveStatus) => {
    status = value
    notify()
  }

  const saveNow = async () => {
    clearTimeout(timer)
    timer = undefined
    if (!current.id) return
    setStatus('saving')
    try {
      await store.put({ ...current, updatedAt: Date.now(), data: serializeProject(core) })
      setStatus('saved')
    } catch (error) {
      console.error('Could not save the project:', error)
      setStatus('error')
    }
  }

  const scheduleSave = () => {
    if (loading) return
    clearTimeout(timer)
    timer = setTimeout(saveNow, saveDelay)
    if (status !== 'saving') setStatus('saving')
  }

  for (const type of ['bpmchange', 'moduleadd', 'moduleremove', 'modulemove', 'modulechange'] as const) {
    core.events.on(type, scheduleSave)
  }

  // Before the page is hidden or closed, save the waiting change, so it is not lost.
  // The IndexedDB write may not finish in time, so also keep a quick backup copy.
  const saveIfWaiting = () => {
    if (!timer || !current.id) return
    store.writeBackup({ ...current, updatedAt: Date.now(), data: serializeProject(core) })
    void saveNow()
  }
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveIfWaiting())
  addEventListener('pagehide', saveIfWaiting)

  const load = (project: StoredProject) => {
    loading = true
    try {
      current = { id: project.id, name: project.name }
      const { skipped } = restoreProject(core, project.data, definitions)
      if (skipped.length) console.warn('Some modules could not be loaded:', skipped)
    } finally {
      loading = false
    }
    store.setCurrentId(project.id)
    status = 'saved'
    notify()
  }

  const session: ProjectSession = {
    get current() {
      return current
    },
    get status() {
      return status
    },
    async start() {
      // A backup exists if the page closed before the last save finished. Keep it if it is newer.
      const backup = store.readBackup()
      if (backup) {
        const saved = await store.get(backup.id)
        if (!saved || backup.updatedAt > saved.updatedAt) await store.put(backup)
        store.clearBackup()
      }

      const id = store.getCurrentId()
      const project = (id && (await store.get(id))) || (await store.list())[0]
      if (project) load(project)
      else await session.create()
    },
    list: () => store.list(),
    async open(id) {
      if (id === current.id) return
      const project = await store.get(id)
      if (!project) throw new Error(`Project ${id} not found`)
      await session.flush()
      load(project)
    },
    async create(name = DEFAULT_NAME, data = newProject) {
      await session.flush()
      const project: StoredProject = { id: crypto.randomUUID(), name, updatedAt: Date.now(), data }
      await store.put(project)
      load(project)
    },
    async rename(name) {
      current = { ...current, name: name.trim() || DEFAULT_NAME }
      await saveNow()
    },
    async delete(id) {
      if (timer && id === current.id) clearTimeout(timer)
      await store.delete(id)
      if (id !== current.id) return notify()
      // The open project was deleted: open the next one, or start a new one.
      const [next] = await store.list()
      if (next) load(next)
      else await session.create()
    },
    async flush() {
      if (timer) await saveNow()
    },
    snapshot: () => serializeProject(core),
  }

  return session
}

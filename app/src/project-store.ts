import { parseProject, type ProjectData } from '@loop/core'

/** A project as it is kept in the browser. */
export interface StoredProject {
  id: string
  name: string
  /** Time of the last save (ms since 1970). */
  updatedAt: number
  data: ProjectData
}

/** Where projects are kept. Only this file knows it is IndexedDB. */
export interface ProjectStore {
  /** All projects, most recently saved first. */
  list(): Promise<StoredProject[]>
  get(id: string): Promise<StoredProject | undefined>
  put(project: StoredProject): Promise<void>
  delete(id: string): Promise<void>
  /** The project that was open last time. */
  getCurrentId(): string | undefined
  setCurrentId(id: string): void
  /**
   * Emergency copy for when the page closes. IndexedDB writes can be stopped when a page
   * closes, but localStorage writes finish at once. `start()` moves the copy into IndexedDB.
   */
  writeBackup(project: StoredProject): void
  readBackup(): StoredProject | undefined
  clearBackup(): void
}

const DB_NAME = 'loop'
const DB_VERSION = 1
const PROJECTS = 'projects'
const CURRENT_KEY = 'loop:current-project'
const BACKUP_KEY = 'loop:unsaved-project'

/** Open the project database (IndexedDB, a native browser database). */
export async function openProjectStore(): Promise<ProjectStore> {
  const db = await request(
    (() => {
      const open = indexedDB.open(DB_NAME, DB_VERSION)
      // Runs the first time, and when DB_VERSION goes up: create or change the tables here.
      open.onupgradeneeded = () => open.result.createObjectStore(PROJECTS, { keyPath: 'id' })
      return open
    })(),
  )

  const store = (mode: IDBTransactionMode) => db.transaction(PROJECTS, mode).objectStore(PROJECTS)

  return {
    async list() {
      const all = await request<StoredProject[]>(store('readonly').getAll())
      return all.sort((a, b) => b.updatedAt - a.updatedAt)
    },
    get: (id) => request<StoredProject | undefined>(store('readonly').get(id)),
    put: async (project) => {
      await request(store('readwrite').put(project))
    },
    delete: async (id) => {
      await request(store('readwrite').delete(id))
    },
    // A tiny pointer, so localStorage is fine. It can fail (private mode), so it is wrapped.
    getCurrentId() {
      try {
        return localStorage.getItem(CURRENT_KEY) ?? undefined
      } catch {
        return undefined
      }
    },
    setCurrentId(id) {
      try {
        localStorage.setItem(CURRENT_KEY, id)
      } catch {
        // Not saved: the app opens the most recent project next time instead.
      }
    },
    writeBackup(project) {
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(project))
      } catch {
        // Nothing more we can do while the page closes.
      }
    },
    readBackup() {
      try {
        const value = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? 'null')
        const data = parseProject(value?.data)
        if (!data || typeof value.id !== 'string' || typeof value.name !== 'string') return undefined
        return { id: value.id, name: value.name, updatedAt: Number(value.updatedAt) || 0, data }
      } catch {
        return undefined
      }
    },
    clearBackup() {
      try {
        localStorage.removeItem(BACKUP_KEY)
      } catch {
        // Ignore.
      }
    },
  }
}

/** Turn an IndexedDB request into a Promise. */
function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

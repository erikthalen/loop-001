import type { Library, SaveStatus, Tape } from '@loop/library'
import { newProject } from './modules'
import {
  createProjectFile,
  PROJECT_FILE_EXTENSION,
  readProjectFile,
} from './project-file'

/**
 * A library for the module guide (/modules/library): a few made-up tapes, kept only in memory.
 * It does what the real one does (open, new, rename, erase, import, export), but it never
 * touches the real projects, and it is gone when the page closes.
 */
export function createDemoLibrary(): Library {
  const now = Date.now()
  const minutes = (n: number) => now - n * 60_000
  let tapes: Tape[] = [
    { id: 'demo-1', name: 'Kitchen drums', updatedAt: minutes(5) },
    { id: 'demo-2', name: 'Night loop', updatedAt: minutes(60 * 26) },
    { id: 'demo-3', name: 'First try', updatedAt: minutes(60 * 24 * 9) },
  ]
  let current = tapes[0]!
  let status: SaveStatus = 'saved'
  let count = tapes.length
  const changes = new EventTarget()

  /** Show a short "saving…", like the real library. */
  const save = (tape: Tape) => {
    tapes = [tape, ...tapes.filter(({ id }) => id !== tape.id)]
    current = tape
    status = 'saving'
    changes.dispatchEvent(new Event('change'))
    setTimeout(() => {
      status = 'saved'
      changes.dispatchEvent(new Event('change'))
    }, 400)
  }
  const add = (name: string) =>
    save({ id: `demo-${++count}`, name, updatedAt: Date.now() })

  return {
    get current() {
      return current
    },
    get status() {
      return status
    },
    list: async () => [...tapes],
    async open(id) {
      const tape = tapes.find((tape) => tape.id === id)
      if (!tape) return
      current = tape
      changes.dispatchEvent(new Event('change'))
    },
    async create() {
      add('Untitled')
    },
    async rename(name) {
      save({
        ...current,
        name: name.trim() || current.name,
        updatedAt: Date.now(),
      })
    },
    async erase(id) {
      tapes = tapes.filter((tape) => tape.id !== id)
      // Like the real library: never an empty machine.
      if (current.id === id) {
        if (tapes[0]) current = tapes[0]
        else return add('Untitled')
      }
      changes.dispatchEvent(new Event('change'))
    },
    exportFile: () => createProjectFile(current.name, newProject),
    async importFile(file) {
      const { name } = await readProjectFile(file)
      add(name)
    },
    fileTypes: `${PROJECT_FILE_EXTENSION},.json,application/json`,
    onChange: (listener, options) =>
      changes.addEventListener('change', listener, options),
  }
}

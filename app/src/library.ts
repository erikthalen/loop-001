import type { Library } from '@loop/library'
import { createProjectFile, PROJECT_FILE_EXTENSION, readProjectFile } from './project-file'
import type { ProjectSession } from './project-session'

/**
 * The work behind the library module (@loop/library): its tapes are this app's projects.
 * The session keeps them saved in the browser (project-session.ts, project-store.ts); a file is a
 * project file (project-file.ts).
 */
export function createLibrary(session: ProjectSession): Library {
  return {
    get current() {
      return session.current
    },
    get status() {
      return session.status
    },
    list: () => session.list(),
    open: (id) => session.open(id),
    create: () => session.create(),
    rename: (name) => session.rename(name),
    erase: (id) => session.delete(id),
    exportFile: () => createProjectFile(session.current.name, session.snapshot()),
    async importFile(file) {
      const { name, project } = await readProjectFile(file)
      await session.create(name, project)
    },
    fileTypes: `${PROJECT_FILE_EXTENSION},.json,application/json`,
    onChange: (listener, options) => session.onChange(listener, options),
  }
}

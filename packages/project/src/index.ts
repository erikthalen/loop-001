/**
 * Projects: everything about saving and loading them. Nothing here makes sound.
 * - data.ts: a project as plain JSON data. Read it from the core, check it, load it into the core.
 * - store.ts: where projects are kept in the browser (IndexedDB).
 * - session.ts: the open project. It saves itself a moment after each change.
 * - file.ts: a project as a file, to export and import.
 *
 * It knows no modules: the app gives it the module list, a new project and how to bring an old
 * project up to date (see app/src/modules.ts).
 */
export {
  type ProjectCable,
  type ProjectData,
  type ProjectModuleData,
  parseProject,
  type RestoreResult,
  restoreProject,
  serializeProject,
} from './data'
export {
  createProjectFile,
  downloadFile,
  PROJECT_FILE_EXTENSION,
  type ProjectFile,
  readProjectFile,
} from './file'
export {
  createProjectSession,
  type ProjectSession,
  type ProjectSessionOptions,
  type SaveStatus,
} from './session'
export {
  openProjectStore,
  type ProjectStore,
  type StoredProject,
} from './store'

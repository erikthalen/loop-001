/**
 * What the library needs from the app. The library only shows the tapes and passes on what you
 * do; the app keeps them (where, how they are saved, the file format). So this package knows
 * nothing about storage, and the app knows nothing about this module's HTML.
 *
 * A tape is a project: the library is the shelf in the studio where the tapes are kept, and the
 * open project is the tape on the machine.
 */
export interface Library {
  /** The tape on the machine (the open project). */
  readonly current: { readonly id: string; readonly name: string }
  /** Is the tape on the machine saved? */
  readonly status: SaveStatus
  /** Every tape on the shelf, most recently saved first. */
  list(): Promise<readonly Tape[]>
  /** Put another tape on the machine. */
  open(id: string): Promise<void>
  /** Put a new, blank tape on the machine. */
  create(): Promise<void>
  /** Write a new name on the tape on the machine. */
  rename(name: string): Promise<void>
  /** Erase a tape (it cannot be undone). */
  erase(id: string): Promise<void>
  /** The tape on the machine, as a file to download. */
  exportFile(): File
  /** Put the tape in a file on the shelf and on the machine. Throws an Error, with a message for the user, if it is not a tape. */
  importFile(file: File): Promise<void>
  /** The file types `importFile` reads (the file picker's `accept`). */
  readonly fileTypes: string
  /** Call `listener` when the tape on the machine, its name, its save status or the shelf changes. */
  onChange(listener: () => void, options?: { signal?: AbortSignal }): void
}

export type SaveStatus = 'saved' | 'saving' | 'error'

/** A tape on the shelf. */
export interface Tape {
  readonly id: string
  readonly name: string
  /** When it was last saved (ms since 1970). */
  readonly updatedAt: number
}

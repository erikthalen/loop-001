import type { AnyAudioModuleDefinition, AudioModule } from '@loop/core'

/**
 * What the patchbay needs, besides the core. It does its work on the core itself (add, remove,
 * cables); these are the few things only the app knows.
 */
export interface PatchbayOptions {
  /** The modules Add offers, in this order. */
  readonly modules: readonly AnyAudioModuleDefinition[]
  /** The color of the cables out of a module (the matrix rows are in it). */
  readonly colorOf: (module: AudioModule) => string
  /** The rack's remove mode: Remove turns it on and off. */
  readonly rack: RemoveMode
  /** Called after Add put a module in the core (and gave it its usual cables). */
  readonly onAdd?: (module: AudioModule) => void
  /**
   * Run a change in a view transition of this type, so the app can animate it. Add runs in
   * one of type 'add-module'. Default: the change happens at once.
   */
  readonly transition?: (type: string, update: () => void) => void
}

/**
 * Remove mode belongs to the rack (it shows the modules, and makes a click on one remove it).
 * The patchbay only turns it on and off, and shows whether it is on.
 */
export interface RemoveMode {
  readonly removing: boolean
  setRemoving(value: boolean): void
  /** Call `listener` when remove mode turns on or off, or a module comes or goes. */
  onChange(listener: () => void, options?: { signal?: AbortSignal }): void
}

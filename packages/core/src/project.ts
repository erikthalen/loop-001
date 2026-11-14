import type { Core } from './core'
import type { AnyAudioModuleDefinition, AudioModule } from './module'

/**
 * A saved project: plain JSON data.
 * `version` lets us change the format later and still read old projects.
 */
export interface ProjectData {
  version: 1
  bpm: number
  /** Modules in chain order. */
  modules: ProjectModuleData[]
}

export interface ProjectModuleData {
  /** The module definition's `type`, for example 'metronome'. */
  type: string
  /** What the module's `save()` returned. Passed back to `setup` as options. */
  state?: unknown
}

/** Read the current project from the core. */
export function serializeProject(core: Core): ProjectData {
  return {
    version: 1,
    bpm: core.bpm,
    modules: [...core.modules.values()].map((module) => {
      const state = module.save?.()
      return state === undefined ? { type: module.type } : { type: module.type, state }
    }),
  }
}

/**
 * Check that unknown data (for example from storage) is a valid project.
 * Returns `undefined` if it is not.
 */
export function parseProject(data: unknown): ProjectData | undefined {
  if (!isObject(data) || data.version !== 1) return undefined
  if (typeof data.bpm !== 'number' || !Number.isFinite(data.bpm) || data.bpm <= 0) return undefined
  if (!Array.isArray(data.modules)) return undefined
  const modules = data.modules.filter(
    (m): m is ProjectModuleData => isObject(m) && typeof m.type === 'string',
  )
  return { version: 1, bpm: data.bpm, modules: modules.map(({ type, state }) => ({ type, state })) }
}

export interface RestoreResult {
  added: AudioModule[]
  /** Modules that could not be restored: unknown type, or their setup threw. */
  skipped: { type: string; reason: string }[]
}

/**
 * Load a project into the core: set the bpm and add its modules.
 * Modules already in the core are removed first.
 * One broken module does not stop the others.
 */
export function restoreProject(
  core: Core,
  project: ProjectData,
  definitions: readonly AnyAudioModuleDefinition[],
): RestoreResult {
  const byType = new Map(definitions.map((definition) => [definition.type, definition]))
  const result: RestoreResult = { added: [], skipped: [] }

  for (const module of [...core.modules.values()]) core.remove(module)
  core.setBpm(project.bpm)

  for (const { type, state } of project.modules) {
    const definition = byType.get(type)
    if (!definition) {
      result.skipped.push({ type, reason: 'unknown module type' })
      continue
    }
    try {
      result.added.push(core.add(definition, state))
    } catch (error) {
      result.skipped.push({ type, reason: String(error) })
    }
  }
  return result
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

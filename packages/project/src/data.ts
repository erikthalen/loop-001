import type { AnyAudioModuleDefinition, AudioModule, Core } from '@loop/core'

/**
 * A saved project: plain JSON data.
 * `version` lets us change the format later and still read old projects.
 * Version 1 had no cables (the modules were in a chain, in rack order): it reads as version 2
 * without `cables`.
 */
export interface ProjectData {
  version: 2
  bpm: number
  /** Modules in rack order. */
  modules: ProjectModuleData[]
  /**
   * The cables (see patch.ts in @loop/core). Missing: a version 1 project, from before cables. Then
   * restoreProject gives every module the usual cables (autoPatch); an app that knows its modules
   * can make better ones first.
   */
  cables?: ProjectCable[]
}

/** One cable. A module is its place in `modules` (0 = first). */
export interface ProjectCable {
  from: { module: number; port: string }
  to: { module: number; port: string }
}

export interface ProjectModuleData {
  /** The module definition's `type`, for example 'metronome'. */
  type: string
  /** What the module's `save()` returned. Passed back to `setup` as options. */
  state?: unknown
}

/** Read the current project from the core. */
export function serializeProject(core: Core): ProjectData {
  const ids = [...core.modules.keys()]
  return {
    version: 2,
    bpm: core.bpm,
    modules: [...core.modules.values()].map((module) => {
      const state = module.save?.()
      return state === undefined
        ? { type: module.type }
        : { type: module.type, state }
    }),
    cables: core.cables.map(({ from, to }) => ({
      from: { module: ids.indexOf(from.module), port: from.port },
      to: { module: ids.indexOf(to.module), port: to.port },
    })),
  }
}

/**
 * Check that unknown data (for example from storage) is a valid project.
 * Returns `undefined` if it is not.
 */
export function parseProject(data: unknown): ProjectData | undefined {
  if (!isObject(data) || (data.version !== 1 && data.version !== 2))
    return undefined
  if (
    typeof data.bpm !== 'number' ||
    !Number.isFinite(data.bpm) ||
    data.bpm <= 0
  )
    return undefined
  if (!Array.isArray(data.modules)) return undefined
  // A broken module entry is dropped, so the cables count the places of the entries as saved.
  const places = data.modules.map((m) =>
    isObject(m) && typeof m.type === 'string' ? m : undefined,
  )
  const kept = places.flatMap((m, i) => (m ? [i] : []))
  const modules = kept.map((i) => ({
    type: places[i]!.type as string,
    state: places[i]!.state,
  }))
  const project: ProjectData = { version: 2, bpm: data.bpm, modules }
  if (data.version === 2) {
    const place = (value: unknown) =>
      typeof value === 'number' ? kept.indexOf(value) : -1
    const cables = Array.isArray(data.cables) ? data.cables : []
    project.cables = cables.flatMap((cable): ProjectCable[] => {
      if (!isObject(cable) || !isObject(cable.from) || !isObject(cable.to))
        return []
      const { from, to } = cable
      if (typeof from.port !== 'string' || typeof to.port !== 'string')
        return []
      const fromModule = place(from.module)
      const toModule = place(to.module)
      if (fromModule < 0 || toModule < 0) return []
      return [
        {
          from: { module: fromModule, port: from.port },
          to: { module: toModule, port: to.port },
        },
      ]
    })
  }
  return project
}

export interface RestoreResult {
  added: AudioModule[]
  /** Modules that could not be restored: unknown type, or their setup threw. */
  skipped: { type: string; reason: string }[]
}

/**
 * Load a project into the core: set the bpm, add its modules, then plug in its cables.
 * Modules already in the core are removed first.
 * One broken module does not stop the others (its cables are left out).
 * No `cables` (a version 1 project): each module gets the usual cables (core.autoPatch).
 */
export function restoreProject(
  core: Core,
  project: ProjectData,
  definitions: readonly AnyAudioModuleDefinition[],
): RestoreResult {
  const byType = new Map(
    definitions.map((definition) => [definition.type, definition]),
  )
  const result: RestoreResult = { added: [], skipped: [] }

  for (const module of [...core.modules.values()]) core.remove(module)
  core.setBpm(project.bpm)

  /** The module at each place in `project.modules` (undefined: skipped). */
  const placed: (AudioModule | undefined)[] = []
  for (const { type, state } of project.modules) {
    const definition = byType.get(type)
    placed.push(undefined)
    if (!definition) {
      result.skipped.push({ type, reason: 'unknown module type' })
      continue
    }
    try {
      const module = core.add(definition, state)
      placed[placed.length - 1] = module
      result.added.push(module)
    } catch (error) {
      result.skipped.push({ type, reason: String(error) })
    }
  }

  if (!project.cables) {
    for (const module of result.added) core.autoPatch(module)
    return result
  }
  for (const { from, to } of project.cables) {
    const fromModule = placed[from.module]
    const toModule = placed[to.module]?.id
    if (!fromModule || !toModule) continue
    core.connect(
      { module: fromModule.id, port: from.port },
      { module: toModule, port: to.port },
    )
  }
  return result
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

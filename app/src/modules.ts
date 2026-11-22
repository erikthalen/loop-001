import type { AnyAudioModuleDefinition } from '@loop/core'
import { delay } from '@loop/delay'
import { drums } from '@loop/drums'
import { lpFilter } from '@loop/lp-filter'
import { master } from '@loop/master'
import { metronome } from '@loop/metronome'
import { mixer } from '@loop/mixer'
import type { ProjectCable, ProjectData } from '@loop/project'
import { sampler } from '@loop/sampler'
import { vuMeter } from '@loop/vu-meter'

/** The modules a user can add. Add new modules here. */
export const availableModules: readonly AnyAudioModuleDefinition[] = [
  master,
  metronome,
  sampler,
  drums,
  mixer,
  delay,
  lpFilter,
  vuMeter,
]

/** The color of the cables that come out of each kind of module (the rows of the patchbay's matrix). */
export const CABLE_COLORS: Readonly<Record<string, string>> = {
  [master.type]: 'var(--red)',
  [metronome.type]: 'var(--pink)',
  [sampler.type]: 'var(--pink)',
  [drums.type]: 'var(--orange)',
  [mixer.type]: 'var(--ink)',
  [delay.type]: 'var(--green)',
  [lpFilter.type]: 'var(--blue)',
  [vuMeter.type]: 'var(--purple)',
}

/** A cable between two modules, by their place in `modules`. */
const cable = (
  from: number,
  fromPort: string,
  to: number,
  toPort: string,
): ProjectCable => ({
  from: { module: from, port: fromPort },
  to: { module: to, port: toPort },
})

/** The sampler's and the mixer's 6 channels. */
const CHANNELS = 6

/** A cable for each channel: channel k of one module to channel k of another (out-k to in-k). */
const channelCables = (from: number, to: number): ProjectCable[] =>
  Array.from({ length: CHANNELS }, (_, k) =>
    cable(from, `out-${k + 1}`, to, `in-${k + 1}`),
  )

/**
 * A new project: Master (play / stop and the volume) plays into the speakers, and the VU meter
 * under it shows that sound. Then the metronome (not plugged in: plug its Out in to hear it).
 * The sampler (with its sequencer) plays into the mixer, the mixer mixes the sampler's
 * channels (a volume and a send each), the delay echoes on the mixer's send A, and the sound goes
 * through the low pass filter into Master and the VU meter.
 * The order here is the rack order. Change it: change the cables' numbers too, and the order in
 * skeleton.ts (the loading screen).
 */
export const newProject: ProjectData = {
  version: 2,
  bpm: 120,
  modules: [master, vuMeter, metronome, sampler, mixer, delay, lpFilter].map(
    ({ type }) => ({ type }),
  ),
  cables: [
    ...channelCables(3, 4),
    cable(4, 'send-a', 5, 'in'),
    cable(5, 'out', 4, 'return-a'),
    cable(4, 'out', 6, 'in'),
    cable(6, 'out', 0, 'in'),
    cable(6, 'out', 1, 'in'),
  ],
}

/** The jacks each module had in a version 1 project (before cables), and its place in the chain. */
interface OldModule {
  /** Master: after the whole chain, then straight into the speakers. */
  stage?: boolean
  in?: boolean
  out?: boolean
  channelsIn?: boolean
  channelsOut?: boolean
  /** A mixer: send and return A and B. */
  sends?: boolean
  /** An effect that could be on a send bus: which bus (0 = A) from its saved state, or null (in the chain). */
  bus?: (state: unknown) => number | null
}
const busOf = (fallback: number | null) => (state: unknown) => {
  const bus = (state as { bus?: unknown } | undefined)?.bus
  return bus === 0 || bus === 1 || bus === null ? bus : fallback
}
const OLD_MODULES: Readonly<Record<string, OldModule>> = {
  [master.type]: { stage: true },
  [metronome.type]: { out: true },
  [sampler.type]: { channelsOut: true },
  [mixer.type]: { channelsIn: true, out: true, sends: true },
  [delay.type]: { in: true, out: true, bus: busOf(0) },
  [lpFilter.type]: { in: true, out: true, bus: busOf(null) },
  [vuMeter.type]: { in: true },
}

/**
 * A version 1 project (no cables) with the cables that give the same sound as its old chain:
 * - the sound went from module to module in rack order: an effect took the sound so far in, a
 *   sound source added its sound, a meter listened;
 * - Master came after all of that (it plays into the speakers itself, with no cable);
 * - channels went to the next mixer below;
 * - a delay or filter on a send bus took that send of the closest mixer above it, and played into
 *   its return.
 */
function addCables(project: ProjectData): ProjectData {
  const old = project.modules.map(({ type, state }) => {
    const info = OLD_MODULES[type] ?? {}
    return { ...info, bus: info.bus?.(state) ?? null }
  })
  const cables: ProjectCable[] = []
  type Source = { module: number; port: string }
  const plugInto = (sources: Source[], module: number, port: string) =>
    sources.forEach((source) => {
      cables.push(cable(source.module, source.port, module, port))
    })

  old.forEach((sender, i) => {
    if (sender.channelsOut) {
      const j = old.findIndex((m, j) => j > i && m.channelsIn)
      if (j >= 0) cables.push(cable(i, 'channels-out', j, 'channels-in'))
    }
    if (sender.bus !== null) {
      const letter = 'ab'[sender.bus]
      let j = i - 1
      while (j >= 0 && !old[j]!.sends) j--
      if (j >= 0)
        cables.push(
          cable(j, `send-${letter}`, i, 'in'),
          cable(i, 'out', j, `return-${letter}`),
        )
    }
  })

  let sources: Source[] = []
  old.forEach((m, i) => {
    if (m.stage || m.bus !== null) return
    if (m.in) plugInto(sources, i, 'in')
    if (m.in && m.out) sources = [{ module: i, port: 'out' }]
    else if (m.out) sources = [...sources, { module: i, port: 'out' }]
  })
  // Only one Master now: the first one gets the sound.
  const stage = old.findIndex((m) => m.stage)
  if (stage >= 0) plugInto(sources, stage, 'in')
  return { ...project, cables }
}

/** The sequencer was its own module before it went into the sampler. Its type, in old projects. */
const OLD_SEQUENCER = 'sequencer'

/**
 * A project from before the sequencer went into the sampler: each sequencer's steps go into the
 * sampler it played, and the sequencer and the trigger cables go away.
 * - The sampler it played: the one its trigger cable went to; else the first sampler below it
 *   (a version 1 project sent triggers down the rack); else the first sampler.
 * - Two sequencers on one sampler: a step is on if it was on in either.
 * - No sampler at all: the steps are lost (they played nothing).
 */
function mergeSequencers(project: ProjectData): ProjectData {
  const { modules } = project
  const cables = project.cables ?? []
  if (!modules.some((m) => m.type === OLD_SEQUENCER)) return project
  const samplers = modules.flatMap((m, i) =>
    m.type === sampler.type ? [i] : [],
  )
  const patterns = new Map<number, string[]>()
  modules.forEach((m, i) => {
    if (m.type !== OLD_SEQUENCER) return
    const wired = cables.find(
      (c) =>
        c.from.module === i &&
        c.from.port === 'trigger-out' &&
        modules[c.to.module]?.type === sampler.type,
    )?.to.module
    const target = wired ?? samplers.find((j) => j > i) ?? samplers[0]
    if (target === undefined) return
    const rows = (m.state as { pattern?: unknown } | undefined)?.pattern
    if (!Array.isArray(rows)) return
    const merged = patterns.get(target) ?? []
    rows.forEach((row, channel) => {
      if (typeof row !== 'string') return
      const before = merged[channel] ?? ''
      const length = Math.max(row.length, before.length)
      merged[channel] = Array.from({ length }, (_, step) =>
        row[step] === 'x' || before[step] === 'x' ? 'x' : '.',
      ).join('')
    })
    patterns.set(target, merged)
  })
  // The new place of each module (-1: a sequencer, gone).
  const places: number[] = []
  let next = 0
  for (const m of modules) places.push(m.type === OLD_SEQUENCER ? -1 : next++)
  return {
    ...project,
    modules: modules.flatMap((m, i) => {
      if (m.type === OLD_SEQUENCER) return []
      const pattern = patterns.get(i)
      if (!pattern) return [m]
      const state = (typeof m.state === 'object' && m.state) || {}
      return [{ ...m, state: { ...state, pattern } }]
    }),
    cables: project.cables?.flatMap((c) => {
      const from = places[c.from.module] ?? -1
      const to = places[c.to.module] ?? -1
      if (from < 0 || to < 0 || c.from.port.startsWith('trigger-')) return []
      return [cable(from, c.from.port, to, c.to.port)]
    }),
  }
}

/**
 * A project from before each channel had its own jack: one "channels" cable (channels-out to
 * channels-in) carried all 6. Now it is 6 cables, channel k to channel k.
 */
function splitChannels(project: ProjectData): ProjectData {
  const old = (port: string) =>
    port === 'channels-out' || port === 'channels-in'
  if (!project.cables?.some((c) => old(c.from.port) || old(c.to.port)))
    return project
  return {
    ...project,
    cables: project.cables.flatMap((c) => {
      if (c.from.port === 'channels-out' && c.to.port === 'channels-in')
        return channelCables(c.from.module, c.to.module)
      return old(c.from.port) || old(c.to.port) ? [] : [c]
    }),
  }
}

/**
 * Bring an old project up to date (the app calls it on each project it opens):
 * - version 1 (no cables): the cables that sound like its old chain (addCables);
 * - a sequencer module: into its sampler (mergeSequencers);
 * - a channels cable: one cable per channel (splitChannels).
 */
export function upgradeProject(project: ProjectData): ProjectData {
  return splitChannels(
    mergeSequencers(project.cables ? project : addCables(project)),
  )
}

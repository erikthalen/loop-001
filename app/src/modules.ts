import type {
  AnyAudioModuleDefinition,
  ProjectCable,
  ProjectData,
} from '@loop/core'
import { delay } from '@loop/delay'
import { lpFilter } from '@loop/lp-filter'
import { master } from '@loop/master'
import { metronome } from '@loop/metronome'
import { mixer } from '@loop/mixer'
import { sampler } from '@loop/sampler'
import { sequencer } from '@loop/sequencer'
import { vuMeter } from '@loop/vu-meter'

/** The modules a user can add. Add new modules here. */
export const availableModules: readonly AnyAudioModuleDefinition[] = [
  master,
  metronome,
  sequencer,
  sampler,
  mixer,
  delay,
  lpFilter,
  vuMeter,
]

/** The color of the cables that come out of each kind of module (the rows of the patchbay's matrix). */
export const CABLE_COLORS: Readonly<Record<string, string>> = {
  [master.type]: 'var(--red)',
  [metronome.type]: 'var(--pink)',
  [sequencer.type]: 'var(--orange)',
  [sampler.type]: 'var(--pink)',
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

/**
 * A new project: Master (play / stop and the volume) plays into the speakers, and the VU meter
 * under it shows that sound. Then the metronome (not plugged in: plug its Out in to hear it).
 * The sequencer (under the sampler) sends triggers to the sampler, the mixer mixes the sampler's
 * channels (a volume and a send each), the delay echoes on the mixer's send A, and the sound goes
 * through the low pass filter into Master and the VU meter.
 * The order here is the rack order. Change it: change the cables' numbers too, and the order in
 * skeleton.ts (the loading screen).
 */
export const newProject: ProjectData = {
  version: 2,
  bpm: 120,
  modules: [
    master,
    vuMeter,
    metronome,
    sampler,
    sequencer,
    mixer,
    delay,
    lpFilter,
  ].map(({ type }) => ({ type })),
  cables: [
    cable(4, 'trigger-out', 3, 'trigger-in'),
    cable(3, 'channels-out', 5, 'channels-in'),
    cable(5, 'send-a', 6, 'in'),
    cable(6, 'out', 5, 'return-a'),
    cable(5, 'out', 7, 'in'),
    cable(7, 'out', 0, 'in'),
    cable(7, 'out', 1, 'in'),
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
  triggerIn?: boolean
  triggerOut?: boolean
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
  [sequencer.type]: { triggerOut: true },
  [sampler.type]: { triggerIn: true, channelsOut: true },
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
 * - triggers went to every module below the sender; channels to the next mixer below;
 * - a delay or filter on a send bus took that send of the closest mixer above it, and played into
 *   its return.
 */
export function upgradeProject(project: ProjectData): ProjectData {
  if (project.cables) return project
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
    if (sender.triggerOut)
      old.forEach((m, j) => {
        if (j > i && m.triggerIn)
          cables.push(cable(i, 'trigger-out', j, 'trigger-in'))
      })
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

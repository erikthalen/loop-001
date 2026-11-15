import type { AnyAudioModuleDefinition, ProjectData } from '@loop/core'
import { lpFilter } from '@loop/lp-filter'
import { metronome } from '@loop/metronome'
import { sampler } from '@loop/sampler'
import { sequencer } from '@loop/sequencer'
import { vuMeter } from '@loop/vu-meter'

/** The modules a user can add. Add new modules here. */
export const availableModules: readonly AnyAudioModuleDefinition[] = [metronome, sequencer, sampler, lpFilter, vuMeter]

/**
 * A new project starts with this chain: the sequencer sends triggers to the sampler, the sound
 * goes through the low pass filter, and the VU meter shows it.
 */
export const newProject: ProjectData = {
  version: 1,
  bpm: 120,
  modules: [sequencer, sampler, lpFilter, vuMeter].map(({ type }) => ({ type })),
}

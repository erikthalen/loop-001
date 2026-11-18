import type { AnyAudioModuleDefinition, ProjectData } from '@loop/core'
import { delay } from '@loop/delay'
import { lpFilter } from '@loop/lp-filter'
import { master } from '@loop/master'
import { metronome } from '@loop/metronome'
import { mixer } from '@loop/mixer'
import { sampler } from '@loop/sampler'
import { sequencer } from '@loop/sequencer'
import { vuMeter } from '@loop/vu-meter'

/** The modules a user can add. Add new modules here. */
export const availableModules: readonly AnyAudioModuleDefinition[] = [master, metronome, sequencer, sampler, mixer, delay, lpFilter, vuMeter]

/**
 * A new project starts with this chain: Master (play / stop and the volume), the sequencer sends
 * triggers to the sampler, the mixer mixes the sampler's channels (a volume and a send each), the
 * delay echoes on the mixer's send A, the sound goes through the low pass filter, and the VU meter
 * shows it.
 */
export const newProject: ProjectData = {
  version: 1,
  bpm: 120,
  modules: [master, sequencer, sampler, mixer, delay, lpFilter, vuMeter].map(({ type }) => ({ type })),
}

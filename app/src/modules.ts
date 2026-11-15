import type { AnyAudioModuleDefinition } from '@loop/core'
import { lpFilter } from '@loop/lp-filter'
import { metronome } from '@loop/metronome'
import { vuMeter } from '@loop/vu-meter'

/** The modules a user can add. Add new modules here. */
export const availableModules: readonly AnyAudioModuleDefinition[] = [metronome, lpFilter, vuMeter]

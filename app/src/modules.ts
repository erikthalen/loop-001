import type { AnyAudioModuleDefinition } from '@loop/core'
import { lpFilter } from '@loop/lp-filter'
import { metronome } from '@loop/metronome'

/** The modules a user can add. Add new modules here. */
export const availableModules: readonly AnyAudioModuleDefinition[] = [metronome, lpFilter]

import type { AnyAudioModuleDefinition } from '@loop/core'
import { metronome } from '@loop/metronome'

/** The modules a user can add. Add new modules here. */
export const availableModules: readonly AnyAudioModuleDefinition[] = [metronome]

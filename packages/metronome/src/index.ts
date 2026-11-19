import { defineAudioModule } from '@loop/core'
import { uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { MetronomeOptions } from './setup'

/** Plays a short tick on every beat of the core clock. */
export const metronome = defineAudioModule({
  type: 'metronome',
  name: 'Metronome',
  label: 'MN',
  description: 'Ticks on every beat.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

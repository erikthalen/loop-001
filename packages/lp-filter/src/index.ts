import { defineAudioModule } from '@loop/core'
import { uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { LowPassOptions } from './setup'

/** A low pass filter: lets the low sounds through and takes away the high ones. Shows the sound. */
export const lpFilter = defineAudioModule({
  type: 'lp-filter',
  name: 'Low pass',
  description: 'Takes away the high sounds. Shows the sound before and after.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

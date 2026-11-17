import { defineAudioModule } from '@loop/core'
import { uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { MasterOptions } from './setup'

/** Starts and stops the core, and sets the master volume. HTML only. */
export const master = defineAudioModule({
  type: 'master',
  name: 'Master',
  description: 'Play and stop, and the master volume.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

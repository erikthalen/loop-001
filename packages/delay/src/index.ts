import { defineAudioModule } from '@loop/core'
import { uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { DelayOptions, RateName } from './setup'

/** Echoes on the beat. Plug it into a mixer's send and return, or between two modules. */
export const delay = defineAudioModule({
  type: 'delay',
  name: 'Delay',
  label: 'DL',
  description:
    'Echoes on the beat. Plug it into a send and return of the mixer.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

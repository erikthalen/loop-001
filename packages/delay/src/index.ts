import { defineAudioModule } from '@loop/core'
import { uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { Bus, DelayOptions, RateName } from './setup'

/** Echoes on the beat. In the main chain, or on a send bus of a mixer before it. */
export const delay = defineAudioModule({
  type: 'delay',
  name: 'Delay',
  description: 'Echoes on the beat. Put it on a send of the mixer, or in the chain.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

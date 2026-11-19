import { defineAudioModule } from '@loop/core'
import { uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { MixerOptions } from './setup'

/** Mixes the 6 channels of the modules before it (a sampler): a volume and a send per channel. */
export const mixer = defineAudioModule({
  type: 'mixer',
  name: 'Mixer',
  label: 'MX',
  description:
    'A volume and a send for each of the 6 channels, and two send buses (A, B) for effects. Put it after a sampler.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

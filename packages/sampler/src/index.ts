import { defineAudioModule } from '@loop/core'
import { uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { SamplerOptions } from './setup'

/** Records the microphone into 6 channels and plays the part between two markers. */
export const sampler = defineAudioModule({
  type: 'sampler',
  name: 'Sampler',
  description: 'Records up to 5 seconds from the microphone. Plays the part between the markers.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

import { defineModule, uiStyles } from '@loop/ui'
import { script } from './script'
import { sequencerStyles } from './sequencer/styles'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { SamplerOptions } from './setup'

/**
 * Records the microphone into 6 channels and plays the part between two markers. Its sequencer,
 * under it, plays the channels in a pattern of 16 steps.
 */
export const sampler = defineModule({
  type: 'sampler',
  name: 'Sampler',
  label: 'SP',
  description:
    'Records up to 5 seconds from the microphone. Plays the part between the markers, by hand or in a 16-step pattern.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles, sequencerStyles], template, script },
})

import { sequencerStyles } from '@loop/sequencer'
import { defineModule, uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { DrumsOptions } from './setup'

/**
 * A drum machine: 6 drums made from scratch (synthesized, no samples), each on its own channel.
 * Its sequencer, under it, plays them in a pattern of 16 steps.
 */
export const drums = defineModule({
  type: 'drums',
  name: 'Drum machine',
  label: 'DR',
  description:
    'Six synthesized drums: bass drum, snare, clap, two hi-hats and a rim shot. Plays them in a 16-step pattern.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles, sequencerStyles], template, script },
})

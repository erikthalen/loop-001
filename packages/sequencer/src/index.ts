import { defineAudioModule } from '@loop/core'
import { uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { SequencerOptions } from './setup'

/** A step sequencer: 6 channels, 16 steps, one checkbox per step. It makes no sound: it sends triggers to the modules plugged into it. */
export const sequencer = defineAudioModule({
  type: 'sequencer',
  name: 'Sequencer',
  label: 'SQ',
  description:
    'Sends triggers on 6 channels in a 16-step pattern, to the modules after it.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

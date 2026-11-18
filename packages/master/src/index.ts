import { defineAudioModule } from '@loop/core'
import { uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { MasterOptions } from './setup'

/**
 * Starts, stops and rewinds the transport, records the sound to play it backwards while it rewinds,
 * and sets the master volume. An output stage: it gets the whole sound, after the chain.
 */
export const master = defineAudioModule({
  type: 'master',
  name: 'Master',
  description: 'Play, stop and rewind, and the master volume.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

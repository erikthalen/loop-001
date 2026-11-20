import { defineModule, uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

export type { MasterOptions } from './setup'

/**
 * Starts, stops and rewinds the transport, records the sound to play it backwards while it rewinds,
 * and sets the master volume. Plug the sound into its In: it plays straight into the speakers.
 * Only one at a time.
 */
export const master = defineModule({
  type: 'master',
  name: 'Master',
  label: 'MSTR',
  description: 'Play, stop and rewind, and the master volume.',
  // The end of the sound, straight into the speakers: one is enough.
  unique: true,
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

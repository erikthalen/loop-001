import { defineAudioModule } from '@loop/core'
import { uiStyles } from '@loop/ui'
import { script } from './script'
import { setup } from './setup'
import { styles } from './styles'
import { template } from './template'

/** A stereo VU meter: two needles show how loud the sound is, left and right. */
export const vuMeter = defineAudioModule({
  type: 'vu-meter',
  name: 'VU meter',
  label: 'VU',
  description: 'Shows how loud the sound is, left and right.',
  setup,
  // The shared UI library first, then the module's own CSS (which can override it).
  ui: { styles: [uiStyles, styles], template, script },
})

import { defineModuleTemplate, html } from '@loop/ui'
import { BAR_MAX, positionOf } from './meter'
import type { setup } from './setup'

/**
 * The two meters show each channel's fast level (0: -20 VU, 1: +3 VU, up to BAR_MAX), see meter.ts.
 * Their color: green up to -3 VU, yellow up to 0 VU, red above 0 VU (the red zone).
 */
const LEVEL = html`min="0" max="${BAR_MAX}" optimum="0" low="${positionOf(-3).toFixed(3)}" high="${positionOf(0).toFixed(3)}" value="0"`

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (display, sr-only)
// and styles.ts; @loop/ui also styles the two <meter>s. The script draws the picture (meter.ts):
// two dials. The <meter>s show each channel's fast level.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>
      <canvas
        class="picture"
        role="img"
        aria-label="Stereo VU meter: two dials with needles from -20 to +3 VU, left and right"
      ></canvas>
      <!-- One row: a meter (from @loop/ui) for each channel, left and right. -->
      <div class="levels">
        <label class="field level left">
          <span aria-hidden="true">L</span>
          <meter ${LEVEL} aria-label="Left level"></meter>
        </label>
        <label class="field level right">
          <span aria-hidden="true">R</span>
          <meter ${LEVEL} aria-label="Right level"></meter>
        </label>
      </div>
    </section>
  `,
)

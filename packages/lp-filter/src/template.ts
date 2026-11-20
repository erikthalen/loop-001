import { defineModuleTemplate, html } from '@loop/core'
import type { setup } from './setup'

/** Slider steps. The frequency slider is logarithmic: script.ts turns a step into Hz. */
export const FREQUENCY_STEPS = 1000
/** Resonance slider steps: 10 per dB. */
export const RESONANCE_STEPS = 200

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (display, field, vertical,
// sr-only) and styles.ts; @loop/ui also styles the sliders, the checkbox and the radio buttons.
// The script draws the picture (picture.ts): the sound before and after the filter, from low to
// high, with the filter's curve, the cutoff and the resonance.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>

      <!-- One row: the cutoff slider (left), the middle column, the resonance slider (right).
           The sliders are as tall as the middle column. -->
      <div class="stage">
        <input
          class="vertical frequency"
          name="frequency"
          type="range"
          min="0"
          max="${FREQUENCY_STEPS}"
          step="1"
          aria-label="Cutoff"
        />
        <!-- The middle column: the bypass checkbox and the slope (two radio buttons), then the picture. -->
        <div class="screen">
          <div class="top-controls">
            <!-- Bypass: checked = the filter is off, the sound goes through unchanged. -->
            <label class="field">
              <input name="bypass" type="checkbox" ${module.on ? '' : 'checked'} />
              <span>bypass</span>
            </label>
            <!-- The slope: 12 or 24 dB per octave. -->
            <fieldset class="slope">
              <legend class="sr-only">Slope (dB per octave)</legend>
              <label class="field">
                <input name="slope" type="radio" value="12" ${module.slope === 12 ? 'checked' : ''} />
                <span>12db</span>
              </label>
              <label class="field">
                <input name="slope" type="radio" value="24" ${module.slope === 24 ? 'checked' : ''} />
                <span>24db</span>
              </label>
            </fieldset>
          </div>
          <canvas class="picture" role="img"></canvas>
        </div>
        <input
          class="vertical resonance"
          name="resonance"
          type="range"
          min="0"
          max="${RESONANCE_STEPS}"
          step="1"
          value="${Math.round(module.resonance * 10)}"
          aria-label="Resonance"
        />
      </div>

    </section>
  `,
)

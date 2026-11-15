import { defineModuleTemplate, html } from "@loop/core";
import type { setup } from "./setup";

/** Slider steps. The frequency slider is logarithmic: script.ts turns a step into Hz. */
export const FREQUENCY_STEPS = 1000;
/** Resonance slider steps: 10 per dB. */
export const RESONANCE_STEPS = 200;

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (range, range--vertical,
// checkbox, field, sr-only) and styles.ts. The script fills in the numbers and draws the picture.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <header class="top">
        <h2>${module.name}</h2>
        <span>
          <p class="readout">
            <span class="frequency-value digits"></span>
            <span class="frequency-unit"></span>
          </p>
          <p class="readout resonance-readout">
            <span class="resonance-value digits"></span>
            <span class="readout-label">res</span>
          </p>
        </span>
      </header>

      <div class="main">
        <div class="frequency-control">
          <input
            class="range range--vertical frequency"
            name="frequency"
            type="range"
            min="0"
            max="${FREQUENCY_STEPS}"
            step="1"
            aria-label="Frequency"
          />
          <!-- Marks at 100 Hz, 1 kHz and 10 kHz, next to the slider. -->
          <span class="scale" aria-hidden="true">
            <span class="tick" style="--at: 0.233"></span>
            <span class="tick" style="--at: 0.566"></span>
            <span class="tick" style="--at: 0.9"></span>
          </span>
        </div>

        <canvas class="spectrum" role="img"></canvas>

        <div class="resonance-control">
          <span class="meter" aria-hidden="true"></span>
          <input
            class="range range--vertical resonance"
            name="resonance"
            type="range"
            min="0"
            max="${RESONANCE_STEPS}"
            step="1"
            value="${Math.round(module.resonance * 10)}"
            aria-label="Resonance"
          />
        </div>
      </div>

      <footer class="bottom">
        <!-- Bypass: checked = the filter is off, the sound goes through unchanged. -->
        <label class="field bypass-field">
          <input
            class="checkbox"
            name="bypass"
            type="checkbox"
            ${module.on ? "" : "checked"}
          />
          bypass
        </label>
        <button class="button button--small slope" type="button">
          ${module.slope} db/oct
        </button>
      </footer>
    </section>
  `,
);

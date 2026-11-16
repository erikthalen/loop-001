import { defineModuleTemplate, html } from "@loop/core";
import type { setup } from "./setup";

/** Slider steps. The frequency slider is logarithmic: script.ts turns a step into Hz. */
export const FREQUENCY_STEPS = 1000;
/** Resonance slider steps: 10 per dB. */
export const RESONANCE_STEPS = 200;

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (display, label, range,
// checkbox, button, sr-only) and styles.ts. The script draws the picture (scene.ts): "music from
// next door", a wall between a speaker and an ear that only lets the low sounds through.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>

      <!-- One row: the cutoff slider (left), the picture, the resonance slider (right).
           Their colors match the CUTOFF (blue) and RES (orange) numbers in the picture. -->
      <div class="stage">
        <input
          class="range range--vertical frequency"
          name="frequency"
          type="range"
          min="0"
          max="${FREQUENCY_STEPS}"
          step="1"
          aria-label="Cutoff"
        />
        <canvas class="picture" role="img"></canvas>
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

      <footer class="bottom">
        <!-- Bypass: checked = the filter is off, the sound goes through unchanged. -->
        <label class="label">
          <input
            class="checkbox"
            name="bypass"
            type="checkbox"
            ${module.on ? "" : "checked"}
          />
          bypass
        </label>
        <!-- The slope: 12 or 24 on a small flip screen (the script slides it), then "db/oct". -->
        <button
          class="button button--small slope"
          type="button"
          style="--at: ${module.slope === 24 ? 1 : 0}"
        >
          <span class="flip" aria-hidden="true">
            <span class="flip-strip"><span>12</span><span>24</span></span>
          </span>
          <span aria-hidden="true">db/oct</span>
        </button>
      </footer>
    </section>
  `,
);

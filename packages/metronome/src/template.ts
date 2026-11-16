import { defineModuleTemplate, html } from "@loop/core";
import type { setup } from "./setup";

/**
 * One radio button (from @loop/ui) per beat in the bar. The script checks the beat that plays,
 * so only one is checked at a time. They only show the beat: they cannot be clicked or focused.
 * script.ts uses this too, when the signature changes.
 */
export const beatCells = (count: number) =>
  Array.from(
    { length: count },
    () => html`<input class="radio beat" type="radio" name="beat" tabindex="-1" />`,
  );

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (display, label, checkbox,
// radio, range, button, sr-only) and styles.ts. One row: the picture (picture.ts) with the tempo slider on
// the left; the beats, mute and the time signature on the right.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>
      <!-- The picture, and the tempo slider (from @loop/ui) under the tempo digits. -->
      <div class="screen">
        <canvas class="picture" role="img"></canvas>
        <input
          class="range tempo"
          name="tempo"
          type="range"
          min="20"
          max="300"
          step="1"
          aria-label="Tempo"
        />
      </div>
      <div class="side">
        <div class="beats" aria-hidden="true">
          ${beatCells(module.beatsPerBar)}
        </div>
        <div class="controls">
          <label class="label mute">
            <input
              class="checkbox"
              name="mute"
              type="checkbox"
              ${module.muted ? "checked" : ""}
            />
            mute
          </label>
          <button class="button button--small signature" type="button">
            ${module.signature}
          </button>
        </div>
      </div>
    </section>
  `,
);

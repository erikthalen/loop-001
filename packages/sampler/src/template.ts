import { defineModuleTemplate, html } from "@loop/core";
import { CHANNELS, type setup } from "./setup";

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (radio, checkbox, button,
// sr-only) and styles.ts. The script draws the sound and keeps the text up to date.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>

      <div class="wave">
        <canvas class="picture" role="img"></canvas>
        <!-- "● rec" or a message, in the top left corner of the picture. -->
        <span class="status" role="status"></span>
        <!-- The markers: drag them, or use the arrow keys. -->
        <button class="marker start" type="button" role="slider" aria-label="Start marker" aria-valuemin="0" aria-valuemax="100"></button>
        <button class="marker end" type="button" role="slider" aria-label="End marker" aria-valuemin="0" aria-valuemax="100"></button>
      </div>

      <p class="times">
        <span>start <span class="start-time"></span></span>
        <span>len <span class="length-time"></span></span>
        <span>end <span class="end-time"></span></span>
      </p>

      <footer class="bottom">
        <fieldset class="channels">
          <legend class="sr-only">Channel</legend>
          ${Array.from(
            { length: CHANNELS },
            (_, i) => html`
              <label class="channel">
                <input
                  class="radio"
                  type="radio"
                  name="channel"
                  value="${i}"
                  ${module.active === i ? "checked" : ""}
                />
                <span>${i + 1}</span>
              </label>
            `,
          )}
        </fieldset>
        <span class="actions">
          <label class="rec">
            <input class="checkbox" name="rec" type="checkbox" />
            rec
          </label>
          <button class="button button--small play" type="button">play</button>
        </span>
      </footer>
    </section>
  `,
);

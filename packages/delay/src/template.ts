import { defineModuleTemplate, html } from "@loop/core";
import { MAX_FEEDBACK, RATES, rateIndex, type setup } from "./setup";

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (display, field, sr-only)
// and styles.ts; @loop/ui also styles the sliders and the radio buttons.
// The picture on top (picture.ts: the echoes over one bar), then three sliders, then where the
// delay is: in the main chain (insert), or on send bus A or B of a mixer before it.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>
      <canvas class="picture" role="img"></canvas>

      <div class="sliders">
        <label class="field">
          <span>dry/wet</span>
          <input name="mix" type="range" min="0" max="100" step="1" value="${Math.round(module.mix * 100)}" />
        </label>
        <label class="field">
          <span>feedback</span>
          <input
            name="feedback"
            type="range"
            min="0"
            max="${Math.round(MAX_FEEDBACK * 100)}"
            step="1"
            value="${Math.round(module.feedback * 100)}"
          />
        </label>
        <label class="field">
          <span>rate</span>
          <input name="rate" type="range" min="0" max="${RATES.length - 1}" step="1" value="${rateIndex(module.rate)}" />
        </label>
      </div>

      <!-- Where the delay is. On a send bus, the main chain goes past it. -->
      <fieldset class="route">
        <legend class="sr-only">Where the delay is</legend>
        <label class="field">
          <input name="bus" type="radio" value="insert" ${module.bus === null ? "checked" : ""} />
          <span>insert</span>
        </label>
        <label class="field">
          <input name="bus" type="radio" value="0" ${module.bus === 0 ? "checked" : ""} />
          <span>send a</span>
        </label>
        <label class="field">
          <input name="bus" type="radio" value="1" ${module.bus === 1 ? "checked" : ""} />
          <span>send b</span>
        </label>
      </fieldset>
    </section>
  `,
);

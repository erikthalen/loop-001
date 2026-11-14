import { defineModuleTemplate, html } from "@loop/core";
import type { setup } from "./setup";

// HTML: made once, when the UI is mounted. Classes come from @loop/ui.
export const template = defineModuleTemplate<typeof setup>(
  ({ module, core }) => html`
    <article>
      <header>
        <h2 class="">${module.name}</h2>

        <div class="beats sr-only" aria-hidden="true">
          ${Array.from(
            { length: core.clock.beatsPerBar },
            () => html`<span class="beat"></span>`,
          )}
        </div>
      </header>

      <canvas></canvas>

      <footer>
        <label class="field">
          <input
            class="range"
            name="volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="${module.volume}"
          />
        </label>
        <label class="field">
          <input
            class="checkbox"
            name="accent"
            type="checkbox"
            ${module.accent ? "checked" : ""}
          />
          Accent first beat
        </label>
      </footer>
    </article>
  `,
);

import { defineModuleTemplate, html } from "@loop/core";
import { CHANNELS, STEPS, type setup } from "./setup";

// HTML: made once, when the UI is mounted. Only checkboxes: one row per channel (1 to 6), one column per step.
// The class "checkbox" comes from @loop/ui. The script turns steps on and off and shows the playing step.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>
      <div class="grid">
        ${Array.from({ length: CHANNELS }, (_, row) =>
          Array.from(
            { length: STEPS },
            (_, step) => html`
              <input
                class="checkbox"
                type="checkbox"
                data-channel="${row}"
                data-step="${step}"
                aria-label="Channel ${row + 1}, step ${step + 1}"
                ${module.pattern[row]![step] ? "checked" : ""}
              />
            `,
          ),
        )}
      </div>
    </section>
  `,
);

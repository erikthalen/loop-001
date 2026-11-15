import { defineModuleTemplate, html } from "@loop/core";
import type { setup } from "./setup";

// The metronome icon, 11 x 13 pixels. The arm is drawn in script.ts.
/** The body: a stepped pixel pyramid with a 1px top. */
const ICON_BODY =
  "M5 0h1v2h-1z M4 2h3v2h-3z M3 4h5v3h-5z M2 7h7v3h-7z M1 10h9v2h-9z M0 12h11v1h-11z";
/** The orange pivot at the bottom, where the arm turns. */
const ICON_PIVOT = "M5 10h1v1h-1z M4 11h3v1h-3z M3 12h5v1h-5z";

/** One cell per beat in the bar. script.ts uses it too, when the signature changes. */
export const beatCells = (count: number) =>
  Array.from({ length: count }, () => html`<span class="beat"></span>`);

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (button, sr-only)
// and styles.ts. The script fills in the numbers and lights the beats.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>

      <header class="top">
        <p class="tempo">
          <svg
            class="icon"
            viewBox="0 0 11 13"
            shape-rendering="crispEdges"
            aria-hidden="true"
          >
            <path d="${ICON_BODY}" fill="currentColor"></path>
            <path class="pivot" d="${ICON_PIVOT}"></path>
            <path class="arm"></path>
          </svg>
          <span class="digits" aria-hidden="true">
            <span class="digit"></span>
            <span class="digit"></span>
            <span class="digit"></span>
          </span>
          <span class="tempo-value sr-only"></span>
        </p>
        <div class="tempo-words">
          <button class="button button--small signature" type="button">
            ${module.signature}
          </button>
          <span class="unit">bpm</span>
        </div>
      </header>

      <div class="beats" aria-hidden="true">
        ${beatCells(module.beatsPerBar)}
      </div>
    </section>
  `,
);

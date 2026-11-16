import { defineModuleTemplate, html } from "@loop/core";
import type { setup } from "./setup";

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (display, sr-only)
// and styles.ts. The script draws the meters (meter.ts): two dials and two segment bars.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>
      <canvas
        class="picture"
        role="img"
        aria-label="Stereo VU meter: two dials with needles from -20 to +3 VU, and two level bars, left and right"
      ></canvas>
    </section>
  `,
);

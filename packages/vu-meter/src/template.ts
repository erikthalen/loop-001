import { defineModuleTemplate, html } from "@loop/core";
import type { setup } from "./setup";

// HTML: made once, when the UI is mounted. Classes come from styles.ts.
// The script draws the two meters.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <article>
      <section class="display">
        <div class="meters">
          <canvas
            class="meter"
            role="img"
            aria-label="Left channel level"
          ></canvas>
          <canvas
            class="meter"
            role="img"
            aria-label="Right channel level"
          ></canvas>
        </div>
      </section>
    </article>
  `,
);

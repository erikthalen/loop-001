import { defineModuleTemplate, html } from '@loop/ui'
import type { setup } from './setup'

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (display, field, sr-only)
// and styles.ts; @loop/ui also styles the slider and the checkbox.
// Two rows. Top, what it shows: the picture (picture.ts: a tape past a head), with the tempo.
// Bottom, what you change:
// the tempo slider and mute.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>
      <!-- Top: the picture, over the whole width. -->
      <canvas class="picture" role="img"></canvas>

      <!-- Bottom: the tempo slider takes the space that is left; mute keeps its own. -->
      <div class="controls">
        <label class="field tempo">
          <span>Tempo</span>
          <input
            name="tempo"
            type="range"
            min="20"
            max="300"
            step="1"
            aria-label="Tempo"
          />
        </label>

        <label class="field">
          <input name="mute" type="checkbox" ${module.muted ? 'checked' : ''} />
          <span>mute</span>
        </label>
      </div>
    </section>
  `,
)

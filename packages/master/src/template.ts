import { defineModuleTemplate, html } from '@loop/ui'
import type { setup } from './setup'

// HTML: made once, when the UI is mounted. Only HTML from @loop/ui (display, field, sr-only; it also
// styles the button, the checkbox and the slider). The tape reels (a canvas, reels.ts) on top, then
// one row with rewind (pressed: rewinding), play (checked: playing) and the master volume.
export const template = defineModuleTemplate<typeof setup>(
  ({ module, core }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>
      <!-- The reels (reels.ts): they stick out above the screen. -->
      <canvas class="reels" role="img" aria-label="Tape reels"></canvas>
      <div class="controls">
        <label class="field play">
          <span>play</span>
          <input
            name="play"
            type="checkbox"
            ${core.playing && !core.stopping ? 'checked' : ''}
          />
        </label>
        <label class="field volume">
          <span>vol</span>
          <input
            name="volume"
            type="range"
            min="0"
            max="100"
            step="1"
            value="${Math.round(module.volume * 100)}"
          />
        </label>
        <button
          class="rewind button small"
          name="rewind"
          type="button"
          aria-pressed="${core.rewinding}"
        >
          rew
        </button>
      </div>
    </section>
  `,
)

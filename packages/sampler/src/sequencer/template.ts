import { CHANNEL_COLORS, type HTMLTemplate, html } from '@loop/ui'
import { CHANNELS, STEPS } from './sequencer'

/** The progress bar's resolution: 20 per step, so it slides smoothly (the script moves it). */
const PROGRESS_STEPS = STEPS * 20

// HTML: the sequencer's own screen, under the sampler's. A grid of checkboxes: one row per
// channel (1 to 6), one column per step. The classes come from @loop/ui (display); it also styles
// the progress bar and the checkboxes. Each row has its channel's color (--c). The script turns
// steps on and off and shows the playing step (on the progress bar, and as a frame around its column).
export const sequencerTemplate = (
  pattern: readonly (readonly boolean[])[],
): HTMLTemplate => html`
  <section class="display sequencer">
    <h3 class="sr-only">Steps</h3>
    <!-- How far the transport is in the bar: 0 at the first step, full at the end of step 16. -->
    <progress
      class="steps"
      max="${PROGRESS_STEPS}"
      value="0"
      aria-label="Step"
    ></progress>

    <div class="grid">
      ${Array.from({ length: CHANNELS }, (_, row) => {
        return html`<span>${row + 1}</span> ${Array.from(
          { length: STEPS },
          (_, step) => html`
              <input
                type="checkbox"
                data-channel="${row}"
                data-step="${step}"
                style="--c: ${CHANNEL_COLORS[row]}"
                aria-label="Channel ${row + 1}, step ${step + 1}"
                ${pattern[row]![step] ? 'checked' : ''}
              />
            `,
        )}`
      })}
    </div>
  </section>
`

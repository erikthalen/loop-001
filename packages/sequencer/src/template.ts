import { CHANNEL_COLORS, type HTMLTemplate, html } from '@loop/ui'
import { CHANNELS, PATTERNS, type Pattern, STEPS } from './sequencer'

/** The progress bar's resolution: 20 per step, so it slides smoothly (the script moves it). */
const PROGRESS_STEPS = STEPS * 20

// HTML: the sequencer's own screen, under the module's (the sampler's, the drum machine's). A grid of checkboxes: one row per
// channel (1 to 6), one column per step. The classes come from @loop/ui (display); it also styles
// the progress bar and the checkboxes. Each row has its channel's color (--c). The script turns
// steps on and off and shows the playing step (on the progress bar, and as a frame around its column).
// Under the grid: one radio button per pattern (page), then copy and paste. The script shows the
// picked pattern in the grid.
// `pattern`: the picked pattern. `page`: its number (0 to 5).
// `rows`: each row's short label (in the grid) and name (for screen readers). Default: 1 to 6,
// "Channel 1" to "Channel 6".
export const sequencerTemplate = (
  pattern: Pattern,
  page: number,
  rows: readonly { label: string; name: string }[] = Array.from(
    { length: CHANNELS },
    (_, i) => ({ label: String(i + 1), name: `Channel ${i + 1}` }),
  ),
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
        return html`<span>${rows[row]!.label}</span> ${Array.from(
          { length: STEPS },
          (_, step) => html`
              <input
                type="checkbox"
                data-channel="${row}"
                data-step="${step}"
                style="--c: ${CHANNEL_COLORS[row]}"
                aria-label="${rows[row]!.name}, step ${step + 1}"
                ${pattern[row]![step] ? 'checked' : ''}
              />
            `,
        )}`
      })}
    </div>

    <!-- One row: the patterns (spread out), then copy and paste. -->
    <div class="pattern-controls">
      <fieldset class="pages">
        <legend class="sr-only">Pattern</legend>
        ${Array.from(
          { length: PATTERNS },
          (_, i) => html`
            <label class="field page">
              <input
                type="radio"
                name="page"
                value="${i}"
                aria-label="Pattern ${i + 1}"
                ${page === i ? 'checked' : ''}
              />
              <span>${i + 1}</span>
            </label>
          `,
        )}
      </fieldset>

      <button class="button small copy" type="button" title="Copy">copy</button>
      <button class="button small paste" type="button" title="Paste" disabled>
        paste
      </button>
    </div>
  </section>
`

import { defineModuleTemplate, html } from '@loop/core'
import type { setup } from './setup'

// The black body of the metronome icon (a pixel triangle). The arm is drawn in script.ts.
const ICON_BODY = 'M5 1h1v2h-1z M4 3h3v2h-3z M3 5h5v2h-5z M2 7h7v2h-7z M1 9h9v2h-9z'

/** One cell per beat in the bar. script.ts uses it too, when the signature changes. */
export const beatCells = (count: number) => Array.from({ length: count }, () => html`<span class="beat"></span>`)

/** The volume bar: 20 segments, one per 5%. */
const VOLUME_SEGMENTS = 20

// HTML: made once, when the UI is mounted. Classes come from @loop/ui and styles.ts.
// The script fills in the numbers and lights the beats.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <article>
      <section class="display">
        <header class="top">
          <span class="title">
            <svg class="icon" viewBox="0 0 11 11" shape-rendering="crispEdges" aria-hidden="true">
              <path d="${ICON_BODY}" fill="currentColor"></path>
              <path class="arm"></path>
            </svg>
            <h2>${module.name}</h2>
          </span>
          <button class="signature" type="button">${module.signature}</button>
        </header>

        <p class="tempo">
          <span class="digits" aria-hidden="true">
            <span class="digit"></span><span class="digit"></span><span class="digit"></span>
          </span>
          <span class="tempo-value sr-only"></span>
          <span class="unit">BPM</span>
        </p>
        <p class="marking"></p>

        <div class="track" aria-hidden="true"><span class="ball"></span></div>

        <div class="beats" aria-hidden="true">
          ${beatCells(module.beatsPerBar)}
        </div>

        <div class="volume">
          <label class="volume-label" for="volume">vol</label>
          <div class="volume-bar">
            <span class="segments" aria-hidden="true">
              ${Array.from({ length: VOLUME_SEGMENTS }, () => html`<span class="segment"></span>`)}
            </span>
            <!-- The real slider sits on top of the segments, invisible. -->
            <input
              id="volume"
              name="volume"
              type="range"
              min="0"
              max="100"
              step="${100 / VOLUME_SEGMENTS}"
              value="${Math.round(module.volume * 100)}"
            />
          </div>
          <span class="volume-value" aria-hidden="true"></span>
        </div>

        <button class="accent-toggle" type="button" aria-pressed="${module.accent}">
          <span>accent beat 1</span>
          <span class="accent-state">
            <span class="accent-label"></span>
            <span class="switch" aria-hidden="true"><span class="knob"></span></span>
          </span>
        </button>

        <p class="status">
          <span class="state"></span>
          <span>beat <span class="beat-number">-</span>/<span class="beat-count">${module.beatsPerBar}</span></span>
          <span>vol <span class="volume-value"></span></span>
        </p>
      </section>
    </article>
  `,
)

import { type HTMLTemplate, html } from '@loop/ui'
import type { Library, Tape } from './library'

/** When a tape was saved, short: "19 Nov, 23:28". */
export const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

// HTML: only HTML from @loop/ui (display, field, button, sr-only; it also styles the text input
// and the dialogs). From the top:
//   the tape on the machine: its name (a text input) and whether it is saved (an <output>)
//   the shelf: a row of cassettes, one per tape (cassette.ts draws them), that scrolls sideways
//     like a stack of widgets. Click a cassette to open it. Under it, a caption per tape (name,
//     when it was saved, remove) that slides along: the one under the tape in the middle shows
//   new, import, export
// Then two dialogs (closed until needed): "erase this tape?", and a problem (a file that is not a tape).
export const template = (library: Library): HTMLTemplate => html`
  <section class="display">
    <h2 class="sr-only">Library</h2>
    <div class="machine">
      <label class="field name">
        <span>Name</span>
        <input
          name="name"
          type="text"
          autocomplete="off"
          spellcheck="false"
          value="${library.current.name}"
        />
      </label>
      <output
        name="status"
        class="status"
        data-status="${library.status}"
      ></output>
    </div>
    <div class="shelf" role="group" aria-labelledby="shelf-title">
      <span class="sr-only" id="shelf-title">Projects</span>
      <!-- The cassettes. Scroll, or use the arrow keys: the one in the middle is picked. -->
      <div class="tapes">
        <ul class="track" aria-describedby="shelf-help"></ul>
      </div>
      <p class="sr-only" id="shelf-help">
        Left and right arrow keys: pick a tape. Enter: put it on the machine.
      </p>
      <!-- One caption per tape: its name ("on" if it is open), when it was saved, remove. They slide
           along with the tapes: the picked tape's caption is the one in the middle. -->
      <div class="captions">
        <div class="caption-track"></div>
      </div>
    </div>
    <div class="actions">
      <button class="button small" name="new" type="button">new</button>
      <button class="button small" name="import" type="button">import</button>
      <button class="button small" name="export" type="button">export</button>
      <input name="file" type="file" accept="${library.fileTypes}" hidden />
    </div>
  </section>

  <dialog class="ask-erase" aria-labelledby="erase-title">
    <form method="dialog">
      <h3 id="erase-title">Remove "<span class="erase-name"></span>"?</h3>
      <p>This cannot be undone. Export it first if you want to keep a copy.</p>
      <footer>
        <!-- Keep is the safe answer: it has the focus, and Esc means keep too. -->
        <button class="button small" value="keep" autofocus>cancel</button>
        <button class="button small primary" value="erase">remove</button>
      </footer>
    </form>
  </dialog>

  <dialog class="problem" aria-labelledby="problem-title">
    <form method="dialog">
      <h3 id="problem-title">Not a tape</h3>
      <p class="problem-text"></p>
      <footer>
        <button class="button small" value="ok" autofocus>ok</button>
      </footer>
    </form>
  </dialog>
`

/**
 * The tapes on the shelf, as cassettes. The script puts them in `.track`, draws each cassette
 * (cassette.ts), and keeps one of them focusable: the picked one (the one in the middle).
 */
export const tapes = (list: readonly Tape[], current: string): HTMLTemplate =>
  html`${list.map(
    (tape) => html`
      <li data-id="${tape.id}">
        <button
          class="tape"
          type="button"
          tabindex="-1"
          aria-label="${tape.name}, saved ${dateFormat.format(tape.updatedAt)}"
          aria-current="${tape.id === current}"
        >
          <canvas class="cassette" aria-hidden="true"></canvas>
          ${
            tape.id === current
              ? html`<span class="on-machine" aria-hidden="true">on</span>`
              : ''
          }
        </button>
      </li>
    `,
  )}`

/**
 * One caption per tape, in the same order. Three rows: its name, when it was saved, and
 * remove. ("On" is on the cassette, see tapes.) To open a tape, click its cassette. The script
 * puts them in `.caption-track`; the CSS slides the row along with the tapes, so the picked
 * tape's caption is in the middle.
 */
export const captions = (list: readonly Tape[]): HTMLTemplate =>
  html`${list.map(
    (tape) => html`
      <div class="caption" data-id="${tape.id}">
        <span class="caption-name">${tape.name}</span>
        <time datetime="${new Date(tape.updatedAt).toISOString()}"
          >${dateFormat.format(tape.updatedAt)}</time
        >
        <button
          class="button small erase"
          type="button"
          data-erase="${tape.id}"
          aria-label="Remove ${tape.name}"
        >
          remove
        </button>
      </div>
    `,
  )}`

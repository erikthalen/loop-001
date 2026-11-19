import { type HTMLTemplate, html } from '@loop/core'
import type { Library, Tape } from './library'

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

// HTML: only HTML from @loop/ui (display, field, button, sr-only; it also styles the text input,
// the radio buttons and the dialogs). From the top:
//   the tape on the machine: its name (a text input) and whether it is saved (an <output>)
//   the shelf: one radio button per tape (checked: the one on the machine), and an erase button
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
    <fieldset class="shelf">
      <legend class="field"><span>projects</span></legend>
      <ul class="tapes"></ul>
    </fieldset>
    <div class="actions">
      <button class="button small" name="new" type="button">new</button>
      <button class="button small" name="import" type="button">import</button>
      <button class="button small" name="export" type="button">export</button>
      <input name="file" type="file" accept="${library.fileTypes}" hidden />
    </div>
  </section>

  <dialog class="ask-erase" aria-labelledby="erase-title">
    <form method="dialog">
      <h3 id="erase-title">Erase "<span class="erase-name"></span>"?</h3>
      <p>This cannot be undone. Export it first if you want to keep a copy.</p>
      <footer>
        <!-- Keep is the safe answer: it has the focus, and Esc means keep too. -->
        <button class="button small" value="keep" autofocus>cancel</button>
        <button class="button small primary" value="erase">erase</button>
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

/** The tapes on the shelf. The script puts them in `.tapes` (they are read from the app, later). */
export const tapes = (list: readonly Tape[], current: string): HTMLTemplate =>
  html`${list.map(
    (tape) => html`
      <li>
        <label class="tape">
          <input
            type="radio"
            name="tape"
            value="${tape.id}"
            ${tape.id === current ? html`checked` : ''}
          />
          <span class="tape-name">${tape.name}</span>
          <time datetime="${new Date(tape.updatedAt).toISOString()}"
            >${dateFormat.format(tape.updatedAt)}</time
          >
        </label>
        <button
          class="button ghost erase"
          type="button"
          data-erase="${tape.id}"
          aria-label="Erase ${tape.name}"
        >
          ×
        </button>
      </li>
    `,
  )}`

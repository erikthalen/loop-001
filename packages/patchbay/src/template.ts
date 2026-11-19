import { type HTMLTemplate, html } from '@loop/core'
import type { PatchbayOptions } from './patchbay'

// HTML: only HTML from @loop/ui (display, button, menu, popover, matrix, sr-only). From the top:
//   add (opens the list of modules: a menu in a popover) and remove (a toggle: remove mode)
//   the matrix: the cables, one table per kind (matrix.ts puts them in)
export const template = (options: PatchbayOptions): HTMLTemplate => html`
  <section class="display">
    <h2 class="sr-only">Patchbay</h2>
    <div class="controls">
      <button class="button small" name="add" type="button" popovertarget="add-list">add</button>
      <button class="button small" name="remove" type="button" aria-pressed="false" disabled>remove</button>
    </div>
    <div id="add-list" class="menu" popover>
      <menu>
        <li><small>Add a module</small></li>
        ${options.modules.map(
          (definition, index) => html`
            <li>
              <button type="button" class="button ghost" data-index="${index}">${definition.name}</button>
            </li>
          `,
        )}
      </menu>
    </div>
    ${options.matrix === false ? '' : html`<div class="matrices"></div>`}
  </section>
`

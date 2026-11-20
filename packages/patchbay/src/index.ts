import type { Core } from '@loop/core'
import { mountView, uiStyles } from '@loop/ui'
import type { PatchbayOptions } from './patchbay'
import { script } from './script'
import { styles } from './styles'
import { template } from './template'

export type { PatchbayOptions, RemoveMode } from './patchbay'

/**
 * The patchbay: where the studio is wired. Add a module, remove modules (remove mode), and
 * connect the jacks in a matrix: a grid of checkboxes, an output per row, an input per column.
 *
 * It works on the core directly (core.add, core.connect, ...), like a module. But it is not in
 * the core: a project is the modules in the core, so the patchbay would be saved in every
 * project, gone when one opens, and could remove itself. The app shows it outside the rack.
 *
 *   mountPatchbay(document.querySelector('#patchbay')!, core, { modules, colorOf, rack })
 */
export function mountPatchbay(
  parent: Element,
  core: Core,
  options: PatchbayOptions,
): () => void {
  return mountView(parent, {
    label: 'Patchbay',
    // The shared UI library first, then the module's own CSS (which can override it).
    styles: [uiStyles, styles],
    template: template(options),
    script: (root, signal) => script(root, signal, core, options),
  })
}

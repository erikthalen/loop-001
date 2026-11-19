import { mountView } from '@loop/core'
import { uiStyles } from '@loop/ui'
import type { Library } from './library'
import { script } from './script'
import { styles } from './styles'
import { template } from './template'

export type { Library, SaveStatus, Tape } from './library'

/**
 * The library: the shelf with your tapes (projects). Name the tape on the machine, put another
 * one on, start a new one, erase one, or take one out of (or into) the studio as a file.
 *
 * It looks like the other modules (a display, @loop/ui), but it is not one: a project is the
 * modules in the core, and the library holds the projects, so it cannot be inside one. The app
 * shows it outside the rack, and does the work behind it (see `Library`).
 *
 *   const unmount = mountLibrary(document.querySelector('#library')!, library)
 */
export function mountLibrary(parent: Element, library: Library): () => void {
  return mountView(parent, {
    label: 'Library',
    // The shared UI library first, then the module's own CSS (which can override it).
    styles: [uiStyles, styles],
    template: template(library),
    script: (root, signal) => script(root, signal, library),
  })
}

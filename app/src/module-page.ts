// Page script for the module guide (/modules/<type>, see app.ts). It shows one module, alone.
// Nothing here is saved: this page does not touch the projects.
// An audio module has no cables here, so it makes no sound. Open the studio to hear it.
import { createCore } from '@loop/core'
import { mountLibrary } from '@loop/library'
import { mountPatchbay, type RemoveMode } from '@loop/patchbay'
import { restoreProject } from '@loop/project'
import { addLoopFont, mountModule } from '@loop/ui'
import { createDemoLibrary } from './demo-library'
import { availableModules, CABLE_COLORS, newProject } from './modules'
import { watchForUpdates } from './updates'

addLoopFont()

// A new version: reload at once (this page saves nothing). See updates.ts.
watchForUpdates()

const element = document.querySelector<HTMLElement>('#module')
const type = element?.dataset.type

if (element && type === 'library') {
  // Made-up tapes, in memory only (demo-library.ts).
  mountLibrary(element, createDemoLibrary())
} else if (element && type === 'patchbay') {
  // The modules of a new project, with their cables, so the matrix has something to show.
  // The modules are not shown (there is no rack here) and make no sound (nothing plays).
  const core = createCore()
  restoreProject(core, newProject, availableModules)
  mountPatchbay(element, core, {
    modules: availableModules,
    colorOf: (module) => CABLE_COLORS[module.type] ?? 'var(--ink)',
    rack: createRemoveModeDemo(),
  })
} else if (element) {
  const definition = availableModules.find(
    (definition) => definition.type === type,
  )
  if (definition) {
    const core = createCore()
    mountModule(core, core.add(definition), element)
  }
}

/**
 * Remove mode without a rack: the button turns on and off, but there are no modules to click.
 * (In the studio, the rack makes a click on a module remove it, see rack.ts.)
 */
function createRemoveModeDemo(): RemoveMode {
  let removing = false
  const changes = new EventTarget()
  return {
    get removing() {
      return removing
    },
    setRemoving(value) {
      removing = value
      changes.dispatchEvent(new Event('change'))
    },
    onChange: (listener, options) =>
      changes.addEventListener('change', listener, options),
  }
}

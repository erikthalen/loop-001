// Page script. All audio runs here, on the page (not in the service worker).
import { createCore } from '@loop/core'
import { mountLibrary } from '@loop/library'
import { mountPatchbay } from '@loop/patchbay'
import { createProjectSession, openProjectStore } from '@loop/project'
import { addLoopFont } from '@loop/ui'
import { createLibrary } from './library'
import {
  availableModules,
  CABLE_COLORS,
  newProject,
  upgradeProject,
} from './modules'
import { createRack } from './rack'
import { watchForUpdates } from './updates'

// The app's font, Italian Plate No1 Mono (all weights, from @loop/ui). Before anything shows text.
addLoopFont()

const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!

// The audio context starts "suspended". Browsers only allow sound after a user action,
// so core.start() (on the Play click) wakes it up.
// The tempo is set in the metronome module (and saved with the project).
const core = createCore()

// ---- Modules: the rack shows what is in the core, the patchbay adds, removes and connects them ----
// The cables are in the patchbay's matrix, in the color of the module they come out of.
const colorOf = (module: { type: string }) =>
  CABLE_COLORS[module.type] ?? 'var(--ink)'
const rack = createRack(core, $('#rack'))
mountPatchbay($('#patchbay'), core, {
  modules: availableModules,
  colorOf,
  rack,
  onAdd: keepStorage,
  transition: rack.transition,
})

// ---- Transport ----
// Play and stop are in the Master module (packages/master). Space does the same as its play
// checkbox, from anywhere on the page.
// But not when the focus is on a control: there, Space has its own job (it clicks a button,
// checks a box, picks a radio, types a space, or grabs a module's drag handle).
const SPACE_CONTROLS =
  'input, textarea, select, button, a[href], summary, [contenteditable], ' +
  '[role="button"], [role="checkbox"], [role="radio"], [role="slider"], [role="switch"], ' +
  '[role="menuitem"], [role="option"], [role="tab"], [role="textbox"], [role="combobox"]'
document.addEventListener('keydown', (event) => {
  if (event.key !== ' ' || event.repeat || event.defaultPrevented) return
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  // The element with the focus, also inside a module's Shadow DOM (event.target is its host).
  const target = event.composedPath()[0]
  if (target instanceof Element && target.closest(SPACE_CONTROLS)) return
  event.preventDefault() // Space would scroll the page.
  if (core.playing && !core.stopping) core.stop()
  else
    core
      .start()
      .catch((error) => console.error('Could not start playback:', error))
})

// ---- Projects: saved in this browser (IndexedDB), local first ----
// The library module shows them (the tapes on the shelf); the session keeps them (see library.ts).
const store = await openProjectStore()
const session = createProjectSession({
  core,
  store,
  definitions: availableModules,
  newProject,
  upgrade: upgradeProject,
})
await session.start()
mountLibrary($('#library'), createLibrary(session))

// ---- Loading: show the modules in place of their silhouettes (see skeleton.ts) ----
// Wait for the fonts first (at most a moment), so the text does not change font after it shows.
await Promise.race([
  document.fonts.ready,
  new Promise((resolve) => setTimeout(resolve, 1500)),
])
$('#patch').dataset.ready = ''

// ---- New versions (see updates.ts and sw.ts) ----
// The page reloads to show a new version. Not while the music plays or rewinds, and only after
// the project is saved.
watchForUpdates({
  async whenSafe() {
    while (core.playing || core.rewinding)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    await session.flush()
    // A save that started before can still run: wait for it.
    while (session.status === 'saving')
      await new Promise((resolve) => setTimeout(resolve, 100))
    if (session.status === 'error') throw new Error('The project is not saved.')
  },
})

/**
 * Local first means the data only lives in this browser.
 * Ask the browser to keep it, even when the disk is almost full.
 * Asked once, on a user action, because some browsers show a question.
 */
let storageAsked = false
function keepStorage() {
  if (storageAsked) return
  storageAsked = true
  navigator.storage?.persist?.().catch(() => {})
}

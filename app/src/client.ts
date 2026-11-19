// Page script. All audio runs here, on the page (not in the service worker).
import { createCore } from '@loop/core'
import { mountLibrary } from '@loop/library'
import { mountPatchbay } from '@loop/patchbay'
import { addLoopFont } from '@loop/ui'
import { createLibrary } from './library'
import {
  availableModules,
  CABLE_COLORS,
  newProject,
  upgradeProject,
} from './modules'
import { createPatchLane } from './patch-lane'
import { createProjectSession } from './project-session'
import { openProjectStore } from './project-store'
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
// Two ways to see the cables, to try side by side: the matrix in the patchbay (default), or the
// cable lane left of the rack (?lane in the URL; then the patchbay has no matrix).
const colorOf = (module: { type: string }) =>
  CABLE_COLORS[module.type] ?? 'var(--ink)'
const useLane = new URLSearchParams(location.search).has('lane')
const lane = useLane
  ? createPatchLane(core, { root: $('#patch'), colorOf })
  : null
const rack = createRack(core, $('#rack'), {
  onSlot: (slot, module) => lane && slot.prepend(lane.jackStrip(module)),
})
mountPatchbay($('#patchbay'), core, {
  modules: availableModules,
  colorOf,
  rack,
  matrix: !useLane,
  onAdd: keepStorage,
  transition: rack.transition,
})

// ---- Transport ----
// Play and stop are in the Master module (packages/master).

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

// Page script. All audio runs here, on the page (not in the service worker).
import { createCore } from '@loop/core'
import { addLoopFont } from '@loop/ui'
import { createModulePicker } from './module-picker'
import { availableModules, newProject } from './modules'
import { connectProjectMenu } from './project-menu'
import { createProjectSession } from './project-session'
import { openProjectStore } from './project-store'
import { createRack } from './rack'

// The app's font, Italian Plate No1 Mono (all weights, from @loop/ui). Before anything shows text.
addLoopFont()

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!

const removeButton = $<HTMLButtonElement>('#remove')
const picker = $('#module-picker')

// The audio context starts "suspended". Browsers only allow sound after a user action,
// so core.start() (on the Play click) wakes it up.
// The tempo is set in the metronome module (and saved with the project).
const core = createCore()

// ---- Modules: the rack shows what is in the core ----
const rack = createRack(core, $('#rack'), {
  onChange: ({ removing }) => {
    removeButton.disabled = core.modules.size === 0
    removeButton.setAttribute('aria-pressed', String(removing))
    removeButton.textContent = removing ? 'Done' : 'Remove'
  },
})

createModulePicker({
  popover: picker,
  list: $('#module-list'),
  modules: availableModules,
  onPick: (definition) => {
    core.add(definition)
    keepStorage()
  },
})

removeButton.addEventListener('click', () => rack.setRemoving(!rack.removing))

// Leave remove mode when the module list opens, or when the user presses Escape.
picker.addEventListener('beforetoggle', (event) => {
  if ((event as ToggleEvent).newState === 'open') rack.setRemoving(false)
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && rack.removing) rack.setRemoving(false)
})

// ---- Transport ----
// Play and stop are in the Master module (packages/master).

// ---- Projects: saved in this browser (IndexedDB), local first ----
const store = await openProjectStore()
let menu: ReturnType<typeof connectProjectMenu> | undefined
const session = createProjectSession({
  core,
  store,
  definitions: availableModules,
  newProject,
  onChange: () => menu?.update(),
})
menu = connectProjectMenu(session, {
  menu: $('#project-menu'),
  list: $('#project-list'),
  nameInput: $<HTMLInputElement>('#project-name'),
  status: $('#save-status'),
  newButton: $<HTMLButtonElement>('#project-new'),
  importButton: $<HTMLButtonElement>('#project-import'),
  exportButton: $<HTMLButtonElement>('#project-export'),
  fileInput: $<HTMLInputElement>('#project-file'),
})
await session.start()

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

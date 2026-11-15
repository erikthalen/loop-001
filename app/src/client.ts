// Page script. All audio runs here, on the page (not in the service worker).
import { createCore } from '@loop/core'
import { createModulePicker } from './module-picker'
import { availableModules, newProject } from './modules'
import { connectProjectMenu } from './project-menu'
import { createProjectSession } from './project-session'
import { openProjectStore } from './project-store'
import { createRack } from './rack'

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!

const playToggle = $<HTMLInputElement>('#play')
const bpmInput = $<HTMLInputElement>('#bpm')
const bpmValue = $<HTMLOutputElement>('#bpm-value')
const removeButton = $<HTMLButtonElement>('#remove')
const picker = $('#module-picker')

// The audio context starts "suspended". Browsers only allow sound after a user action,
// so core.start() (on the Play click) wakes it up.
const core = createCore({ bpm: readBpm() })

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
// Keep the controls in sync with the core (also when a project loads).
const showBpm = (bpm: number) => {
  bpmInput.value = String(bpm)
  bpmValue.value = String(bpm)
}
showBpm(core.bpm)
core.events.on('bpmchange', ({ bpm }) => showBpm(bpm))
core.events.on('start', () => (playToggle.checked = true))
core.events.on('stop', () => (playToggle.checked = false))

function readBpm(): number {
  const value = bpmInput.valueAsNumber
  return Number.isFinite(value) ? Math.min(300, Math.max(20, value)) : 120
}

// Play is a checkbox: checked = playing.
playToggle.addEventListener('change', async () => {
  if (playToggle.checked) {
    try {
      await core.start()
    } catch (error) {
      console.error('Could not start playback:', error)
    }
  } else {
    core.stop()
  }
  playToggle.checked = core.playing
})

// The tempo changes live while you drag.
bpmInput.addEventListener('input', () => core.setBpm(readBpm()))

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

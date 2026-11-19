import { render } from '@loop/core'
import type { Library } from './library'
import { tapes } from './template'

const STATUS_TEXT = { saved: 'saved', saving: 'saving…', error: 'not saved!' } as const

// JS: connect the HTML to the library (the app). Everything is removed for us on unmount.
export function script(root: ShadowRoot, signal: AbortSignal, library: Library): void {
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!
  const name = $<HTMLInputElement>('[name=name]')
  const status = $<HTMLOutputElement>('[name=status]')
  const shelf = $<HTMLElement>('.tapes')
  const file = $<HTMLInputElement>('[name=file]')
  const listen = { signal }

  // ——— Show the library ———
  /** What the shelf shows now, so it is only made again when that changes. */
  let shown = ''
  /** Only the newest list goes on the shelf (lists come back from the app in any order). */
  let asked = 0
  async function showShelf() {
    const ask = ++asked
    const list = await library.list()
    if (ask !== asked || signal.aborted) return
    const current = library.current.id
    const key = JSON.stringify([current, list.map((tape) => [tape.id, tape.name, tape.updatedAt])])
    if (key === shown) return
    shown = key
    // Making the shelf again loses the focus: put it back on the same tape (or its erase button).
    const focused = root.activeElement as HTMLElement | null
    const again = focused && shelf.contains(focused) ? (focused.dataset.erase ?? (focused as HTMLInputElement).value) : null
    render(tapes(list, current), shelf)
    if (again) shelf.querySelector<HTMLElement>(`[data-erase="${again}"], [value="${again}"]`)?.focus()
  }

  function update() {
    // Not while you type: the name you are writing stays.
    if (root.activeElement !== name) name.value = library.current.name
    status.value = STATUS_TEXT[library.status]
    status.dataset.status = library.status
    void showShelf()
  }

  library.onChange(update, listen)

  // ——— What you do ———
  // A new name: written on the tape when you press Enter or leave the field.
  name.addEventListener('change', () => library.rename(name.value), listen)

  // A tape: on the machine.
  shelf.addEventListener(
    'change',
    (event) => {
      const radio = event.target as HTMLInputElement
      if (radio.name === 'tape') void library.open(radio.value)
    },
    listen,
  )

  // Erase: only after "erase" in the dialog.
  const askErase = $<HTMLDialogElement>('.ask-erase')
  shelf.addEventListener(
    'click',
    async (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-erase]')
      if (!button) return
      $('.erase-name').textContent = button.getAttribute('aria-label')!.replace(/^Erase /, '')
      if ((await answer(askErase)) === 'erase') await library.erase(button.dataset.erase!)
    },
    listen,
  )

  $('[name=new]').addEventListener(
    'click',
    async () => {
      await library.create()
      // A new tape: give it a name right away.
      name.focus()
      name.select()
    },
    listen,
  )

  $('[name=export]').addEventListener('click', () => download(library.exportFile()), listen)

  $('[name=import]').addEventListener('click', () => file.click(), listen)
  file.addEventListener(
    'change',
    async () => {
      const picked = file.files?.[0]
      file.value = '' // so the same file can be picked again
      if (!picked) return
      try {
        await library.importFile(picked)
      } catch (error) {
        $('.problem-text').textContent = error instanceof Error ? error.message : String(error)
        void answer($<HTMLDialogElement>('.problem'))
      }
    },
    listen,
  )

  update()
}

/**
 * Open a dialog (modal), and wait until it closes. Gives the value of the button that closed it
 * (its form is method="dialog"), or '' when it was closed another way (Esc).
 */
function answer(dialog: HTMLDialogElement): Promise<string> {
  dialog.returnValue = ''
  dialog.showModal()
  return new Promise((resolve) => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }))
}

/** Let the browser download a file (native: a temporary link with `download`). */
function download(file: File): void {
  const url = URL.createObjectURL(file)
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

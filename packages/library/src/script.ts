import { CHANNEL_COLORS, render } from '@loop/ui'
import {
  CASSETTE_FONTS,
  type CassetteColors,
  designCassette,
  drawCassette,
} from './cassette'
import type { Library, Tape } from './library'
import { SHELF_TAPE_WIDTH } from './styles'
import { captions, tapes } from './template'

const STATUS_TEXT = {
  saved: 'saved',
  saving: 'saving…',
  error: 'not saved!',
} as const

// JS: connect the HTML to the library (the app). Everything is removed for us on unmount.
// The shelf is a row of cassettes that scrolls sideways (the stack effect is CSS, see styles.ts).
// The tape in the middle is "picked": its caption (name, date, remove) slides to the middle under it.
// Scrolling only picks. Opening a tape is a separate step (click the picked tape, or Enter),
// because it changes the whole studio.
export function script(
  root: ShadowRoot,
  signal: AbortSignal,
  library: Library,
): void {
  const $ = <T extends Element>(selector: string) =>
    root.querySelector<T>(selector)!
  const display = $<HTMLElement>('.display')
  const name = $<HTMLInputElement>('[name=name]')
  const status = $<HTMLOutputElement>('[name=status]')
  /** The row that scrolls, and the list of tapes in it. */
  const shelf = $<HTMLElement>('.tapes')
  const track = $<HTMLElement>('.track')
  /** The captions, one per tape: they slide along with the tapes (CSS, see styles.ts). */
  const captionTrack = $<HTMLElement>('.caption-track')
  const file = $<HTMLInputElement>('[name=file]')
  const listen = { signal }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

  // ——— The cassettes ———
  // The canvas cannot use CSS variables, so read the colors from the CSS.
  // A hidden element turns any CSS color (also light-dark()) into rgb().
  const probe = document.createElement('span')
  probe.hidden = true
  display.append(probe)
  const resolve = (color: string) => {
    probe.style.color = color
    return getComputedStyle(probe).color
  }
  let colors: CassetteColors
  const readColors = () => {
    colors = {
      screen: resolve('var(--screen)'),
      ink: resolve('var(--ink)'),
      muted: resolve('var(--muted)'),
      line: resolve('var(--line)'),
      dim: resolve('var(--dim)'),
      plastic: resolve('var(--color-neutral-0-light)'),
      plasticDim: resolve('var(--color-neutral-300-light)'),
      plasticLine: resolve('var(--color-neutral-400-light)'),
      plasticInk: resolve('var(--color-neutral-1000-light)'),
      hole: resolve('var(--color-neutral-1000-light)'),
      hub: resolve('var(--color-neutral-0-light)'),
      pack: resolve('var(--color-neutral-800-light)'),
      packLine: resolve('var(--color-neutral-600-light)'),
      accents: CHANNEL_COLORS.map(resolve),
      font: getComputedStyle(display).fontFamily,
    }
  }
  readColors()

  /** The tapes on the shelf now, in its order. */
  let list: readonly Tape[] = []
  const items = () => [...track.querySelectorAll<HTMLLIElement>('li')]
  const itemOf = (id: string | null) =>
    items().find((li) => li.dataset.id === id)
  const tapeOf = (id: string | null) => list.find((tape) => tape.id === id)

  const drawAll = () => {
    for (const li of items()) {
      const tape = tapeOf(li.dataset.id!)
      const canvas = li.querySelector('canvas')
      if (!tape || !canvas) continue
      const design = designCassette(tape.id, colors.accents.length)
      drawCassette(canvas, design, tape.name, colors, SHELF_TAPE_WIDTH)
    }
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener(
    'change',
    () => {
      readColors()
      drawAll()
    },
    listen,
  )
  // A canvas does not wait for a font, and the browser downloads a weight only when something
  // uses it. So load the weights the cassettes use, then draw them again.
  Promise.all(
    CASSETTE_FONTS.map((font) => document.fonts.load(`${font} ${colors.font}`)),
  )
    .then(() => signal.aborted || drawAll())
    .catch((error) => console.error('The library font did not load:', error))

  // ——— The picked tape: the one in the middle ———
  let picked: string | null = null

  /** Scroll a tape to the middle of the shelf. */
  const center = (li: HTMLElement, smooth: boolean) =>
    shelf.scrollTo({
      left: li.offsetLeft + li.offsetWidth / 2 - shelf.clientWidth / 2,
      behavior: smooth && !reducedMotion.matches ? 'smooth' : 'instant',
    })

  /** The tape nearest to the middle of the shelf. */
  const middle = () => {
    const box = shelf.getBoundingClientRect()
    const mid = box.left + box.width / 2
    let best: HTMLLIElement | undefined
    let distance = Infinity
    for (const li of items()) {
      const r = li.getBoundingClientRect()
      const d = Math.abs(r.left + r.width / 2 - mid)
      if (d < distance) {
        distance = d
        best = li
      }
    }
    return best
  }

  /**
   * Pick a tape: make it the one Tab goes to. Only its caption can be used: the others are inert
   * (no clicks, no Tab, not read), because they are off to the side.
   */
  const pick = (id: string | null) => {
    picked = id
    for (const li of items()) {
      li.querySelector('button')!.tabIndex = li.dataset.id === id ? 0 : -1
    }
    for (const caption of captionTrack.children as HTMLCollectionOf<HTMLElement>) {
      const on = caption.dataset.id === id
      caption.inert = !on
      caption.toggleAttribute('data-picked', on)
    }
  }

  // Scrolling picks the tape that comes to the middle (once per frame).
  let frame = 0
  shelf.addEventListener(
    'scroll',
    () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0
        const li = middle()
        if (li && li.dataset.id !== picked) pick(li.dataset.id!)
      })
    },
    listen,
  )
  signal.addEventListener('abort', () => cancelAnimationFrame(frame))

  // ——— Show the library ———
  /** What the shelf shows now, so it is only made again when that changes. */
  let shown = ''
  /** The tape that was on the machine at the last update: when it changes, go to the new one. */
  let lastCurrent: string | null = null
  /** Only the newest list goes on the shelf (lists come back from the app in any order). */
  let asked = 0
  async function showShelf() {
    const ask = ++asked
    const next = await library.list()
    if (ask !== asked || signal.aborted) return
    const current = library.current.id
    const key = JSON.stringify([
      current,
      next.map((tape) => [tape.id, tape.name, tape.updatedAt]),
    ])
    if (key === shown) return
    shown = key
    // Making the shelf again loses the focus: put it back on the picked tape.
    const hadFocus = shelf.contains(root.activeElement)
    list = next
    render(tapes(list, current), track)
    render(captions(list), captionTrack)
    drawAll()
    // Another tape on the machine (opened, new, imported): go to it. Else stay on the picked one.
    const target = current !== lastCurrent || !tapeOf(picked) ? current : picked
    lastCurrent = current
    const li = itemOf(target)
    if (li) center(li, false)
    pick(li ? target : null)
    if (hadFocus) li?.querySelector('button')?.focus({ preventScroll: true })
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

  /** Put a tape on the machine (unless it is on already). */
  const open = (id: string | null) => {
    if (id && id !== library.current.id) void library.open(id)
  }

  // A click on a tape: the picked one goes on the machine. Another one comes to the middle first.
  shelf.addEventListener(
    'click',
    (event) => {
      const li = (event.target as Element).closest<HTMLLIElement>('li')
      if (!li) return
      if (li.dataset.id === picked) open(picked)
      else {
        center(li, true)
        pick(li.dataset.id!)
        // A mouse click: no focus ring (the keyboard still gets one).
        li.querySelector('button')!.focus({
          preventScroll: true,
          focusVisible: false,
        })
      }
    },
    listen,
  )

  // The arrow keys pick the tape next to it (Home and End: the first and the last).
  shelf.addEventListener(
    'keydown',
    (event) => {
      const all = items()
      const at = all.findIndex((li) => li.dataset.id === picked)
      const moves: Record<string, number> = {
        ArrowLeft: at - 1,
        ArrowRight: at + 1,
        Home: 0,
        End: all.length - 1,
      }
      const li = all[moves[event.key] ?? -1]
      if (!li) return
      event.preventDefault()
      center(li, true)
      pick(li.dataset.id!)
      li.querySelector('button')!.focus({ preventScroll: true })
    },
    listen,
  )

  // The captions: remove (only after "remove" in the dialog).
  const askErase = $<HTMLDialogElement>('.ask-erase')
  captionTrack.addEventListener(
    'click',
    async (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        '[data-erase]',
      )
      const tape = tapeOf(button?.dataset.erase ?? null)
      if (!tape) return
      $('.erase-name').textContent = tape.name
      if ((await answer(askErase)) === 'erase') await library.erase(tape.id)
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

  $('[name=export]').addEventListener(
    'click',
    () => download(library.exportFile()),
    listen,
  )

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
        $('.problem-text').textContent =
          error instanceof Error ? error.message : String(error)
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
  return new Promise((resolve) =>
    dialog.addEventListener('close', () => resolve(dialog.returnValue), {
      once: true,
    }),
  )
}

/** Let the browser download a file (native: a temporary link with `download`). */
function download(file: File): void {
  const url = URL.createObjectURL(file)
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: file.name,
  })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

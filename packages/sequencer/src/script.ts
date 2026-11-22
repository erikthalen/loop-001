import type { Core, ScopedOn } from '@loop/core'
import { CHANNELS, type Pattern, type Sequencer, STEPS } from './sequencer'

/**
 * The copied pattern, for paste. One for the whole page: copy in the sampler, paste in the drum
 * machine. Not saved. `clipboardChange` tells every sequencer on the page when it changes.
 */
let clipboard: Pattern | null = null
const clipboardChange = new EventTarget()

export interface SequencerScriptContext {
  /** The sequencer's screen (`.sequencer`, see template.ts). */
  readonly section: HTMLElement
  readonly sequencer: Pick<
    Sequencer,
    | 'pattern'
    | 'page'
    | 'playingPage'
    | 'setPage'
    | 'setPattern'
    | 'hasSteps'
    | 'setStep'
  >
  readonly core: Core
  /** Listen to a core event, until the UI is unmounted. */
  readonly on: ScopedOn
  /** Aborts when the UI is unmounted. */
  readonly signal: AbortSignal
}

// JS: connect the sequencer's HTML to it. The module's script calls this. Everything is removed
// for us on unmount.
export function connectSequencer({
  section,
  sequencer,
  core,
  on,
  signal,
}: SequencerScriptContext): void {
  const grid = section.querySelector<HTMLElement>('.grid')!
  const boxes = [
    ...grid.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ]
  const boxAt = (row: number, step: number) => boxes[row * STEPS + step]
  const pages = [
    ...section.querySelectorAll<HTMLInputElement>('input[name="page"]'),
  ]
  const copy = section.querySelector<HTMLButtonElement>('.copy')!
  const paste = section.querySelector<HTMLButtonElement>('.paste')!

  // The pattern that plays, as far as you can hear: the sequencer switches a little early (the
  // clock schedules ahead), so this follows at the real start of the bar (see `on('step')`).
  let heard = sequencer.playingPage

  /**
   * The pattern buttons: which one is picked, which one plays, and which patterns have no steps.
   * A picked pattern that waits for the next bar blinks. The one that still plays has its color.
   */
  const showPages = () => {
    pages.forEach((radio, i) => {
      const empty = !sequencer.hasSteps(i)
      const label = radio.closest('label')!
      const waiting = i === sequencer.page && i !== heard
      radio.checked = i === sequencer.page
      label.classList.toggle('empty', empty)
      label.classList.toggle('waiting', waiting)
      label.classList.toggle('playing', i === heard && i !== sequencer.page)
      radio.setAttribute(
        'aria-label',
        `Pattern ${i + 1}${empty ? ', empty' : ''}${waiting ? ', starts at the next bar' : ''}`,
      )
    })
    copy.setAttribute('aria-label', `Copy pattern ${sequencer.page + 1}`)
    paste.setAttribute('aria-label', `Paste into pattern ${sequencer.page + 1}`)
    paste.disabled = !clipboard
  }

  /** The grid shows the picked pattern. */
  const showPattern = () => {
    const { pattern } = sequencer
    for (let row = 0; row < CHANNELS; row++)
      for (let step = 0; step < STEPS; step++) {
        const box = boxAt(row, step)
        if (box) box.checked = !!pattern[row]?.[step]
      }
  }
  showPages()

  for (const radio of pages)
    radio.addEventListener(
      'change',
      () => {
        sequencer.setPage(Number(radio.value))
        // It plays at once (the transport is at the start of a bar): no need to wait for the bar.
        if (sequencer.playingPage === sequencer.page)
          heard = sequencer.playingPage
        showPattern()
        showPages()
      },
      { signal },
    )

  copy.addEventListener(
    'click',
    () => {
      clipboard = sequencer.pattern.map((row) => [...row])
      clipboardChange.dispatchEvent(new Event('change'))
    },
    { signal },
  )
  paste.addEventListener(
    'click',
    () => {
      if (!clipboard) return
      sequencer.setPattern(clipboard)
      showPattern()
      showPages()
    },
    { signal },
  )
  // A copy in any sequencer on the page: paste works here too.
  clipboardChange.addEventListener('change', showPages, { signal })

  // One listener for all 96 checkboxes.
  grid.addEventListener(
    'change',
    (event) => {
      const box = event.target as HTMLInputElement
      sequencer.setStep(
        Number(box.dataset.channel),
        Number(box.dataset.step),
        box.checked,
      )
      showPages()
    },
    { signal },
  )

  // Arrow keys move between the checkboxes, like in a table. Space turns one on or off.
  grid.addEventListener(
    'keydown',
    (event) => {
      const box = event.target as HTMLInputElement
      const moves: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      }
      const move = moves[event.key]
      if (!move) return
      event.preventDefault()
      const row = (Number(box.dataset.channel) + move[0] + CHANNELS) % CHANNELS
      const step = (Number(box.dataset.step) + move[1] + STEPS) % STEPS
      boxAt(row, step)?.focus()
    },
    { signal },
  )

  // The playing step: its column of checkboxes gets the class "now".
  let shown = -1
  const progress = section.querySelector<HTMLProgressElement>('.steps')!
  const showStep = (step: number) => {
    if (step === shown) return
    // For screen readers: the step that plays (or played last), not the bar's fine position.
    progress.setAttribute(
      'aria-valuetext',
      step >= 0 ? `Step ${step + 1} of ${STEPS}` : 'Start',
    )
    for (let row = 0; row < CHANNELS; row++) {
      if (shown >= 0) boxAt(row, shown)?.classList.remove('now')
      if (step >= 0) boxAt(row, step)?.classList.add('now')
    }
    shown = step
  }

  // The step the transport is on, from the next step it plays: the one before it (none at the start).
  // It keeps its place when the core stops, so the progress bar does too.
  const stepBefore = (next: number) => (next > 0 ? (next - 1) % STEPS : -1)
  showStep(stepBefore(core.clock.step))

  // Events arrive early (the clock schedules ahead), so wait until the transport really gets there.
  const at = (time: number, show: () => void) => {
    const delay = Math.max(0, (time - core.context.currentTime) * 1000)
    setTimeout(() => signal.aborted || show(), delay)
  }
  on('step', ({ step, time }) =>
    at(time, () => {
      showStep(step % STEPS)
      // A new bar: the picked pattern plays now.
      if (step % STEPS === 0 && heard !== sequencer.playingPage) {
        heard = sequencer.playingPage
        showPages()
      }
    }),
  )
  // Rewind: the transport goes back past the steps, so the progress bar goes back too. A rewind ends
  // exactly at the first step of the sequence: then the bar is empty, like at the start.
  on('rewindstep', ({ step, time }) =>
    at(time, () => showStep(step % STEPS === 0 ? -1 : stepBefore(step))),
  )

  // The progress bar slides with the transport: each frame, where it really is in the bar (with
  // the speed ramps, and backwards while it rewinds). Empty at the first step, full at the end of
  // the last one. When the transport stands still, the bar does too.
  let frame = 0
  const slide = () => {
    const steps = Math.max(0, core.clock.stepsAt(core.context.currentTime))
    // How far into the bar. The clock's position is a sum of speed ramps, so it can come out a
    // hair under a bar line where it should be exactly on it (for example at the end of a rewind:
    // 15.9999999 instead of 16). That counts as the bar line: empty, not full for a frame.
    let inBar = steps % STEPS
    if (STEPS - inBar < 1e-6) inBar = 0
    const value = (inBar / STEPS) * progress.max
    if (value !== progress.value) progress.value = value
    frame = requestAnimationFrame(slide)
  }
  slide()
  signal.addEventListener('abort', () => cancelAnimationFrame(frame))
}

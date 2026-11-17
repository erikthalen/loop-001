import { defineModuleScript } from '@loop/core'
import { CHANNELS, STEPS, type setup } from './setup'

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(({ root, module, core, on, signal }) => {
  const grid = root.querySelector<HTMLElement>('.grid')!
  const boxes = [...grid.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
  const boxAt = (row: number, step: number) => boxes[row * STEPS + step]

  // One listener for all 96 checkboxes.
  grid.addEventListener('change', (event) => {
    const box = event.target as HTMLInputElement
    module.setStep(Number(box.dataset.channel), Number(box.dataset.step), box.checked)
  }, { signal })

  // Arrow keys move between the checkboxes, like in a table. Space turns one on or off.
  grid.addEventListener('keydown', (event) => {
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
  }, { signal })

  // The playing step: its column of checkboxes gets the class "now".
  let shown = -1
  const progress = root.querySelector<HTMLProgressElement>('.steps')!
  const showStep = (step: number) => {
    if (step === shown) return
    // The progress bar: the step that plays (or played last), 1 to 16. At the start of the tape: 0.
    progress.value = step + 1
    for (let row = 0; row < CHANNELS; row++) {
      if (shown >= 0) boxAt(row, shown)?.classList.remove('now')
      if (step >= 0) boxAt(row, step)?.classList.add('now')
    }
    shown = step
  }

  // The step the tape is on, from the next step it plays: the one before it (none at the start).
  // It keeps its place when the core stops, so the progress bar does too.
  const stepBefore = (next: number) => (next > 0 ? (next - 1) % STEPS : -1)
  showStep(stepBefore(core.clock.step))

  // Events arrive early (the clock schedules ahead), so wait until the tape really gets there.
  const at = (time: number, show: () => void) => {
    const delay = Math.max(0, (time - core.context.currentTime) * 1000)
    setTimeout(() => signal.aborted || show(), delay)
  }
  on('step', ({ step, time }) => at(time, () => showStep(step % STEPS)))
  // Rewind: the tape goes back past the steps, so the progress bar goes back too. A rewind ends
  // exactly at the first step of the sequence: then the bar is empty, like at the start.
  on('rewindstep', ({ step, time }) => at(time, () => showStep(step % STEPS === 0 ? -1 : stepBefore(step))))
})

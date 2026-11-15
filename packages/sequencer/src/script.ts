import { defineModuleScript } from '@loop/core'
import { CHANNELS, STEPS, type setup } from './setup'

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(({ root, module, core, on, signal }) => {
  const grid = root.querySelector<HTMLElement>('.grid')!
  const boxes = [...grid.querySelectorAll<HTMLInputElement>('.checkbox')]
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
  const showStep = (step: number) => {
    if (step === shown) return
    for (let row = 0; row < CHANNELS; row++) {
      if (shown >= 0) boxAt(row, shown)?.classList.remove('now')
      if (step >= 0) boxAt(row, step)?.classList.add('now')
    }
    shown = step
  }

  // Step events arrive early (the clock schedules ahead), so wait until the step really plays.
  on('step', ({ step, time }) => {
    const delay = Math.max(0, (time - core.context.currentTime) * 1000)
    setTimeout(() => core.playing && !signal.aborted && showStep(step % STEPS), delay)
  })
  on('stop', () => showStep(-1))
})

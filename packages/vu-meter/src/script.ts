import { defineModuleScript } from '@loop/core'
import { addMatrixFont, MATRIX_FONT } from '@loop/ui'
import { createMeter, type MeterColors } from './meter'
import type { setup } from './setup'

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(({ root, module, signal }) => {
  addMatrixFont()

  const display = root.querySelector<HTMLElement>('.display')!
  const canvases = [...root.querySelectorAll<HTMLCanvasElement>('.meter')]

  // The canvas cannot use CSS variables, so read the colors from styles.ts.
  // A hidden element turns any CSS color (also light-dark()) into rgb().
  // Read them again when the page switches between light and dark mode.
  const probe = document.createElement('span')
  probe.hidden = true
  display.append(probe)
  const resolve = (color: string) => {
    probe.style.color = color
    return getComputedStyle(probe).color
  }
  let colors: MeterColors
  const readColors = () => {
    colors = {
      faceLight: resolve('var(--face-light)'),
      faceDark: resolve('var(--face-dark)'),
      ink: resolve('var(--ink)'),
      soft: resolve('var(--soft)'),
      ghost: resolve('var(--ghost)'),
      red: resolve('var(--red)'),
      lampOff: resolve('var(--lamp-off)'),
      dome: resolve('var(--dome)'),
      font: `'${MATRIX_FONT}', ${getComputedStyle(display).fontFamily}`,
    }
  }
  readColors()
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors, { signal })

  const meters = canvases.map((canvas, i) => createMeter(canvas, i === 0 ? 'L' : 'R', () => colors))

  // About 60 times a second, while the UI is mounted: read the levels, move the needles, draw.
  let frame = 0
  let last = 0
  const draw = (now: number) => {
    const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
    last = now
    const levels = module.levels()
    meters.forEach((meter, i) => meter.update(levels[i]!, seconds))
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  signal.addEventListener('abort', () => cancelAnimationFrame(frame))
})

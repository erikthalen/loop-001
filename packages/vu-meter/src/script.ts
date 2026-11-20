import { defineModuleScript } from '@loop/ui'
import { createMeter, type MeterColors } from './meter'
import type { setup } from './setup'

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(
  ({ root, module, signal }) => {
    const display = root.querySelector<HTMLElement>('.display')!
    const canvas = root.querySelector<HTMLCanvasElement>('.picture')!
    const levels = [...root.querySelectorAll<HTMLMeterElement>('.levels meter')]

    // The canvas cannot use CSS variables, so read the colors from the CSS.
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
        screen: resolve('var(--screen)'),
        ink: resolve('var(--ink)'),
        dim: resolve('var(--dim)'),
        muted: resolve('var(--muted)'),
        red: resolve('var(--red)'),
        orange: resolve('var(--orange)'),
        left: resolve('var(--blue)'),
        right: resolve('var(--orange)'),
        font: getComputedStyle(display).fontFamily,
      }
    }
    readColors()
    matchMedia('(prefers-color-scheme: dark)').addEventListener(
      'change',
      readColors,
      { signal },
    )

    const meter = createMeter(canvas, () => colors)

    // About 60 times a second, while the UI is mounted: read the levels, move the needles, draw.
    let frame = 0
    let last = 0
    const draw = (now: number) => {
      const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      meter.update(module.levels(), seconds)
      // The <meter>s show each channel's fast level.
      meter.bars.forEach((bar, i) => {
        levels[i]!.value = bar
      })
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    signal.addEventListener('abort', () => cancelAnimationFrame(frame))
  },
)

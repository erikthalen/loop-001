import { defineModuleScript } from '@loop/core'
import { createOdometer } from '@loop/ui'
import {
  COLUMN_EDGES,
  COLUMNS,
  CURVE_FREQUENCIES,
  drawPicture,
  HZ_WHEELS,
  type PictureColors,
  RESONANCE_WHEELS,
  TEXT_FONTS,
} from './picture'
import { MAX_FREQUENCY, MIN_FREQUENCY, type setup } from './setup'
import { FREQUENCY_STEPS } from './template'

/** Slider step to Hz. Logarithmic: each step is the same musical distance. */
const hzOf = (step: number) =>
  MIN_FREQUENCY * (MAX_FREQUENCY / MIN_FREQUENCY) ** (step / FREQUENCY_STEPS)
const stepOf = (hz: number) =>
  Math.round(
    (Math.log(hz / MIN_FREQUENCY) / Math.log(MAX_FREQUENCY / MIN_FREQUENCY)) *
      FREQUENCY_STEPS,
  )

/** "600" + "hz", or "1.25" + "khz". */
function formatHz(hz: number): { value: string; unit: string } {
  if (hz < 1000) return { value: String(Math.round(hz)), unit: 'hz' }
  return { value: (hz / 1000).toFixed(hz < 10_000 ? 2 : 1), unit: 'khz' }
}

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(
  ({ root, module, signal }) => {
    const display = root.querySelector<HTMLElement>('.display')!
    const frequency = root.querySelector<HTMLInputElement>('[name=frequency]')!
    const resonance = root.querySelector<HTMLInputElement>('[name=resonance]')!
    const bypass = root.querySelector<HTMLInputElement>('[name=bypass]')!
    const slopes = [...root.querySelectorAll<HTMLInputElement>('[name=slope]')]
    const canvas = root.querySelector<HTMLCanvasElement>('.picture')!

    /** What the picture shows, in words, for screen readers. */
    const describe = () => {
      const hz = formatHz(module.frequency)
      canvas.setAttribute(
        'aria-label',
        `The sound before and after the filter, from low to high, and the filter's curve. Cutoff ${hz.value} ${hz.unit}, resonance ${module.resonance.toFixed(1)} dB, ` +
          `${module.slope} dB per octave` +
          (module.on ? '.' : '. The filter is off.'),
      )
    }

    const showFrequency = () => {
      const hz = formatHz(module.frequency)
      frequency.setAttribute('aria-valuetext', `${hz.value} ${hz.unit}`)
      describe()
    }

    const showResonance = () => {
      resonance.setAttribute(
        'aria-valuetext',
        `${module.resonance.toFixed(1)} decibels`,
      )
      describe()
    }

    const showSlope = () => {
      for (const radio of slopes)
        radio.checked = Number(radio.value) === module.slope
      describe()
    }

    frequency.value = String(stepOf(module.frequency))
    showFrequency()
    showResonance()
    showSlope()

    frequency.addEventListener(
      'input',
      () => {
        module.setFrequency(hzOf(frequency.valueAsNumber))
        showFrequency()
      },
      { signal },
    )
    resonance.addEventListener(
      'input',
      () => {
        module.setResonance(resonance.valueAsNumber / 10)
        showResonance()
      },
      { signal },
    )
    for (const radio of slopes) {
      radio.addEventListener(
        'change',
        () => {
          module.setSlope(radio.value === '24' ? 24 : 12)
          showSlope()
        },
        { signal },
      )
    }
    bypass.addEventListener(
      'change',
      () => {
        module.setOn(!bypass.checked)
        describe()
      },
      { signal },
    )

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
    let colors: PictureColors
    const readColors = () => {
      colors = {
        screen: resolve('var(--screen)'),
        ink: resolve('var(--ink)'),
        line: resolve('var(--line)'),
        dim: resolve('var(--dim)'),
        muted: resolve('var(--muted)'),
        primary: resolve('var(--loop-primary)'),
        font: getComputedStyle(display).fontFamily,
      }
    }
    readColors()
    matchMedia('(prefers-color-scheme: dark)').addEventListener(
      'change',
      readColors,
      { signal },
    )

    // The filter's curve, at the picture's points.
    const response = new Float32Array(CURVE_FREQUENCIES.length)

    // The sound, before and after the filter: one level (0 to 1) per column of the picture. Each
    // column is a part of the range (COLUMN_EDGES): its loudest bin.
    const bins = new Float32Array(module.inputAnalyser.frequencyBinCount)
    const binHz =
      module.inputAnalyser.context.sampleRate / module.inputAnalyser.fftSize
    const levels = (analyser: AnalyserNode, into: Float32Array) => {
      analyser.getFloatFrequencyData(bins)
      for (let i = 0; i < COLUMNS; i++) {
        const from = Math.floor(COLUMN_EDGES[i]! / binHz)
        const to = Math.max(from, Math.floor(COLUMN_EDGES[i + 1]! / binHz))
        let loudest = -200
        for (let k = from; k <= to && k < bins.length; k++)
          loudest = Math.max(loudest, bins[k]!)
        // -90 dB: no cells, -20 dB: all of them.
        into[i] = Math.max(0, Math.min(1, (loudest + 90) / 70))
      }
    }
    const before = new Float32Array(COLUMNS)
    const after = new Float32Array(COLUMNS)

    // The numbers roll to a new value (see createOdometer in @loop/ui). Less motion: jump there.
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    const hzValue = () => Math.round(module.frequency)
    const resonanceValue = () => Math.round(module.resonance * 10)
    const hzWheels = createOdometer(HZ_WHEELS, hzValue())
    const resonanceWheels = createOdometer(RESONANCE_WHEELS, resonanceValue())

    // Draw about 60 times a second, while the UI is mounted.
    let last = 0
    let frame = 0
    const draw = (now: number) => {
      const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      module.getResponse(CURVE_FREQUENCIES, response)
      levels(module.inputAnalyser, before)
      levels(module.outputAnalyser, after)
      if (reducedMotion.matches) {
        hzWheels.jump(hzValue())
        resonanceWheels.jump(resonanceValue())
      } else {
        hzWheels.roll(hzValue(), seconds)
        resonanceWheels.roll(resonanceValue(), seconds)
      }
      drawPicture(
        canvas,
        {
          cutoff: module.frequency,
          hzWheels: hzWheels.wheels,
          resonanceWheels: resonanceWheels.wheels,
          bypass: !module.on,
          response,
          before,
          after,
        },
        colors,
      )
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    signal.addEventListener('abort', () => cancelAnimationFrame(frame))

    // A canvas does not wait for a font, and the browser downloads a weight only when something
    // uses it. Load the weights the picture uses (it draws again on the next frame anyway).
    Promise.all(
      Object.values(TEXT_FONTS).map((font) =>
        document.fonts.load(`${font} ${colors.font}`),
      ),
    ).catch((error) => console.error('The filter font did not load:', error))
  },
)

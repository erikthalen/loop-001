import { defineModuleScript } from '@loop/core'
import { addVideoFont } from '@loop/ui'
import { MAX_FREQUENCY, MAX_RESONANCE, MIN_FREQUENCY, type setup } from './setup'
import { createSpectrum, type SpectrumColors } from './spectrum'
import { FREQUENCY_STEPS } from './template'

/** Slider step to Hz. Logarithmic: each step is the same musical distance. */
const hzOf = (step: number) => MIN_FREQUENCY * (MAX_FREQUENCY / MIN_FREQUENCY) ** (step / FREQUENCY_STEPS)
const stepOf = (hz: number) => Math.round((Math.log(hz / MIN_FREQUENCY) / Math.log(MAX_FREQUENCY / MIN_FREQUENCY)) * FREQUENCY_STEPS)

/** "600" + "hz", or "1.25" + "khz". */
function formatHz(hz: number): { value: string; unit: string } {
  if (hz < 1000) return { value: String(Math.round(hz)), unit: 'hz' }
  return { value: (hz / 1000).toFixed(hz < 10_000 ? 2 : 1), unit: 'khz' }
}

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(({ root, module, signal }) => {
  addVideoFont()

  const display = root.querySelector<HTMLElement>('.display')!
  const frequency = root.querySelector<HTMLInputElement>('[name=frequency]')!
  const resonance = root.querySelector<HTMLInputElement>('[name=resonance]')!
  const bypass = root.querySelector<HTMLInputElement>('[name=bypass]')!
  const slope = root.querySelector<HTMLButtonElement>('.slope')!
  const frequencyValue = root.querySelector<HTMLElement>('.frequency-value')!
  const frequencyUnit = root.querySelector<HTMLElement>('.frequency-unit')!
  const resonanceValue = root.querySelector<HTMLElement>('.resonance-value')!
  const meter = root.querySelector<HTMLElement>('.meter')!
  const canvas = root.querySelector<HTMLCanvasElement>('.spectrum')!

  /** What the picture shows, in words, for screen readers. */
  const describe = () => {
    const hz = formatHz(module.frequency)
    canvas.setAttribute(
      'aria-label',
      `Sound before and after the filter. Cutoff ${hz.value} ${hz.unit}, resonance ${module.resonance.toFixed(1)} dB, ` +
        `${module.slope} dB per octave` +
        (module.on ? '.' : '. The filter is off.'),
    )
  }

  const showFrequency = () => {
    const hz = formatHz(module.frequency)
    frequencyValue.textContent = hz.value
    frequencyUnit.textContent = hz.unit
    frequency.setAttribute('aria-valuetext', `${hz.value} ${hz.unit}`)
    describe()
  }

  const showResonance = () => {
    resonanceValue.textContent = module.resonance.toFixed(1)
    resonance.setAttribute('aria-valuetext', `${module.resonance.toFixed(1)} decibels`)
    // 40 cells: the lowest one is always lit, the others follow the resonance.
    meter.style.setProperty('--lit', String(1 + Math.round((module.resonance / MAX_RESONANCE) * 39)))
    describe()
  }

  const showSlope = () => {
    slope.textContent = `${module.slope} db/oct`
    slope.setAttribute('aria-label', `Slope ${module.slope} dB per octave. Click to change.`)
    describe()
  }

  frequency.value = String(stepOf(module.frequency))
  showFrequency()
  showResonance()
  showSlope()

  frequency.addEventListener('input', () => {
    module.setFrequency(hzOf(frequency.valueAsNumber))
    showFrequency()
  }, { signal })
  resonance.addEventListener('input', () => {
    module.setResonance(resonance.valueAsNumber / 10)
    showResonance()
  }, { signal })
  slope.addEventListener('click', () => {
    module.toggleSlope()
    showSlope()
  }, { signal })
  bypass.addEventListener('change', () => {
    module.setOn(!bypass.checked)
    describe()
  }, { signal })

  // The canvas cannot use CSS variables, so read the colors from styles.ts once.
  // A hidden element turns any CSS color (also light-dark()) into rgb().
  const probe = document.createElement('span')
  probe.hidden = true
  display.append(probe)
  const resolve = (color: string) => {
    probe.style.color = color
    return getComputedStyle(probe).color
  }
  const colors: SpectrumColors = {
    spectrumIn: resolve('var(--spectrum-in)'),
    spectrumOut: resolve('var(--spectrum-out)'),
    curve: resolve('var(--curve)'),
    grid: resolve('var(--grid)'),
    axis: resolve('var(--axis)'),
    font: getComputedStyle(display).fontFamily,
  }

  // Draw about 60 times a second, while the UI is mounted.
  const spectrum = createSpectrum(canvas, module, () => colors)
  let frame = 0
  const draw = () => {
    spectrum.draw()
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  signal.addEventListener('abort', () => cancelAnimationFrame(frame))
})

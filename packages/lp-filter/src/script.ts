import { defineModuleScript, sendSourceOf } from '@loop/core'
import { MAX_FREQUENCY, MIN_FREQUENCY, type Bus, type setup } from './setup'
import { BANDS, drawScene, type SceneColors } from './scene'
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
export const script = defineModuleScript<typeof setup>(({ root, module, core, on, signal }) => {
  const display = root.querySelector<HTMLElement>('.display')!
  const frequency = root.querySelector<HTMLInputElement>('[name=frequency]')!
  const resonance = root.querySelector<HTMLInputElement>('[name=resonance]')!
  const bypass = root.querySelector<HTMLInputElement>('[name=bypass]')!
  const slopes = [...root.querySelectorAll<HTMLInputElement>('[name=slope]')]
  const buses = [...root.querySelectorAll<HTMLInputElement>('[name=bus]')]

  /** On a send bus: is there a mixer before it to take the sound from? In the main chain: yes. */
  const connected = () => {
    if (module.bus === null) return true
    const order = [...core.modules.values()]
    return sendSourceOf(order, order.indexOf(module), module.bus) >= 0
  }
  const canvas = root.querySelector<HTMLCanvasElement>('.picture')!

  /** What the picture shows, in words, for screen readers. */
  const describe = () => {
    const hz = formatHz(module.frequency)
    canvas.setAttribute(
      'aria-label',
      `Music from next door: a wall between a speaker and an ear lets the low sounds through. Cutoff ${hz.value} ${hz.unit}, resonance ${module.resonance.toFixed(1)} dB, ` +
        `${module.slope} dB per octave, ` +
        (module.bus === null ? 'in the chain' : `on send ${module.bus === 0 ? 'A' : 'B'}`) +
        (module.on ? '.' : '. The filter is off.') +
        (connected() ? '' : ' No mixer before it, so no sound comes in.'),
    )
  }

  const showFrequency = () => {
    const hz = formatHz(module.frequency)
    frequency.setAttribute('aria-valuetext', `${hz.value} ${hz.unit}`)
    describe()
  }

  const showResonance = () => {
    resonance.setAttribute('aria-valuetext', `${module.resonance.toFixed(1)} decibels`)
    describe()
  }

  const showSlope = () => {
    for (const radio of slopes) radio.checked = Number(radio.value) === module.slope
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
  for (const radio of slopes) {
    radio.addEventListener('change', () => {
      module.setSlope(radio.value === '24' ? 24 : 12)
      showSlope()
    }, { signal })
  }
  bypass.addEventListener('change', () => {
    module.setOn(!bypass.checked)
    describe()
  }, { signal })
  for (const radio of buses) {
    radio.addEventListener('change', () => {
      module.setBus((radio.value === 'insert' ? null : Number(radio.value)) as Bus)
      describe()
    }, { signal })
  }
  // Added, removed or moved modules can add or take away the mixer.
  on('moduleadd', describe)
  on('moduleremove', describe)
  on('modulemove', describe)

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
  let colors: SceneColors
  const readColors = () => {
    colors = {
      screen: resolve('var(--screen)'),
      ink: resolve('var(--ink)'),
      dim: resolve('var(--dim)'),
      muted: resolve('var(--muted)'),
      blue: resolve('var(--blue)'),
      orange: resolve('var(--orange)'),
      red: resolve('var(--red)'),
      font: getComputedStyle(display).fontFamily,
    }
  }
  readColors()
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors, { signal })

  // How much of each wave comes through the wall: the filter's curve at the waves' frequencies.
  const bandFrequencies = Float32Array.from(BANDS, (band) => band.hz)
  const bandGains = new Float32Array(BANDS.length)

  // How loud the sound is (0 to 1): the loudest band before the filter.
  const bins = new Float32Array(module.inputAnalyser.frequencyBinCount)
  const level = () => {
    module.inputAnalyser.getFloatFrequencyData(bins)
    let loudest = -200
    for (let k = 2; k < 600; k++) loudest = Math.max(loudest, bins[k]!)
    return Math.max(0, Math.min(1, (loudest + 80) / 60))
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

  // Draw about 60 times a second, while the UI is mounted.
  let loudness = 0
  let last = 0
  let frame = 0
  const draw = (now: number) => {
    const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
    last = now
    if (module.on) module.getResponse(bandFrequencies, bandGains)
    else bandGains.fill(1)
    loudness = Math.max(level(), loudness - seconds * 1.5)
    drawScene(
      canvas,
      {
        resonance: module.resonance,
        position: frequency.valueAsNumber / FREQUENCY_STEPS,
        bypass: !module.on,
        gains: [...bandGains],
        level: loudness,
        time: reducedMotion.matches ? 0 : now / 1000,
      },
      colors,
    )
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  signal.addEventListener('abort', () => cancelAnimationFrame(frame))
})

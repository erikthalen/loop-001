import { defineModuleScript } from '@loop/core'
import { createOdometer } from '@loop/ui'
import { drawPicture, MS_WHEELS, type PictureColors } from './picture'
import { levelsOf, RATES, rateIndex, type setup } from './setup'

/** A rate in words, for screen readers: '1/8d' → '1/8 dotted'. */
const spoken = (name: string) => name.replace(/t$/, ' triplet').replace(/d$/, ' dotted')

// JS: connect the HTML to the module. Everything is removed for us on unmount.
// The picture only changes when a setting (or the tempo, or the modules around it) changes, so it
// is drawn then, not every frame. Only while the rate and the time roll to a new value (like a tape
// counter) is it drawn every frame, until they settle.
export const script = defineModuleScript<typeof setup>(({ root, module, core, on, signal }) => {
  const display = root.querySelector<HTMLElement>('.display')!
  const canvas = root.querySelector<HTMLCanvasElement>('.picture')!
  const mix = root.querySelector<HTMLInputElement>('[name=mix]')!
  const feedback = root.querySelector<HTMLInputElement>('[name=feedback]')!
  const rate = root.querySelector<HTMLInputElement>('[name=rate]')!

  /** Is a cable plugged into its input? Without one, no sound comes in. */
  const connected = () => core.cables.some((cable) => cable.to.module === module.id && cable.to.port === 'in')

  // The canvas cannot use CSS variables, so read the colors from the CSS.
  // A hidden element turns any CSS color (also light-dark()) into rgb().
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
      dim: resolve('var(--dim)'),
      muted: resolve('var(--muted)'),
      primary: resolve('var(--loop-primary)'),
      font: getComputedStyle(display).fontFamily,
    }
  }

  // The rate drum and the time's digit wheels (see picture.ts): they roll to the new value. Each
  // time wheel rolls on its own, so the higher ones roll too (see createOdometer in @loop/ui).
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  // The echoes slide too: the space between them (in steps) glides to the new rate.
  const targets = () => ({
    drum: rateIndex(module.rate),
    ms: Math.round(module.seconds * 1000),
    steps: RATES[rateIndex(module.rate)]!.beats * 4,
  })
  let { drum, steps } = targets()
  const counter = createOdometer(MS_WHEELS, targets().ms)

  const draw = () => {
    const { dry, wet } = levelsOf(module.mix)
    const isConnected = connected()
    canvas.setAttribute(
      'aria-label',
      `Echoes over one bar: every ${spoken(module.rate)} note, ${Math.round(module.seconds * 1000)} milliseconds apart.` +
        (isConnected ? '' : ' Nothing is plugged into its input, so no sound comes in.'),
    )
    drawPicture(
      canvas,
      {
        rateDrum: drum,
        msWheels: counter.wheels,
        steps,
        dry,
        wet,
        feedback: module.feedback,
        connected: isConnected,
      },
      colors,
    )
  }

  // Turn the wheels towards the new values, each frame, until they are there. Less motion: jump.
  let frame = 0
  let last = 0
  const roll = (now: number) => {
    const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
    last = now
    const target = targets()
    const step = Math.min(1, seconds * 14)
    drum += (target.drum - drum) * step
    if (Math.abs(target.drum - drum) < 0.001) drum = target.drum
    steps += (target.steps - steps) * step
    if (Math.abs(target.steps - steps) < 0.001) steps = target.steps
    const rolling = counter.roll(target.ms, seconds)
    draw()
    if (drum !== target.drum || steps !== target.steps || rolling) {
      frame = requestAnimationFrame(roll)
    } else {
      frame = 0
      last = 0
    }
  }
  /** Something changed: draw it, and roll the counter to the new values. */
  const update = () => {
    if (reducedMotion.matches) {
      const target = targets()
      drum = target.drum
      steps = target.steps
      counter.jump(target.ms)
    } else if (!frame) frame = requestAnimationFrame(roll)
    draw()
  }
  signal.addEventListener('abort', () => cancelAnimationFrame(frame))

  const percent = (value: number) => `${Math.round(value * 100)} percent`
  const showMix = () => mix.setAttribute('aria-valuetext', `${percent(module.mix)} wet`)
  const showFeedback = () => feedback.setAttribute('aria-valuetext', percent(module.feedback))
  const showRate = () => rate.setAttribute('aria-valuetext', `${spoken(module.rate)}, ${Math.round(module.seconds * 1000)} milliseconds`)

  mix.addEventListener('input', () => {
    module.setMix(mix.valueAsNumber / 100)
    showMix()
    update()
  }, { signal })
  feedback.addEventListener('input', () => {
    module.setFeedback(feedback.valueAsNumber / 100)
    showFeedback()
    update()
  }, { signal })
  rate.addEventListener('input', () => {
    module.setRate(RATES[rate.valueAsNumber]!.name)
    showRate()
    update()
  }, { signal })

  // The tempo changes the time; a cable plugged in or out can bring or take away the sound.
  on('bpmchange', () => {
    showRate()
    update()
  })
  on('cablechange', update)
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    readColors()
    update()
  }, { signal })

  readColors()
  showMix()
  showFeedback()
  showRate()
  draw()
})

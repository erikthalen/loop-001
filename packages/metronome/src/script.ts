import { defineModuleScript, html, render } from '@loop/core'
import { drawPicture, SWING, type PictureColors } from './picture'
import type { setup } from './setup'
import { beatCells } from './template'

/** Where the arm rests when the metronome is stopped: leaning all the way left. */
const REST = -SWING

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(({ root, module, core, on, signal }) => {
  const display = root.querySelector<HTMLElement>('.display')!
  const canvas = root.querySelector<HTMLCanvasElement>('.picture')!
  const signatureButton = root.querySelector<HTMLButtonElement>('.signature')!
  const mute = root.querySelector<HTMLInputElement>('[name=mute]')!
  const tempo = root.querySelector<HTMLInputElement>('[name=tempo]')!
  const beatsRow = root.querySelector<HTMLElement>('.beats')!
  let cells = [...root.querySelectorAll<HTMLInputElement>('.beat')]
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

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
      dim: resolve('var(--dim)'),
      muted: resolve('var(--muted)'),
      orange: resolve('var(--orange)'),
      font: getComputedStyle(display).fontFamily,
    }
  }
  readColors()
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors, { signal })

  /** What the picture shows, in words, for screen readers. */
  const describe = () =>
    canvas.setAttribute(
      'aria-label',
      `Metronome at ${Math.round(core.bpm)} bpm in ${module.signature}${module.muted ? ', muted' : ''}.`,
    )

  /** The signature button, and one radio button per beat. */
  const showSignature = () => {
    signatureButton.textContent = module.signature
    signatureButton.setAttribute('aria-label', `Time signature ${module.signature}. Click to change.`)
    if (cells.length !== module.beatsPerBar) {
      render(html`${beatCells(module.beatsPerBar)}`, beatsRow)
      cells = [...beatsRow.querySelectorAll<HTMLInputElement>('.beat')]
    }
    describe()
  }

  // The first beat is orange when the accent is on (saved with the project).
  const showAccent = () => display.classList.toggle('accent', module.accent)

  // Check the radio button of the beat that plays. -1: none (stopped).
  const showBeat = (index: number) => cells.forEach((cell, i) => (cell.checked = i === index))

  showAccent()
  showSignature()

  signatureButton.addEventListener('click', () => {
    module.nextSignature()
    showSignature()
  }, { signal })

  mute.addEventListener('change', () => {
    module.setMuted(mute.checked)
    describe()
  }, { signal })

  // The tempo slider sets the core's tempo (for every module). It follows the core too, for
  // example when a project loads.
  const showTempo = () => {
    tempo.value = String(Math.round(core.bpm))
    tempo.setAttribute('aria-valuetext', `${Math.round(core.bpm)} bpm`)
    describe()
  }
  showTempo()
  tempo.addEventListener('input', () => core.setBpm(tempo.valueAsNumber), { signal })
  on('bpmchange', showTempo)

  // The arm is in the middle on every beat. Between two beats it swings out to one side and
  // back (a sine curve: fast in the middle, slow at the side). The next beat swings to the other side.
  // Beat events arrive early (the clock schedules ahead), so keep them until their time comes.
  const swings: { time: number; side: number }[] = []

  on('beat', ({ beat, time }) => {
    // After even beats the arm swings out to the left, after odd beats to the right.
    swings.push({ time, side: beat % 2 === 0 ? -1 : 1 })

    // The metronome's own bar (see setup.ts), not the core clock's.
    // Wait until the beat really plays, then check its radio button.
    const beatInBar = beat % module.beatsPerBar
    const delay = Math.max(0, (time - core.context.currentTime) * 1000)
    setTimeout(() => core.playing && !signal.aborted && showBeat(beatInBar), delay)
  })

  on('stop', () => {
    showBeat(-1)
    swings.length = 0
  })

  // ——— The picture, about 60 times a second ———
  let angle = REST
  const history: number[] = []
  // The tempo on the digit wheels: it turns towards the real tempo. Less motion: jump there.
  let bpm = core.bpm
  let last = 0
  let frame = 0
  const draw = (now: number) => {
    const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
    last = now

    const time = core.context.currentTime
    while (swings.length > 1 && swings[1]!.time <= time) swings.shift()
    const current = swings[0]
    if (!core.playing) angle = REST
    else if (current && current.time <= time) {
      // Less motion: no swing, the arm only jumps to the side of each beat.
      const progress = reducedMotion.matches ? 0.5 : Math.min(1, (time - current.time) / (60 / core.bpm))
      angle = current.side * SWING * Math.sin(Math.PI * progress)
    }
    history.push(angle)
    if (history.length > 8) history.shift()

    const target = Math.round(core.bpm)
    bpm = reducedMotion.matches ? target : bpm + (target - bpm) * Math.min(1, seconds * 14)
    if (Math.abs(target - bpm) < 0.005) bpm = target

    drawPicture(canvas, { angle, ghosts: [history[0] ?? angle, history[4] ?? angle], bpm }, colors)
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  signal.addEventListener('abort', () => cancelAnimationFrame(frame))
})

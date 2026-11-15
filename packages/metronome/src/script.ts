import { defineModuleScript, html, render } from '@loop/core'
import { addDisplayFont } from './font'
import type { setup } from './setup'
import { beatCells } from './template'

/** The Italian tempo name for a bpm. */
function marking(bpm: number): string {
  if (bpm < 66) return 'largo'
  if (bpm < 76) return 'adagio'
  if (bpm < 108) return 'andante'
  if (bpm < 120) return 'moderato'
  if (bpm < 156) return 'allegro'
  if (bpm < 176) return 'vivace'
  if (bpm < 200) return 'presto'
  return 'prestissimo'
}

/** How far the arm tip swings to each side, in icon pixels. */
const SWING = 4
/** Where the arm rests when the metronome is stopped: leaning all the way left. */
const REST = -SWING
/** The arm is 11 pixels long: from the pivot (row 10) up to the top row (row 0). */
const ARM_LENGTH = 10

/**
 * The pixel arm of the icon: one pixel per row, from the pivot up to the tip.
 * `lean` is where the tip is, from -SWING (left) to SWING (right). Any number works:
 * each pixel snaps to the grid, so the arm moves smoothly but stays pixel art.
 */
function armPath(lean: number): string {
  let d = ''
  for (let t = 0; t <= ARM_LENGTH; t++) {
    const x = Math.round(5 + (lean * t) / ARM_LENGTH)
    d += `M${x} ${ARM_LENGTH - t}h1v1h-1z `
  }
  return d
}

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(({ root, module, core, on, signal }) => {
  addDisplayFont()

  const display = root.querySelector<HTMLElement>('.display')!
  const volume = root.querySelector<HTMLInputElement>('[name=volume]')!
  const accent = root.querySelector<HTMLInputElement>('[name=accent]')!
  const digits = [...root.querySelectorAll<HTMLElement>('.digit')]
  const tempoValue = root.querySelector<HTMLElement>('.tempo-value')!
  const markingLabel = root.querySelector<HTMLElement>('.marking')!
  const signatureButton = root.querySelector<HTMLButtonElement>('.signature')!
  const beatsRow = root.querySelector<HTMLElement>('.beats')!
  const arm = root.querySelector<SVGPathElement>('.arm')!
  let cells = [...root.querySelectorAll<HTMLElement>('.beat')]
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

  /** Three dot-matrix digits. Leading zeros stay dark, like an unlit display. */
  const showTempo = (bpm: number) => {
    const text = String(Math.round(bpm)).padStart(3, '0')
    let leading = true
    digits.forEach((digit, i) => {
      const ch = text[i] ?? '0'
      if (ch !== '0' || i === digits.length - 1) leading = false
      digit.textContent = ch
      digit.classList.toggle('unlit', leading)
    })
    tempoValue.textContent = `${Math.round(bpm)} bpm`
    markingLabel.textContent = marking(bpm)
  }

  /** The signature in the top right corner, and one cell per beat. */
  const showSignature = () => {
    signatureButton.textContent = module.signature
    signatureButton.setAttribute('aria-label', `Time signature ${module.signature}. Click to change.`)
    if (cells.length !== module.beatsPerBar) {
      render(html`${beatCells(module.beatsPerBar)}`, beatsRow)
      cells = [...beatsRow.querySelectorAll<HTMLElement>('.beat')]
    }
  }

  const showAccent = () => display.classList.toggle('accent', module.accent)

  /** What screen readers say for the slider. */
  const showVolume = () => {
    volume.setAttribute('aria-valuetext', `${volume.valueAsNumber} percent`)
  }

  const showBeat = (index: number) => cells.forEach((cell, i) => cell.classList.toggle('on', i === index))

  // The arm. Only touch the DOM when a pixel really moves.
  let shownPath = ''
  const showArm = (lean: number) => {
    const path = armPath(lean)
    if (path === shownPath) return
    shownPath = path
    arm.setAttribute('d', path)
  }

  // The arm is in the middle on every beat. Between two beats it swings out to one side and
  // back (a sine curve: fast in the middle, slow at the side). The next beat swings to the other side.
  // Beat events arrive early (the clock schedules ahead), so keep them until their time comes.
  const swings: { time: number; side: number }[] = []
  let frame = 0

  const animate = () => {
    const now = core.context.currentTime
    while (swings.length > 1 && swings[1]!.time <= now) swings.shift()
    const current = swings[0]
    if (current && current.time <= now) {
      // Less motion: no swing, the arm only jumps to the side of each beat.
      const progress = reducedMotion.matches ? 0.5 : Math.min(1, (now - current.time) / (60 / core.bpm))
      showArm(current.side * SWING * Math.sin(Math.PI * progress))
    }
    frame = requestAnimationFrame(animate)
  }

  const startSwing = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(animate)
  }

  const stopSwing = () => {
    cancelAnimationFrame(frame)
    swings.length = 0
    showArm(REST)
  }

  showTempo(core.bpm)
  showAccent()
  showVolume()
  showSignature()
  showArm(REST)
  if (core.playing) startSwing()
  signal.addEventListener('abort', () => cancelAnimationFrame(frame))

  volume.addEventListener('input', () => {
    module.setVolume(volume.valueAsNumber / 100)
    showVolume()
  }, { signal })
  accent.addEventListener('change', () => {
    module.setAccent(accent.checked)
    showAccent()
  }, { signal })
  signatureButton.addEventListener('click', () => {
    module.nextSignature()
    showSignature()
  }, { signal })

  on('bpmchange', ({ bpm }) => showTempo(bpm))
  on('start', startSwing)

  on('beat', ({ beat, time }) => {
    // After even beats the arm swings out to the left, after odd beats to the right.
    swings.push({ time, side: beat % 2 === 0 ? -1 : 1 })

    // The metronome's own bar (see setup.ts), not the core clock's.
    // Wait until the beat really plays, then light its cell.
    const beatInBar = beat % module.beatsPerBar
    const delay = Math.max(0, (time - core.context.currentTime) * 1000)
    setTimeout(() => core.playing && !signal.aborted && showBeat(beatInBar), delay)
  })

  on('stop', () => {
    showBeat(-1)
    stopSwing()
  })
})

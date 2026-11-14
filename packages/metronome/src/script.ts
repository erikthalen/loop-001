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

/** The pixel arm of the icon. `lean` goes from -4 (left) to 4 (right). */
function armPath(lean: number): string {
  let d = ''
  for (let t = 0; t <= 9; t++) {
    const x = Math.round(5 + (lean * t) / 9)
    d += `M${x} ${9 - t}h1v1h-1z `
  }
  return d
}

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(({ root, module, core, on, signal }) => {
  addDisplayFont()

  const display = root.querySelector<HTMLElement>('.display')!
  const volume = root.querySelector<HTMLInputElement>('[name=volume]')!
  const segments = [...root.querySelectorAll<HTMLElement>('.segment')]
  const volumeValues = [...root.querySelectorAll<HTMLElement>('.volume-value')]
  const accentToggle = root.querySelector<HTMLButtonElement>('.accent-toggle')!
  const digits = [...root.querySelectorAll<HTMLElement>('.digit')]
  const tempoValue = root.querySelector<HTMLElement>('.tempo-value')!
  const markingLabel = root.querySelector<HTMLElement>('.marking')!
  const signatureButton = root.querySelector<HTMLButtonElement>('.signature')!
  const beatCount = root.querySelector<HTMLElement>('.beat-count')!
  const beatsRow = root.querySelector<HTMLElement>('.beats')!
  const arm = root.querySelector<SVGPathElement>('.arm')!
  const ball = root.querySelector<HTMLElement>('.ball')!
  let cells = [...root.querySelectorAll<HTMLElement>('.beat')]
  const state = root.querySelector<HTMLElement>('.state')!
  const beatNumber = root.querySelector<HTMLElement>('.beat-number')!
  const accentLabel = root.querySelector<HTMLElement>('.accent-label')!

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
    tempoValue.textContent = `${Math.round(bpm)}`
    markingLabel.textContent = marking(bpm)
  }

  /** The signature in the top right corner, one cell per beat, and the beat count. */
  const showSignature = () => {
    signatureButton.textContent = module.signature
    beatCount.textContent = String(module.beatsPerBar)
    signatureButton.setAttribute('aria-label', `Time signature ${module.signature}. Click to change.`)
    if (cells.length !== module.beatsPerBar) {
      render(html`${beatCells(module.beatsPerBar)}`, beatsRow)
      cells = [...beatsRow.querySelectorAll<HTMLElement>('.beat')]
    }
  }

  const showAccent = () => {
    display.classList.toggle('accent', module.accent)
    accentToggle.setAttribute('aria-pressed', String(module.accent))
    accentLabel.textContent = module.accent ? 'on' : 'off'
  }

  /** Lit segments and the volume as three digits, like "070". */
  const showVolume = () => {
    const percent = Math.round(module.volume * 100)
    const lit = Math.round((percent / 100) * segments.length)
    segments.forEach((segment, i) => segment.classList.toggle('lit', i < lit))
    volumeValues.forEach((value) => (value.textContent = String(percent).padStart(3, '0')))
    volume.setAttribute('aria-valuetext', `${percent} percent`)
  }

  /** The ball and the icon arm. `side` 0 is left, 0.5 is centre, 1 is right. */
  const swing = (side: number, seconds: number) => {
    ball.style.transition = `left ${seconds}s cubic-bezier(.45, 0, .55, 1)`
    ball.style.setProperty('--side', String(side))
    arm.setAttribute('d', armPath(side === 0.5 ? -3 : side === 0 ? -4 : 4))
  }

  const showRunning = (running: boolean) => {
    display.classList.toggle('running', running)
    state.textContent = running ? '● run' : '○ idle'
  }

  const showBeat = (index: number) => {
    cells.forEach((cell, i) => cell.classList.toggle('on', i === index))
    beatNumber.textContent = index < 0 ? '-' : String(index + 1)
  }

  showTempo(core.bpm)
  showAccent()
  showVolume()
  showSignature()
  showRunning(core.playing)
  swing(0.5, 0)

  volume.addEventListener('input', () => {
    module.setVolume(volume.valueAsNumber / 100)
    showVolume()
  }, { signal })
  accentToggle.addEventListener('click', () => {
    module.setAccent(!module.accent)
    showAccent()
  }, { signal })

  signatureButton.addEventListener('click', () => {
    module.nextSignature()
    showSignature()
  }, { signal })

  on('bpmchange', ({ bpm }) => showTempo(bpm))
  on('start', () => showRunning(true))

  // Beat events arrive a bit early (the clock schedules ahead).
  // Wait until the beat really plays, then light the cell and swing the ball.
  let side = 0
  on('beat', ({ beat, time }) => {
    // The metronome's own bar (see setup.ts), not the core clock's.
    const beatInBar = beat % module.beatsPerBar
    const delay = Math.max(0, (time - core.context.currentTime) * 1000)
    setTimeout(() => {
      if (!core.playing || signal.aborted) return
      showBeat(beatInBar)
      // The ball reaches the other side on the next beat.
      side = side === 0 ? 1 : 0
      swing(side, 60 / core.bpm)
    }, delay)
  })

  on('stop', () => {
    showRunning(false)
    showBeat(-1)
    side = 0
    swing(0.5, 0.2)
  })
})

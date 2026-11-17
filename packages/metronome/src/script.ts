import { defineModuleScript } from '@loop/core'
import { drawPicture, REST, TRAIL, type PictureColors } from './picture'
import type { setup } from './setup'

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(({ root, module, core, on, signal }) => {
  const display = root.querySelector<HTMLElement>('.display')!
  const canvas = root.querySelector<HTMLCanvasElement>('.picture')!
  const mute = root.querySelector<HTMLInputElement>('[name=mute]')!
  const tempo = root.querySelector<HTMLInputElement>('[name=tempo]')!
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
      `Metronome at ${Math.round(core.bpm)} bpm${module.muted ? ', muted' : ''}.`,
    )

  describe()

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

  // The dot is in the middle of the ∞ on every beat. Between two beats it goes around one loop
  // (fast in the middle, slow at the ends); the next beat, the other loop.
  // Beat events arrive early (the clock schedules ahead), so keep them until their time comes.
  const swings: { time: number; beat: number; accent: boolean }[] = []

  on('beat', ({ beat, beatInBar, time }) => {
    // The middle flashes on each beat (orange on the first beat of the bar, when the accent is on).
    swings.push({ time, beat, accent: module.accent && beatInBar === 0 })
  })

  on('stop', () => {
    swings.length = 0
  })

  // ——— The picture, about 60 times a second ———
  // Where the dot is on the ∞ (see picture.ts): one beat is half of the way around.
  // It keeps its place when the core stops (like the tape), and goes back while it rewinds.
  let phase = REST
  // Where the trail behind the dot starts. It follows the dot, at most TRAIL behind it (ahead of
  // it while the tape goes backwards). It stays where it is when the dot stops, so the path stays
  // drawn; and it grows from the middle the first time.
  let trail = REST
  let lastTime = core.context.currentTime
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
    if (core.playing && current && current.time <= time) {
      // Less motion: the dot only jumps to the end of each loop.
      // How far into the beat: how far the tape has moved since the beat, in beats. So the dot
      // follows the tape speed exactly (also while it speeds up or slows down), and never goes back.
      const moved = core.clock.travel(current.time, time) / (60 / core.bpm)
      const progress = reducedMotion.matches ? 0.5 : Math.min(1, Math.max(0, moved))
      // Even beats: the left loop; odd beats: the right loop.
      phase = Math.PI * (current.beat + progress + 1)
    } else if (!reducedMotion.matches) {
      // Stopped, rewinding, or not at the first beat yet: the dot moves as far as the tape (back
      // while it rewinds; not at all while it stands still).
      phase += (Math.PI * core.clock.travel(lastTime, time)) / (60 / core.bpm)
    }
    lastTime = time
    if (reducedMotion.matches) trail = phase
    else if (phase - trail > TRAIL) trail = phase - TRAIL
    else if (trail - phase > TRAIL) trail = phase + TRAIL
    // The beat flash: bright on the beat, gone after 0.25 s.
    const flash = core.playing && current && current.time <= time ? Math.max(0, 1 - (time - current.time) / 0.25) : 0

    const target = Math.round(core.bpm)
    bpm = reducedMotion.matches ? target : bpm + (target - bpm) * Math.min(1, seconds * 14)
    if (Math.abs(target - bpm) < 0.005) bpm = target

    // The canvas is as wide as the module, so read its width.
    drawPicture(
      canvas,
      { phase, trail, bpm, flash, accent: current?.accent ?? false },
      colors,
      canvas.clientWidth,
    )
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  signal.addEventListener('abort', () => cancelAnimationFrame(frame))
})

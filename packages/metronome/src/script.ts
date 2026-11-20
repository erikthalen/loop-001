import { defineModuleScript } from '@loop/core'
import { createOdometer } from '@loop/ui'
import {
  BPM_WHEELS,
  drawPicture,
  INCH_WHEELS,
  type PictureColors,
  tapePerBeat,
} from './picture'
import type { setup } from './setup'

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(
  ({ root, module, core, on, signal }) => {
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
        line: resolve('var(--line)'),
        dim: resolve('var(--dim)'),
        muted: resolve('var(--muted)'),
        primary: resolve('var(--loop-primary)'),
        orange: resolve('var(--orange)'),
        font: getComputedStyle(display).fontFamily,
      }
    }
    readColors()
    matchMedia('(prefers-color-scheme: dark)').addEventListener(
      'change',
      readColors,
      { signal },
    )

    /** What the picture shows, in words, for screen readers. */
    const describe = () =>
      canvas.setAttribute(
        'aria-label',
        `Metronome at ${Math.round(core.bpm)} bpm${module.muted ? ', muted' : ''}.`,
      )

    describe()

    mute.addEventListener(
      'change',
      () => {
        module.setMuted(mute.checked)
        describe()
      },
      { signal },
    )

    // The tempo slider sets the core's tempo (for every module). It follows the core too, for
    // example when a project loads.
    const showTempo = () => {
      tempo.value = String(Math.round(core.bpm))
      tempo.setAttribute('aria-valuetext', `${Math.round(core.bpm)} bpm`)
      describe()
    }
    showTempo()
    tempo.addEventListener('input', () => core.setBpm(tempo.valueAsNumber), {
      signal,
    })
    on('bpmchange', showTempo)

    // The tape (see picture.ts): mark k passes the head exactly on beat k.
    // Beat events arrive early (the clock schedules ahead), so keep them until their time comes.
    const swings: { time: number; beat: number; accent: boolean }[] = []

    on('beat', ({ beat, beatInBar, time }) => {
      // On each beat, its dot on the tape lights up orange (see picture.ts).
      swings.push({ time, beat, accent: module.accent && beatInBar === 0 })
    })

    on('stop', () => {
      swings.length = 0
    })

    // ——— The picture, about 60 times a second ———
    // Where the tape is, in beats. It keeps its place when the core stops (like a tape machine),
    // and goes back while it rewinds.
    let position = 0
    let lastTime = core.context.currentTime
    // The tempo on the digit wheels: they roll towards the real tempo, each wheel on its own, so the
    // higher ones roll too (see createOdometer in @loop/ui). Less motion: jump there.
    const tempoWheels = createOdometer(BPM_WHEELS, Math.round(core.bpm))
    // The tape per beat, the same way (in tenths of an inch).
    const inchWheels = createOdometer(INCH_WHEELS, tapePerBeat(core.bpm))
    let last = 0
    let frame = 0
    const draw = (now: number) => {
      const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now

      const time = core.context.currentTime
      while (swings.length > 1 && swings[1]!.time <= time) swings.shift()
      const current = swings[0]
      if (core.playing && current && current.time <= time) {
        // How far into the beat: how far the transport has moved since the beat, in beats. So the
        // tape follows the transport speed exactly (also while it speeds up or slows down).
        // Less motion: the tape moves one beat at a time.
        const moved = core.clock.travel(current.time, time) / (60 / core.bpm)
        const progress = reducedMotion.matches
          ? 0
          : Math.min(1, Math.max(0, moved))
        position = current.beat + progress
      } else if (!reducedMotion.matches) {
        // Stopped, rewinding, or not at the first beat yet: the tape moves as far as the transport
        // (back while it rewinds; not at all while it stands still).
        position += core.clock.travel(lastTime, time) / (60 / core.bpm)
      }
      lastTime = time
      // The beat flash: bright on the beat, then an even fade, gone after 0.1 s.
      const flash =
        core.playing && current && current.time <= time
          ? Math.max(0, 1 - (time - current.time) / 0.1)
          : 0

      if (reducedMotion.matches) {
        tempoWheels.jump(Math.round(core.bpm))
        inchWheels.jump(tapePerBeat(core.bpm))
      } else {
        tempoWheels.roll(Math.round(core.bpm), seconds)
        inchWheels.roll(tapePerBeat(core.bpm), seconds)
      }

      // The canvas is as wide as the module, so read its width.
      drawPicture(
        canvas,
        {
          position,
          barLength: module.accent ? core.clock.beatsPerBar : 0,
          bpmWheels: tempoWheels.wheels,
          inchWheels: inchWheels.wheels,
          beat: current?.beat ?? 0,
          flash,
          accent: current?.accent ?? false,
        },
        colors,
        canvas.clientWidth,
      )
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    signal.addEventListener('abort', () => cancelAnimationFrame(frame))
  },
)

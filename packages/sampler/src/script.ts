import { defineModuleScript } from '@loop/core'
import { CHANNEL_COLORS, createOdometer } from '@loop/ui'
import { CHANNELS, MAX_SECONDS, type setup } from './setup'
import {
  COLUMNS,
  COUNTER_WHEELS,
  columnsOf,
  drawWave,
  tapeRadius,
  type WaveColors,
} from './wave'

const seconds = (value: number) => `${value.toFixed(2)} s`

/** Channel 1's place on the tape (0 to 1: how much is on the right reel), and the space to the next channel. */
const FIRST_PLACE = 0.1
const CHANNEL_SPACE = 0.13
const placeOnTape = (channel: number) => FIRST_PLACE + channel * CHANNEL_SPACE
/** How far the tape moves while a whole sound plays (or a whole recording): a short strip. */
const STRIP = 0.08
/** Rewind and fast forward speed: part of the whole tape per second. */
const WIND_SPEED = 0.6
/** The tape's length in px, to turn the reels the right amount. */
const TAPE_LENGTH = 600

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(
  ({ root, module, signal }) => {
    const display = root.querySelector<HTMLElement>('.display')!
    const status = root.querySelector<HTMLElement>('.status')!
    const channelNumber = root.querySelector<HTMLElement>('.channel-number')!
    const wave = root.querySelector<HTMLElement>('.wave')!
    const canvas = root.querySelector<HTMLCanvasElement>('.picture')!
    const startMarker = root.querySelector<HTMLButtonElement>('.marker.start')!
    const endMarker = root.querySelector<HTMLButtonElement>('.marker.end')!
    const cuts = root.querySelector<HTMLElement>('.cuts')!
    const cutWindow = root.querySelector<HTMLElement>('.cut-window')!
    const radios = [
      ...root.querySelectorAll<HTMLInputElement>('[name=channel]'),
    ]
    const rec = root.querySelector<HTMLInputElement>('[name=rec]')!
    const play = root.querySelector<HTMLButtonElement>('.play')!

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
    let colors: WaveColors
    const readColors = () => {
      colors = {
        marker: resolve('var(--blue)'),
        screen: resolve('var(--screen)'),
        ink: resolve('var(--ink)'),
        dim: resolve('var(--dim)'),
        muted: resolve('var(--muted)'),
        line: resolve('var(--line)'),
        tape: resolve('var(--orange)'),
        rec: resolve('var(--red)'),
        channels: CHANNEL_COLORS.map(resolve),
        font: getComputedStyle(display).fontFamily,
      }
    }
    readColors()
    matchMedia('(prefers-color-scheme: dark)').addEventListener(
      'change',
      readColors,
      { signal },
    )

    // The columns of a sound are slow to make, so keep them for each sound.
    const columnCache = new WeakMap<AudioBuffer, Float32Array>()
    const columnsFor = (buffer: AudioBuffer) => {
      let columns = columnCache.get(buffer)
      if (!columns) columnCache.set(buffer, (columns = columnsOf(buffer)))
      return columns
    }

    /** Text, markers, radios and buttons. Called after every change. */
    const show = () => {
      const { buffer, start, end } = module.sound
      const duration = buffer?.duration ?? 0

      status.textContent = module.recording ? '● rec' : module.message

      // An empty channel (or while recording):
      // at the start and the end of the tape, and they cannot be moved.
      const movable = !!buffer && !module.recording
      for (const [marker, value, rest] of [
        [startMarker, start, 0],
        [endMarker, end, 1],
      ] as const) {
        marker.disabled = !movable
        marker.style.setProperty('--at', String(movable ? value : rest))
        marker.setAttribute('aria-valuenow', String(Math.round(value * 100)))
        marker.setAttribute('aria-valuetext', seconds(value * duration))
      }

      radios.forEach((radio, i) => {
        radio.checked = i === module.active
        radio.disabled = module.recording
        radio.closest('label')!.classList.toggle('empty', !module.hasSound(i))
        radio.setAttribute(
          'aria-label',
          `Channel ${i + 1}${module.hasSound(i) ? '' : ', empty'}`,
        )
      })

      rec.checked = module.recording
      play.disabled = !buffer || module.recording
      play.textContent = module.playing ? 'stop' : 'play'
      play.setAttribute('aria-pressed', String(module.playing))

      canvas.setAttribute(
        'aria-label',
        buffer
          ? `Tape of channel ${module.active + 1}, ${seconds(duration)} long. ` +
              `The cut goes from ${seconds(start * duration)} to ${seconds(end * duration)} (${seconds((end - start) * duration)}).`
          : `Channel ${module.active + 1} is blank tape`,
      )
    }

    // ——— Inputs ———

    for (const radio of radios) {
      radio.addEventListener(
        'change',
        () => {
          module.setActive(Number(radio.value))
          show()
        },
        { signal },
      )
    }

    rec.addEventListener(
      'change',
      () => {
        if (rec.checked) void module.record()
        else module.stopRecording()
        show()
      },
      { signal },
    )

    play.addEventListener(
      'click',
      () => (module.playing ? module.stop() : module.play()),
      { signal },
    )

    // The markers: drag with the pointer, or use the arrow keys (Shift: bigger steps), Home and End.
    const markers = [
      [
        startMarker,
        (value: number) => module.setStart(value),
        () => module.sound.start,
      ],
      [
        endMarker,
        (value: number) => module.setEnd(value),
        () => module.sound.end,
      ],
    ] as const
    for (const [marker, set, get] of markers) {
      const placeOf = (event: PointerEvent) => {
        const box = wave.getBoundingClientRect()
        return (event.clientX - box.left) / box.width
      }
      marker.addEventListener(
        'pointerdown',
        (event) => {
          event.preventDefault()
          marker.focus()
          marker.setPointerCapture(event.pointerId)
        },
        { signal },
      )
      marker.addEventListener(
        'pointermove',
        (event) => {
          if (!marker.hasPointerCapture(event.pointerId)) return
          set(placeOf(event))
          show()
        },
        { signal },
      )
      marker.addEventListener(
        'keydown',
        (event) => {
          const step = event.shiftKey ? 0.05 : 0.01
          const moves: Record<string, number> = {
            ArrowLeft: get() - step,
            ArrowDown: get() - step,
            ArrowRight: get() + step,
            ArrowUp: get() + step,
            Home: 0,
            End: 1,
          }
          const value = moves[event.key]
          if (value === undefined) return
          event.preventDefault()
          set(value)
          show()
        },
        { signal },
      )
    }

    const unsubscribe = module.subscribe(show)
    signal.addEventListener('abort', () => unsubscribe())
    show()

    // ——— The picture, about 60 times a second ———

    // While recording: one level per column, over the 5 seconds.
    let recorded: number[] | null = null
    // One tape for all 6 channels, like a real tape with 6 songs on it. Each channel has its own place
    // on the tape: switching channels winds the tape there (rewind or fast forward). `wind` is the
    // channel under the window (between two whole numbers while winding).
    // Playing or recording moves a short strip further (`strip`); after the sound it winds back.
    // `tape` is how much tape is on the right reel (0 to 1).
    let wind = module.active
    let strip = 0
    let tape = placeOnTape(wind)
    const turns: [number, number] = [0, 0]
    // How far the tape has moved past the rollers, in px (they turn with it).
    let travel = 0
    // The level meter: jumps up, falls back slowly.
    let level = 0
    // The time counter, in hundredths: digit wheels that roll towards the right time. Each wheel
    // rolls on its own, so the higher ones roll too (see createOdometer in @loop/ui).
    const counter = createOdometer(COUNTER_WHEELS)
    let last = 0
    let frame = 0
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    const draw = (now: number) => {
      const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      if (module.recording) {
        recorded ??= []
        const column = Math.floor(
          (module.recordedSeconds / MAX_SECONDS) * COLUMNS,
        )
        if (column < COLUMNS)
          recorded[column] = Math.max(recorded[column] ?? 0, module.level())
        for (let i = 0; i < recorded.length; i++) recorded[i] ??= 0
      } else {
        recorded = null
      }
      // The shown channel's sound that plays (from the play button or a trigger): the reels turn,
      // the play icon shows and the playhead moves. Other channels' sounds do not show.
      const sound = module.nowPlaying()
      const playhead = sound ? sound.at : null
      // Wind to the channel that is shown, and play (or record) a short strip. At most WIND_SPEED
      // per second; playing is slower, so the strip follows the sound exactly. Less motion: jump there.
      const limit = reducedMotion.matches ? Infinity : WIND_SPEED * seconds
      const toward = (from: number, to: number, max: number) =>
        from + Math.max(-max, Math.min(max, to - from))
      wind = toward(wind, module.active, limit / CHANNEL_SPACE)
      // The channel number turns with the tape: it settles when the tape does.
      channelNumber.style.setProperty('--at', wind.toFixed(4))
      // The markers ride on the tape with their channel (the canvas draws the other channels' markers).
      const offset = (wind - module.active) * canvas.clientWidth
      cuts.style.transform = offset ? `translateX(${offset.toFixed(1)}px)` : ''
      cutWindow.classList.toggle('winding', offset !== 0)
      let stripTarget = 0
      if (recorded)
        stripTarget = STRIP * Math.min(1, module.recordedSeconds / MAX_SECONDS)
      else if (sound) stripTarget = STRIP * sound.progress
      strip = toward(strip, stripTarget, limit)
      const moved = placeOnTape(wind) + strip - tape
      tape += moved
      // Both reels turn by the same length of tape. A small reel turns faster than a big one.
      turns[0] -= (moved * TAPE_LENGTH) / tapeRadius(1 - tape)
      turns[1] -= (moved * TAPE_LENGTH) / tapeRadius(tape)
      travel += moved * TAPE_LENGTH
      // The level: the microphone while recording, else the sampler's own sound.
      level = Math.max(
        recorded ? module.level() : module.outputLevel(),
        level - seconds * 1.2,
      )
      // The counter: the recorded time, the place in the sound that plays, or the cut's start.
      // A jump (another channel, a moved marker) turns the wheels quickly to the new time,
      // like an analog counter. Less motion: jump there.
      const shown = module.sound
      const duration = shown.buffer?.duration ?? 0
      let target = shown.start * duration
      if (recorded) target = module.recordedSeconds
      else if (playhead !== null) target = playhead * duration
      // Whole hundredths, so the wheels stop on a full digit when the time stands still.
      const hundredths = Math.round(target * 100)
      if (reducedMotion.matches) counter.jump(hundredths)
      else counter.roll(hundredths, seconds)
      drawWave(
        canvas,
        {
          channels: Array.from({ length: CHANNELS }, (_, channel) => {
            const { buffer, start, end } = module.soundOf(channel)
            return { columns: buffer ? columnsFor(buffer) : null, start, end }
          }),
          wind,
          active: module.active,
          playhead,
          playing: !!sound,
          recorded,
          tape,
          turns,
          travel,
          counter: counter.wheels,
          level,
          time: now / 1000,
        },
        colors,
      )
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    signal.addEventListener('abort', () => cancelAnimationFrame(frame))
  },
)

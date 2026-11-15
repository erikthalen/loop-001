import { defineModuleScript } from '@loop/core'
import { MAX_SECONDS, type setup } from './setup'
import { COLUMNS, columnsOf, drawWave, type WaveColors } from './wave'

const seconds = (value: number) => `${value.toFixed(2)} s`

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(({ root, module, signal }) => {
  const display = root.querySelector<HTMLElement>('.display')!
  const status = root.querySelector<HTMLElement>('.status')!
  const wave = root.querySelector<HTMLElement>('.wave')!
  const canvas = root.querySelector<HTMLCanvasElement>('.picture')!
  const startMarker = root.querySelector<HTMLButtonElement>('.marker.start')!
  const endMarker = root.querySelector<HTMLButtonElement>('.marker.end')!
  const startTime = root.querySelector<HTMLElement>('.start-time')!
  const lengthTime = root.querySelector<HTMLElement>('.length-time')!
  const endTime = root.querySelector<HTMLElement>('.end-time')!
  const radios = [...root.querySelectorAll<HTMLInputElement>('[name=channel]')]
  const rec = root.querySelector<HTMLInputElement>('[name=rec]')!
  const play = root.querySelector<HTMLButtonElement>('.play')!

  // The canvas cannot use CSS variables, so read the colors from styles.ts.
  // A hidden element turns any CSS color (also light-dark()) into rgb().
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
      background: resolve('var(--wave-background)'),
      middle: resolve('var(--wave-middle)'),
      bright: resolve('var(--wave-bright)'),
      dim: resolve('var(--wave-dim)'),
      rec: resolve('var(--rec)'),
      playhead: resolve('var(--wave-playhead)'),
      text: resolve('var(--wave-text)'),
      font: getComputedStyle(display).fontFamily,
    }
  }
  readColors()
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors, { signal })

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

    startTime.textContent = buffer ? seconds(start * duration) : '–'
    endTime.textContent = buffer ? seconds(end * duration) : '–'
    lengthTime.textContent = buffer ? seconds((end - start) * duration) : '–'

    for (const [marker, value] of [[startMarker, start], [endMarker, end]] as const) {
      marker.hidden = !buffer || module.recording
      marker.style.setProperty('--at', String(value))
      marker.setAttribute('aria-valuenow', String(Math.round(value * 100)))
      marker.setAttribute('aria-valuetext', seconds(value * duration))
    }

    radios.forEach((radio, i) => {
      radio.checked = i === module.active
      radio.disabled = module.recording
      radio.closest('label')!.classList.toggle('empty', !module.hasSound(i))
      radio.setAttribute('aria-label', `Channel ${i + 1}${module.hasSound(i) ? '' : ', empty'}`)
    })

    rec.checked = module.recording
    play.disabled = !buffer || module.recording
    play.textContent = module.playing ? 'stop' : 'play'
    play.setAttribute('aria-pressed', String(module.playing))

    canvas.setAttribute(
      'aria-label',
      buffer
        ? `Sound of channel ${module.active + 1}, ${seconds(duration)} long`
        : `Channel ${module.active + 1} is empty`,
    )
  }

  // ——— Inputs ———

  for (const radio of radios) {
    radio.addEventListener('change', () => {
      module.setActive(Number(radio.value))
      show()
    }, { signal })
  }

  rec.addEventListener('change', () => {
    if (rec.checked) void module.record()
    else module.stopRecording()
    show()
  }, { signal })

  play.addEventListener('click', () => (module.playing ? module.stop() : module.play()), { signal })

  // The markers: drag with the pointer, or use the arrow keys (Shift: bigger steps), Home and End.
  const markers = [
    [startMarker, (value: number) => module.setStart(value), () => module.sound.start],
    [endMarker, (value: number) => module.setEnd(value), () => module.sound.end],
  ] as const
  for (const [marker, set, get] of markers) {
    const placeOf = (event: PointerEvent) => {
      const box = wave.getBoundingClientRect()
      return (event.clientX - box.left) / box.width
    }
    marker.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      marker.focus()
      marker.setPointerCapture(event.pointerId)
    }, { signal })
    marker.addEventListener('pointermove', (event) => {
      if (!marker.hasPointerCapture(event.pointerId)) return
      set(placeOf(event))
      show()
    }, { signal })
    marker.addEventListener('keydown', (event) => {
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
    }, { signal })
  }

  const unsubscribe = module.subscribe(show)
  signal.addEventListener('abort', () => unsubscribe())
  show()

  // ——— The picture, about 60 times a second ———

  // While recording: one level per column, over the 5 seconds.
  let recorded: number[] | null = null
  let frame = 0
  const draw = () => {
    if (module.recording) {
      recorded ??= []
      const column = Math.floor((module.recordedSeconds / MAX_SECONDS) * COLUMNS)
      if (column < COLUMNS) recorded[column] = Math.max(recorded[column] ?? 0, module.level())
      for (let i = 0; i < recorded.length; i++) recorded[i] ??= 0
    } else {
      recorded = null
    }
    const { buffer, start, end } = module.sound
    drawWave(canvas, { columns: buffer ? columnsFor(buffer) : null, start, end, playhead: module.playhead(), recorded }, colors)
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  signal.addEventListener('abort', () => cancelAnimationFrame(frame))
})

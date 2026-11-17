/**
 * The SP-01 picture, drawn on a 2D canvas (247 x 120): a tape machine, in thin lines.
 *
 *   ┌───────────────────────────────────────────┐
 *   │ 3 ● rec    0:00:48              [ PLAY ] │   channel, status, time counter, play button
 *   │            ////////                     │ │   level ticks; level meter on the right (●)
 *   │   ( reel )      ▶ / ■ / ●     ( reel )    │   reels: hub, notches, spokes, the tape on them
 *   │      •──○────── [head] ──────○──•         │   tape path: rollers and the tape head
 *   │ | | | | | | | | | | | | | | | | | | | | | | │   ticks: orange inside the cut, light outside it
 *   │ ▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪ │   the sound (cells)
 *   │ ───────────────────────────────────────── │   6 tracks: each channel's cut, in its color
 *   └───────────────────────────────────────────┘
 *
 * - One tape holds all 6 channels (see script.ts). The more tape has moved to the right reel,
 *   the bigger it is. Winding to another channel slides the cut and the sound with the tape (to the
 *   right when winding forward, like the tape going from the left reel to the right one), past the
 *   channels in between.
 * - The sound: columns of small cells, one on the middle row, then the same number above and below.
 *   Between the markers it is bright, outside them dim. While recording: the microphone, in red.
 * - While a sound plays, an orange playhead line moves along the sound.
 * - The canvas has 4 times the screen's resolution (SUPERSAMPLE), so the thin lines stay sharp,
 *   also when zoomed in.
 */

export interface WaveColors {
  /** The cut markers. */
  marker: string
  screen: string
  ink: string
  dim: string
  muted: string
  line: string
  tape: string
  rec: string
  /** The 6 channel colors. */
  channels: readonly string[]
  font: string
}

export const WIDTH = 247
export const HEIGHT = 120
/**
 * Canvas pixels per screen pixel, in each direction. 4: sharp lines, also when zoomed in.
 * Each step costs more drawing work (4 is 16 times the pixels of 1), so do not go much higher.
 */
const SUPERSAMPLE = 4

/** The reels' middles, and the outer ring's radius. */
const REELS = [50, 197] as const
const REEL_Y = 50
const REEL_RING = 28
/** The hub (light disc) and the tape on the reel, from the hub out to (almost) the ring. */
const HUB = 12
const MAX_TAPE = 14
/** The tape head, in the middle under the reels. */
const HEAD_X = WIDTH / 2
const HEAD_Y = 62
/** The ticks (they show the cut), the sound and the 6 tracks, from top to bottom. */
const CUT_Y = 85
/** Space between two ticks, in px. */
const TICK_SPACE = 6
const SOUND_TOP = 87
const SOUND_BOTTOM = 106
const TRACKS_Y = 108
/** One column is 2px of cells and a 1px gap. One cell is 2px high with a 1px gap. */
const PITCH = 3
/** 82 columns of 3px: 246px. */
export const COLUMNS = 82
const LEFT = 1
/** The middle row of cells. */
const CENTER = (SOUND_TOP + SOUND_BOTTOM) / 2 - 1
/** Cells above (and below) the middle row, at full level. */
const MAX_CELLS = Math.floor((CENTER - SOUND_TOP) / PITCH)
/** The level meter on the right: a line from top to bottom, with a red dot at the level. */
const METER_X = WIDTH - 4
/** Starts under the play button (top right). */
const METER_TOP = 26
const METER_BOTTOM = 72

/** The radius of the tape on a reel, in px. `mass`: how much of the tape is on it, 0 to 1. */
export const tapeRadius = (mass: number) => HUB + 1 + MAX_TAPE * mass

/** The loudest sample in each column, from 0 to 1 (the loudest column is 1). */
export function columnsOf(buffer: AudioBuffer): Float32Array {
  const data = buffer.getChannelData(0)
  const per = data.length / COLUMNS
  const out = new Float32Array(COLUMNS)
  let peak = 0.0001
  for (let i = 0; i < COLUMNS; i++) {
    let p = 0
    for (let k = Math.floor(i * per); k < Math.floor((i + 1) * per); k++) p = Math.max(p, Math.abs(data[k]!))
    out[i] = p
    peak = Math.max(peak, p)
  }
  return out.map((p) => p / peak)
}

/** One channel on the tape: its sound as columns (see columnsOf, null: empty) and its markers. */
export interface TapeChannel {
  columns: Float32Array | null
  start: number
  end: number
}

export interface WaveState {
  /** All channels, in order. */
  channels: readonly TapeChannel[]
  /** Which channel is under the head: 0 is channel 1. Between two whole numbers: the tape is winding. */
  wind: number
  /** The channel that is shown (and recorded into). */
  active: number
  /** Where the shown channel's sound is playing now (0 to 1 of the whole sound), or null. */
  playhead: number | null
  /** True while the shown channel plays: shows the play triangle. */
  playing: boolean
  /** While recording: the level of each column so far. */
  recorded: number[] | null
  /** How much of the tape is on the right reel, 0 to 1. */
  tape: number
  /** How far each reel has turned, in radians. */
  turns: readonly [left: number, right: number]
  /** The time counter, in seconds. Not rounded: between two values, the digit wheels are turning. */
  counter: number
  /** The level meter and the ticks under the counter: 0 to 1. */
  level: number
  /** The time in seconds (the rec dot blinks). */
  time: number
}

/**
 * The counter "0:00:48" (minutes, seconds, hundredths) is made of digit wheels, like an analog
 * tape counter. Each wheel: how many hundredths one step of it is (`unit`), and its number of
 * digits (`size`: the tens of seconds only go to 5). A `null` is a colon.
 */
const WHEELS: ({ unit: number; size: number } | null)[] = [
  { unit: 6000, size: 10 },
  null,
  { unit: 1000, size: 6 },
  { unit: 100, size: 10 },
  null,
  { unit: 10, size: 10 },
  { unit: 1, size: 10 },
]
/** The counter's digit height (one step of a wheel), in px. */
const COUNTER_ROW = 15
const COUNTER_Y = 10

export function drawWave(canvas: HTMLCanvasElement, state: WaveState, c: WaveColors) {
  // More canvas pixels than screen pixels, so thin lines stay sharp.
  const dpr = (devicePixelRatio || 1) * SUPERSAMPLE
  if (canvas.width !== Math.round(WIDTH * dpr)) {
    canvas.width = Math.round(WIDTH * dpr)
    canvas.height = Math.round(HEIGHT * dpr)
  }
  const g = canvas.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.fillStyle = c.screen
  g.fillRect(0, 0, WIDTH, HEIGHT)
  g.lineCap = 'round'

  const circle = (x: number, y: number, r: number) => {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.stroke()
  }

  // ——— The time counter, and the level ticks under it ———
  g.font = `300 13px ${c.font}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = c.ink
  // Like an odometer: the last wheel turns all the time. A wheel to its left only turns while all
  // the wheels to its right roll over from 9 to 0, and then it moves on by one.
  const hundredths = Math.max(0, state.counter * 100)
  const charWidth = g.measureText('0').width
  let x = HEAD_X - (WHEELS.length * charWidth) / 2 + charWidth / 2
  g.save()
  g.beginPath()
  g.rect(0, COUNTER_Y - COUNTER_ROW / 2, WIDTH, COUNTER_ROW)
  g.clip()
  for (const wheel of WHEELS) {
    if (!wheel) {
      g.fillText(':', x, COUNTER_Y)
    } else {
      const steps = hundredths / wheel.unit
      const digit = Math.floor(steps) % wheel.size
      const below = hundredths % wheel.unit
      const turn = wheel.unit === 1 ? steps % 1 : Math.max(0, below - (wheel.unit - 1))
      // The digit moves up, and the next one comes in from below.
      g.fillText(String(digit), x, COUNTER_Y - turn * COUNTER_ROW)
      if (turn > 0) g.fillText(String((digit + 1) % wheel.size), x, COUNTER_Y + (1 - turn) * COUNTER_ROW)
    }
    x += charWidth
  }
  g.restore()
  const TICKS = 11
  g.lineWidth = 1.2
  for (let i = 0; i < TICKS; i++) {
    const x = HEAD_X - ((TICKS - 1) / 2) * 4.5 + i * 4.5
    g.strokeStyle = i < Math.round(state.level * TICKS) ? c.ink : c.dim
    line(x - 1, 26, x + 1, 20)
  }

  // ——— The level meter, on the right ———
  g.strokeStyle = c.dim
  g.lineWidth = 1
  line(METER_X, METER_TOP, METER_X, METER_BOTTOM)
  for (let y = METER_BOTTOM; y >= METER_TOP; y -= 8) line(METER_X - 3, y, METER_X - 1, y)
  g.fillStyle = c.rec
  circle(METER_X, METER_BOTTOM - state.level * (METER_BOTTOM - METER_TOP), 2.5)
  g.fill()

  // ——— The reels ———
  /** One reel. `mass` is how much tape is on it (0 to 1). Returns the tape's radius. */
  const reel = (x: number, mass: number, turn: number) => {
    const tape = tapeRadius(mass)
    // The outer ring, and the tape wound on the reel.
    g.strokeStyle = c.ink
    g.lineWidth = 1.2
    circle(x, REEL_Y, REEL_RING)
    g.stroke()
    g.fillStyle = c.line
    circle(x, REEL_Y, tape)
    g.fill()
    // Two spokes across the tape, that turn with the reel.
    g.strokeStyle = c.ink
    g.lineWidth = 1
    for (const side of [0, Math.PI]) {
      const angle = turn + side + Math.PI / 6
      line(
        x + Math.cos(angle) * (HUB + 2), REEL_Y + Math.sin(angle) * (HUB + 2),
        x + Math.cos(angle) * (REEL_RING - 2), REEL_Y + Math.sin(angle) * (REEL_RING - 2),
      )
    }
    // The hub: a light disc, a dark ring with 3 notches, and a dot in the middle.
    g.fillStyle = c.ink
    circle(x, REEL_Y, HUB)
    g.fill()
    g.fillStyle = c.screen
    circle(x, REEL_Y, 7)
    g.fill()
    for (let k = 0; k < 3; k++) {
      const angle = turn + (k * 2 * Math.PI) / 3
      circle(x + Math.cos(angle) * 7.5, REEL_Y + Math.sin(angle) * 7.5, 1.6)
      g.fill()
    }
    g.fillStyle = c.ink
    circle(x, REEL_Y, 1.8)
    g.fill()
    return tape
  }
  const left = reel(REELS[0], 1 - state.tape, state.turns[0])
  const right = reel(REELS[1], state.tape, state.turns[1])

  // ——— The tape path: from the reels, over rollers, past the head ———
  // The tape leaves each reel at the bottom, on the side of the head.
  const from = [REELS[0] + Math.cos(Math.PI * 0.42) * left, REEL_Y + Math.sin(Math.PI * 0.42) * left] as const
  const to = [REELS[1] + Math.cos(Math.PI * 0.58) * right, REEL_Y + Math.sin(Math.PI * 0.58) * right] as const
  const path: [number, number][] = [[...from], [66, 75], [92, 66], [HEAD_X, 66], [155, 66], [181, 75], [...to]]
  g.strokeStyle = c.muted
  g.lineWidth = 1
  g.beginPath()
  path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.stroke()
  // Rollers: small light dots by the reels, open circles by the head.
  for (const [x, y] of [path[1]!, path[5]!]) {
    g.fillStyle = c.ink
    circle(x, y, 2.2)
    g.fill()
  }
  for (const [x, y] of [path[2]!, path[4]!]) {
    g.fillStyle = c.screen
    g.strokeStyle = c.ink
    g.lineWidth = 1.2
    circle(x, y, 3.5)
    g.fill()
    g.stroke()
  }
  // The head: a light block with a slot.
  g.fillStyle = c.ink
  g.fillRect(HEAD_X - 6, HEAD_Y, 12, 9)
  g.fillStyle = c.screen
  g.fillRect(HEAD_X - 1, HEAD_Y, 2, 4)

  // ——— Rec (a blinking dot), play (a triangle), or stop (a square) ———
  if (state.recorded) {
    if (Math.floor(state.time / 0.4) % 2 === 0) {
      g.fillStyle = c.rec
      circle(HEAD_X, 43, 4.5)
      g.fill()
    }
  } else if (state.playing) {
    g.fillStyle = c.ink
    g.beginPath()
    g.moveTo(HEAD_X - 4.5, 37)
    g.lineTo(HEAD_X + 5.5, 43)
    g.lineTo(HEAD_X - 4.5, 49)
    g.closePath()
    g.fill()
  } else {
    g.fillStyle = c.line
    g.fillRect(HEAD_X - 4, 39, 8, 8)
  }

  // ——— The cut and the sound. While winding, two channels share the window. ———
  /** One column of cells: always one cell on the middle row, then the same number above and below it. */
  const column = (i: number, level: number, color: string) => {
    const cells = Math.round(Math.min(1, level) * MAX_CELLS)
    const x = LEFT + i * PITCH
    g.fillStyle = color
    g.fillRect(x, CENTER, PITCH - 1, 2)
    for (let k = 1; k <= cells; k++) {
      g.fillRect(x, CENTER - k * PITCH, PITCH - 1, 2)
      g.fillRect(x, CENTER + k * PITCH, PITCH - 1, 2)
    }
  }
  g.save()
  g.beginPath()
  g.rect(0, CUT_Y - 4, WIDTH, SOUND_BOTTOM - CUT_Y + 4)
  g.clip()
  const first = Math.floor(state.wind)
  for (const channel of [first, first + 1]) {
    const tape = state.channels[channel]
    if (!tape) continue
    // How far this channel is from the head, in px. The tape runs from the left reel to the right
    // one (the reels turn counterclockwise), so the next channel comes in from the left.
    const shift = Math.round((state.wind - channel) * WIDTH)
    if (Math.abs(shift) >= WIDTH) continue
    g.save()
    g.translate(shift, 0)
    // The ticks: a row of short lines on the tape. Orange inside the cut (the part that plays),
    // light outside it. An empty channel (or while recording): all light.
    const cut = tape.columns && !(channel === state.active && state.recorded)
    g.lineWidth = 1
    g.lineCap = 'butt'
    for (let x = TICK_SPACE / 2; x < WIDTH; x += TICK_SPACE) {
      const inside = cut && x >= tape.start * WIDTH && x <= tape.end * WIDTH
      g.strokeStyle = inside ? c.tape : c.ink
      line(x, CUT_Y - 2, x, CUT_Y + 2)
    }
    g.lineCap = 'round'
    if (channel === state.active && state.recorded) {
      state.recorded.forEach((level, i) => column(i, level * 1.4, c.rec))
    } else if (!tape.columns) {
      g.font = `400 10px ${c.font}`
      g.fillStyle = c.muted
      g.textAlign = 'center'
      // In the middle of its space: between the ticks and the tracks. Centered by the letters
      // above the line (the "p" hangs below it and does not count), so it looks centered.
      const text = 'blank tape — tick rec'
      const middle = (CUT_Y + 2 + TRACKS_Y) / 2
      g.textBaseline = 'alphabetic'
      g.fillText(text, WIDTH / 2, middle + g.measureText(text).actualBoundingBoxAscent / 2)
      g.textBaseline = 'middle'
    } else {
      // The sound.
      tape.columns.forEach((level, i) => {
        const at = (i + 0.5) / COLUMNS
        column(i, level, at >= tape.start && at <= tape.end ? c.ink : c.dim)
      })
    }
    g.restore()
  }
  g.restore()

  // ——— The other channels' cut markers, while the tape winds past them ———
  // (The shown channel's markers are buttons on top of the canvas, see template.ts.)
  g.fillStyle = c.marker
  for (const channel of [first, first + 1]) {
    const tape = state.channels[channel]
    if (!tape || channel === state.active) continue
    const shift = (state.wind - channel) * WIDTH
    const [start, end] = tape.columns ? [tape.start, tape.end] : [0, 1]
    for (const at of [start, end]) {
      const x = Math.round(shift + at * WIDTH)
      if (x >= 0 && x <= WIDTH) g.fillRect(x - 0.5, CUT_Y - 4, 1, HEIGHT - CUT_Y + 4)
    }
  }

  // ——— The 6 tracks: a thin line per channel, with its cut in its color ———
  state.channels.forEach((tape, i) => {
    const y = TRACKS_Y + i * 2
    g.fillStyle = c.dim
    g.fillRect(0, y, WIDTH, 1)
    if (!tape.columns) return
    g.globalAlpha = i === state.active ? 1 : 0.5
    g.fillStyle = c.channels[i]!
    g.fillRect(tape.start * WIDTH, y, (tape.end - tape.start) * WIDTH, 1)
    g.globalAlpha = 1
  })

  // ——— The playhead: an orange line that moves along the sound ———
  if (state.playhead !== null) {
    g.fillStyle = c.tape
    g.fillRect(state.playhead * WIDTH - 0.75, CUT_Y - 3, 1.5, HEIGHT - CUT_Y + 3)
  }
}

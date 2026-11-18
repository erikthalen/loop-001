/**
 * The SP-01 picture, drawn on a 2D canvas (247 x 120): a tape machine, in thin lines.
 *
 *   ┌───────────────────────────────────────────┐
 *   │ 3 ● rec    0:00:48              [ PLAY ] │   channel, status, time counter, play button
 *   │            ////////                     │ │   level ticks; level meter on the right (●)
 *   │   ( reel )      ▶ / ■ / ●     ( reel )    │   reels: hub, spokes, rim ticks, the tape on them
 *   │      ○──○────── [head] ──────○──○         │   tape path: rollers (they turn) and the tape head
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
/** The tape head, in the middle under the reels. Its top is where the tape runs over it. */
const HEAD_X = WIDTH / 2
const HEAD_Y = 62
/** How far the tape runs outside a roller's line (it lies on the roller's edge), in px. */
const ROLLER_TAPE = 1
/**
 * How fast the rollers turn, compared to the tape: slower than real, so the ticks are easy to
 * follow (1 would be real speed).
 */
const ROLLER_SPIN = 0.25
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
  /** How far the tape has moved past the rollers, in px (they turn with it). */
  travel: number
  /**
   * The time counter's digit wheels (COUNTER_WHEELS, see createOdometer in @loop/ui): each one 0 to
   * its size. Between two whole numbers, a wheel is turning.
   */
  counter: readonly number[]
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
/** The counter's wheels without the colons, in hundredths: for createOdometer in @loop/ui. */
export const COUNTER_WHEELS = WHEELS.filter((wheel) => wheel !== null)
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
  // Each wheel's place comes from the script (an odometer, see createOdometer in @loop/ui).
  let wheelIndex = 0
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
      const place = state.counter[wheelIndex++] ?? 0
      const digit = Math.floor(place) % wheel.size
      const turn = place % 1
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
    /** A point on the reel: at an angle, at a distance from its middle. */
    const at = (angle: number, r: number) => [x + Math.cos(angle) * r, REEL_Y + Math.sin(angle) * r] as const
    // The tape wound on the reel. Faint rings: the windings.
    g.fillStyle = c.line
    circle(x, REEL_Y, tape)
    g.fill()
    g.strokeStyle = c.dim
    g.lineWidth = 0.35
    for (let r = HUB + 3; r < tape - 0.5; r += 2.5) {
      circle(x, REEL_Y, r)
      g.stroke()
    }
    g.lineWidth = 0.6
    circle(x, REEL_Y, tape)
    g.stroke()
    // The flange: the outer ring, a thin ring inside it, and ticks between them that turn with the
    // reel (a longer one every 3).
    g.strokeStyle = c.ink
    g.lineWidth = 1.2
    circle(x, REEL_Y, REEL_RING)
    g.stroke()
    g.strokeStyle = c.dim
    g.lineWidth = 0.5
    circle(x, REEL_Y, REEL_RING - 2.5)
    g.stroke()
    for (let i = 0; i < 36; i++) {
      const angle = turn + (i * Math.PI * 2) / 36
      const long = i % 3 === 0
      g.strokeStyle = long ? c.muted : c.dim
      line(...at(angle, REEL_RING - 0.9), ...at(angle, long ? REEL_RING - 2.5 : REEL_RING - 1.8))
    }
    // Two spokes across the tape, that turn with the reel, each with a rivet at its end (one
    // red: you can see the reel turn even when the tape hides the rest).
    g.lineWidth = 1
    ;[c.ink, c.rec].forEach((rivet, k) => {
      const angle = turn + k * Math.PI + Math.PI / 6
      g.strokeStyle = c.ink
      line(...at(angle, HUB + 2), ...at(angle, REEL_RING - 3))
      g.fillStyle = rivet
      circle(...at(angle, REEL_RING - 5), 1.3)
      g.fill()
    })
    // Two small screws between the spokes, near the hub.
    g.fillStyle = c.screen
    g.strokeStyle = c.muted
    g.lineWidth = 0.6
    for (const side of [0, Math.PI]) {
      const [sx, sy] = at(turn + side + Math.PI * (2 / 3), HUB + 4)
      circle(sx, sy, 1.2)
      g.fill()
      g.stroke()
      line(sx - 0.7, sy, sx + 0.7, sy)
    }
    // The hub: a dark ring with 3 notches, a light disc, a thin ring, and the spindle with 3 keys.
    g.fillStyle = c.ink
    circle(x, REEL_Y, HUB)
    g.fill()
    g.fillStyle = c.screen
    circle(x, REEL_Y, 7)
    g.fill()
    for (let k = 0; k < 3; k++) {
      circle(...at(turn + (k * 2 * Math.PI) / 3, 7.5), 1.6)
      g.fill()
    }
    g.strokeStyle = c.dim
    g.lineWidth = 0.6
    circle(x, REEL_Y, 4.6)
    g.stroke()
    g.fillStyle = c.ink
    circle(x, REEL_Y, 2.4)
    g.fill()
    g.strokeStyle = c.ink
    g.lineWidth = 0.8
    for (let k = 0; k < 3; k++) {
      const angle = turn + (k * 2 * Math.PI) / 3 + Math.PI / 3
      line(...at(angle, 2.2), ...at(angle, 3.6))
    }
    g.fillStyle = c.screen
    circle(x, REEL_Y, 0.8)
    g.fill()
    return tape
  }
  const left = reel(REELS[0], 1 - state.tape, state.turns[0])
  const right = reel(REELS[1], state.tape, state.turns[1])

  // ——— The tape path: from the reels, around the rollers, over the head ———
  // The tape is pulled tight around the rollers: straight lines that touch each roller (tangents),
  // and arcs along the rollers' edges. `side`: where the roller is, seen from the tape: -1 above it
  // (the tape runs under it), 1 below it (the tape runs over it).
  interface Wheel { x: number; y: number; r: number; side: 1 | -1 }
  const tension: [Wheel, Wheel] = [{ x: 68, y: 77, r: 3, side: -1 }, { x: 179, y: 77, r: 3, side: -1 }]
  const guides: [Wheel, Wheel] = [{ x: 92, y: 66, r: 3.5, side: 1 }, { x: 155, y: 66, r: 3.5, side: 1 }]
  /** The tape lies on the roller's edge, so it runs just outside the roller's line. */
  const onEdge = (wheel: Wheel): Wheel => ({ ...wheel, r: wheel.r + ROLLER_TAPE })
  /**
   * The straight piece of tape from wheel `a` to wheel `b`: where it leaves `a` and where it
   * reaches `b`. (In complex numbers: the direction is (b - a) / (along + i·k).)
   */
  const tangent = (a: Wheel, b: Wheel) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const square = dx * dx + dy * dy
    const k = b.side * b.r - a.side * a.r
    const along = Math.sqrt(Math.max(0, square - k * k))
    const tx = (dx * along + dy * k) / square
    const ty = (dy * along - dx * k) / square
    // The normal (the tape direction turned a quarter): from the tape towards a wheel below it.
    const [nx, ny] = [-ty, tx]
    return {
      leave: [a.x - a.side * a.r * nx, a.y - a.side * a.r * ny] as const,
      reach: [b.x - b.side * b.r * nx, b.y - b.side * b.r * ny] as const,
    }
  }
  // The reels: the tape comes off the bottom of each pack (the pack is above the tape).
  const packs: [Wheel, Wheel] = [{ x: REELS[0], y: REEL_Y, r: left, side: -1 }, { x: REELS[1], y: REEL_Y, r: right, side: -1 }]
  const wheels = [packs[0], ...[tension[0], guides[0], guides[1], tension[1]].map(onEdge), packs[1]]
  const pieces = wheels.slice(1).map((wheel, i) => tangent(wheels[i]!, wheel))

  /** A roller: an open circle with a tick that turns with the tape, slower than the tape (like Master's). */
  const roller = ({ x, y, r, side }: Wheel) => {
    g.fillStyle = c.screen
    g.strokeStyle = c.ink
    g.lineWidth = 1.1
    circle(x, y, r)
    g.fill()
    g.stroke()
    g.lineWidth = 0.8
    // A roller under the tape turns one way, a roller over it the other way.
    const angle = (side * state.travel * ROLLER_SPIN) / r
    line(x, y, x + Math.cos(angle) * (r - 1.2), y + Math.sin(angle) * (r - 1.2))
    g.fillStyle = c.ink
    circle(x, y, 0.8)
    g.fill()
  }
  // The tension rollers by the reels (small), and the guides by the head.
  for (const wheel of [...tension, ...guides]) roller(wheel)

  // The tape, over the rollers: straight pieces, and an arc around each roller between them.
  g.strokeStyle = c.muted
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(...pieces[0]!.leave)
  pieces.forEach((piece, i) => {
    g.lineTo(...piece.reach)
    const next = pieces[i + 1]
    const wheel = wheels[i + 1]!
    if (!next) return
    const from = Math.atan2(piece.reach[1] - wheel.y, piece.reach[0] - wheel.x)
    const to = Math.atan2(next.leave[1] - wheel.y, next.leave[0] - wheel.x)
    // Under a roller the tape goes around it one way, over a roller the other way.
    g.arc(wheel.x, wheel.y, wheel.r, from, to, wheel.side === -1)
  })
  g.stroke()

  // ——— The tape head, under the tape ———
  // The plate it stands on.
  g.fillStyle = c.line
  g.strokeStyle = c.ink
  g.lineWidth = 0.8
  g.beginPath()
  g.roundRect(HEAD_X - 7.5, HEAD_Y + 7, 15, 3, 1)
  g.fill()
  g.stroke()
  // Two pins, one on each side, that keep the tape on the head.
  g.fillStyle = c.ink
  for (const dx of [-7, 7]) {
    circle(HEAD_X + dx, HEAD_Y + 1, 0.9)
    g.fill()
  }
  // The head: a block with a rounded top (the tape only touches it in the middle), and the gap
  // at the top, where it reads the tape.
  g.beginPath()
  g.roundRect(HEAD_X - 4.5, HEAD_Y, 9, 7.5, [3, 3, 0, 0])
  g.fill()
  g.strokeStyle = c.screen
  g.lineWidth = 0.6
  line(HEAD_X, HEAD_Y + 0.4, HEAD_X, HEAD_Y + 2.8)

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

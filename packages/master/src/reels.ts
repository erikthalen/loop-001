/**
 * The Master's picture: the reels of a tape machine, drawn on a 2D canvas in the same thin-line
 * style as the other modules. Their tops stick out above the screen. The counter is over the head.
 *
 *         .-~~~-.           .-~~~-.
 *       /  ◜   ◝  \       /  ◜   ◝  \          ← outside the screen
 *   ───(  ◟  ◉  ◞  )─────(  ◟  ◉  ◞  )───────  ← the top of the screen
 *       \   ◡    /   0021  \   ◡    /
 *     o  `-...-´    ▶       `-...-´  o
 *      \___o____[▮ ▮ ▮]____●o____o___/          ← the tape: rollers, the head block, the capstan
 *
 * - Each reel: a metal disc with 3 windows. Through the windows you see the tape wound on it
 *   (the tape pack). Ticks on the rim and the hub show it turning.
 * - The tape goes from the left reel to the right one while it plays, so the left pack gets
 *   smaller and the right one bigger. The reels turn with the tape: a small pack turns faster.
 * - The counter, over the head: steps on digit wheels. It counts from where the last rewind went
 *   to, so a rewind rolls it back to 0.
 * - The transport sign, under the counter: ▶ playing, ◀◀ rewinding, ■ still (red).
 */

import type { OdometerWheel } from '@loop/ui'

export interface ReelColors {
  screen: string
  ink: string
  line: string
  dim: string
  muted: string
  /** The module's main color (--loop-primary): the transport sign while it plays or rewinds. */
  primary: string
  /** The transport sign while it stands still (the stop square). */
  red: string
  font: string
}

export interface ReelState {
  /** How far each reel has turned, in radians. */
  turns: readonly [left: number, right: number]
  /** How much of the tape is on the right reel, 0 to 1. */
  tape: number
  /** How far the tape has moved past the rollers, in px (they turn with it). */
  travel: number
  /**
   * The counter's 4 digit wheels (thousands first): where each one is, 0 to 10. 2.5 is halfway
   * from 2 to 3. See COUNTER_WHEELS (the script rolls them with createOdometer in @loop/ui).
   */
  wheels: readonly number[]
  /** What the tape does. */
  transport: 'play' | 'rewind' | 'still'
}

/** The canvas size, in CSS px. As wide as the whole screen (with its padding). */
export const WIDTH = 275
export const HEIGHT = 140
/** How far the canvas sticks out above the screen, in px. */
export const OVERFLOW = 40
/** Canvas pixels per screen pixel, in each direction (like the other modules: sharp thin lines). */
const SUPERSAMPLE = 4

/** The reels: their middles, and their size. */
const REELS = [64, 211] as const
const REEL_Y = 50
const REEL = 45
/** The hub, and the window cut-outs in the disc (from the hub out to near the rim). */
const HUB = 12
const WINDOW_IN = 17
const WINDOW_OUT = 37.5
/** Each window's width, in radians (3 windows). */
const WINDOW_WIDTH = (Math.PI * 2) / 3 - 0.85
/** The tape pack: from the hub out to at most this radius. */
const PACK_MAX = 35
/** The tape, under the reels: rollers, the head block and the capstan. */
const TAPE_Y = 118
const HEAD_X = WIDTH / 2
/** The counter, between the reels. */
const COUNTER_Y = TAPE_Y - 33
const COUNTER_ROW = 15
/** The counter's 4 digit wheels (thousands first), in steps: for createOdometer in @loop/ui. */
export const COUNTER_WHEELS: readonly OdometerWheel[] = [1000, 100, 10, 1].map((unit) => ({ unit }))

/** The tape on a reel: its radius, in px. `mass`: how much of the tape is on it, 0 to 1. */
export const packRadius = (mass: number) => HUB + 2 + (PACK_MAX - HUB - 2) * Math.min(1, Math.max(0, mass))

export function drawReels(canvas: HTMLCanvasElement, state: ReelState, c: ReelColors) {
  const scale = (devicePixelRatio || 1) * SUPERSAMPLE
  if (canvas.width !== Math.round(WIDTH * scale) || canvas.height !== Math.round(HEIGHT * scale)) {
    canvas.width = Math.round(WIDTH * scale)
    canvas.height = Math.round(HEIGHT * scale)
  }
  const g = canvas.getContext('2d')!
  g.setTransform(scale, 0, 0, scale, 0, 0)
  // No background: above the screen the page shows through, around the reels and in their windows.
  g.clearRect(0, 0, WIDTH, HEIGHT)
  g.lineCap = 'round'
  g.lineJoin = 'round'

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
  const at = (x: number, y: number, angle: number, r: number) => [x + Math.cos(angle) * r, y + Math.sin(angle) * r] as const

  const packs = [packRadius(1 - state.tape), packRadius(state.tape)] as const

  // ——— The tape path, under the reels ———
  // Rollers: the tension rollers by the reels, two guides by the head, and the pinch roller.
  const outer = [[18, 94], [WIDTH - 18, 94]] as const
  const guides = [[66, TAPE_Y], [WIDTH - 54, TAPE_Y]] as const
  const capstan = [WIDTH - 72, TAPE_Y - 3.5] as const
  const pinch = [WIDTH - 72, TAPE_Y + 6] as const
  /** Where the tape leaves a reel's pack, on its outer side, towards the roller (a tangent). */
  const leave = (reel: 0 | 1) => {
    const [px, py] = outer[reel]
    const cx = REELS[reel]
    const r = packs[reel]
    const angle = Math.atan2(py - REEL_Y, px - cx)
    const spread = Math.acos(Math.min(1, r / Math.hypot(px - cx, py - REEL_Y)))
    return at(cx, REEL_Y, reel === 0 ? angle + spread : angle - spread, r)
  }
  g.strokeStyle = c.muted
  g.lineWidth = 1.1
  g.beginPath()
  const path = [leave(0), [outer[0][0] - 4, outer[0][1]], [outer[0][0], outer[0][1] + 4], [guides[0][0], TAPE_Y + 4], [HEAD_X, TAPE_Y + 1],
    [capstan[0], TAPE_Y + 1], [guides[1][0], TAPE_Y + 4], [outer[1][0], outer[1][1] + 4], [outer[1][0] + 4, outer[1][1]], leave(1)]
  path.forEach(([x, y], i) => (i ? g.lineTo(x!, y!) : g.moveTo(x!, y!)))
  g.stroke()

  /** A roller: an open circle with a tick that turns with the tape. */
  const roller = (x: number, y: number, r: number) => {
    g.fillStyle = c.screen
    g.strokeStyle = c.ink
    g.lineWidth = 1.1
    circle(x, y, r)
    g.fill()
    g.stroke()
    g.lineWidth = 0.8
    const [tx, ty] = at(x, y, state.travel / r, r - 1.6)
    line(x, y, tx, ty)
    g.fillStyle = c.ink
    circle(x, y, 0.9)
    g.fill()
  }
  for (const [x, y] of outer) roller(x, y, 4.5)
  for (const [x, y] of guides) roller(x, y, 4)
  roller(pinch[0], pinch[1], 5)
  // The capstan: a small steel pin above the tape.
  g.fillStyle = c.ink
  circle(capstan[0], capstan[1], 2)
  g.fill()

  // The head block: three heads (erase, record, play) in a row, under the tape.
  g.fillStyle = c.line
  g.strokeStyle = c.ink
  g.lineWidth = 1
  g.beginPath()
  g.roundRect(HEAD_X - 30, TAPE_Y + 2, 60, 13, 2.5)
  g.fill()
  g.stroke()
  for (const dx of [-18, 0, 18]) {
    g.fillStyle = c.ink
    g.beginPath()
    g.roundRect(HEAD_X + dx - 4.5, TAPE_Y + 1, 9, 7, [3, 3, 1, 1])
    g.fill()
    g.fillStyle = c.screen
    g.fillRect(HEAD_X + dx - 0.5, TAPE_Y + 1, 1, 3)
  }
  g.fillStyle = c.dim
  for (const dx of [-26, 26]) {
    circle(HEAD_X + dx, TAPE_Y + 11.5, 1)
    g.fill()
  }

  // ——— The reels ———
  /** One reel at `x`, turned by `turn`, with a tape pack of radius `pack`. */
  const reel = (x: number, turn: number, pack: number) => {
    // The tape pack, behind the disc: you see it through the windows. Faint rings: the windings.
    g.fillStyle = c.line
    circle(x, REEL_Y, pack)
    g.fill()
    g.strokeStyle = c.dim
    g.lineWidth = 0.4
    for (let r = HUB + 3; r < pack - 0.5; r += 2.5) {
      circle(x, REEL_Y, r)
      g.stroke()
    }
    g.lineWidth = 0.8
    circle(x, REEL_Y, pack)
    g.stroke()

    // The disc, with its 3 windows cut out (even-odd: the windows are holes).
    const windows = (path: Path2D) => {
      for (let k = 0; k < 3; k++) {
        const middle = turn + (k * Math.PI * 2) / 3 - Math.PI / 2
        const a = middle - WINDOW_WIDTH / 2
        const b = middle + WINDOW_WIDTH / 2
        path.moveTo(...at(x, REEL_Y, a, WINDOW_IN))
        path.arc(x, REEL_Y, WINDOW_OUT, a, b)
        path.arc(x, REEL_Y, WINDOW_IN, b, a, true)
        path.closePath()
      }
    }
    const disc = new Path2D()
    disc.arc(x, REEL_Y, REEL, 0, Math.PI * 2)
    windows(disc)
    g.fillStyle = c.screen
    g.fill(disc, 'evenodd')
    const holes = new Path2D()
    windows(holes)
    g.strokeStyle = c.ink
    g.lineWidth = 1
    g.stroke(holes)

    // The rim: a line, then ticks that turn with the reel (a longer one every 5).
    g.lineWidth = 1.2
    circle(x, REEL_Y, REEL)
    g.stroke()
    g.strokeStyle = c.dim
    g.lineWidth = 0.6
    circle(x, REEL_Y, REEL - 3)
    g.stroke()
    for (let i = 0; i < 60; i++) {
      const angle = turn + (i * Math.PI * 2) / 60
      g.strokeStyle = i % 5 === 0 ? c.muted : c.dim
      line(...at(x, REEL_Y, angle, REEL - 4), ...at(x, REEL_Y, angle, i % 5 === 0 ? REEL - 7 : REEL - 5.5))
    }
    // Three screws between the windows.
    g.strokeStyle = c.muted
    g.lineWidth = 0.7
    for (let k = 0; k < 3; k++) {
      const angle = turn + (k * Math.PI * 2) / 3 + Math.PI / 6 + Math.PI / 3
      const [sx, sy] = at(x, REEL_Y, angle, WINDOW_IN - 2.5)
      circle(sx, sy, 1.3)
      g.stroke()
    }

    // The hub: a dark ring with 3 locking tabs, a light middle, and the spindle.
    g.fillStyle = c.ink
    circle(x, REEL_Y, HUB)
    g.fill()
    g.fillStyle = c.screen
    circle(x, REEL_Y, HUB - 3.5)
    g.fill()
    g.fillStyle = c.ink
    for (let k = 0; k < 3; k++) {
      const angle = turn + (k * Math.PI * 2) / 3 + Math.PI / 2
      g.save()
      g.translate(...at(x, REEL_Y, angle, HUB - 4.5))
      g.rotate(angle)
      g.fillRect(-1.7, -2, 3.4, 4)
      g.restore()
    }
    circle(x, REEL_Y, 3)
    g.fill()
    g.fillStyle = c.screen
    circle(x, REEL_Y, 1.1)
    g.fill()
  }
  reel(REELS[0], state.turns[0], packs[0])
  reel(REELS[1], state.turns[1], packs[1])

  // ——— The counter, over the head: steps, on 4 digit wheels ———
  g.font = `300 13px ${c.font}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const charWidth = g.measureText('0').width
  const left = HEAD_X - charWidth * 2
  g.save()
  g.beginPath()
  g.rect(left - 2, COUNTER_Y - COUNTER_ROW / 2, charWidth * 4 + 4, COUNTER_ROW)
  g.clip()
  // Each wheel: its digit moves up as it turns, and the next one comes in from below.
  state.wheels.forEach((wheel, i) => {
    const x = left + charWidth * (i + 0.5)
    const digit = Math.floor(wheel) % 10
    const turn = wheel % 1
    g.fillStyle = c.ink
    g.fillText(String(digit), x, COUNTER_Y - turn * COUNTER_ROW)
    if (turn > 0) g.fillText(String((digit + 1) % 10), x, COUNTER_Y + (1 - turn) * COUNTER_ROW)
  })
  g.restore()
  // A thin line under the counter.
  g.strokeStyle = c.dim
  g.lineWidth = 0.6
  line(left - 1, COUNTER_Y + 8.5, left + charWidth * 4 + 1, COUNTER_Y + 8.5)

  // ——— The transport sign, under the counter: ▶ play, ◀◀ rewind (both in the main color), ■ still (red) ———
  const signY = COUNTER_Y + 16
  const signX = HEAD_X
  g.fillStyle = state.transport === 'still' ? c.red : c.primary
  g.beginPath()
  if (state.transport === 'play') {
    g.moveTo(signX - 3, signY - 3.5)
    g.lineTo(signX + 4, signY)
    g.lineTo(signX - 3, signY + 3.5)
  } else if (state.transport === 'rewind') {
    // Two triangles pointing left.
    for (const dx of [-3.5, 3.5]) {
      g.moveTo(signX + dx + 3.5, signY - 3.5)
      g.lineTo(signX + dx - 3.5, signY)
      g.lineTo(signX + dx + 3.5, signY + 3.5)
      g.closePath()
    }
  } else {
    g.rect(signX - 3, signY - 3, 6, 6)
  }
  g.closePath()
  g.fill()
}

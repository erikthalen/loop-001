/**
 * The MT-01 picture, drawn on a 2D canvas (140 x 44), in the same thin-line style as the sampler.
 *
 *   ┌────────────────────────────────────────────┐
 *   │    .·'''·.     1 2 0  bpm                  │   a scale arc with ticks, over the swinging arm
 *   │   /  |/  \       ~~~~~~                    │   the tempo on digit wheels (like the sampler's counter)
 *   │  /   ▮    \                                │   the weight (orange): high is slow, low is fast
 *   │ /    ◎     \     [ tempo slider ]           │   (a @loop/ui range slider, on top of the canvas)
 *   │ ‾‾‾‾‾‾‾‾‾‾‾‾                               │
 *   └────────────────────────────────────────────┘
 *
 * - The arm swings over a scale. Two faint "ghost" arms show where it was a moment ago.
 * - The tempo turns like an analog counter: a jump in tempo rolls the digit wheels to it.
 *   A leading zero (for example the 0 in "090") is dim.
 */

export interface PictureColors {
  screen: string
  ink: string
  dim: string
  muted: string
  orange: string
  font: string
}

export interface PictureState {
  /** The arm's angle, in degrees. Negative is left. */
  angle: number
  /** The arm a moment ago (faint). */
  ghosts: readonly number[]
  /** The tempo. Not rounded: between two values, the digit wheels are turning. */
  bpm: number
}

export const WIDTH = 140
export const HEIGHT = 44
/** Canvas pixels per screen pixel, in each direction (like the sampler: sharp thin lines). */
const SUPERSAMPLE = 4

/** The pivot, where the arm turns. */
const PIVOT_X = 23
const PIVOT_Y = 37
const ARM = 33
/** The swing, and the scale arc above it. */
export const SWING = 24
const SCALE_RADIUS = 30
/** The tempo range. */
export const MIN_BPM = 20
export const MAX_BPM = 300
/** The digit wheels. */
const DIGITS_X = 50
const DIGITS_Y = 13
const DIGIT_ROW = 30

/** How far the weight sits from the pivot: high (slow) at 30 bpm, low (fast) at 300 bpm. */
const weightAt = (bpm: number) =>
  29 - ((Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)) - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 16

export function drawPicture(canvas: HTMLCanvasElement, state: PictureState, c: PictureColors) {
  const scale = (devicePixelRatio || 1) * SUPERSAMPLE
  if (canvas.width !== Math.round(WIDTH * scale)) {
    canvas.width = Math.round(WIDTH * scale)
    canvas.height = Math.round(HEIGHT * scale)
  }
  const g = canvas.getContext('2d')!
  g.setTransform(scale, 0, 0, scale, 0, 0)
  g.fillStyle = c.screen
  g.fillRect(0, 0, WIDTH, HEIGHT)
  g.lineCap = 'round'
  g.lineJoin = 'round'

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.stroke()
  }
  /** A point at `angle` degrees from straight up, `r` px from the pivot. */
  const at = (angle: number, r: number): [number, number] => {
    const a = (angle * Math.PI) / 180
    return [PIVOT_X + Math.sin(a) * r, PIVOT_Y - Math.cos(a) * r]
  }

  // ——— The body and the base ———
  g.strokeStyle = c.ink
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(19, 2)
  g.lineTo(27, 2)
  g.lineTo(40, 41)
  g.lineTo(6, 41)
  g.closePath()
  g.stroke()
  g.lineWidth = 1.5
  line(2, 43, 44, 43)

  // ——— The scale: ticks on an arc, a long one in the middle ———
  g.lineWidth = 0.8
  for (let i = -6; i <= 6; i++) {
    const angle = (i / 6) * (SWING + 2)
    g.strokeStyle = i === 0 ? c.orange : c.muted
    line(...at(angle, i === 0 ? SCALE_RADIUS - 4 : SCALE_RADIUS - 2), ...at(angle, SCALE_RADIUS))
  }

  // ——— The arm: faint ghosts, then the arm with its weight ———
  const arm = (angle: number) => {
    line(PIVOT_X, PIVOT_Y, ...at(angle, ARM))
    g.save()
    g.translate(...at(angle, weightAt(state.bpm)))
    g.rotate((angle * Math.PI) / 180)
    g.fillRect(-3.5, -2.5, 7, 5)
    g.restore()
  }
  g.lineWidth = 1.2
  state.ghosts.forEach((ghost, i) => {
    g.globalAlpha = 0.12 + i * 0.08
    g.strokeStyle = c.ink
    g.fillStyle = c.ink
    arm(ghost)
  })
  g.globalAlpha = 1
  g.strokeStyle = c.ink
  g.fillStyle = c.orange
  arm(state.angle)

  // The pivot: a ring with a dot.
  g.fillStyle = c.screen
  g.strokeStyle = c.ink
  g.lineWidth = 1
  g.beginPath()
  g.arc(PIVOT_X, PIVOT_Y, 2.8, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.fillStyle = c.ink
  g.beginPath()
  g.arc(PIVOT_X, PIVOT_Y, 1, 0, Math.PI * 2)
  g.fill()

  // ——— The tempo on 3 digit wheels ———
  // Like an odometer: the last wheel turns; a wheel to its left only turns while the wheels to its
  // right roll over from 9 to 0.
  g.font = `200 30px ${c.font}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const bpm = Math.max(0, state.bpm)
  const charWidth = g.measureText('0').width
  g.save()
  g.beginPath()
  g.rect(DIGITS_X - 2, DIGITS_Y - DIGIT_ROW / 2, charWidth * 3 + 4, DIGIT_ROW)
  g.clip()
  ;[100, 10, 1].forEach((unit, i) => {
    const x = DIGITS_X + charWidth * (i + 0.5)
    const steps = bpm / unit
    const digit = Math.floor(steps) % 10
    const turn = unit === 1 ? steps % 1 : Math.max(0, (bpm % unit) - (unit - 1))
    // A leading zero is dim, like an unlit display.
    g.fillStyle = unit > 1 && bpm < unit ? c.dim : c.ink
    g.fillText(String(digit), x, DIGITS_Y - turn * DIGIT_ROW)
    if (turn > 0) g.fillText(String((digit + 1) % 10), x, DIGITS_Y + (1 - turn) * DIGIT_ROW)
  })
  g.restore()
  g.font = `500 8px ${c.font}`
  // "BPM" at the top right, in line with the end of the tempo slider below it.
  g.textAlign = 'right'
  g.fillStyle = c.muted
  g.fillText('BPM', WIDTH, 5)
}

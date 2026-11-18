/**
 * The MT-01 picture, drawn on a 2D canvas (24px high, as wide as the module), in the same
 * thin-line style as the sampler and the VU meter. One flat row: the ∞ on the left, the tempo on
 * the right. Both are exactly as high as the digits.
 *
 *    ┊ ·  ·  ·  ·  ·   ·  ·  ·  ·  · ┊
 *    ┊·             ╲ ╱             ·┊      1 2 0  B P M
 *    ┊ ·  ·  ·  ·  ·  ✕  ·  ●~~ ·  · ┊
 *
 * The ∞ (a lemniscate of Gerono): the dot goes once around it every two beats. It passes the
 * crossing in the middle exactly on each beat, then goes around one loop (fast in the middle,
 * slow at the end), and back to the middle on the next beat, then around the other loop.
 * - The path has fine ticks, and small marks at both ends. A blue cross marks the middle.
 * - The dot (blue) draws a trail behind it, about half a beat long: thick and bright at the dot,
 *   thin and faint at its end, with a soft glow.
 * - On each beat the middle flashes (blue on the first beat of the bar).
 *
 * The tempo: digit wheels and "BPM" in the same size, on one base line. A jump in tempo rolls the
 * wheels to it, like an analog counter (the script rolls them, see createOdometer in @loop/ui).
 * A leading zero (for example the 0 in "090") is dim.
 */

import type { OdometerWheel } from '@loop/ui'

/** The tempo's 3 digit wheels (hundreds first), in bpm: for createOdometer in @loop/ui. */
export const BPM_WHEELS: readonly OdometerWheel[] = [100, 10, 1].map((unit) => ({ unit }))

export interface PictureColors {
  screen: string
  ink: string
  dim: string
  muted: string
  /** The module's main color (--loop-primary, the app's dodgerblue): the dot, the cross, the accent. */
  primary: string
  font: string
}

export interface PictureState {
  /**
   * Where the dot is on the ∞, in radians: 0, π, 2π... is the middle; π/2 the right end, 3π/2 the
   * left end (then it goes on: 2π + π/2 is the right end again).
   */
  phase: number
  /** Where the dot's trail starts (behind the dot, along the path). The same as phase: no trail. */
  trail: number
  /** The tempo's digit wheels (BPM_WHEELS): each one 0 to 10. 2.5 is halfway from 2 to 3. */
  bpmWheels: readonly number[]
  /** The beat flash: 1 just on a beat, down to 0. */
  flash: number
  /** True if the last beat was the first one of the bar (a blue flash). */
  accent: boolean
}

export const HEIGHT = 24
/** Where the dot rests when the metronome is stopped: in the middle, where the first beat starts. */
export const REST = Math.PI
/** How long the trail behind the dot is, along the path (in radians: π is one beat). */
export const TRAIL = 1.6
/** Canvas pixels per screen pixel, in each direction (like the sampler: sharp thin lines). */
const SUPERSAMPLE = 4
/** The tempo text's size, and where it stands (its base line). */
const TEXT_SIZE = 22
const BASE_Y = 21
/** The space between the ∞ and the tempo. */
const GAP = 12
/** Ticks along the ∞ (and a longer one every MAJOR). */
const TICKS = 48
const MAJOR = 6

/** `width`: the canvas's width in CSS px (the module's width). */
export function drawPicture(canvas: HTMLCanvasElement, state: PictureState, c: PictureColors, width: number) {
  const scale = (devicePixelRatio || 1) * SUPERSAMPLE
  if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(HEIGHT * scale)) {
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(HEIGHT * scale)
  }
  const g = canvas.getContext('2d')!
  g.setTransform(scale, 0, 0, scale, 0, 0)
  g.fillStyle = c.screen
  g.fillRect(0, 0, width, HEIGHT)
  g.lineCap = 'round'
  g.lineJoin = 'round'

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.stroke()
  }

  // ——— The tempo, on the right: its size sets the height of everything ———
  g.font = `200 ${TEXT_SIZE}px ${c.font}`
  g.textBaseline = 'alphabetic'
  const charWidth = g.measureText('0').width
  const capHeight = g.measureText('0').actualBoundingBoxAscent
  const top = BASE_Y - capHeight
  const textWidth = charWidth * 6.4
  const textLeft = width - textWidth

  // ——— The ∞, on the left, from the top of the digits to their base line ———
  // x = sin θ, y = sin θ · cos θ: the loops are as wide as the space, and as high as the digits
  // (minus the dot's size, so that the dot stays inside too).
  const infinityWidth = textLeft - GAP
  const cx = infinityWidth / 2
  const cy = top + capHeight / 2
  const rx = cx - 3
  const ry = capHeight - 4
  const at = (theta: number): [number, number] => [
    cx + rx * Math.sin(theta),
    cy + ry * Math.sin(theta) * Math.cos(theta),
  ]
  /** The direction of the path at θ (for ticks across it). */
  const across = (theta: number): [number, number] => {
    const dx = rx * Math.cos(theta)
    const dy = ry * Math.cos(2 * theta)
    const length = Math.hypot(dx, dy) || 1
    return [-dy / length, dx / length]
  }
  const path = (from: number, to: number) => {
    g.beginPath()
    const steps = Math.max(2, Math.ceil(Math.abs(to - from) * 40))
    for (let i = 0; i <= steps; i++) {
      const [x, y] = at(from + ((to - from) * i) / steps)
      if (i) g.lineTo(x, y)
      else g.moveTo(x, y)
    }
  }

  // The path, thin.
  g.strokeStyle = c.muted
  g.lineWidth = 0.6
  path(0, Math.PI * 2)
  g.stroke()

  // Ticks across the path, longer every MAJOR. Not right at the middle (the cross is there).
  g.lineCap = 'butt'
  for (let k = 0; k < TICKS; k++) {
    if (k % (TICKS / 2) === 0) continue
    const theta = (k / TICKS) * Math.PI * 2
    const [x, y] = at(theta)
    const [nx, ny] = across(theta)
    const length = k % MAJOR === 0 ? 1.8 : 1
    g.lineWidth = k % MAJOR === 0 ? 0.7 : 0.45
    line(x - nx * length, y - ny * length, x + nx * length, y + ny * length)
  }
  g.lineCap = 'round'

  // Marks at both ends of the ∞.
  g.strokeStyle = c.ink
  g.lineWidth = 0.8
  for (const side of [-1, 1]) {
    const x = cx + side * (rx + 2.5)
    line(x, cy - 2.5, x, cy + 2.5)
  }

  // The middle: a blue cross. On each beat it flashes, and a ring grows from it.
  g.strokeStyle = c.primary
  g.lineWidth = 0.8
  line(cx - 1.8, cy - 1.8, cx + 1.8, cy + 1.8)
  line(cx - 1.8, cy + 1.8, cx + 1.8, cy - 1.8)
  if (state.flash > 0) {
    g.globalAlpha = state.flash
    g.strokeStyle = state.accent ? c.primary : c.ink
    g.beginPath()
    g.arc(cx, cy, 2.5 + (1 - state.flash) * 4, 0, Math.PI * 2)
    g.stroke()
    g.globalAlpha = 1
  }

  // ——— The dot, with its trail: from faint and thin (its end) to bright and thick (at the dot) ———
  const trailSteps = 24
  g.strokeStyle = c.primary
  for (let i = 0; i < trailSteps; i++) {
    const from = state.trail + ((state.phase - state.trail) * i) / trailSteps
    const to = state.trail + ((state.phase - state.trail) * (i + 1)) / trailSteps
    const near = (i + 1) / trailSteps
    path(from, to)
    // A soft glow under the line, then the line.
    g.globalAlpha = near * 0.25
    g.lineWidth = 1 + near * 3
    g.stroke()
    g.globalAlpha = 0.15 + near * 0.85
    g.lineWidth = 0.6 + near * 1.4
    g.stroke()
  }
  g.globalAlpha = 1
  const [dx, dy] = at(state.phase)
  g.fillStyle = c.primary
  g.beginPath()
  g.arc(dx, dy, 2.2, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = c.screen
  g.lineWidth = 0.6
  g.stroke()

  // ——— The tempo: 3 digit wheels, then "BPM" in the same size ———
  // Each wheel's place comes from the script. The window: from the top of the digits to just under
  // the line.
  g.textAlign = 'center'
  const row = TEXT_SIZE * 1.05
  const wheels = state.bpmWheels
  g.save()
  g.beginPath()
  g.rect(textLeft - 1, top - 2, charWidth * 3 + 2, capHeight + 4)
  g.clip()
  wheels.forEach((wheel, i) => {
    const x = textLeft + charWidth * (i + 0.5)
    const digit = Math.floor(wheel) % 10
    const turn = wheel % 1
    // A leading zero is dim, like an unlit display (this wheel and all before it show 0).
    const leading = i < wheels.length - 1 && wheels.slice(0, i + 1).every((w) => w < 0.5)
    g.fillStyle = leading ? c.dim : c.ink
    g.fillText(String(digit), x, BASE_Y - turn * row)
    if (turn > 0) g.fillText(String((digit + 1) % 10), x, BASE_Y + (1 - turn) * row)
  })
  g.restore()
  g.textAlign = 'left'
  g.fillStyle = c.muted
  g.fillText('BPM', textLeft + charWidth * 3.4, BASE_Y)
}

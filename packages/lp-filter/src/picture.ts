/**
 * The LP-01 picture, drawn on a 2D canvas (199 x 70): what the filter does to the sound, from low
 * (left) to high (right), in the same thin-line style as the other modules.
 *
 *   ┌───────────────────────────────────────────┐
 *   │ RES 06.0 DB                     01200 HZ  │   the resonance and the cutoff (they roll)
 *   │                         ╭╮                │
 *   │ ───────────────────────╯  ╲               │   the filter's curve (0 dB is the flat part)
 *   │ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▫ ▫ ▫ ▫ ▫     │   the sound: before the filter (light), after
 *   │ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▫ ▫ ▫ ▫ ▫   │     it (the main color) on top
 *   │ ┴┬┬┬┬┬┬┬┴┬┬┬┬┬┬┬┬┴┬┬┬┬┬┬┬┬┴┬┬┬┬┬┬┬┬┴┬┬┬┬┬ │   the ruler: 20 Hz to 20 kHz, the same space
 *   │        100          1K   ▲       10K      │     for each octave; ▲ the cutoff
 *   └───────────────────────────────────────────┘
 *
 * It is honest, not only a picture: the curve is the filter's real curve, and the cells are the
 * real sound, before and after the filter. So where the light cells stick out above the colored
 * ones, the filter takes that part of the sound away.
 * - Bypass: the curve is a dashed flat line (nothing changes), and the sound after is the sound
 *   before.
 * - The numbers roll like a tape counter when they change (digit wheels, see createOdometer in
 *   @loop/ui). The script turns them.
 */

import type { OdometerWheel } from '@loop/ui'
import { MAX_FREQUENCY, MIN_FREQUENCY } from './setup'

/**
 * The weights and sizes of the text in the picture (the family is `PictureColors.font`).
 * script.ts loads them before it draws: see there.
 */
export const TEXT_FONTS = { counter: '300 13px', small: '400 7px' } as const

export interface PictureColors {
  screen: string
  ink: string
  line: string
  dim: string
  muted: string
  /** The module's main color (--loop-primary): the sound after the filter. */
  primary: string
  font: string
}

export interface PictureState {
  /** The cutoff, in Hz (the mark on the ruler). */
  cutoff: number
  /** The cutoff's digit wheels (HZ_WHEELS): each one 0 to 10. 2.5 is halfway from 2 to 3. */
  hzWheels: readonly number[]
  /** The resonance's digit wheels (RESONANCE_WHEELS), the same way. */
  resonanceWheels: readonly number[]
  bypass: boolean
  /** The filter's curve: how loud each of CURVE_FREQUENCIES comes out (1: unchanged). */
  response: ArrayLike<number>
  /** The sound before the filter: one level per column (COLUMNS), 0 to 1. */
  before: ArrayLike<number>
  /** The sound after the filter, the same way. */
  after: ArrayLike<number>
}

export const WIDTH = 199
export const HEIGHT = 70
/** Canvas pixels per screen pixel, in each direction (like the other modules: sharp thin lines). */
const SUPERSAMPLE = 4

/** The graph: from LEFT to RIGHT (20 Hz to 20 kHz), the ruler's line at BASE, the top at TOP. */
const LEFT = 1.5
const RIGHT = WIDTH - 1.5
const BASE = 56
const TOP = 18
/** The curve: where 0 dB is, and px per dB (+20 dB of resonance reaches TOP). */
const ZERO_DB_Y = 30
const PX_PER_DB = 0.6
/** The text row (the resonance, the cutoff): its middle, and its height (one turn of a wheel). */
const TEXT_Y = 7.5
const ROW = 15
/** The ruler's numbers: their base line. */
const LABEL_Y = 68
/** One column of cells is 2px wide with a 1px gap. One cell is 2px high with a 1px gap. */
const PITCH = 3
export const COLUMNS = Math.floor((RIGHT - LEFT + 1) / PITCH)
const MAX_CELLS = Math.floor((BASE - TOP) / PITCH)
/** How many points the curve has. */
const CURVE_POINTS = 120

/** The cutoff's digit wheels, in Hz: up to 99999. */
export const HZ_WHEELS: readonly OdometerWheel[] = [
  10000, 1000, 100, 10, 1,
].map((unit) => ({ unit }))
/** The resonance's digit wheels, in tenths of a dB: 60 shows "06.0" (with a dim 0). */
export const RESONANCE_WHEELS: readonly OdometerWheel[] = [100, 10, 1].map(
  (unit) => ({ unit }),
)

/** Where a frequency is on the graph, in px: the same space for each octave. */
const xOf = (hz: number) =>
  LEFT +
  ((RIGHT - LEFT) * Math.log(hz / MIN_FREQUENCY)) /
    Math.log(MAX_FREQUENCY / MIN_FREQUENCY)
/** The frequency at a place on the graph. */
const hzAt = (x: number) =>
  MIN_FREQUENCY *
  (MAX_FREQUENCY / MIN_FREQUENCY) ** ((x - LEFT) / (RIGHT - LEFT))

/** The frequencies of the curve's points, from left to right (for the filter's getResponse). */
export const CURVE_FREQUENCIES = Float32Array.from(
  { length: CURVE_POINTS },
  (_, i) => hzAt(LEFT + (i * (RIGHT - LEFT)) / (CURVE_POINTS - 1)),
)

/** Where each column starts and ends, in Hz: column i is from edge i to edge i + 1. */
export const COLUMN_EDGES = Float32Array.from({ length: COLUMNS + 1 }, (_, i) =>
  hzAt(LEFT + i * PITCH),
)

export function drawPicture(
  canvas: HTMLCanvasElement,
  state: PictureState,
  c: PictureColors,
) {
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

  // ——— The text row: the resonance (left) and the cutoff (right), on digit wheels ———
  g.font = `${TEXT_FONTS.counter} ${c.font}`
  g.textBaseline = 'middle'

  /**
   * Digit wheels from `left`: each digit rolls up to the next. `decimals`: how many of the last
   * wheels are after a decimal point. A leading zero is dim, like an unlit display. Gives the width.
   */
  const drawWheels = (
    wheels: readonly number[],
    left: number,
    decimals = 0,
  ) => {
    const charWidth = g.measureText('0').width
    const pointWidth = decimals ? g.measureText('.').width : 0
    const point = wheels.length - decimals
    g.save()
    g.beginPath()
    g.rect(0, TEXT_Y - ROW / 2, WIDTH, ROW)
    g.clip()
    g.textAlign = 'center'
    wheels.forEach((wheel, i) => {
      const x = left + charWidth * (i + 0.5) + (i >= point ? pointWidth : 0)
      const digit = Math.floor(wheel) % 10
      const turn = wheel % 1
      // Leading: this wheel and all before it show 0 (not the last one before the point).
      const leading =
        i < point - 1 && wheels.slice(0, i + 1).every((w) => w < 0.5)
      g.fillStyle = leading ? c.dim : c.ink
      g.fillText(String(digit), x, TEXT_Y - turn * ROW)
      if (turn > 0)
        g.fillText(String((digit + 1) % 10), x, TEXT_Y + (1 - turn) * ROW)
    })
    if (decimals) {
      g.fillStyle = c.ink
      g.textAlign = 'left'
      g.fillText('.', left + charWidth * point, TEXT_Y)
    }
    g.restore()
    return charWidth * wheels.length + pointWidth
  }

  // Left: "RES", the resonance, "DB".
  g.textAlign = 'left'
  g.fillStyle = c.muted
  g.fillText('RES ', 0, TEXT_Y)
  const resLeft = g.measureText('RES ').width
  const resWidth = drawWheels(state.resonanceWheels, resLeft, 1)
  g.fillStyle = c.ink
  g.textAlign = 'left'
  g.fillText(' DB', resLeft + resWidth, TEXT_Y)
  // Right: the cutoff, "HZ".
  g.textAlign = 'right'
  g.fillText(' HZ', WIDTH, TEXT_Y)
  const hzWidth = g.measureText('0').width * state.hzWheels.length
  drawWheels(state.hzWheels, WIDTH - g.measureText(' HZ').width - hzWidth)

  // ——— The sound: a column of cells for each part of the range, from the ruler up ———
  const column = (i: number, level: number) => {
    const cells = Math.round(Math.min(1, Math.max(0, level)) * MAX_CELLS)
    const x = LEFT + i * PITCH
    for (let k = 0; k < cells; k++)
      g.fillRect(x, BASE - 3 - k * PITCH, PITCH - 1, 2)
  }
  // Before the filter (light), then after it (the main color) on top.
  g.fillStyle = c.dim
  for (let i = 0; i < COLUMNS; i++) column(i, state.before[i] ?? 0)
  g.fillStyle = c.primary
  for (let i = 0; i < COLUMNS; i++) column(i, state.after[i] ?? 0)

  // ——— The cutoff: a thin line up from the ruler ———
  const cutoffX = xOf(state.cutoff)
  g.strokeStyle = c.line
  g.lineWidth = 0.6
  line(cutoffX, TOP, cutoffX, BASE)

  // ——— The filter's curve. Bypass: a dashed flat line (nothing changes) ———
  g.save()
  g.beginPath()
  g.rect(0, TOP - 2, WIDTH, BASE - TOP + 2)
  g.clip()
  g.strokeStyle = c.ink
  g.lineWidth = 1
  if (state.bypass) {
    g.strokeStyle = c.muted
    g.setLineDash([2, 2])
    line(LEFT, ZERO_DB_Y, RIGHT, ZERO_DB_Y)
    g.setLineDash([])
  } else {
    g.beginPath()
    for (let i = 0; i < CURVE_POINTS; i++) {
      const x = LEFT + (i * (RIGHT - LEFT)) / (CURVE_POINTS - 1)
      const db = 20 * Math.log10(Math.max(1e-6, state.response[i] ?? 1))
      // Far below the ruler: stop there (the line would only go down out of view).
      const y = Math.min(BASE + 1, ZERO_DB_Y - db * PX_PER_DB)
      if (i) g.lineTo(x, y)
      else g.moveTo(x, y)
    }
    g.stroke()
  }
  g.restore()

  // ——— The ruler: a tick on 20, 30, ... 90, 100, 200, ... 20k; longer on 100, 1k, 10k ———
  g.lineWidth = 0.8
  g.strokeStyle = c.dim
  line(LEFT, BASE, RIGHT, BASE)
  for (let decade = 10; decade < MAX_FREQUENCY; decade *= 10) {
    for (let n = 1; n <= 9; n++) {
      const hz = decade * n
      if (hz < MIN_FREQUENCY || hz > MAX_FREQUENCY) continue
      const long = n === 1
      g.strokeStyle = long ? c.muted : c.dim
      const x = xOf(hz)
      line(x, BASE, x, BASE + (long ? 5 : 3))
    }
  }
  // The cutoff's mark on the ruler: a small triangle under it.
  g.fillStyle = state.bypass ? c.muted : c.ink
  g.beginPath()
  g.moveTo(cutoffX, BASE + 1.5)
  g.lineTo(cutoffX + 2.5, BASE + 5.5)
  g.lineTo(cutoffX - 2.5, BASE + 5.5)
  g.closePath()
  g.fill()
  // The numbers under the long ticks.
  g.font = `${TEXT_FONTS.small} ${c.font}`
  g.textBaseline = 'alphabetic'
  g.textAlign = 'center'
  g.fillStyle = c.muted
  for (const [hz, label] of [
    [100, '100'],
    [1000, '1K'],
    [10000, '10K'],
  ] as const)
    g.fillText(label, xOf(hz), LABEL_Y)
}

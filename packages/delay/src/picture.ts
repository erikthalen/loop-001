/**
 * The DL-01 picture, drawn on a 2D canvas (247 x 66): the echoes of one hit, over one bar.
 *
 *   ┌───────────────────────────────────────────┐
 *   │ 1/8D                             00375 MS │   the rate, and the time until each echo (they roll)
 *   │ ┃                                         │
 *   │ ┃     ▌                                   │   the hit (the dry sound), then each echo:
 *   │ ┃     ▌     ▌     ▐     ▖                 │   as loud as the delay really makes it
 *   │ ┴──┬──┬──┼──┬──┬──┬──┼──┬──┬──┬──┼──┬──┬─ │   one bar: 16 steps, a longer tick on each beat
 *   └───────────────────────────────────────────┘
 *
 * It is honest, not only a picture: the hit is as tall as the dry level, the first echo as the
 * wet level, and each echo after it is `feedback` times the one before. With nothing plugged into
 * its input, no sound comes in: it is dim, and says so.
 *
 * The rate and the time roll like a tape counter when they change: the time on digit wheels (an
 * odometer, see createOdometer in @loop/ui), the rate on one drum with all the rates printed on it,
 * in order. Only the end of the rate that changes rolls ("1/" stays). The script turns them (they
 * glide to the new value).
 */

import type { OdometerWheel } from '@loop/ui'
import { RATES } from './setup'

export interface PictureColors {
  screen: string
  ink: string
  dim: string
  muted: string
  /** The module's main color (--loop-primary): the echoes. */
  primary: string
  font: string
}

export interface PictureState {
  /**
   * Where the rate drum is: the place in RATES (2 is RATES[2]). Between two whole numbers: it is
   * turning from one rate to the next.
   */
  rateDrum: number
  /** The time's digit wheels (MS_WHEELS, see createOdometer in @loop/ui): each one 0 to 10. */
  msWheels: readonly number[]
  /** The time until each echo, in steps (16 in a bar). */
  steps: number
  dry: number
  wet: number
  feedback: number
  /** False: nothing is plugged into its input. */
  connected: boolean
}

export const WIDTH = 247
export const HEIGHT = 66
/** Canvas pixels per screen pixel, in each direction (like the other modules: sharp thin lines). */
const SUPERSAMPLE = 4

/** The bar: from LEFT to RIGHT, its line at BASE. The tallest echo reaches TOP. */
const LEFT = 1.5
const RIGHT = WIDTH - 1.5
const BASE = 58
const TOP = 22
const STEPS = 16
const BAR_WIDTH = 2
/** Quieter than this, an echo is not drawn. */
const QUIET = 0.01
/** The text row (the rate, the time): its middle, and its height (one turn of a wheel). */
const TEXT_Y = 8
const ROW = 15
/** The time's digit wheels, in ms: up to 99999. */
export const MS_WHEELS: readonly OdometerWheel[] = [
  10000, 1000, 100, 10, 1,
].map((unit) => ({ unit }))
const DIGITS = MS_WHEELS.length

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
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.stroke()
  }
  const step = (RIGHT - LEFT) / STEPS

  // ——— The rate, and the time until each echo: they roll, like a tape counter ———
  g.font = `300 13px ${c.font}`
  g.textBaseline = 'middle'
  g.save()
  g.beginPath()
  g.rect(0, TEXT_Y - ROW / 2, WIDTH, ROW)
  g.clip()
  // The rate drum: the rate moves up as it turns, and the next one comes in from below.
  g.fillStyle = c.ink
  g.textAlign = 'left'
  const drum = Math.min(RATES.length - 1, Math.max(0, state.rateDrum))
  const shown = Math.floor(drum)
  const turn = drum - shown
  const from = RATES[shown]!.name.toUpperCase()
  if (turn > 0) {
    // Only the end that changes rolls: from 1/16 to 1/8T, "1/" stays and "16" rolls to "8T".
    const to = RATES[shown + 1]!.name.toUpperCase()
    let same = 0
    while (same < from.length && from[same] === to[same]) same++
    const still = from.slice(0, same)
    const x = g.measureText(still).width
    g.fillText(still, 0, TEXT_Y)
    g.fillText(from.slice(same), x, TEXT_Y - turn * ROW)
    g.fillText(to.slice(same), x, TEXT_Y + (1 - turn) * ROW)
  } else {
    g.fillText(from, 0, TEXT_Y)
  }
  // The time: "MS" on the right, the digit wheels before it.
  g.textAlign = 'center'
  const charWidth = g.measureText('0').width
  const unitWidth = g.measureText(' MS').width
  g.textAlign = 'right'
  g.fillText(' MS', WIDTH, TEXT_Y)
  g.textAlign = 'center'
  const wheels = state.msWheels
  const left = WIDTH - unitWidth - DIGITS * charWidth
  wheels.forEach((wheel, i) => {
    const x = left + charWidth * (i + 0.5)
    const digit = Math.floor(wheel) % 10
    const part = wheel % 1
    // Leading zeros are dim, like an unlit display.
    const leading =
      i < DIGITS - 1 && wheels.slice(0, i + 1).every((w) => w < 0.5)
    g.fillStyle = leading ? c.dim : c.ink
    g.fillText(String(digit), x, TEXT_Y - part * ROW)
    if (part > 0)
      g.fillText(String((digit + 1) % 10), x, TEXT_Y + (1 - part) * ROW)
  })
  g.restore()

  // ——— The bar: a line, a tick on each step, a longer one on each beat ———
  g.strokeStyle = c.dim
  g.lineWidth = 0.8
  line(LEFT, BASE, RIGHT, BASE)
  for (let k = 0; k <= STEPS; k++) {
    const beat = k % 4 === 0
    g.strokeStyle = beat ? c.muted : c.dim
    line(LEFT + k * step, BASE, LEFT + k * step, BASE + (beat ? 5 : 3))
  }

  // ——— The hit, and its echoes ———
  if (!state.connected) g.globalAlpha = 0.35
  const bar = (x: number, level: number, color: string) => {
    const height = Math.min(1, level) * (BASE - TOP)
    g.fillStyle = color
    g.fillRect(x - BAR_WIDTH / 2, BASE - height, BAR_WIDTH, height)
  }
  bar(LEFT + BAR_WIDTH / 2, state.dry, c.ink)
  let level = state.wet
  for (let n = 1; level > QUIET; n++) {
    const x = LEFT + n * state.steps * step
    if (x > RIGHT) break
    bar(x, level, c.primary)
    level *= state.feedback
  }
  g.globalAlpha = 1

  if (!state.connected) {
    const text = 'NOTHING PLUGGED IN'
    const y = (TOP + BASE) / 2
    g.font = `500 10px ${c.font}`
    g.textAlign = 'center'
    // On a patch of screen, so the dim echoes behind it do not cross the words.
    const width = g.measureText(text).width + 10
    g.fillStyle = c.screen
    g.fillRect(WIDTH / 2 - width / 2, y - 7, width, 14)
    g.fillStyle = c.muted
    g.fillText(text, WIDTH / 2, y)
  }
}

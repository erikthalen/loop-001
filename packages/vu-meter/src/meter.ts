/**
 * One VU-01 meter face, drawn on a 2D canvas as pixel art: an 80 x 47 grid of square cells.
 * - An arc scale from -20 to +3 VU: dark up to 0 VU, red above it, with marks and numbers.
 * - A needle that swings on a spring, like a real meter, with two faded "ghost" needles behind it.
 * - A small lamp (top right) that lights red when the sound goes over +0.5 VU. Like on a real
 *   meter, it shows short peaks that the heavy needle is too slow to reach.
 * - "VU", the channel name (L or R), and a dark dome at the bottom where the needle turns.
 */

export interface MeterColors {
  faceLight: string
  faceDark: string
  ink: string
  soft: string
  ghost: string
  red: string
  lampOff: string
  dome: string
  font: string
}

export interface Meter {
  /** Move the needle towards `vu` for `seconds`, then draw. */
  update(vu: number, seconds: number): void
}

/**
 * One cell is 1.5 x 1.5 CSS pixels: 3 x 3 screen pixels on a retina screen, so the pixel art
 * stays sharp. The grid is 80 x 47 cells: 120 x 70.5 CSS pixels.
 */
export const CELL = 1.5
export const COLUMNS = 80
export const ROWS = 47
export const WIDTH = COLUMNS * CELL
export const HEIGHT = ROWS * CELL

/** The needle turns around this cell, below the face. */
const PIVOT_X = 40
const PIVOT_Y = 55
/** The scale goes from -48° to +48°. */
const SWING = (48 * Math.PI) / 180
/** The scale: -20 to +3 VU. Position 0 is -20 VU, 1 is +3 VU. Like a real meter, it is not linear. */
const MAX_VU = 3
const positionOf = (vu: number) => (10 ** (vu / 20) - 0.1) / (10 ** (MAX_VU / 20) - 0.1)
/** The marks on the scale, with their numbers (no number: a short mark). */
const MARKS: readonly [vu: number, label: string][] = [
  [-20, '20'], [-10, '10'], [-7, '7'], [-5, '5'], [-3, '3'], [-2, ''], [-1, ''],
  [0, '0'], [1, ''], [2, ''], [3, '3'],
]
/** Spring: how hard the needle is pulled to the level, and how much it is slowed down. */
const STIFFNESS = 140
const DAMPING = 16
/** The lamp stays on this long after the sound goes over +0.5 VU. */
const LAMP_SECONDS = 0.35

export function createMeter(canvas: HTMLCanvasElement, channel: string, colors: () => MeterColors): Meter {
  const g = canvas.getContext('2d')!
  let position = 0
  let speed = 0
  let lamp = 0
  const history: number[] = []

  const angle = (pos: number) => -SWING + pos * 2 * SWING
  /** The cell at a place on the scale (`pos`) and a distance from the pivot (`radius`, in cells). */
  const at = (pos: number, radius: number): [number, number] => [
    PIVOT_X + radius * Math.sin(angle(pos)),
    PIVOT_Y - radius * Math.cos(angle(pos)),
  ]
  const cell = (x: number, y: number) => g.fillRect(Math.round(x) * CELL, Math.round(y) * CELL, CELL, CELL)

  const drawNeedle = (pos: number, color: string) => {
    g.fillStyle = color
    for (let radius = 6; radius <= 44; radius += 0.5) {
      const [x, y] = at(pos, radius)
      if (y < ROWS) cell(x, y)
    }
  }

  const draw = () => {
    const c = colors()
    const zero = positionOf(0)

    // The face: a soft light in the middle.
    const light = g.createRadialGradient(WIDTH / 2, HEIGHT / 2, 3.5 * CELL, WIDTH / 2, HEIGHT / 2, 50 * CELL)
    light.addColorStop(0, c.faceLight)
    light.addColorStop(1, c.faceDark)
    g.fillStyle = light
    g.fillRect(0, 0, WIDTH, HEIGHT)

    // The arc: thin and dark up to 0 VU, thick and red above it.
    g.fillStyle = c.ink
    for (let i = 0; i <= 160; i++) {
      const q = i / 160
      if (q < zero) cell(...at(q, 38))
    }
    g.fillStyle = c.red
    for (let i = 0; i <= 160; i++) {
      const q = i / 160
      if (q >= zero) for (let radius = 38; radius <= 40; radius++) cell(...at(q, radius))
    }

    // Marks and numbers.
    g.font = `7px ${c.font}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (const [vu, label] of MARKS) {
      const q = positionOf(vu)
      g.fillStyle = vu >= 0 ? c.red : c.ink
      for (let radius = 39; radius <= 39 + (label ? 4 : 2); radius++) cell(...at(q, radius))
      if (label) {
        const [x, y] = at(q, 47)
        g.fillText(label, x * CELL + CELL / 2, y * CELL + CELL / 2)
      }
    }
    g.fillStyle = c.ink
    g.fillText('−', ...toPixels(at(-0.06, 47)))
    g.fillStyle = c.red
    g.fillText('+', ...toPixels(at(1.06, 47)))

    // "VU" and the channel name.
    g.fillStyle = c.ink
    g.font = `12px ${c.font}`
    g.fillText('VU', WIDTH / 2, 32 * CELL)
    g.font = `7px ${c.font}`
    g.textAlign = 'left'
    g.fillStyle = c.soft
    g.fillText(channel, 3 * CELL, 43 * CELL)

    // The lamp.
    g.fillStyle = lamp > 0 ? c.red : c.lampOff
    for (let y = 33; y < 35; y++) for (let x = 72; x < 74; x++) cell(x, y)

    // The needle, with two ghosts of where it was a moment ago.
    if (history.length > 6) {
      drawNeedle(history[history.length - 7]!, c.ghost)
      drawNeedle(history[history.length - 4]!, c.ghost)
    }
    drawNeedle(position, c.ink)

    // The dome over the pivot.
    g.fillStyle = c.dome
    for (let y = ROWS - 6; y < ROWS; y++) {
      for (let x = 0; x < COLUMNS; x++) {
        if ((x - PIVOT_X) ** 2 + (y - (ROWS + 1)) ** 2 * 4 <= 160) cell(x, y)
      }
    }
  }

  return {
    update(vu, seconds) {
      // Sharp on every screen: one canvas pixel per screen pixel.
      const dpr = devicePixelRatio || 1
      if (canvas.width !== Math.round(WIDTH * dpr)) {
        canvas.width = Math.round(WIDTH * dpr)
        canvas.height = Math.round(HEIGHT * dpr)
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.imageSmoothingEnabled = false

      // The spring pulls the needle towards the level. Silence: it rests just left of the scale.
      const target = Math.max(-0.04, Math.min(1.06, positionOf(Math.max(-30, vu))))
      speed += (STIFFNESS * (target - position) - DAMPING * speed) * seconds
      position += speed * seconds
      // The lamp follows the sound itself, not the needle: a short click lights it even when
      // the needle is too slow to reach the red zone. Real VU meters work the same way.
      lamp = vu > 0.5 ? LAMP_SECONDS : Math.max(0, lamp - seconds)
      history.push(position)
      if (history.length > 12) history.shift()

      draw()
    },
  }
}

/** A cell's middle, in CSS pixels. */
const toPixels = ([x, y]: [number, number]): [number, number] => [x * CELL + CELL / 2, y * CELL + CELL / 2]

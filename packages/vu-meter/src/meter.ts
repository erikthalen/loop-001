/**
 * The VU-01 picture, drawn on a 2D canvas (247 x 80), in the same thin-line style as the sampler.
 *
 *   ┌─────────────────────────────────────────────┐
 *   │    20 10 7 5 3 0  3        VU     20 10 ...  │   numbers over each scale
 *   │   ''''|''|'|'|'|'|▼|'|    L -12   ''''|''... │   fine ticks, big ticks, red zone, peak hold (▼)
 *   │        \             ●   R -14         /     │   the needle (and its ghost), the peak lamp (●)
 *   │ L       ◎                  R    ◎            │   the pivot
 *   │ ───────────────────        ───────────────── │
 *   │ L ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▯▯▯▯▯▯▯▯▯▮▯▯▯▯▯   │   segment bars: fast level, red over 0 VU,
 *   │ R ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▯▯▯▯▯▯▯▯▯▯▯▯▮▯▯▯▯▯   │   orange peak hold
 *   └─────────────────────────────────────────────┘
 *
 * - The needles swing on a spring, like a real meter (slow). The bars follow the sound fast.
 * - The peak lamp lights red for a moment when the sound goes over +0.5 VU. Like on a real meter,
 *   it shows short peaks that the heavy needle is too slow to reach.
 * - The peak hold marks stay at the highest level for a second, then fall.
 */

export interface MeterColors {
  screen: string
  ink: string
  dim: string
  muted: string
  red: string
  orange: string
  left: string
  right: string
  font: string
}

export interface Meter {
  /** Move the needles and bars towards the levels (in VU) for `seconds`, then draw. */
  update(levels: readonly [number, number], seconds: number): void
}

export const WIDTH = 247
export const HEIGHT = 80
/** Canvas pixels per screen pixel, in each direction (like the sampler: sharp thin lines). */
const SUPERSAMPLE = 4

/** The dials: pivots, scale radius, and how far the scale goes to each side (from straight up). */
const DIALS = [61, 186] as const
const PIVOT_Y = 58
const RADIUS = 46
const SPAN = (48 * Math.PI) / 180
/** The scale: -20 to +3 VU. Position 0 is -20 VU, 1 is +3 VU. Like a real meter, it is not linear. */
const MAX_VU = 3
const positionOf = (vu: number) => (10 ** (vu / 20) - 0.1) / (10 ** (MAX_VU / 20) - 0.1)
const ZERO = positionOf(0)
/** The big marks, with their numbers ('' : no number). */
const MARKS: readonly [vu: number, label: string][] = [
  [-20, '20'], [-10, '10'], [-7, '7'], [-5, '5'], [-3, '3'], [-2, ''], [-1, ''],
  [0, '0'], [1, ''], [2, ''], [3, '3'],
]
/** The segment bars. */
const BARS_Y = [68, 75] as const
const BAR_LEFT = 11
const SEGMENT = 4
const SEGMENTS = Math.floor((WIDTH - BAR_LEFT) / SEGMENT)
/** Spring: how hard the needle is pulled to the level, and how much it is slowed down. */
const STIFFNESS = 140
const DAMPING = 16
/** The lamp stays on this long after the sound goes over +0.5 VU. */
const LAMP_SECONDS = 0.35
/** A peak hold mark stays this long, then falls this fast (scale per second). */
const HOLD_SECONDS = 1
const HOLD_FALL = 0.6

export function createMeter(canvas: HTMLCanvasElement, colors: () => MeterColors): Meter {
  const g = canvas.getContext('2d')!
  const channels = [0, 1].map(() => ({
    vu: -30,
    position: 0,
    speed: 0,
    bar: 0,
    hold: 0,
    holdLeft: 0,
    lamp: 0,
    history: [] as number[],
  }))

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.stroke()
  }
  const circle = (x: number, y: number, r: number) => {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
  }

  const draw = () => {
    const c = colors()
    g.fillStyle = c.screen
    g.fillRect(0, 0, WIDTH, HEIGHT)
    g.lineCap = 'round'

    DIALS.forEach((cx, i) => {
      const channel = channels[i]!
      const color = i === 0 ? c.left : c.right
      /** A point on the dial: `position` on the scale (0 to 1), `r` px from the pivot. */
      const at = (position: number, r: number): [number, number] => {
        const a = -SPAN + position * 2 * SPAN
        return [cx + Math.sin(a) * r, PIVOT_Y - Math.cos(a) * r]
      }
      const arc = (from: number, to: number, r: number) => {
        g.beginPath()
        g.arc(cx, PIVOT_Y, r, -Math.PI / 2 - SPAN + from * 2 * SPAN, -Math.PI / 2 - SPAN + to * 2 * SPAN)
        g.stroke()
      }

      // The scale arc: thin up to 0 VU, thicker and red above it.
      g.strokeStyle = c.muted
      g.lineWidth = 0.8
      arc(0, ZERO, RADIUS)
      g.strokeStyle = c.red
      g.lineWidth = 1.6
      arc(ZERO, 1, RADIUS)

      // Fine ticks all along, then the big marks with their numbers.
      g.lineWidth = 0.6
      for (let k = 0; k <= 40; k++) {
        const position = k / 40
        g.strokeStyle = position >= ZERO ? c.red : c.muted
        line(...at(position, RADIUS - 1.5), ...at(position, RADIUS))
      }
      g.font = `400 6.5px ${c.font}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (const [vu, label] of MARKS) {
        const position = positionOf(vu)
        g.strokeStyle = vu >= 0 ? c.red : c.ink
        g.lineWidth = label ? 1 : 0.8
        line(...at(position, RADIUS - (label ? 5 : 3.5)), ...at(position, RADIUS + 1))
        if (label) {
          g.fillStyle = vu >= 0 ? c.red : c.muted
          g.fillText(label, ...at(position, RADIUS + 6))
        }
      }
      g.fillStyle = c.muted
      g.fillText('−', ...at(-0.07, RADIUS + 6))
      g.fillStyle = c.red
      g.fillText('+', ...at(1.07, RADIUS + 6))

      // The peak hold mark: a small orange triangle over the scale.
      if (channel.hold > 0.01) {
        const [x, y] = at(Math.min(1.04, channel.hold), RADIUS + 1.5)
        const [tx, ty] = at(Math.min(1.04, channel.hold), RADIUS - 2)
        g.fillStyle = c.orange
        g.beginPath()
        g.moveTo(tx, ty)
        const a = -SPAN + Math.min(1.04, channel.hold) * 2 * SPAN
        g.lineTo(x - Math.cos(a) * 2, y - Math.sin(a) * 2)
        g.lineTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2)
        g.closePath()
        g.fill()
      }

      // The base line under the dial, with small end marks.
      g.strokeStyle = c.dim
      g.lineWidth = 0.8
      line(cx - 40, PIVOT_Y + 4.5, cx + 40, PIVOT_Y + 4.5)
      line(cx - 40, PIVOT_Y + 3, cx - 40, PIVOT_Y + 6)
      line(cx + 40, PIVOT_Y + 3, cx + 40, PIVOT_Y + 6)

      // The needle, and its faint ghost.
      g.strokeStyle = c.ink
      g.lineWidth = 1
      if (channel.history.length > 5) {
        g.globalAlpha = 0.25
        line(...at(channel.history[channel.history.length - 6]!, 7), ...at(channel.history[channel.history.length - 6]!, RADIUS + 1))
        g.globalAlpha = 1
      }
      line(...at(channel.position, 7), ...at(channel.position, RADIUS + 1))

      // The pivot: a ring with a dot.
      g.fillStyle = c.screen
      g.lineWidth = 1
      circle(cx, PIVOT_Y, 3.5)
      g.fill()
      g.stroke()
      g.fillStyle = c.ink
      circle(cx, PIVOT_Y, 1.2)
      g.fill()

      // L or R (left of the pivot), and the peak lamp (right of it).
      g.font = `600 8px ${c.font}`
      g.fillStyle = color
      g.fillText(i === 0 ? 'L' : 'R', cx - 33, PIVOT_Y - 1)
      g.strokeStyle = channel.lamp > 0 ? c.red : c.muted
      g.fillStyle = c.red
      g.lineWidth = 0.8
      circle(cx + 33, PIVOT_Y - 1, 2.2)
      if (channel.lamp > 0) g.fill()
      g.stroke()
    })

    // ——— In the middle: "VU", and each channel's level in numbers ———
    const middle = WIDTH / 2
    g.font = `500 7px ${c.font}`
    g.textAlign = 'center'
    g.fillStyle = c.muted
    g.fillText('VU', middle, 14)
    g.strokeStyle = c.dim
    g.lineWidth = 0.6
    line(middle - 10, 20, middle + 10, 20)
    // The numbers fit in the 28px between the dials: "L" on the left, the level right-aligned.
    // Short: one decimal below 10 ("-9.1"), whole numbers from 10 ("-12"), "–∞" for silence.
    channels.forEach((channel, i) => {
      const vu = channel.vu
      let text = '–∞'
      if (vu > -30) text = `${vu > 0 ? '+' : ''}${Math.abs(vu) < 9.95 ? vu.toFixed(1) : Math.round(vu)}`
      const y = 28 + i * 10
      g.font = `600 7px ${c.font}`
      g.fillStyle = i === 0 ? c.left : c.right
      g.textAlign = 'left'
      g.fillText(i === 0 ? 'L' : 'R', middle - 14, y)
      g.font = `300 8px ${c.font}`
      g.fillStyle = vu > 0 ? c.red : c.ink
      g.textAlign = 'right'
      g.fillText(text, middle + 14, y, 21)
    })

    // ——— The segment bars ———
    channels.forEach((channel, i) => {
      const y = BARS_Y[i]!
      g.font = `600 7px ${c.font}`
      g.textAlign = 'left'
      g.fillStyle = i === 0 ? c.left : c.right
      g.fillText(i === 0 ? 'L' : 'R', 0, y + 2)
      const lit = (channel.bar / 1.06) * SEGMENTS
      const hold = Math.min(SEGMENTS - 1, Math.round((channel.hold / 1.06) * SEGMENTS))
      for (let k = 0; k < SEGMENTS; k++) {
        const over = k / SEGMENTS >= ZERO / 1.06
        if (k === hold && channel.hold > 0.01) g.fillStyle = c.orange
        else if (k < lit) g.fillStyle = over ? c.red : c.ink
        else g.fillStyle = c.dim
        g.fillRect(BAR_LEFT + k * SEGMENT, y, SEGMENT - 1.5, 4)
      }
    })
  }

  return {
    update(levels, seconds) {
      const scale = (devicePixelRatio || 1) * SUPERSAMPLE
      if (canvas.width !== Math.round(WIDTH * scale)) {
        canvas.width = Math.round(WIDTH * scale)
        canvas.height = Math.round(HEIGHT * scale)
      }
      g.setTransform(scale, 0, 0, scale, 0, 0)

      channels.forEach((channel, i) => {
        const vu = levels[i]!
        channel.vu = vu
        const target = Math.max(-0.04, Math.min(1.06, positionOf(Math.max(-30, vu))))
        // The needle: a spring pulls it towards the level. Silence: it rests just left of the scale.
        channel.speed += (STIFFNESS * (target - channel.position) - DAMPING * channel.speed) * seconds
        channel.position += channel.speed * seconds
        channel.history.push(channel.position)
        if (channel.history.length > 10) channel.history.shift()
        // The bar: up at once, down a little slower.
        channel.bar = Math.max(Math.max(0, target), channel.bar - seconds * 1.5)
        // The peak hold: stays a second, then falls.
        if (target >= channel.hold) {
          channel.hold = target
          channel.holdLeft = HOLD_SECONDS
        } else if (channel.holdLeft > 0) {
          channel.holdLeft -= seconds
        } else {
          channel.hold = Math.max(0, channel.hold - seconds * HOLD_FALL)
        }
        // The lamp follows the sound itself, not the needle: a short click lights it even when
        // the needle is too slow to reach the red zone. Real VU meters work the same way.
        channel.lamp = vu > 0.5 ? LAMP_SECONDS : Math.max(0, channel.lamp - seconds)
      })

      draw()
    },
  }
}

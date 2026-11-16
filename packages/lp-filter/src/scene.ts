/**
 * The LP-01 picture, drawn on a 2D canvas (199 x 96): "music from next door".
 * A low pass filter is like a wall between a speaker and your ear: the low sounds (bass) come
 * through, the high sounds stay behind.
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ CUTOFF 00.45 kHz                 RES 15.0 dB│   numbers on digit wheels
 *   │ ┌──┐ HI ∿∿∿∿∿∿∿∿∿∿ ▓▓▓▓ ·············   ╭─╮  │   high: short waves (blue), stopped by the wall
 *   │ │◎ │ MID ∿∿∿∿∿∿∿∿∿ ▓▓▓▓ ∿∿∿∿∿∿∿∿∿∿∿∿  <  ●│  │   mid: weaker behind the wall
 *   │ │◎ │ LO ∿∿∿∿∿∿∿∿∿∿ ▓▓▓▓ ∿∿∿∿∿∿∿∿∿∿∿∿   ╰─╯  │   low: long waves (orange), they come through
 *   │ ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾ │
 *   └─────────────────────────────────────────────┘
 *
 * - The lower the cutoff, the thicker the wall.
 * - Behind the wall, each wave is as strong as the filter really lets it be (its curve at 100 Hz,
 *   1 kHz and 6 kHz), so it is honest, not only a picture.
 * - Resonance: the wall rings (orange lines). The wall itself stands still.
 * - Bypass: the wall is open (a dashed outline), all waves come through.
 * - The waves move with the music: louder sound, bigger waves.
 */

export interface SceneColors {
  screen: string
  ink: string
  dim: string
  muted: string
  blue: string
  orange: string
  red: string
  font: string
}

export interface SceneState {
  /** Cutoff in kHz, and resonance in dB. Not rounded: between two values, the digit wheels turn. */
  kHz: number
  resonance: number
  /** The cutoff as a place on the slider, 0 to 1 (the wall's thickness). */
  position: number
  bypass: boolean
  /** How much of each band comes through the wall (1: all of it; more: louder), for BANDS. */
  gains: readonly number[]
  /** How loud the sound is, 0 to 1. */
  level: number
  /** The time in seconds (the waves move). */
  time: number
}

export const WIDTH = 199
export const HEIGHT = 96
/** Canvas pixels per screen pixel, in each direction (like the sampler: sharp thin lines). */
const SUPERSAMPLE = 4

/** The three waves: their frequency (for the filter's curve), name, lane, wavelength and color. */
export const BANDS = [
  { hz: 6000, name: 'HI', y: 40, wavelength: 5, color: 'blue' },
  { hz: 1000, name: 'MID', y: 56, wavelength: 13, color: 'ink' },
  { hz: 100, name: 'LO', y: 72, wavelength: 34, color: 'orange' },
] as const

/** Where things are. */
const WAVES_FROM = 38
const WALL_X = 88
const WALL_TOP = 26
const WALL_BOTTOM = 86
const HEAD_X = 158
const GROUND = 88

/**
 * A number on digit wheels, like an odometer (the same as the sampler's counter): the last wheel
 * turns all the time; a wheel to its left only turns while the wheels to its right roll over from
 * 9 to 0. `decimals`: digits after the point. Leading zeros are dim. Returns the width in px.
 */
function wheels(
  g: CanvasRenderingContext2D, value: number, digits: number, decimals: number,
  x: number, y: number, row: number, ink: string, dim: string,
): number {
  const units = Math.max(0, value) * 10 ** decimals
  const charWidth = g.measureText('0').width
  const pointWidth = decimals ? g.measureText('.').width : 0
  g.save()
  g.beginPath()
  g.rect(x - 1, y - row / 2, digits * charWidth + pointWidth + 2, row)
  g.clip()
  let left = x
  for (let i = digits - 1; i >= 0; i--) {
    const unit = 10 ** i
    const steps = units / unit
    const digit = Math.floor(steps) % 10
    const turn = unit === 1 ? steps % 1 : Math.max(0, (units % unit) - (unit - 1))
    const leading = i >= decimals + 1 && units < unit
    g.fillStyle = leading ? dim : ink
    g.fillText(String(digit), left, y - turn * row)
    if (turn > 0) g.fillText(String((digit + 1) % 10), left, y + (1 - turn) * row)
    left += charWidth
    if (i === decimals && decimals) {
      g.fillStyle = ink
      g.fillText('.', left, y)
      left += pointWidth
    }
  }
  g.restore()
  return left - x
}

export function drawScene(canvas: HTMLCanvasElement, state: SceneState, c: SceneColors) {
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
  const color = (name: 'blue' | 'ink' | 'orange') => c[name]
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.stroke()
  }

  // ——— Top: CUTOFF and RES, on digit wheels ———
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  g.font = `600 7px ${c.font}`
  g.fillStyle = c.blue
  g.fillText('CUTOFF', 0, 7)
  let x = g.measureText('CUTOFF').width + 5
  g.font = `300 13px ${c.font}`
  x += wheels(g, state.kHz, 4, 2, x, 7, 14, state.bypass ? c.muted : c.ink, c.dim)
  g.font = `500 7px ${c.font}`
  g.fillStyle = c.muted
  g.fillText('kHz', x + 3, 8)

  g.font = `500 7px ${c.font}`
  const dbWidth = g.measureText('dB').width
  g.fillText('dB', WIDTH - dbWidth, 8)
  g.font = `300 13px ${c.font}`
  const resWidth = g.measureText('00.0').width
  const resX = WIDTH - dbWidth - 3 - resWidth
  wheels(g, state.resonance, 3, 1, resX, 7, 14, state.bypass ? c.muted : c.ink, c.dim)
  g.font = `600 7px ${c.font}`
  g.fillStyle = c.red
  g.textAlign = 'right'
  g.fillText('RES', resX - 5, 7)

  if (state.bypass) {
    g.textAlign = 'center'
    g.fillText('● BYPASS', WIDTH / 2 + 8, 7)
  }

  // ——— The ground ———
  g.strokeStyle = c.dim
  g.lineWidth = 0.8
  line(0, GROUND, WIDTH, GROUND)
  for (let gx = 3; gx < WIDTH; gx += 6) line(gx, GROUND + 1.5, gx - 2, GROUND + 4)

  // ——— The speaker, on the left ———
  g.strokeStyle = c.ink
  g.lineWidth = 1
  g.strokeRect(2.5, 30.5, 26, 56)
  g.lineWidth = 0.8
  for (const [cy, r] of [[42, 5], [66, 9.5]] as const) {
    g.beginPath()
    g.arc(15.5, cy, r, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.arc(15.5, cy, r * 0.45, 0, Math.PI * 2)
    g.stroke()
  }
  g.fillStyle = c.ink
  for (const [sx, sy] of [[5.5, 33.5], [25.5, 33.5], [5.5, 83.5], [25.5, 83.5]] as const) {
    g.beginPath()
    g.arc(sx, sy, 0.8, 0, Math.PI * 2)
    g.fill()
  }

  // ——— The wall: thicker for a lower cutoff. It rings with resonance ———
  const thickness = 4 + (1 - state.position) * 18
  const ring = state.bypass ? 0 : Math.min(1, state.resonance / 20)
  const wallLeft = WALL_X
  const wallRight = wallLeft + thickness
  if (state.bypass) {
    g.strokeStyle = c.muted
    g.lineWidth = 0.8
    g.setLineDash([2, 2])
    g.strokeRect(wallLeft, WALL_TOP, thickness, WALL_BOTTOM - WALL_TOP)
    g.setLineDash([])
  } else {
    // Bricks: rows of 6px, every other row shifted by half a brick.
    g.fillStyle = c.screen
    g.fillRect(wallLeft, WALL_TOP, thickness, WALL_BOTTOM - WALL_TOP)
    g.strokeStyle = c.ink
    g.lineWidth = 1
    g.strokeRect(wallLeft, WALL_TOP, thickness, WALL_BOTTOM - WALL_TOP)
    g.lineWidth = 0.5
    g.strokeStyle = c.muted
    for (let row = 0, y = WALL_TOP + 6; y < WALL_BOTTOM; row++, y += 6) {
      line(wallLeft, y, wallRight, y)
      for (let bx = wallLeft + (row % 2 ? 4 : 8); bx < wallRight - 1; bx += 8) line(bx, y - 6, bx, y)
    }
    // The ring: short orange arcs on the far side of the wall.
    if (ring > 0.05) {
      g.strokeStyle = c.orange
      g.lineWidth = 0.8
      for (let k = 1; k <= Math.ceil(ring * 3); k++) {
        g.globalAlpha = Math.max(0, ring - (k - 1) * 0.25)
        g.beginPath()
        g.arc(wallRight, (WALL_TOP + WALL_BOTTOM) / 2, 6 + k * 4, -0.5, 0.5)
        g.stroke()
      }
      g.globalAlpha = 1
    }
  }

  // ——— The waves: from the speaker to the wall, and what comes through to the ear ———
  const swing = 2 + state.level * 4
  BANDS.forEach((band, i) => {
    const stroke = color(band.color)
    const wave = (from: number, to: number, amplitude: number) => {
      g.beginPath()
      for (let wx = from; wx <= to; wx += 0.5) {
        const y = band.y + amplitude * Math.sin(((wx - state.time * 24) / band.wavelength) * Math.PI * 2)
        if (wx === from) g.moveTo(wx, y)
        else g.lineTo(wx, y)
      }
      g.stroke()
    }
    g.strokeStyle = stroke
    g.lineWidth = 0.9
    wave(WAVES_FROM, WALL_X - 3, swing)
    // Behind the wall: as strong as the filter lets it be. Almost nothing: a dotted line.
    const gain = Math.min(2, state.gains[i] ?? 1)
    const after = swing * gain
    if (after > 0.3) {
      wave(wallRight + 3, HEAD_X - 8, after)
    } else {
      g.globalAlpha = 0.5
      g.setLineDash([1, 3])
      line(wallRight + 3, band.y, HEAD_X - 8, band.y)
      g.setLineDash([])
      g.globalAlpha = 1
    }
    g.font = `600 6px ${c.font}`
    g.textAlign = 'left'
    g.fillStyle = stroke
    g.fillText(band.name, WAVES_FROM - 8, band.y - 6)
  })

  // ——— The listener: a head in thin lines, facing the wall, with a red dot in the ear ———
  const head: [number, number][] = [
    [238, 87], [236, 74], [240, 60], [241, 46], [236, 33], [224, 26], [212, 30], [207, 39],
    [206, 45], [201, 52], [206, 55], [205, 60], [208, 62], [206, 67], [212, 71], [215, 78], [214, 87],
  ].map(([hx, hy]) => [hx + (HEAD_X - 204), hy])
  g.strokeStyle = c.orange
  g.lineWidth = 1.1
  g.beginPath()
  g.moveTo(...head[0]!)
  for (let k = 1; k < head.length - 1; k++) {
    const [px, py] = head[k]!
    const [nx, ny] = head[k + 1]!
    g.quadraticCurveTo(px, py, (px + nx) / 2, (py + ny) / 2)
  }
  g.lineTo(...head[head.length - 1]!)
  g.stroke()
  // The ear, and the eye.
  g.lineWidth = 0.9
  g.beginPath()
  g.arc(HEAD_X + 22, 52, 4, Math.PI * 0.6, Math.PI * 1.6)
  g.stroke()
  g.fillStyle = c.red
  g.beginPath()
  g.arc(HEAD_X + 22.5, 52, 1.6 + state.level * 0.8, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = c.ink
  g.beginPath()
  g.arc(HEAD_X + 6, 43, 0.9, 0, Math.PI * 2)
  g.fill()
}

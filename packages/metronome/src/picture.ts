/**
 * The metronome's picture, drawn on a 2D canvas (40px high, as wide as the module), in the same
 * thin-line style as the Master's reels and the library's cassettes: the tape path at the bottom
 * of a cassette, without the case. A thin line of tape comes down from the reels (out of view),
 * past a small pin and around a tape guide on each side, along the bottom, past the head, and back
 * up. It is quiet on purpose: only the marks on the tape and the head's light are strong.
 *
 *  │                                                                  │
 *  o╲                                                               ╱o     ← pins
 *    (·)        o               ▭               o              (·)       ← tape guides, capstans, pad
 *     ╰───•───────•───────●───────•──┬──•───────●───────•──────╯         ← the tape: a dot per beat,
 *                                ╭──┴──╮                                    a bigger one per bar
 *                                ╰─────╯                                 ← the head (it lights up)
 *  7.5 IN / BEAT AT 15 IPS                                 120 BPM       ← tape per beat, the tempo
 *
 * Not an exact drawing of a cassette: simpler, like the other pictures.
 * - One beat is always the same length of tape (BEAT_LENGTH). So the faster the tempo, the faster
 *   the tape runs, and a mark passes the head exactly on each beat.
 * - The marks on the tape: a small dot on each beat, and a bigger dot in the main color on the
 *   first beat of each bar (when the accent is on). On its beat, a dot lights up orange as it
 *   passes the head, and fades back over 0.1 s.
 * - The tape follows the transport: it slows down when it stops, stands still, and runs back
 *   while it rewinds. The tape guides turn with it.
 * - The small print: how much tape one beat is at 15 inches per second, the studio tape speed.
 *   Engineers cut tape loops to this length. Then the tempo. Both on digit wheels that roll to a
 *   new value (the script rolls them, see createOdometer in @loop/ui).
 */

import type { OdometerWheel } from '@loop/ui'

/** The tempo's 3 digit wheels (hundreds first), in bpm: for createOdometer in @loop/ui. */
export const BPM_WHEELS: readonly OdometerWheel[] = [100, 10, 1].map(
  (unit) => ({ unit }),
)

/** The studio tape speed, in inches per second (for the tape per beat). */
const TAPE_SPEED = 15

/**
 * The tape per beat's 3 digit wheels, in tenths of an inch: 75 shows "07.5" (with a dim 0).
 * From 3.0 in (300 bpm) to 45.0 in (20 bpm).
 */
export const INCH_WHEELS: readonly OdometerWheel[] = BPM_WHEELS

/** How much tape one beat is at a tempo, in tenths of an inch (the value for INCH_WHEELS). */
export const tapePerBeat = (bpm: number) =>
  Math.round((TAPE_SPEED * 60 * 10) / Math.max(1, bpm))

export interface PictureColors {
  screen: string
  ink: string
  line: string
  dim: string
  muted: string
  /** The module's main color (--loop-primary): the bar dots, and the head's gap on a bar. */
  primary: string
  /** A dot's light on its beat. */
  orange: string
  font: string
}

export interface PictureState {
  /** Where the tape is, in beats: mark k is at the head at position k. */
  position: number
  /** Every this many beats a bar dot (the first beat of a bar). 0: no bar dots (accent off). */
  barLength: number
  /** The tape per beat's digit wheels (INCH_WHEELS): each one 0 to 10. */
  inchWheels: readonly number[]
  /** The tempo's digit wheels (BPM_WHEELS): each one 0 to 10. 2.5 is halfway from 2 to 3. */
  bpmWheels: readonly number[]
  /** The last beat: its dot (mark k for beat k) is the one that lights up. */
  beat: number
  /** The beat flash: 1 just on a beat, down to 0. */
  flash: number
  /** True if the last beat was the first one of a bar (the head's gap lights in the main color). */
  accent: boolean
}

export const HEIGHT = 40
/** Canvas pixels per screen pixel, in each direction (like the Master: sharp thin lines). */
const SUPERSAMPLE = 4
/** How long one beat of tape is on the screen, in px. */
const BEAT_LENGTH = 38

// The parts, in px from the top (and from the sides).
/** The tape: a line, where it runs along the bottom. */
const TAPE_Y = 19.5
/** The marks on the tape: the radius of a beat dot, and of a bar dot. */
const BEAT_DOT = 1.3
const BAR_DOT = 2.2
/** The tape guides: their size, and how far in from the sides. The tape runs under them. */
const GUIDE = 4.5
const GUIDE_X = 16
/** The pins: small rollers above the tape guides, nearer the sides. The tape runs outside them. */
const PIN = 2.4
const PIN_X = 6
const PIN_Y = 6
/** The capstan holes: how far from the middle, as a part of the width. */
const CAPSTAN = 0.27
/** The head, under the tape in the middle. */
const HEAD_WIDTH = 16
const HEAD_HEIGHT = 5.5
/** The small print, on one base line at the bottom. */
const TEXT_Y = 37.5
const TEXT_SIZE = 7
/** The tempo (digits and "BPM"): one size, one color. */
const DIGIT_SIZE = 11

/** `width`: the canvas's width in CSS px (the module's width). */
export function drawPicture(
  canvas: HTMLCanvasElement,
  state: PictureState,
  c: PictureColors,
  width: number,
) {
  const scale = (devicePixelRatio || 1) * SUPERSAMPLE
  if (
    canvas.width !== Math.round(width * scale) ||
    canvas.height !== Math.round(HEIGHT * scale)
  ) {
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
  const circle = (x: number, y: number, r: number) => {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
  }

  const headX = width / 2
  /** How far the tape has moved, in px (the tape guides turn with it). */
  const travel = state.position * BEAT_LENGTH
  const guides = [GUIDE_X, width - GUIDE_X] as const
  const capstans = [headX - width * CAPSTAN, headX + width * CAPSTAN] as const
  /** The radius of the tape around a guide: just outside its rim. */
  const around = GUIDE + 0.8
  const guideY = TAPE_Y - around
  const pins = [PIN_X, width - PIN_X] as const
  /** The radius of the tape around a pin: just outside its rim. */
  const pinAround = PIN + 0.8
  /**
   * Where the tape goes from the left pin to the left guide: a line that touches both, on their
   * outer side. The angle (from each center) of the points where it touches.
   */
  const dx = guides[0] - pins[0]
  const dy = guideY - PIN_Y
  const leave =
    Math.atan2(dy, dx) + Math.acos((pinAround - around) / Math.hypot(dx, dy))

  // ——— The capstan holes, just inside the tape: small rings ———
  g.strokeStyle = c.line
  g.lineWidth = 0.8
  for (const x of capstans) {
    circle(x, TAPE_Y - 4, 1.8)
    g.stroke()
  }

  // ——— The pressure pad: felt, pressing the tape against the head ———
  g.fillStyle = c.dim
  g.beginPath()
  g.roundRect(headX - 5, TAPE_Y - 2.6, 10, 2, 0.6)
  g.fill()

  // ——— The head, under the tape ———
  g.beginPath()
  g.roundRect(
    headX - HEAD_WIDTH / 2,
    TAPE_Y + 1,
    HEAD_WIDTH,
    HEAD_HEIGHT,
    [3.5, 3.5, 1.5, 1.5],
  )
  g.fillStyle = c.screen
  g.fill()
  g.strokeStyle = c.muted
  g.lineWidth = 0.8
  g.stroke()
  // The gap, where it reads the tape.
  g.strokeStyle = state.flash > 0.5 && state.accent ? c.primary : c.muted
  g.lineWidth = 0.8
  line(headX, TAPE_Y + 1.6, headX, TAPE_Y + 3.4)

  // ——— The tape: one line, down from the reels, past the pins and around the guides, along the
  // bottom, and up again (the right side is the left side mirrored) ———
  g.beginPath()
  g.moveTo(pins[0] - pinAround, -1)
  g.arc(pins[0], PIN_Y, pinAround, Math.PI, leave, true)
  g.arc(guides[0], guideY, around, leave, Math.PI / 2, true)
  g.lineTo(guides[1], TAPE_Y)
  g.arc(guides[1], guideY, around, Math.PI / 2, Math.PI - leave, true)
  g.arc(pins[1], PIN_Y, pinAround, Math.PI - leave, 0, true)
  g.lineTo(pins[1] + pinAround, -1)
  g.strokeStyle = c.muted
  g.lineWidth = 1.1
  g.stroke()

  // The marks: dots on the tape, on the part along the bottom (between the guides).
  g.save()
  g.beginPath()
  g.rect(
    guides[0],
    TAPE_Y - BAR_DOT - 1,
    guides[1] - guides[0],
    BAR_DOT * 2 + 2,
  )
  g.clip()
  const first = Math.floor(state.position - headX / BEAT_LENGTH) - 1
  const last = Math.ceil(state.position + (width - headX) / BEAT_LENGTH) + 1
  for (let k = first; k <= last; k++) {
    const x = headX + (k - state.position) * BEAT_LENGTH
    const bar =
      state.barLength > 0 &&
      ((k % state.barLength) + state.barLength) % state.barLength === 0
    g.fillStyle = bar ? c.primary : c.ink
    circle(x, TAPE_Y, bar ? BAR_DOT : BEAT_DOT)
    g.fill()
    // On its beat: orange on top, fading out evenly (see the beat flash in script.ts).
    if (k === state.beat && state.flash > 0) {
      g.globalAlpha = state.flash
      g.fillStyle = c.orange
      g.fill()
      g.globalAlpha = 1
    }
  }
  g.restore()

  // ——— The tape guides, in the corners: rollers with a tick that turns with the tape ———
  for (const x of guides) {
    circle(x, guideY, GUIDE)
    g.fillStyle = c.screen
    g.fill()
    g.strokeStyle = c.muted
    g.lineWidth = 0.8
    g.stroke()
    // The tape runs left under the guide, so the guide turns clockwise.
    const turn = travel / GUIDE
    line(
      x,
      guideY,
      x + Math.cos(turn) * (GUIDE - 1.4),
      guideY + Math.sin(turn) * (GUIDE - 1.4),
    )
    circle(x, guideY, 0.8)
    g.fillStyle = c.muted
    g.fill()
  }

  // The tape comes from the reels, out of view: it fades in at the top. Erase it gradually (so
  // the screen behind shows): a fade to a color through "transparent" would pass through gray.
  g.globalCompositeOperation = 'destination-out'
  const fade = g.createLinearGradient(0, 0, 0, 7)
  fade.addColorStop(0, 'rgb(0 0 0 / 1)')
  fade.addColorStop(1, 'rgb(0 0 0 / 0)')
  g.fillStyle = fade
  g.fillRect(pins[0] - pinAround - 2, 0, 4, 7)
  g.fillRect(pins[1] + pinAround - 2, 0, 4, 7)
  g.globalCompositeOperation = 'source-over'

  // ——— The pins: small rollers. After the fade, so they are not faded too ———
  for (const x of pins) {
    circle(x, PIN_Y, PIN)
    g.fillStyle = c.screen
    g.fill()
    g.strokeStyle = c.muted
    g.lineWidth = 0.8
    g.stroke()
    circle(x, PIN_Y, 0.7)
    g.fillStyle = c.muted
    g.fill()
  }

  // ——— The small print: tape per beat, left; the tempo, right ———
  g.textBaseline = 'alphabetic'

  /**
   * Digit wheels in a window, from `left`, in the font set now: each digit rolls up to the next.
   * `decimals`: how many of the last wheels are after a decimal point. A leading zero is dim, like
   * an unlit display. Gives the width.
   */
  const drawWheels = (
    wheels: readonly number[],
    left: number,
    size: number,
    color: string,
    decimals = 0,
  ) => {
    const charWidth = g.measureText('0').width
    const capHeight = g.measureText('0').actualBoundingBoxAscent
    const pointWidth = decimals ? g.measureText('.').width : 0
    const point = wheels.length - decimals
    const row = size * 1.1
    const total = charWidth * wheels.length + pointWidth
    g.save()
    g.beginPath()
    g.rect(left - 1, TEXT_Y - capHeight - 1.5, total + 2, capHeight + 3)
    g.clip()
    g.textAlign = 'center'
    wheels.forEach((wheel, i) => {
      const x = left + charWidth * (i + 0.5) + (i >= point ? pointWidth : 0)
      const digit = Math.floor(wheel) % 10
      const turn = wheel % 1
      // Leading: this wheel and all before it show 0 (not the last one before the point).
      const leading =
        i < point - 1 && wheels.slice(0, i + 1).every((w) => w < 0.5)
      g.fillStyle = leading ? c.dim : color
      g.fillText(String(digit), x, TEXT_Y - turn * row)
      if (turn > 0)
        g.fillText(String((digit + 1) % 10), x, TEXT_Y + (1 - turn) * row)
    })
    if (decimals) {
      g.fillStyle = color
      g.textAlign = 'left'
      g.fillText('.', left + charWidth * point, TEXT_Y)
    }
    g.restore()
    return total
  }

  // The tape per beat: digit wheels, then the rest of the text.
  g.font = `400 ${TEXT_SIZE}px ${c.font}`
  const inchesWidth = drawWheels(state.inchWheels, 0, TEXT_SIZE, c.muted, 1)
  g.fillStyle = c.muted
  g.textAlign = 'left'
  g.fillText(` IN / BEAT AT ${TAPE_SPEED} IPS`, inchesWidth, TEXT_Y)

  // The tempo: digit wheels, then "BPM", in the same size and color.
  g.font = `500 ${DIGIT_SIZE}px ${c.font}`
  g.fillStyle = c.ink
  g.textAlign = 'right'
  const bpmWidth = g.measureText(' BPM').width
  g.fillText(' BPM', width, TEXT_Y)
  const digitsWidth = g.measureText('0').width * state.bpmWheels.length
  drawWheels(state.bpmWheels, width - bpmWidth - digitsWidth, DIGIT_SIZE, c.ink)
}

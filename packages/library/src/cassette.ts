/**
 * A cassette tape for each project, drawn on a 2D canvas in the thin-line style of the other
 * modules (see the Master's reels). Each project gets its own look: a random number made from its
 * id picks the shell, the label, the colors and the small print. The same id always gives the
 * same tape, so nothing has to be saved.
 *
 *   ┌o───────────────────────────────o┐
 *   │ ┌─────────────────────────────┐ │
 *   │ │ Untitled project_______  C60 │ │   ← the label: the project name on the writing line
 *   │ │A  ╭───────────────────╮     │ │
 *   │ │   │ (◎)  [ ═══ ]  (◎) │     │ │   ← the window: the hubs, and the tape wound on them
 *   │ │   ╰───────────────────╯     │ │
 *   │ │▓▓▓▓ KORAVE ▓▓▓▓ LOW NOISE ▓▓▓│ │   ← a color band, the made-up brand, the small print
 *   │ └─────────────────────────────┘ │
 *   └o─────\__o__▫__▭__▫__o__/──────o┘   ← the head opening, with its holes
 */

/** The canvas size, in CSS px (a real cassette is 100.4 × 63.8 mm). */
export const CASSETTE_WIDTH = 100
export const CASSETTE_HEIGHT = 64
/** Canvas pixels per screen pixel: sharp thin lines, but less than the Master (there are many). */
const SUPERSAMPLE = 2

export interface CassetteColors {
  screen: string
  ink: string
  muted: string
  line: string
  dim: string
  /** The window and the holes: dark in light and dark mode, like a real cassette. */
  hole: string
  /** The hubs: white in light and dark mode. */
  hub: string
  /** The tape wound on the hubs, and its rings: dark brown-grey in light and dark mode. */
  pack: string
  packLine: string
  /** The accent colors of the app (CHANNEL_COLORS): for the shells and the labels. */
  accents: readonly string[]
  font: string
}

/** The font weights and sizes the tape uses (the family is `CassetteColors.font`). Load them first. */
export const CASSETTE_FONTS = ['400 4px', '500 5px', '700 7px'] as const

type Shell = 'light' | 'dark' | 'grey' | 'tinted' | 'clear'
type Layout = 'stripe' | 'band' | 'diagonal' | 'split'

/** What one tape looks like. Made by `designCassette` from a project id. */
export interface CassetteDesign {
  shell: Shell
  layout: Layout
  /** Two different accent colors (places in `CassetteColors.accents`). */
  accents: readonly [number, number]
  length: string
  side: 'A' | 'B'
  brand: string
  smallPrint: string
  /** How many stripes the diagonal label has. */
  stripes: number
  /** How much of the tape is on the left hub, 0 to 1. */
  tape: number
  /** How far each hub is turned, in radians. */
  turns: readonly [number, number]
  screws: 'cross' | 'slot'
}

const LENGTHS = ['C46', 'C60', 'C60', 'C90', 'C90', 'C120'] as const
const SMALL_PRINT = [
  'LOW NOISE',
  'HIGH OUTPUT',
  'NORMAL BIAS',
  'FERRO',
  'CHROME',
  'TYPE I',
  'HI-FI',
  'STUDIO',
] as const
/** Brand names: two or three of these, for example KO + RA + VE. Made up, so no real brand. */
const SYLLABLES = [
  'KO',
  'RA',
  'VE',
  'LU',
  'MI',
  'TO',
  'SA',
  'NE',
  'DA',
  'ZE',
  'FO',
  'BI',
  'XA',
  'YO',
  'PE',
  'TRO',
] as const

/** FNV-1a: a 32-bit number from a string. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mulberry32: random numbers from 0 to 1, the same ones for the same seed. */
function createRandom(seed: number) {
  let state = seed
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pick = <T>(list: readonly T[]): T =>
    list[Math.floor(next() * list.length)]!
  const between = (min: number, max: number) => min + next() * (max - min)
  return { next, pick, between }
}

/** The look of a project's tape. The same id always gives the same tape. */
export function designCassette(
  id: string,
  accentCount: number,
): CassetteDesign {
  const random = createRandom(hash(id))
  const shell = random.pick<Shell>([
    'light',
    'light',
    'dark',
    'dark',
    'grey',
    'tinted',
    'tinted',
    'clear',
  ])
  const first = Math.floor(random.next() * accentCount)
  const second =
    (first + 1 + Math.floor(random.next() * (accentCount - 1))) % accentCount
  const syllables = 2 + Math.floor(random.next() * 2)
  return {
    shell,
    layout: random.pick<Layout>(['stripe', 'band', 'diagonal', 'split']),
    accents: [first, second],
    length: random.pick(LENGTHS),
    side: random.next() < 0.75 ? 'A' : 'B',
    brand: Array.from({ length: syllables }, () => random.pick(SYLLABLES)).join(
      '',
    ),
    smallPrint: random.pick(SMALL_PRINT),
    stripes: 2 + Math.floor(random.next() * 2),
    tape: random.between(0.15, 0.85),
    turns: [random.between(0, Math.PI), random.between(0, Math.PI)],
    screws: random.next() < 0.5 ? 'cross' : 'slot',
  }
}

// The parts, in px on the 100 × 64 tape.
const LABEL = { x: 6, y: 5, w: 88, h: 41 }
const WINDOW = { x: 25, y: 19, w: 50, h: 14 }
const HUBS = [35.5, 64.5] as const
const HUB_Y = 26
const SCREWS = [
  [4.5, 4.5],
  [95.5, 4.5],
  [4.5, 59.5],
  [95.5, 59.5],
  [50, 53.5],
] as const

/** Draw a project's tape: its design, with the project name on the label. Units: a 100 × 64 tape. */
export function drawCassette(
  canvas: HTMLCanvasElement,
  design: CassetteDesign,
  name: string,
  c: CassetteColors,
  /** How wide the canvas shows on the page, in CSS px. The drawing is sharp at this size. */
  width: number = CASSETTE_WIDTH,
) {
  const scale = (devicePixelRatio || 1) * SUPERSAMPLE * (width / CASSETTE_WIDTH)
  canvas.width = Math.round(CASSETTE_WIDTH * scale)
  canvas.height = Math.round(CASSETTE_HEIGHT * scale)
  const g = canvas.getContext('2d')!
  g.setTransform(scale, 0, 0, scale, 0, 0)
  g.clearRect(0, 0, CASSETTE_WIDTH, CASSETTE_HEIGHT)
  g.lineCap = 'round'
  g.lineJoin = 'round'

  const accent = (i: 0 | 1) => c.accents[design.accents[i]]!
  const rounded = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath()
    g.roundRect(x, y, w, h, r)
  }
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
  const text = (
    value: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign = 'left',
    maxWidth?: number,
  ) => {
    g.font = `${font} ${c.font}`
    g.fillStyle = color
    g.textAlign = align
    g.textBaseline = 'middle'
    g.fillText(fit(g, value, maxWidth), x, y)
  }

  // ——— The shell ———
  const clear = design.shell === 'clear'
  const shellFill = {
    light: c.screen,
    dark: c.muted,
    grey: c.line,
    tinted: c.screen,
    clear: c.screen,
  }[design.shell]
  rounded(0.5, 0.5, CASSETTE_WIDTH - 1, CASSETTE_HEIGHT - 1, 3.5)
  g.fillStyle = shellFill
  g.fill()
  if (design.shell === 'tinted' || clear) {
    g.globalAlpha = clear ? 0.25 : 0.45
    g.fillStyle = clear ? c.dim : accent(1)
    g.fill()
    g.globalAlpha = 1
  }
  g.strokeStyle = c.ink
  g.lineWidth = 0.8
  g.stroke()
  // The raised edge just inside.
  rounded(2.5, 2.5, CASSETTE_WIDTH - 5, CASSETTE_HEIGHT - 5, 2.5)
  g.strokeStyle = c.dim
  g.lineWidth = 0.4
  g.stroke()

  // A clear shell: the whole tape pack shows through, not only in the window.
  if (clear) {
    HUBS.forEach((x, i) => {
      const r = 6 + 10 * (i === 0 ? design.tape : 1 - design.tape)
      circle(x, HUB_Y, r)
      g.fillStyle = c.pack
      g.globalAlpha = 0.18
      g.fill()
      g.globalAlpha = 1
      // The tape wound on the hub: thin rings, like in the window.
      g.strokeStyle = c.line
      g.lineWidth = 0.3
      for (let ring = 6; ring < r; ring += 1.6) {
        circle(x, HUB_Y, ring)
        g.stroke()
      }
      circle(x, HUB_Y, r)
      g.strokeStyle = c.muted
      g.lineWidth = 0.45
      g.stroke()
    })
    // The tape from one pack to the other, under the window, past the guides.
    g.strokeStyle = c.muted
    g.lineWidth = 0.4
    g.beginPath()
    g.moveTo(HUBS[0] - 6 - 10 * design.tape, HUB_Y + 4)
    g.lineTo(23, 50.5)
    g.lineTo(77, 50.5)
    g.lineTo(HUBS[1] + 6 + 10 * (1 - design.tape), HUB_Y + 4)
    g.stroke()
  }

  // ——— The label ———
  drawLabel(g, design, c, accent, { rounded, line })

  // The writing line, with the project name on it.
  const nameY = design.layout === 'split' ? 10 : 10.5
  g.strokeStyle = c.dim
  g.lineWidth = 0.35
  line(LABEL.x + 4, nameY + 3, LABEL.x + LABEL.w - 18, nameY + 3)
  text(name, LABEL.x + 4, nameY, '500 5px', c.ink, 'left', LABEL.w - 24)
  text(
    design.length,
    LABEL.x + LABEL.w - 3,
    nameY + 0.5,
    '700 7px',
    c.ink,
    'right',
  )

  // The side, in a small box left of the window.
  rounded(LABEL.x + 3.5, WINDOW.y + 3.5, 7, 7, 1)
  g.fillStyle = c.screen
  g.fill()
  g.strokeStyle = c.ink
  g.lineWidth = 0.5
  g.stroke()
  text(design.side, LABEL.x + 7, WINDOW.y + 7.2, '700 7px', c.ink, 'center')

  // ——— The window: the hubs, and the tape wound on them ———
  g.save()
  rounded(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, WINDOW.h / 2)
  g.fillStyle = c.hole
  g.globalAlpha = clear ? 0.15 : 0.8
  g.fill()
  g.globalAlpha = 1
  g.clip()
  HUBS.forEach((x, i) => {
    const r = 5 + 9 * (i === 0 ? design.tape : 1 - design.tape)
    circle(x, HUB_Y, r)
    g.fillStyle = c.pack
    g.fill()
    g.strokeStyle = c.packLine
    g.lineWidth = 0.3
    for (let ring = 6; ring < r; ring += 1.6) {
      circle(x, HUB_Y, ring)
      g.stroke()
    }
  })
  // The tape between the hubs, through the little window in the middle.
  rounded(44, 22.5, 12, 7, 1)
  g.fillStyle = c.screen
  g.globalAlpha = 0.25
  g.fill()
  g.globalAlpha = 1
  g.strokeStyle = c.line
  g.lineWidth = 0.4
  g.stroke()
  g.restore()

  // The hubs: a white ring with teeth inside.
  HUBS.forEach((x, i) => {
    circle(x, HUB_Y, 4.2)
    g.fillStyle = c.hub
    g.fill()
    g.strokeStyle = c.ink
    g.lineWidth = 0.6
    g.stroke()
    circle(x, HUB_Y, 2.4)
    g.fillStyle = c.hole
    g.fill()
    g.strokeStyle = c.hub
    g.lineWidth = 0.5
    for (let t = 0; t < 6; t++) {
      const a = design.turns[i]! + (t * Math.PI) / 3
      line(
        x + Math.cos(a) * 1.2,
        HUB_Y + Math.sin(a) * 1.2,
        x + Math.cos(a) * 2.4,
        HUB_Y + Math.sin(a) * 2.4,
      )
    }
  })
  rounded(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, WINDOW.h / 2)
  g.strokeStyle = c.ink
  g.lineWidth = 0.7
  g.stroke()
  // The scale under the window: how much tape is left, in ticks (every fifth a little longer).
  g.strokeStyle = c.muted
  g.lineWidth = 0.3
  for (let t = 0; t <= 20; t++) {
    const tx = WINDOW.x + 7 + t * ((WINDOW.w - 14) / 20)
    const long = t % 5 === 0
    line(
      tx,
      WINDOW.y + WINDOW.h + 2.6,
      tx,
      WINDOW.y + WINDOW.h + (long ? 4.6 : 3.6),
    )
  }
  // The play direction, right of the window.
  g.fillStyle = c.ink
  g.beginPath()
  g.moveTo(WINDOW.x + WINDOW.w + 4, HUB_Y - 2)
  g.lineTo(WINDOW.x + WINDOW.w + 7, HUB_Y)
  g.lineTo(WINDOW.x + WINDOW.w + 4, HUB_Y + 2)
  g.closePath()
  g.fill()
  rounded(
    WINDOW.x - 1.5,
    WINDOW.y - 1.5,
    WINDOW.w + 3,
    WINDOW.h + 3,
    WINDOW.h / 2 + 1.5,
  )
  g.strokeStyle = c.line
  g.lineWidth = 0.35
  g.stroke()

  // ——— The head opening at the bottom, with its holes ———
  g.beginPath()
  g.moveTo(20, CASSETTE_HEIGHT - 0.5)
  g.lineTo(24.5, 49.5)
  g.lineTo(75.5, 49.5)
  g.lineTo(80, CASSETTE_HEIGHT - 0.5)
  g.fillStyle = shellFill
  g.fill()
  g.strokeStyle = c.ink
  g.lineWidth = 0.6
  g.stroke()
  for (const x of [29, 71]) {
    circle(x, 58, 1.9)
    g.fillStyle = c.hole
    g.fill()
  }
  for (const x of [36, 61]) {
    rounded(x, 56.5, 3, 3, 0.5)
    g.fillStyle = c.hole
    g.fill()
  }
  rounded(45, 59, 10, 6, 0.8)
  g.fillStyle = c.hole
  g.fill()

  // ——— The screws ———
  SCREWS.forEach(([x, y], i) => {
    circle(x, y, 1.6)
    g.fillStyle = c.line
    g.fill()
    g.strokeStyle = c.ink
    g.lineWidth = 0.4
    g.stroke()
    const a = design.turns[i % 2]! + i
    g.lineWidth = 0.35
    line(x - Math.cos(a), y - Math.sin(a), x + Math.cos(a), y + Math.sin(a))
    if (design.screws === 'cross')
      line(x + Math.sin(a), y - Math.cos(a), x - Math.sin(a), y + Math.cos(a))
  })
}

/** The label, in one of four layouts. Under the name, the window and the side box. */
function drawLabel(
  g: CanvasRenderingContext2D,
  design: CassetteDesign,
  c: CassetteColors,
  accent: (i: 0 | 1) => string,
  draw: {
    rounded: (x: number, y: number, w: number, h: number, r: number) => void
    line: (x1: number, y1: number, x2: number, y2: number) => void
  },
) {
  const { x, y, w, h } = LABEL
  const bottom = y + h
  const small = (
    value: string,
    tx: number,
    ty: number,
    color: string,
    align: CanvasTextAlign,
  ) => {
    g.font = `400 4px ${c.font}`
    g.fillStyle = color
    g.textAlign = align
    g.textBaseline = 'middle'
    g.fillText(value, tx, ty)
  }
  const brand = (
    tx: number,
    ty: number,
    color: string,
    align: CanvasTextAlign = 'left',
  ) => {
    g.font = `700 7px ${c.font}`
    g.fillStyle = color
    g.textAlign = align
    g.textBaseline = 'middle'
    g.fillText(design.brand, tx, ty)
  }

  // A clear shell has only a small paper label at the top.
  if (design.shell === 'clear') {
    draw.rounded(x + 2, y, w - 4, 11, 1.5)
    g.fillStyle = c.screen
    g.fill()
    g.strokeStyle = c.ink
    g.lineWidth = 0.5
    g.stroke()
    g.fillStyle = accent(0)
    g.fillRect(x + 2.3, y + 9.5, w - 4.6, 1.2)
    brand(x + w / 2, bottom - 3, c.ink, 'center')
    return
  }

  // The paper.
  draw.rounded(x, y, w, h, 2)
  g.fillStyle = c.screen
  g.fill()
  g.save()
  g.clip()

  if (design.layout === 'stripe') {
    // A color band under the window, with a thin second stripe above it.
    g.fillStyle = accent(1)
    g.fillRect(x, bottom - 11.5, w, 1.3)
    g.fillStyle = accent(0)
    g.fillRect(x, bottom - 9.5, w, 9.5)
    brand(x + 4, bottom - 4.6, c.screen)
    small(design.smallPrint, x + w - 4, bottom - 4.6, c.screen, 'right')
  } else if (design.layout === 'band') {
    // A wide band behind the window, with thin lines above and under it.
    g.fillStyle = accent(0)
    g.fillRect(x, WINDOW.y - 3, w, WINDOW.h + 6)
    g.fillStyle = accent(1)
    g.fillRect(x, WINDOW.y - 4.8, w, 1)
    g.fillRect(x, WINDOW.y + WINDOW.h + 3.8, w, 1)
    brand(x + 4, bottom - 4, c.ink)
    small(design.smallPrint, x + w - 4, bottom - 4, c.muted, 'right')
  } else if (design.layout === 'diagonal') {
    // Slanted stripes on the right, under the writing line (the length stays on paper).
    g.save()
    g.beginPath()
    g.rect(x, y + 15, w, h - 15)
    g.clip()
    for (let i = 0; i < design.stripes; i++) {
      const left = x + w - 10 - i * 7
      g.beginPath()
      g.moveTo(left, bottom)
      g.lineTo(left + 5, bottom)
      g.lineTo(left + 20, y)
      g.lineTo(left + 15, y)
      g.closePath()
      g.fillStyle = accent(i % 2 === 0 ? 0 : 1)
      g.fill()
    }
    g.restore()
    brand(x + 4, bottom - 4, c.ink)
    // The small print right after the brand, on the same line.
    g.font = `700 7px ${c.font}`
    const after = x + 4 + g.measureText(design.brand).width + 3
    small(design.smallPrint, after, bottom - 4, c.muted, 'left')
  } else {
    // Split: a color field from under the writing line to the bottom, the brand on it.
    g.fillStyle = accent(0)
    g.fillRect(x, y + 15, w, h - 15)
    g.fillStyle = accent(1)
    g.fillRect(x, y + 15, w, 1.2)
    brand(x + w - 4, bottom - 4.2, c.screen, 'right')
    small(design.smallPrint, x + 4, bottom - 4.2, c.screen, 'left')
  }
  g.restore()

  draw.rounded(x, y, w, h, 2)
  g.strokeStyle = c.ink
  g.lineWidth = 0.5
  g.stroke()
}

/** Shorten `value` with "…" until it fits in `maxWidth` (with the current font). */
function fit(g: CanvasRenderingContext2D, value: string, maxWidth?: number) {
  if (maxWidth === undefined || g.measureText(value).width <= maxWidth)
    return value
  let end = value.length
  while (end > 0 && g.measureText(`${value.slice(0, end)}…`).width > maxWidth)
    end--
  return `${value.slice(0, end)}…`
}

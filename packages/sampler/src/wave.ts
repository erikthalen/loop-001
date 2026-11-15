/**
 * The SP-01 picture, drawn on a 2D canvas: the sound as columns of small cells, mirrored around
 * a dotted middle line. The part between the markers is bright, the rest is dim.
 * While recording: the microphone level, in red, from left to right over 5 seconds.
 */

export interface WaveColors {
  background: string
  middle: string
  bright: string
  dim: string
  rec: string
  playhead: string
  text: string
  font: string
}

export const WIDTH = 275
export const HEIGHT = 84
/** One column is 2px of cells and a 1px gap. One cell is 2px high with a 1px gap. */
const PITCH = 3
/** 92 columns: 92 x 3px is 276px, and the last column needs no gap, so they fill the 275px exactly. */
export const COLUMNS = Math.floor((WIDTH + 1) / PITCH)
const MIDDLE = HEIGHT / 2
/** The middle row of cells: 2px high, on the middle line. */
const CENTER = MIDDLE - 1
/** Cells above (and below) the middle row, at full level. */
const MAX_CELLS = Math.floor((CENTER - 1) / PITCH)

/** The loudest sample in each column, from 0 to 1 (the loudest column is 1). */
export function columnsOf(buffer: AudioBuffer): Float32Array {
  const data = buffer.getChannelData(0)
  const per = data.length / COLUMNS
  const out = new Float32Array(COLUMNS)
  let peak = 0.0001
  for (let i = 0; i < COLUMNS; i++) {
    let p = 0
    for (let k = Math.floor(i * per); k < Math.floor((i + 1) * per); k++) p = Math.max(p, Math.abs(data[k]!))
    out[i] = p
    peak = Math.max(peak, p)
  }
  return out.map((p) => p / peak)
}

export interface WaveState {
  /** The sound to show, as columns (see columnsOf). null: the channel is empty. */
  columns: Float32Array | null
  start: number
  end: number
  /** Where the sound is playing now (0 to 1), or null. */
  playhead: number | null
  /** While recording: the level of each column so far. */
  recorded: number[] | null
}

export function drawWave(canvas: HTMLCanvasElement, state: WaveState, c: WaveColors) {
  // Sharp on every screen: one canvas pixel per screen pixel.
  const dpr = devicePixelRatio || 1
  if (canvas.width !== Math.round(WIDTH * dpr)) {
    canvas.width = Math.round(WIDTH * dpr)
    canvas.height = Math.round(HEIGHT * dpr)
  }
  const g = canvas.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)

  g.fillStyle = c.background
  g.fillRect(0, 0, WIDTH, HEIGHT)
  // The dotted middle line: only on an empty channel and while recording. A sound has its own middle row.
  if (state.recorded || !state.columns) {
    g.fillStyle = c.middle
    for (let x = 0; x < WIDTH; x += 4) g.fillRect(x, MIDDLE, 1, 1)
  }

  /** One column of cells: always one cell on the middle row, then the same number above and below it. */
  const column = (i: number, level: number, color: string) => {
    const cells = Math.round(level * MAX_CELLS)
    g.fillStyle = color
    g.fillRect(i * PITCH, CENTER, PITCH - 1, 2)
    for (let k = 1; k <= cells; k++) {
      g.fillRect(i * PITCH, CENTER - k * PITCH, PITCH - 1, 2)
      g.fillRect(i * PITCH, CENTER + k * PITCH, PITCH - 1, 2)
    }
  }

  g.font = `10px ${c.font}`
  g.textBaseline = 'middle'

  if (state.recorded) {
    state.recorded.forEach((level, i) => column(i, Math.min(1, level * 1.4), c.rec))
    g.fillStyle = c.rec
    g.textAlign = 'right'
    g.fillText('MAX 5 S', WIDTH - 5, 9)
    return
  }

  if (!state.columns) {
    g.fillStyle = c.text
    g.textAlign = 'center'
    g.fillText('EMPTY — TICK REC TO RECORD', WIDTH / 2, MIDDLE - 9)
    return
  }

  state.columns.forEach((level, i) => {
    const at = (i + 0.5) / COLUMNS
    column(i, level, at >= state.start && at <= state.end ? c.bright : c.dim)
  })

  if (state.playhead !== null) {
    g.fillStyle = c.playhead
    g.fillRect(Math.round(state.playhead * WIDTH), 0, 1, HEIGHT)
  }
}

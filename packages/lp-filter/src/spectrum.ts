/**
 * The LP-01 picture, drawn on a 2D canvas, about 60 times a second:
 * - Bars: the sound in 40 frequency bands, as stacks of small cells (like an LED display).
 *   Grey: the sound before the filter. Blue, on top: the sound after it.
 * - An amber line with a glow: the filter's curve. A small square marks the cutoff.
 * - Dashed lines and labels at 100 Hz, 1 kHz and 10 kHz.
 *
 * The frequency axis is logarithmic (each octave is the same width), like we hear.
 */

import { MAX_FREQUENCY, MIN_FREQUENCY, SECOND_STAGE_Q, type Slope } from './setup'

export interface SpectrumSource {
  readonly inputAnalyser: AnalyserNode
  readonly outputAnalyser: AnalyserNode
  readonly frequency: number
  /** Resonance in dB. */
  readonly resonance: number
  readonly slope: Slope
  readonly on: boolean
  getResponse(frequencies: Float32Array<ArrayBuffer>, magnitudes: Float32Array<ArrayBuffer>): void
}

export interface SpectrumColors {
  spectrumIn: string
  spectrumOut: string
  curve: string
  grid: string
  axis: string
  font: string
}

export interface Spectrum {
  /** Draw one frame. */
  draw(): void
}

/** Size in CSS pixels. The plot is the top part; the labels are under it. */
const WIDTH = 200
const HEIGHT = 132
const PLOT = 120
const BANDS = 40
/** One cell: 2px lit, 1px gap. */
const CELL = 3
/** Bars: from -100 dB (nothing) to -15 dB (full). */
const BAR_FLOOR_DB = -100
const BAR_RANGE_DB = 85
/** Curve: +24 dB at the top, -48 dB at the bottom. */
const CURVE_TOP_DB = 24
const CURVE_RANGE_DB = 72
const MARKS: readonly [hz: number, label: string][] = [
  [100, '100'],
  [1000, '1k'],
  [10_000, '10k'],
]

const SPAN = Math.log(MAX_FREQUENCY / MIN_FREQUENCY)
const xOf = (hz: number) => (Math.log(hz / MIN_FREQUENCY) / SPAN) * WIDTH
const hzAt = (x: number) => MIN_FREQUENCY * Math.exp((SPAN * x) / WIDTH)
const yOfDb = (db: number) => 5 + ((CURVE_TOP_DB - db) / CURVE_RANGE_DB) * (PLOT - 5)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
/** Like Math.min / Math.max, but with a round corner (about `k` px) instead of a sharp one. */
const softMin = (a: number, b: number, k: number) => Math.min(a, b) - k * Math.log1p(Math.exp(-Math.abs(a - b) / k))
const softMax = (a: number, b: number, k: number) => Math.max(a, b) + k * Math.log1p(Math.exp(-Math.abs(a - b) / k))

export function createSpectrum(
  canvas: HTMLCanvasElement,
  source: SpectrumSource,
  colors: () => SpectrumColors,
): Spectrum {
  const g = canvas.getContext('2d')!
  const input = new Float32Array(source.inputAnalyser.frequencyBinCount)
  const output = new Float32Array(source.outputAnalyser.frequencyBinCount)

  // Which analyser bins belong to each band (the same for both analysers).
  const binWidth = source.inputAnalyser.context.sampleRate / source.inputAnalyser.fftSize
  const bands = Array.from({ length: BANDS }, (_, i) => {
    const from = Math.floor(hzAt((i * WIDTH) / BANDS) / binWidth)
    const to = Math.ceil(hzAt(((i + 1) * WIDTH) / BANDS) / binWidth)
    return { from, to: Math.max(to, from + 1) }
  })

  // The curve: one point every 1px.
  const curveHz = Float32Array.from({ length: WIDTH + 1 }, (_, x) => hzAt(x))
  const curveGain = new Float32Array(curveHz.length)
  const curveY = new Float32Array(curveHz.length)

  /** The loudest bin in a band, in dB. */
  const loudest = (data: Float32Array, band: { from: number; to: number }) => {
    let max = -Infinity
    for (let k = band.from; k < band.to && k < data.length; k++) if (data[k]! > max) max = data[k]!
    return max
  }
  const cellsFor = (db: number) =>
    Math.floor((clamp((db - BAR_FLOOR_DB) / BAR_RANGE_DB, 0, 1) * (PLOT - 6)) / CELL)
  const dbOf = (gain: number) => 20 * Math.log10(Math.max(gain, 1e-6))

  return {
    draw() {
      // Sharp on every screen: the canvas has one pixel per screen pixel.
      const dpr = devicePixelRatio || 1
      if (canvas.width !== Math.round(WIDTH * dpr)) {
        canvas.width = Math.round(WIDTH * dpr)
        canvas.height = Math.round(HEIGHT * dpr)
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, WIDTH, HEIGHT)
      const c = colors()

      // Dashed lines at 100 Hz, 1 kHz, 10 kHz.
      g.fillStyle = c.grid
      for (const [hz] of MARKS) {
        const x = Math.round(xOf(hz))
        for (let y = 0; y < PLOT; y += 6) g.fillRect(x, y, 1, 3)
      }

      // Bars: before (grey), then after (blue) on top.
      source.inputAnalyser.getFloatFrequencyData(input)
      source.outputAnalyser.getFloatFrequencyData(output)
      const bandWidth = WIDTH / BANDS
      for (let i = 0; i < BANDS; i++) {
        const x = Math.round(i * bandWidth)
        const w = Math.round(bandWidth) - 1
        const before = cellsFor(loudest(input, bands[i]!))
        const after = cellsFor(loudest(output, bands[i]!))
        g.fillStyle = c.spectrumIn
        for (let cell = 0; cell < before; cell++) g.fillRect(x, PLOT - (cell + 1) * CELL, w, CELL - 1)
        g.fillStyle = c.spectrumOut
        for (let cell = 0; cell < after; cell++) g.fillRect(x, PLOT - (cell + 1) * CELL, w, CELL - 1)
      }

      // The filter's curve, with a glow. Faded when the filter is off.
      source.getResponse(curveHz, curveGain)
      g.save()
      g.globalAlpha = source.on ? 1 : 0.35
      g.shadowColor = c.curve
      g.shadowBlur = 6
      g.strokeStyle = c.curve
      g.lineWidth = 1.5
      g.lineJoin = 'round'
      g.lineCap = 'round'
      // Keep the line inside the plot, with round corners where it meets the bottom (or the top).
      for (let x = 0; x < curveY.length; x++) {
        curveY[x] = softMax(softMin(yOfDb(dbOf(curveGain[x]!)), PLOT, 3), -2, 3)
      }
      // A smooth line: a curve from the middle of one step to the middle of the next,
      // bent by the point in between. So there are no corners at the points.
      g.beginPath()
      g.moveTo(0, curveY[0]!)
      for (let x = 1; x < curveY.length - 1; x++) {
        g.quadraticCurveTo(x, curveY[x]!, x + 0.5, (curveY[x]! + curveY[x + 1]!) / 2)
      }
      g.lineTo(curveY.length - 1, curveY[curveY.length - 1]!)
      g.stroke()
      g.restore()

      // The cutoff: a small square on the curve. At the cutoff, a low pass filter is always
      // exactly as loud as its resonance (in dB), at any frequency. So the square moves on a
      // straight line. (Measuring the filter here made it jump: the filter slides to a new
      // frequency over 20 ms, and the measurement saw the old curve.)
      // At 24 dB/oct, the second filter adds its own Q (-3 dB) at the cutoff.
      const cutoffDb = source.resonance + (source.slope === 24 ? SECOND_STAGE_Q : 0)
      const cx = Math.round(xOf(source.frequency))
      const cy = Math.round(clamp(yOfDb(cutoffDb), 4, PLOT - 4))
      g.globalAlpha = source.on ? 1 : 0.35
      g.strokeStyle = c.spectrumOut
      g.lineWidth = 1
      g.strokeRect(cx - 3.5, cy - 3.5, 7, 7)
      g.globalAlpha = 1

      // The axis: a line, ticks and labels.
      g.fillStyle = c.axis
      g.fillRect(0, PLOT + 1, WIDTH, 1)
      g.font = `8px ${c.font}`
      g.textAlign = 'center'
      for (const [hz, label] of MARKS) {
        const x = Math.round(xOf(hz))
        g.fillRect(x, PLOT + 1, 1, 3)
        g.fillText(label, x, HEIGHT - 1)
      }
    },
  }
}

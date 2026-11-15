import { defineModuleSetup } from '@loop/core'

export interface LowPassOptions {
  /** Cutoff frequency in Hz, from MIN_FREQUENCY to MAX_FREQUENCY. Default: 1000. */
  frequency?: number
  /** Resonance (a peak at the cutoff) in dB, from 0 to MAX_RESONANCE. Default: 6. */
  resonance?: number
  /** Filter on. Off: the sound goes through unchanged (bypass). Default: true. */
  on?: boolean
  /** How steep the filter is, in dB per octave: 12 or 24. Default: 12. */
  slope?: Slope
}

export type Slope = 12 | 24

export const MIN_FREQUENCY = 20
export const MAX_FREQUENCY = 20_000
export const MAX_RESONANCE = 20

/** How fast a new setting takes over, in seconds. Short, but long enough to avoid clicks. */
const SMOOTHING = 0.02

/**
 * The second filter's Q at 24 dB/oct, in dB: a plain (Butterworth) filter. At the cutoff it
 * is 3 dB quieter. The first filter adds the resonance.
 */
export const SECOND_STAGE_Q = -3.01

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Audio: a low pass filter (12 or 24 dB per octave) in the audio chain, with two analysers
 * for the picture: one before the filter, one after it.
 *
 *   input ─┬─▶ filter ─▶ second ─▶ wet ─┬─▶ output ─▶ (next module)
 *          ├─▶ dry ─────────────────────┘     └─▶ outputAnalyser
 *          └─▶ inputAnalyser
 *
 * On: wet is open, dry is closed. Off (bypass): the other way around.
 * 12 dB/oct: `second` is an all pass filter (it does not change the loudness).
 * 24 dB/oct: `second` is a low pass filter too. Two 12 dB/oct filters in a row make 24 dB/oct.
 */
export const setup = defineModuleSetup((ctx, options: LowPassOptions = {}) => {
  const { audio } = ctx
  // Options can come from a saved project file, so check the types.
  let frequency =
    typeof options.frequency === 'number' ? clamp(options.frequency, MIN_FREQUENCY, MAX_FREQUENCY) : 1000
  let resonance = typeof options.resonance === 'number' ? clamp(options.resonance, 0, MAX_RESONANCE) : 6
  let on = typeof options.on === 'boolean' ? options.on : true
  let slope: Slope = options.slope === 24 ? 24 : 12

  const input = new GainNode(audio)
  // For a low pass filter, Web Audio's Q is the resonance in dB.
  const filter = new BiquadFilterNode(audio, { type: 'lowpass', frequency, Q: resonance })
  const second = new BiquadFilterNode(audio, {
    type: slope === 24 ? 'lowpass' : 'allpass',
    frequency,
    Q: SECOND_STAGE_Q,
  })
  const wet = new GainNode(audio, { gain: on ? 1 : 0 })
  const dry = new GainNode(audio, { gain: on ? 0 : 1 })
  const output = new GainNode(audio)
  input.connect(filter).connect(second).connect(wet).connect(output)
  input.connect(dry).connect(output)

  // fftSize 4096: about 12 Hz per bin at 48 kHz, enough detail for the low notes.
  const analyserOptions: AnalyserOptions = { fftSize: 4096, smoothingTimeConstant: 0.8 }
  const inputAnalyser = new AnalyserNode(audio, analyserOptions)
  const outputAnalyser = new AnalyserNode(audio, analyserOptions)
  input.connect(inputAnalyser)
  output.connect(outputAnalyser)

  let phases = new Float32Array(0)
  let secondMagnitudes = new Float32Array(0)

  const setSlope = (value: Slope) => {
    slope = value
    second.type = slope === 24 ? 'lowpass' : 'allpass'
    ctx.changed()
  }

  return {
    input,
    output,
    /** The sound before the filter. Read it with `getFloatFrequencyData`. */
    inputAnalyser,
    /** The sound after the filter (or the bypass). */
    outputAnalyser,
    get frequency() {
      return frequency
    },
    get resonance() {
      return resonance
    },
    get on() {
      return on
    },
    get slope() {
      return slope
    },
    setFrequency(hz: number) {
      frequency = clamp(hz, MIN_FREQUENCY, MAX_FREQUENCY)
      filter.frequency.setTargetAtTime(frequency, audio.currentTime, SMOOTHING)
      second.frequency.setTargetAtTime(frequency, audio.currentTime, SMOOTHING)
      ctx.changed()
    },
    setResonance(db: number) {
      resonance = clamp(db, 0, MAX_RESONANCE)
      filter.Q.setTargetAtTime(resonance, audio.currentTime, SMOOTHING)
      ctx.changed()
    },
    setSlope,
    /** Switch between 12 and 24 dB/oct. */
    toggleSlope() {
      setSlope(slope === 12 ? 24 : 12)
    },
    setOn(value: boolean) {
      on = value
      wet.gain.setTargetAtTime(on ? 1 : 0, audio.currentTime, SMOOTHING)
      dry.gain.setTargetAtTime(on ? 0 : 1, audio.currentTime, SMOOTHING)
      ctx.changed()
    },
    /**
     * The filter's curve: how loud each frequency comes out (1 = unchanged).
     * Fills `magnitudes` for the frequencies (Hz) in `frequencies`.
     */
    getResponse(frequencies: Float32Array<ArrayBuffer>, magnitudes: Float32Array<ArrayBuffer>) {
      if (phases.length !== frequencies.length) {
        phases = new Float32Array(frequencies.length)
        secondMagnitudes = new Float32Array(frequencies.length)
      }
      // Two filters in a row: multiply their curves.
      filter.getFrequencyResponse(frequencies, magnitudes, phases)
      second.getFrequencyResponse(frequencies, secondMagnitudes, phases)
      for (let i = 0; i < magnitudes.length; i++) magnitudes[i]! *= secondMagnitudes[i]!
    },
    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): LowPassOptions => ({ frequency, resonance, on, slope }),
  }
})

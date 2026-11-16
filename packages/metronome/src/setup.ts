import { defineModuleSetup } from '@loop/core'

/** The time signatures the metronome can play, in the order the button steps through them. */
export const SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8'] as const
export type Signature = (typeof SIGNATURES)[number]

const isSignature = (value: unknown): value is Signature => SIGNATURES.includes(value as Signature)

/** Beats in one bar: the top number of the signature. Every beat of the core clock is one tick. */
const beatsIn = (signature: Signature) => Number.parseInt(signature, 10)

export interface MetronomeOptions {
  /** Volume from 0 to 1. Default: 0.5. */
  volume?: number
  /** Play a higher tick on the first beat of each bar. Default: true. */
  accent?: boolean
  /** Time signature. Default: '4/4'. */
  signature?: Signature
  /** Silent: no ticks (the picture still swings). Default: false. */
  muted?: boolean
}

/** Audio: plays a short tick on every beat of the core clock. */
export const setup = defineModuleSetup((ctx, options: MetronomeOptions = {}) => {
  const { audio } = ctx
  // Options can come from a saved project file, so check the types.
  let volume = typeof options.volume === 'number' ? Math.min(1, Math.max(0, options.volume)) : 0.5
  let accent = typeof options.accent === 'boolean' ? options.accent : true
  let signature: Signature = isSignature(options.signature) ? options.signature : '4/4'
  let muted = typeof options.muted === 'boolean' ? options.muted : false
  const output = new GainNode(audio, { gain: muted ? 0 : volume })

  /** Schedule one tick at an exact audio time. */
  const tick = (time: number, high: boolean) => {
    // A short sine "blip": fast attack, fast decay.
    const oscillator = new OscillatorNode(audio, { type: 'sine', frequency: high ? 1760 : 880 })
    const envelope = new GainNode(audio, { gain: 0 })
    envelope.gain.setValueAtTime(0, time)
    envelope.gain.linearRampToValueAtTime(1, time + 0.002)
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05)

    oscillator.connect(envelope).connect(output)
    oscillator.start(time)
    oscillator.stop(time + 0.06)
    oscillator.onended = () => envelope.disconnect()
  }

  // Removed for us when the module is removed.
  const setSignature = (value: Signature) => {
    signature = value
    ctx.changed()
  }

  // The metronome counts its own bars, so its signature does not change the core clock.
  ctx.on('beat', ({ time, beat }) => tick(time, accent && beat % beatsIn(signature) === 0))

  return {
    output,
    get volume() {
      return volume
    },
    get accent() {
      return accent
    },
    get signature() {
      return signature
    },
    get beatsPerBar() {
      return beatsIn(signature)
    },
    setVolume(value: number) {
      volume = value
      if (!muted) output.gain.setTargetAtTime(value, audio.currentTime, 0.01)
      ctx.changed()
    },
    get muted() {
      return muted
    },
    /** Silence the ticks (true) or bring them back (false). */
    setMuted(value: boolean) {
      muted = value
      output.gain.setTargetAtTime(muted ? 0 : volume, audio.currentTime, 0.01)
      ctx.changed()
    },
    setAccent(value: boolean) {
      accent = value
      ctx.changed()
    },
    setSignature,
    /** Step to the next signature in SIGNATURES (after the last one: the first one). */
    nextSignature() {
      setSignature(SIGNATURES[(SIGNATURES.indexOf(signature) + 1) % SIGNATURES.length]!)
    },
    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): MetronomeOptions => ({ volume, accent, signature, muted }),
  }
})

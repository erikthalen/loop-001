import { defineModuleSetup } from '@loop/core'

export interface MetronomeOptions {
  /** Volume from 0 to 1. Default: 0.5. */
  volume?: number
  /** Play a higher tick on the first beat of each bar. Default: true. */
  accent?: boolean
  /** Silent: no ticks (the picture still swings). Default: false. */
  muted?: boolean
}

/** Audio: plays a short tick on every beat of the core clock. */
export const setup = defineModuleSetup((ctx, options: MetronomeOptions = {}) => {
  const { audio } = ctx
  // Options can come from a saved project file, so check the types.
  let volume = typeof options.volume === 'number' ? Math.min(1, Math.max(0, options.volume)) : 0.5
  let accent = typeof options.accent === 'boolean' ? options.accent : true
  let muted = typeof options.muted === 'boolean' ? options.muted : false
  const output = new GainNode(audio, { gain: muted ? 0 : volume })

  /** Schedule one tick at an exact audio time. */
  const tick = (time: number, high: boolean) => {
    // It follows the tape speed (see core.speed): a slow tape plays the tick lower and longer.
    // The pitch follows the speed signal all the time; the length is set by the speed at the start.
    const speed = Math.max(0.2, ctx.core.speedAt(time))
    const decay = 0.05 / speed
    // A short sine "blip": fast attack, fast decay. Its frequency is the speed signal × the pitch.
    const oscillator = new OscillatorNode(audio, { type: 'sine', frequency: 0 })
    const pitch = new GainNode(audio, { gain: high ? 1760 : 880 })
    ctx.core.speedSignal.connect(pitch).connect(oscillator.frequency)
    const envelope = new GainNode(audio, { gain: 0 })
    envelope.gain.setValueAtTime(0, time)
    envelope.gain.linearRampToValueAtTime(1, time + 0.002 / speed)
    envelope.gain.exponentialRampToValueAtTime(0.001, time + decay)

    oscillator.connect(envelope).connect(output)
    oscillator.start(time)
    oscillator.stop(time + decay + 0.01)
    oscillator.onended = () => {
      try {
        ctx.core.speedSignal.disconnect(pitch)
      } catch {
        // Already gone.
      }
      pitch.disconnect()
      envelope.disconnect()
    }
  }

  // A tick on every beat of the core clock; a higher one on the first beat of each bar (4/4).
  // Removed for us when the module is removed.
  ctx.on('beat', ({ time, beatInBar }) => tick(time, accent && beatInBar === 0))

  return {
    output,
    get volume() {
      return volume
    },
    get accent() {
      return accent
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
    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): MetronomeOptions => ({ volume, accent, muted }),
  }
})

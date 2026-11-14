import { defineModuleSetup } from '@loop/core'

export interface MetronomeOptions {
  /** Volume from 0 to 1. Default: 0.5. */
  volume?: number
  /** Play a higher tick on the first beat of each bar. Default: true. */
  accent?: boolean
}

/** Audio: plays a short tick on every beat of the core clock. */
export const setup = defineModuleSetup((ctx, options: MetronomeOptions = {}) => {
  const { audio } = ctx
  // Options can come from a saved project file, so check the types.
  let volume = typeof options.volume === 'number' ? Math.min(1, Math.max(0, options.volume)) : 0.5
  let accent = typeof options.accent === 'boolean' ? options.accent : true
  const output = new GainNode(audio, { gain: volume })

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
      output.gain.setTargetAtTime(value, audio.currentTime, 0.01)
      ctx.changed()
    },
    setAccent(value: boolean) {
      accent = value
      ctx.changed()
    },
    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): MetronomeOptions => ({ volume, accent }),
  }
})

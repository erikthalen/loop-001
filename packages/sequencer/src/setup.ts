import { defineModuleSetup } from '@loop/core'

/** Steps in one pattern. With the core clock's 4 steps per beat, that is one 4/4 bar of 16th notes. */
export const STEPS = 16

/** Channels, top to bottom. Row 0 sends triggers on channel 1, and so on. */
export const CHANNELS = 6

export interface SequencerOptions {
  /**
   * One string per channel (channel 1 first), one character per step: "x" sends a trigger,
   * "." does not. Example: "x...x...x...x...". Default: all off.
   */
  pattern?: string[]
}

/** Read a saved pattern. Options can come from a saved project file, so check everything. */
function readPattern(saved: unknown): boolean[][] {
  const rows = Array.isArray(saved) ? saved : []
  return Array.from({ length: CHANNELS }, (_, channel) => {
    const row = typeof rows[channel] === 'string' ? (rows[channel] as string) : ''
    return Array.from({ length: STEPS }, (_, step) => row[step] === 'x')
  })
}

/**
 * The sequencer makes no sound. On every step of the core clock, it sends a trigger (like a MIDI
 * note) for each channel that is on. Only the modules after it in the chain get the triggers,
 * for example a sampler. The sound from before it goes past it, unchanged.
 */
export const setup = defineModuleSetup((ctx, options: SequencerOptions = {}) => {
  const pattern = readPattern(options.pattern)

  // Removed for us when the module is removed.
  ctx.on('step', ({ step, time }) => {
    const index = step % STEPS
    pattern.forEach((row, channel) => {
      if (row[index]) ctx.send({ channel, time })
    })
  })

  return {
    /** Which steps are on: `pattern[channel][step]`. Change it with `setStep`. */
    get pattern(): readonly (readonly boolean[])[] {
      return pattern
    },
    /** Turn one step of one channel on or off. */
    setStep(channel: number, step: number, on: boolean) {
      const row = pattern[channel]
      if (!row || step < 0 || step >= STEPS) return
      row[step] = on
      ctx.changed()
    },
    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): SequencerOptions => ({
      pattern: pattern.map((row) => row.map((on) => (on ? 'x' : '.')).join('')),
    }),
  }
})

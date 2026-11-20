import type { ModuleContext } from '@loop/core'

/**
 * The step sequencer, built into the sampler: 6 channels, 16 steps. On every step of the core
 * clock, it calls `onStep` for each channel that is on. It knows nothing about the sampler: the
 * sampler decides what a step does (it plays that channel).
 *
 * Its own folder, so it can become its own package if another module needs a sequencer too.
 */

/** Steps in one pattern. With the core clock's 4 steps per beat, that is one 4/4 bar of 16th notes. */
export const STEPS = 16

/** Channels, top to bottom. Row 0 is channel 1, and so on. */
export const CHANNELS = 6

/**
 * A saved pattern: one string per channel (channel 1 first), one character per step. "x" is on,
 * "." is off. Example: "x...x...x...x...".
 */
export type SavedPattern = string[]

export interface SequencerOptions {
  /** The saved pattern (from `save()`). It can come from a project file, so anything is checked. Default: all off. */
  pattern?: unknown
  /** A step that is on comes: play `channel` at the exact audio `time`. */
  onStep: (channel: number, time: number) => void
}

export interface Sequencer {
  /** Which steps are on: `pattern[channel][step]`. Change it with `setStep`. */
  readonly pattern: readonly (readonly boolean[])[]
  /** Turn one step of one channel on or off. */
  setStep(channel: number, step: number, on: boolean): void
  /** The pattern, to save with the project. */
  save(): SavedPattern
}

/** Read a saved pattern. Options can come from a saved project file, so check everything. */
function readPattern(saved: unknown): boolean[][] {
  const rows = Array.isArray(saved) ? saved : []
  return Array.from({ length: CHANNELS }, (_, channel) => {
    const row =
      typeof rows[channel] === 'string' ? (rows[channel] as string) : ''
    return Array.from({ length: STEPS }, (_, step) => row[step] === 'x')
  })
}

/** Make the sequencer. Call it in the module's setup: it listens to the core clock through `ctx`. */
export function createSequencer(
  ctx: ModuleContext,
  options: SequencerOptions,
): Sequencer {
  const pattern = readPattern(options.pattern)

  // Removed for us when the module is removed.
  ctx.on('step', ({ step, time }) => {
    const index = step % STEPS
    pattern.forEach((row, channel) => {
      if (row[index]) options.onStep(channel, time)
    })
  })

  return {
    pattern,
    setStep(channel, step, on) {
      const row = pattern[channel]
      if (!row || step < 0 || step >= STEPS) return
      row[step] = on
      ctx.changed()
    },
    save: () =>
      pattern.map((row) => row.map((on) => (on ? 'x' : '.')).join('')),
  }
}

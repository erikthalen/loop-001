import type { ModuleContext } from '@loop/core'

/**
 * The step sequencer: 6 channels, 16 steps, 6 patterns (pages). On every step of the core clock,
 * it calls `onStep` for each channel that is on in the picked pattern. It knows nothing about the
 * module it is in (the sampler, the drum machine): the module decides what a step does (it plays
 * that channel).
 *
 * One pattern is picked at a time: the screen shows it, and you change it. It starts to play at
 * the start of the next bar (step 1), like on a TR-808: the beat never breaks. Until then, the
 * pattern before it plays to the end of its bar. When the transport is at the start of a bar
 * (a new project, after a rewind), it plays at once.
 */

/** Steps in one pattern. With the core clock's 4 steps per beat, that is one 4/4 bar of 16th notes. */
export const STEPS = 16

/** Channels, top to bottom. Row 0 is channel 1, and so on. */
export const CHANNELS = 6

/** Patterns (pages). Pattern 0 is "1" on the screen. */
export const PATTERNS = 6

/**
 * A saved pattern: one string per channel (channel 1 first), one character per step. "x" is on,
 * "." is off. Example: "x...x...x...x...".
 */
export type SavedPattern = string[]

/** What the sequencer saves. The module puts it in its own saved data: `...sequencer.save()`. */
export interface SavedSequence {
  /** All patterns, pattern 1 first. */
  patterns: SavedPattern[]
  /** The picked pattern (0 to 5). */
  page: number
}

/** A pattern: `pattern[channel][step]`, true if the step is on. */
export type Pattern = readonly (readonly boolean[])[]

export interface SequencerOptions {
  /**
   * The module's saved data (its `options`): the sequencer reads `patterns` and `page` from it
   * (see SavedSequence). An old project has only `pattern` (one pattern): it becomes pattern 1.
   * It can come from a project file, so anything is checked. Default: all off, pattern 1.
   */
  saved?: unknown
  /** A step that is on comes: play `channel` at the exact audio `time`. */
  onStep: (channel: number, time: number) => void
}

export interface Sequencer {
  /** The picked pattern's steps: `pattern[channel][step]`. Change them with `setStep`. */
  readonly pattern: Pattern
  /** The picked pattern, 0 to 5: the screen shows it. */
  readonly page: number
  /** The pattern that plays now, 0 to 5. Not the picked one until the next bar starts. */
  readonly playingPage: number
  /** Pick another pattern: the screen shows it at once, and it plays from the next bar on. */
  setPage(page: number): void
  /** Put these steps into the picked pattern (paste). */
  setPattern(pattern: Pattern): void
  /** True if a pattern has at least one step on. */
  hasSteps(page: number): boolean
  /** Turn one step of one channel on or off, in the picked pattern. */
  setStep(channel: number, step: number, on: boolean): void
  /** The patterns, to save with the project. */
  save(): SavedSequence
}

/** Read one saved pattern. Anything that is not a pattern: all off. */
function readPattern(saved: unknown): boolean[][] {
  const rows = Array.isArray(saved) ? saved : []
  return Array.from({ length: CHANNELS }, (_, channel) => {
    const row =
      typeof rows[channel] === 'string' ? (rows[channel] as string) : ''
    return Array.from({ length: STEPS }, (_, step) => row[step] === 'x')
  })
}

/** Read the saved patterns and the picked one. Saved data can come from a file, so check everything. */
function readSaved(saved: unknown): { patterns: boolean[][][]; page: number } {
  const data = (typeof saved === 'object' && saved) || {}
  const { patterns, pattern, page } = data as Record<string, unknown>
  // An old project: one pattern, before there were pages.
  const list = Array.isArray(patterns) ? patterns : [pattern]
  return {
    patterns: Array.from({ length: PATTERNS }, (_, i) => readPattern(list[i])),
    page:
      typeof page === 'number' && Number.isInteger(page)
        ? Math.min(PATTERNS - 1, Math.max(0, page))
        : 0,
  }
}

/** Make the sequencer. Call it in the module's setup: it listens to the core clock through `ctx`. */
export function createSequencer(
  ctx: ModuleContext,
  options: SequencerOptions,
): Sequencer {
  const saved = readSaved(options.saved)
  const { patterns } = saved
  let { page } = saved
  let playing = page

  // Removed for us when the module is removed.
  ctx.on('step', ({ step, time }) => {
    const index = step % STEPS
    // A new bar: the picked pattern plays from here on.
    if (index === 0) playing = page
    patterns[playing]!.forEach((row, channel) => {
      if (row[index]) options.onStep(channel, time)
    })
  })

  return {
    get pattern() {
      return patterns[page]!
    },
    get page() {
      return page
    },
    get playingPage() {
      return playing
    },
    setPage(next) {
      if (next === page || !patterns[next]) return
      page = next
      // The next step is the start of a bar: no need to wait. (If its step event has already
      // come, the clock's step is past it, so this waits for the next bar.)
      if (ctx.core.clock.step % STEPS === 0) playing = page
      ctx.changed()
    },
    setPattern(pattern) {
      patterns[page]!.forEach((row, channel) => {
        for (let step = 0; step < STEPS; step++)
          row[step] = !!pattern[channel]?.[step]
      })
      ctx.changed()
    },
    hasSteps: (index) => !!patterns[index]?.some((row) => row.some((on) => on)),
    setStep(channel, step, on) {
      const row = patterns[page]![channel]
      if (!row || step < 0 || step >= STEPS) return
      row[step] = on
      ctx.changed()
    },
    save: () => ({
      patterns: patterns.map((pattern) =>
        pattern.map((row) => row.map((on) => (on ? 'x' : '.')).join('')),
      ),
      page,
    }),
  }
}

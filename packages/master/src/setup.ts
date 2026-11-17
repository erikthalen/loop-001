import { defineModuleSetup } from '@loop/core'

export interface MasterOptions {
  /** The master volume, 0 to 1. Default: 1. */
  volume?: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Master: start, stop and rewind the core, and set the master volume (the core's output, just before the
 * speakers). It makes no sound itself, so the sound from before it goes past it, unchanged.
 */
export const setup = defineModuleSetup((ctx, options: MasterOptions = {}) => {
  const { core } = ctx
  // Options can come from a saved project file, so check the type.
  let volume = typeof options.volume === 'number' && Number.isFinite(options.volume) ? clamp(options.volume) : 1

  /** Set the core's output volume (smoothly, so it does not click). */
  const apply = (value: number) => core.output.gain.setTargetAtTime(value, core.context.currentTime, 0.01)
  apply(volume)
  // Removed: the master volume goes back to full.
  ctx.onDispose(() => apply(1))

  return {
    get volume() {
      return volume
    },
    setVolume(value: number) {
      volume = clamp(value)
      apply(volume)
      ctx.changed()
    },
    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): MasterOptions => ({ volume }),
  }
})

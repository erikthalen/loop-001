import { defineModuleSetup } from '@loop/core'
import { createTape, type Tape } from './tape'

export interface MasterOptions {
  /** The master volume, 0 to 1. Default: 1. */
  volume?: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Master: start, stop and rewind the transport, record the sound to play it backwards while it
 * rewinds (the tape, see tape.ts), and set the master volume. It is the end of the sound: plug the
 * whole sound into its In. It plays straight into the speakers (`speakerOutput`, no jack).
 * Only one Master at a time (`unique` in index.ts).
 *
 *   input ─▶ tape ─▶ volume (output) ─▶ speakers (core.output)
 */
export const setup = defineModuleSetup((ctx, options: MasterOptions = {}) => {
  const { core, audio } = ctx
  // Options can come from a saved project file, so check the type.
  let volume = typeof options.volume === 'number' && Number.isFinite(options.volume) ? clamp(options.volume) : 1

  const input = new GainNode(audio)
  const output = new GainNode(audio, { gain: volume })
  // The tape loads in the background; until then the sound goes straight through.
  input.connect(output)

  let tape: Tape | null = null
  createTape(audio, core.speedSignal)
    .then((loaded) => {
      if (ctx.signal.aborted) return loaded.dispose()
      tape = loaded
      input.disconnect(output)
      input.connect(tape.node).connect(output)
      // The tape and the transport agree on where the tape is: now, and each time it stands still.
      const align = () => loaded.setPosition(core.clock.positionAt(audio.currentTime))
      align()
      ctx.on('rewindend', align)
      // (Not when a rewind turned the transport around: it still moves then.)
      ctx.on('stop', () => core.rewinding || align())
    })
    .catch((error) => console.error('The tape (rewind sound) could not load:', error))

  ctx.onDispose(() => {
    tape?.dispose()
    input.disconnect()
    output.disconnect()
  })

  return {
    input,
    speakerOutput: output,
    get volume() {
      return volume
    },
    setVolume(value: number) {
      volume = clamp(value)
      // Smoothly, so it does not click.
      output.gain.setTargetAtTime(volume, audio.currentTime, 0.01)
      ctx.changed()
    },
    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): MasterOptions => ({ volume }),
  }
})

import { defineModuleSetup } from '@loop/core'
import {
  createSequencer,
  type SavedPattern,
  type SavedSequence,
} from '@loop/sequencer'
import { CLOSED_HAT, createNoise, OPEN_HAT, VOICES } from './voices'

/** The number of drums (channels). */
export const CHANNELS = VOICES.length

export interface DrumsOptions {
  /** The drum that is shown (0 to 5). Default: 0 (bass drum). */
  active?: number
  /** Each drum's 4 settings, 0 to 1 (see voices.ts). Default: each drum's own defaults. */
  voices?: number[][]
  /** The sequencer's patterns (see @loop/sequencer). Default: all off. */
  patterns?: SavedSequence['patterns']
  /** The sequencer's picked pattern (0 to 5). Default: 0. */
  page?: number
  /** An old project: one pattern, before there were 6. It becomes pattern 1. */
  pattern?: SavedPattern
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * Audio: 6 synthesized drums (voices.ts), each on its own channel output. Its sequencer plays
 * them in a pattern of 16 steps. A hit from the sequencer follows the transport speed, like the
 * sampler: when the tape slows down, the drums get lower and longer.
 */
export const setup = defineModuleSetup((ctx, options: DrumsOptions = {}) => {
  const { audio } = ctx
  // One output per drum, each on its own jack (the group "1–6" in the patchbay), so a drum can go
  // into a mixer, or anywhere.
  const channelOutputs = Array.from(
    { length: CHANNELS },
    () => new GainNode(audio, { gain: 1 }),
  )
  const noise = createNoise(audio)

  // A closed hi-hat stops an open one that still rings (like on a real drum machine). The open
  // hi-hat goes through this gain: it falls to 0 on a closed hit, and is back at 1 on the next open hit.
  const choke = new GainNode(audio, { gain: 1 })
  choke.connect(channelOutputs[OPEN_HAT]!)

  // Options can come from a saved project file, so check everything.
  let active = isNumber(options.active)
    ? clamp(Math.round(options.active), 0, CHANNELS - 1)
    : 0
  const savedVoices = Array.isArray(options.voices) ? options.voices : []
  const params = VOICES.map((voice, channel) => {
    const saved = savedVoices[channel]
    return voice.params.map((param, i) => {
      const value = Array.isArray(saved) ? saved[i] : undefined
      return isNumber(value) ? clamp(value, 0, 1) : param.default
    })
  })

  const wake = () => {
    if (audio instanceof AudioContext && audio.state === 'suspended')
      void audio.resume()
  }

  /** Play one drum at an exact audio time. `transport`: from the sequencer (follows its speed). */
  const trigger = (channel: number, time: number, transport = false) => {
    const voice = VOICES[channel]
    if (!voice) return
    // The speed can be 0 or below (stopped, rewinding): steps do not come then, but stay safe.
    const rate = transport ? clamp(ctx.core.speedAt(time), 0.25, 2) : 1
    let output: AudioNode = channelOutputs[channel]!
    if (channel === CLOSED_HAT) choke.gain.setTargetAtTime(0, time, 0.004)
    if (channel === OPEN_HAT) {
      choke.gain.setValueAtTime(1, time)
      output = choke
    }
    voice.play({ audio, time, rate, params: params[channel]!, noise, output })
  }

  // The sequencer: each step that is on plays its drum at that time.
  const sequencer = createSequencer(ctx, {
    saved: options,
    onStep: (channel, time) => trigger(channel, time, true),
  })

  return {
    channelOutputs,
    get active() {
      return active
    },
    /** Show another drum. */
    setActive(channel: number) {
      if (channel === active || !VOICES[channel]) return
      active = channel
      ctx.changed()
    },
    /** A drum's 4 settings, 0 to 1. */
    paramsOf: (channel: number): readonly number[] => params[channel] ?? [],
    /** Change one setting of a drum (0 to 1). The next hit uses it. */
    setParam(channel: number, index: number, value: number) {
      const row = params[channel]
      if (!row || index < 0 || index >= row.length || !isNumber(value)) return
      row[index] = clamp(value, 0, 1)
      ctx.changed()
    },
    /** Play the active drum now (the hit button). */
    hit() {
      wake()
      trigger(active, audio.currentTime + 0.005)
    },
    /** Play any drum at an exact audio time. */
    trigger: (channel: number, time: number) => trigger(channel, time),
    /** The picked pattern's steps: `pattern[channel][step]`. Change them with `setStep`. */
    get pattern() {
      return sequencer.pattern
    },
    /** The picked pattern (0 to 5). Pick another one with `setPage`. */
    get page() {
      return sequencer.page
    },
    /** The pattern that plays now (0 to 5): the picked one plays from the next bar on. */
    get playingPage() {
      return sequencer.playingPage
    },
    setPage: sequencer.setPage,
    setPattern: sequencer.setPattern,
    hasSteps: sequencer.hasSteps,
    setStep: sequencer.setStep,
    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): DrumsOptions => ({
      active,
      voices: params.map((row) => [...row]),
      ...sequencer.save(),
    }),
  }
})

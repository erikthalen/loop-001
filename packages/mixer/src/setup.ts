import { defineModuleSetup } from '@loop/core'

/** The number of channels (the same as the sequencer and the sampler). */
export const CHANNELS = 6
/** The number of send buses (A and B). */
export const BUSES = 2
/** The name of each send bus. */
export const BUS_NAMES = ['A', 'B'] as const

export interface MixerOptions {
  /** One volume per channel (channel 1 first), 0 to 1. Default: all 1. */
  volumes?: number[]
  /** Per channel: does the channel go to the mixer's output? Off: only to its sends. Default: all on. */
  mains?: boolean[]
  /** Per send bus, per channel: is the channel sent to that bus? Default: all off. */
  sends?: boolean[][]
  /** Per send bus: how much of the sent channels goes to it, 0 to 1. Default: all 1. */
  sendLevels?: number[]
  /** Per send bus: how much of its effect comes back into the mix, 0 to 1. Default: all 1. */
  returnLevels?: number[]
}

/** The saved options of the first mixer version (one send bus). They become send bus A. */
interface OldMixerOptions {
  sends?: unknown[]
  send?: number
  return?: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const numberOr = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value) : fallback
const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const booleanOr = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)

/**
 * Mixer: it takes in 6 channels (one channels cable, for example from a sampler) and mixes them:
 *
 *   channel 1 ─▶ volume 1 ─┬▶ main on/off ─────────────────────────────────────────▶ mix ─▶ output
 *   ...                    ├▶ send A on/off ─▶ send bus A ─▶ (an effect on send A) ─▶ return A ─┤
 *                          └▶ send B on/off ─▶ send bus B ─▶ (an effect on send B) ─▶ return B ─┘
 *
 * - Each channel has a volume, a main switch, and a send switch per bus. The sends are after the
 *   volume (post-fader), so a quieter channel also sends less.
 * - Main off: the channel only goes to its sends. Then only the effect (wet) is heard, not the
 *   channel itself (dry).
 * - The send buses (sendOutputs: jacks Snd A, Snd B) and the returns (returnInputs: Rtn A, Rtn B):
 *   plug a send into an effect (for example a delay), and the effect's output into the return.
 *   Without one, the return is silent.
 */
export const setup = defineModuleSetup((ctx, options: MixerOptions = {}) => {
  const { audio } = ctx
  // Options can come from a saved project file, so check everything.
  const old = options as OldMixerOptions
  const savedVolumes = listOf(options.volumes)
  // The first version saved one list of booleans (one bus). Now it is one list per bus.
  const savedSends = listOf(options.sends).every((item) => typeof item === 'boolean')
    ? [listOf(old.sends)]
    : listOf(options.sends).map(listOf)
  const savedSendLevels = Array.isArray(options.sendLevels) ? options.sendLevels : [old.send]
  const savedReturnLevels = Array.isArray(options.returnLevels) ? options.returnLevels : [old.return]

  const volumes = Array.from({ length: CHANNELS }, (_, i) => numberOr(savedVolumes[i], 1))
  const savedMains = listOf(options.mains)
  const mains = Array.from({ length: CHANNELS }, (_, i) => booleanOr(savedMains[i], true))
  const sends = Array.from({ length: BUSES }, (_, bus) =>
    Array.from({ length: CHANNELS }, (_, i) => savedSends[bus]?.[i] === true),
  )
  const sendLevels = Array.from({ length: BUSES }, (_, bus) => numberOr(savedSendLevels[bus], 1))
  const returnLevels = Array.from({ length: BUSES }, (_, bus) => numberOr(savedReturnLevels[bus], 1))

  const mix = new GainNode(audio, { gain: 1 })
  // Per bus: the send bus (its level), and the return (its level) into the mix.
  const sendBuses = sendLevels.map((level) => new GainNode(audio, { gain: level }))
  const returnInputs = returnLevels.map((level) => new GainNode(audio, { gain: level }))
  for (const input of returnInputs) input.connect(mix)
  // Per channel: its volume (the input), then a main switch to the mix, and a send switch to each send bus.
  const channelInputs = volumes.map((volume) => new GainNode(audio, { gain: volume }))
  const mainSwitches = mains.map((on) => new GainNode(audio, { gain: on ? 1 : 0 }))
  const sendSwitches = sends.map((bus) => bus.map((on) => new GainNode(audio, { gain: on ? 1 : 0 })))
  channelInputs.forEach((input, i) => {
    input.connect(mainSwitches[i]!).connect(mix)
    sendSwitches.forEach((switches, bus) => input.connect(switches[i]!).connect(sendBuses[bus]!))
  })

  /** Change a gain smoothly, so it does not click. */
  const glide = (param: AudioParam, value: number) => param.setTargetAtTime(value, audio.currentTime, 0.01)
  const isChannel = (channel: number) => channel >= 0 && channel < CHANNELS
  const isBus = (bus: number) => bus >= 0 && bus < BUSES

  return {
    output: mix,
    channelInputs,
    /** The send buses (A, B): an effect on a send bus after the mixer takes one in. */
    sendOutputs: sendBuses as readonly AudioNode[],
    /** The returns (A, B): the effect on that send bus plays into it. */
    returnInputs: returnInputs as readonly AudioNode[],
    /**
     * Inside the mixer, the channels reach the output and the sends; a return only reaches the
     * output. So send A ─▶ delay ─▶ return A is not a loop (see routes in @loop/core).
     */
    routes: [
      ['channels-in', 'out'],
      ...BUS_NAMES.map((bus) => [`return-${bus.toLowerCase()}`, 'out'] as const),
      ...BUS_NAMES.map((bus) => ['channels-in', `send-${bus.toLowerCase()}`] as const),
    ],

    /** The volume of each channel, 0 to 1. */
    get volumes(): readonly number[] {
      return volumes
    },
    setVolume(channel: number, value: number) {
      if (!isChannel(channel)) return
      volumes[channel] = clamp(value)
      glide(channelInputs[channel]!.gain, volumes[channel]!)
      ctx.changed()
    },
    /** Per channel: does the channel go to the mixer's output? */
    get mains(): readonly boolean[] {
      return mains
    },
    setMain(channel: number, on: boolean) {
      if (!isChannel(channel)) return
      mains[channel] = on
      glide(mainSwitches[channel]!.gain, on ? 1 : 0)
      ctx.changed()
    },
    /** Per bus, per channel: is the channel sent to that bus? */
    get sends(): readonly (readonly boolean[])[] {
      return sends
    },
    setSend(bus: number, channel: number, on: boolean) {
      if (!isBus(bus) || !isChannel(channel)) return
      sends[bus]![channel] = on
      glide(sendSwitches[bus]![channel]!.gain, on ? 1 : 0)
      ctx.changed()
    },
    /** Per bus: how much goes to it, 0 to 1. */
    get sendLevels(): readonly number[] {
      return sendLevels
    },
    setSendLevel(bus: number, value: number) {
      if (!isBus(bus)) return
      sendLevels[bus] = clamp(value)
      glide(sendBuses[bus]!.gain, sendLevels[bus]!)
      ctx.changed()
    },
    /** Per bus: how much of its effect comes back, 0 to 1. */
    get returnLevels(): readonly number[] {
      return returnLevels
    },
    setReturnLevel(bus: number, value: number) {
      if (!isBus(bus)) return
      returnLevels[bus] = clamp(value)
      glide(returnInputs[bus]!.gain, returnLevels[bus]!)
      ctx.changed()
    },
    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): MixerOptions => ({
      volumes: [...volumes],
      mains: [...mains],
      sends: sends.map((bus) => [...bus]),
      sendLevels: [...sendLevels],
      returnLevels: [...returnLevels],
    }),
  }
})

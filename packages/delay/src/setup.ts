import { defineModuleSetup } from '@loop/core'
import { createDelayLine } from './processor'

/**
 * The rates: how long until each echo, as a note length, so the echoes fall on the beat.
 * In order, shortest first. `beats`: the length in beats (a quarter note is 1 beat).
 * t: triplet (3 in the time of 2), d: dotted (one and a half).
 */
export const RATES = [
  { name: '1/32', beats: 1 / 8 },
  { name: '1/16t', beats: 1 / 6 },
  { name: '1/16', beats: 1 / 4 },
  { name: '1/8t', beats: 1 / 3 },
  { name: '1/16d', beats: 3 / 8 },
  { name: '1/8', beats: 1 / 2 },
  { name: '1/4t', beats: 2 / 3 },
  { name: '1/8d', beats: 3 / 4 },
  { name: '1/4', beats: 1 },
  { name: '1/2t', beats: 4 / 3 },
  { name: '1/4d', beats: 3 / 2 },
  { name: '1/2', beats: 2 },
] as const

export type RateName = (typeof RATES)[number]['name']

/** Where the delay is: in the main chain (`null`), or on send bus 0 (A) or 1 (B) of a mixer before it. */
export type Bus = 0 | 1 | null

export interface DelayOptions {
  /** Dry/wet, 0 to 1: 0 only the sound that comes in, 1 only the echoes. Default: 1. */
  mix?: number
  /** How much of each echo comes back as the next echo, 0 to MAX_FEEDBACK. Default: 0.4. */
  feedback?: number
  /** The time until each echo, as a note length (see RATES). Default: '1/8d'. */
  rate?: RateName
  /** In the main chain (null), or on send bus 0 (A) or 1 (B). Default: 0 (send A). */
  bus?: Bus
}

/** More than this, and the echoes would get louder and louder. */
export const MAX_FEEDBACK = 0.95
/** The longest delay: 1/2 note at 10 bpm (12 s), and a little more. (Slower: it stops there.) */
const MAX_SECONDS = 13
/** How fast a new setting takes over, in seconds (a new rate glides there, like a tape delay). */
const SMOOTHING = 0.03

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const numberOr = (value: unknown, fallback: number, max = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, max) : fallback

/** The note length's place in RATES. */
export const rateIndex = (name: RateName) => RATES.findIndex((rate) => rate.name === name)

/** Dry and wet levels for a mix (equal power: the sound is as loud in the middle as at the ends). */
export const levelsOf = (mix: number) => ({ dry: Math.cos((mix * Math.PI) / 2), wet: Math.sin((mix * Math.PI) / 2) })

/**
 * Delay: echoes of the sound, on the beat.
 *
 *   input ─┬─▶ dry ──────────────────────────────┬─▶ output
 *          └─▶ delay line (with feedback) ─▶ wet ┘
 *
 * The delay line is an AudioWorklet (processor.ts), so every echo is exactly on time. It loads in
 * the background; until then only the dry sound comes through.
 *
 * It can be in the main chain, or on a send bus of a mixer before it (see `sendEffect` in
 * @loop/core): then the mixer's send goes into `input`, and `output` plays into its return.
 * The delay time follows the tempo: a rate of 1/8 is half a beat, at any bpm.
 */
export const setup = defineModuleSetup((ctx, options: DelayOptions = {}) => {
  const { core, audio } = ctx
  // Options can come from a saved project file, so check everything.
  let mix = numberOr(options.mix, 1)
  let feedback = numberOr(options.feedback, 0.4, MAX_FEEDBACK)
  let rate: RateName = RATES.some((r) => r.name === options.rate) ? options.rate! : '1/8d'
  let bus: Bus = options.bus === null || options.bus === 0 || options.bus === 1 ? options.bus : 0

  /** Seconds until each echo, at the tempo now. */
  const seconds = () => Math.min(MAX_SECONDS, (RATES[rateIndex(rate)]!.beats * 60) / core.bpm)

  const input = new GainNode(audio)
  const output = new GainNode(audio)
  const { dry: dryLevel, wet: wetLevel } = levelsOf(mix)
  const dry = new GainNode(audio, { gain: dryLevel })
  const wet = new GainNode(audio, { gain: wetLevel })
  input.connect(dry).connect(output)
  wet.connect(output)

  const glide = (param: AudioParam | undefined, value: number) =>
    param?.setTargetAtTime(value, audio.currentTime, SMOOTHING)
  /** The delay line's parameters, once it has loaded. */
  let line: { node: AudioWorkletNode; time: AudioParam; feedback: AudioParam } | null = null
  createDelayLine(audio, MAX_SECONDS)
    .then((node) => {
      if (ctx.signal.aborted) return node.port.close()
      line = { node, time: node.parameters.get('delayTime')!, feedback: node.parameters.get('feedback')! }
      line.time.value = seconds()
      line.feedback.value = feedback
      input.connect(node).connect(wet)
    })
    .catch((error) => console.error('The delay could not load:', error))

  const retime = () => glide(line?.time, seconds())
  // A new tempo: the echoes stay on the beat.
  ctx.on('bpmchange', retime)

  ctx.onDispose(() => {
    for (const node of [input, dry, wet, output]) node.disconnect()
    line?.node.disconnect()
    line?.node.port.close()
  })

  return {
    input,
    output,
    /** On a send bus: the core puts it between the mixer's send and return (see @loop/core). */
    get sendEffect() {
      return bus === null ? undefined : { bus, input, output }
    },
    get mix() {
      return mix
    },
    get feedback() {
      return feedback
    },
    get rate(): RateName {
      return rate
    },
    get bus(): Bus {
      return bus
    },
    /** Seconds until each echo, at the tempo now. */
    get seconds() {
      return seconds()
    },
    setMix(value: number) {
      mix = clamp(value, 0, 1)
      const levels = levelsOf(mix)
      glide(dry.gain, levels.dry)
      glide(wet.gain, levels.wet)
      ctx.changed()
    },
    setFeedback(value: number) {
      feedback = clamp(value, 0, MAX_FEEDBACK)
      glide(line?.feedback, feedback)
      ctx.changed()
    },
    setRate(name: RateName) {
      if (rateIndex(name) < 0) return
      rate = name
      retime()
      ctx.changed()
    },
    /** Move it into the main chain (null) or onto send bus 0 (A) or 1 (B). */
    setBus(value: Bus) {
      if (value === bus) return
      bus = value
      ctx.replug()
      ctx.changed()
    },
    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): DelayOptions => ({ mix, feedback, rate, bus }),
  }
})

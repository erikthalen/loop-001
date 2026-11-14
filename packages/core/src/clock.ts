/**
 * The clock uses the "lookahead scheduler" pattern
 * (see "A Tale of Two Clocks": https://web.dev/articles/audio-scheduling).
 *
 * JavaScript timers are not exact. They can be late by many milliseconds.
 * The audio clock (`AudioContext.currentTime`) is exact.
 * So a JS timer wakes up often (every `interval` ms) and announces all steps that
 * fall in the next `lookahead` seconds. Each event carries the exact audio `time`.
 * Modules schedule sound at that time, for example `oscillator.start(time)`.
 *
 * Result: events arrive a little EARLY, but the sound plays exactly on time.
 */

/** Anything with an audio clock. AudioContext and OfflineAudioContext both fit. */
export interface TimeSource {
  readonly currentTime: number
}

export interface StepEvent {
  /** Step number since start: 0, 1, 2, ... */
  step: number
  /** Step position in the bar: 0 to (stepsPerBeat * beatsPerBar - 1). */
  stepInBar: number
  /** Audio time (seconds, AudioContext clock) when this step plays. */
  time: number
  /** Length of one step in seconds at the current bpm. */
  duration: number
}

export interface BeatEvent {
  /** Beat number since start: 0, 1, 2, ... */
  beat: number
  /** Beat position in the bar: 0 to (beatsPerBar - 1). 0 is the first beat of a bar. */
  beatInBar: number
  /** Bar number since start: 0, 1, 2, ... */
  bar: number
  /** Audio time (seconds, AudioContext clock) when this beat plays. */
  time: number
}

export interface ClockEventMap {
  start: { time: number }
  stop: { time: number }
  step: StepEvent
  beat: BeatEvent
}

export interface ClockOptions {
  /** Beats per minute. Default: 120. */
  bpm?: number
  /** Steps per beat. 4 gives 16th notes. Default: 4. */
  stepsPerBeat?: number
  /** Beats per bar. Default: 4. */
  beatsPerBar?: number
  /** How far ahead (seconds) the clock announces steps. Default: 0.1. */
  lookahead?: number
  /** How often (milliseconds) the JS timer wakes up. Default: 25. */
  interval?: number
}

export type ClockEmit = <K extends keyof ClockEventMap>(type: K, detail: ClockEventMap[K]) => void

export interface Clock {
  readonly bpm: number
  readonly running: boolean
  /** Length of one step in seconds. */
  readonly stepDuration: number
  readonly stepsPerBeat: number
  readonly beatsPerBar: number
  readonly lookahead: number
  /** Change the tempo. Steps that are already announced keep their time. */
  setBpm(bpm: number): void
  /**
   * Start from step 0.
   * @param time Audio time of the first step. Default: a little after now,
   * so the first step is not already late when it is scheduled.
   */
  start(time?: number): void
  stop(): void
  /** Announce every step inside the lookahead window. The timer calls this. */
  tick(): void
}

export function createClock(source: TimeSource, emit: ClockEmit, options: ClockOptions = {}): Clock {
  const stepsPerBeat = options.stepsPerBeat ?? 4
  const beatsPerBar = options.beatsPerBar ?? 4
  const lookahead = options.lookahead ?? 0.1
  const interval = options.interval ?? 25

  let bpm = validBpm(options.bpm ?? 120)
  let running = false
  let step = 0
  let nextStepTime = 0
  let timer: ReturnType<typeof setInterval> | undefined

  const stepDuration = () => 60 / bpm / stepsPerBeat

  const advance = () => {
    step++
    nextStepTime += stepDuration()
  }

  const tick = () => {
    if (!running) return
    const now = source.currentTime

    // A step that is a little late still plays (Web Audio plays it at once).
    // But if the timer was very late (for example, the computer was asleep),
    // skip the missed steps. Playing them all at once would sound bad.
    while (nextStepTime < now - lookahead) advance()

    const until = now + lookahead
    const stepsPerBar = stepsPerBeat * beatsPerBar
    while (running && nextStepTime < until) {
      const time = nextStepTime
      emit('step', { step, stepInBar: step % stepsPerBar, time, duration: stepDuration() })

      if (step % stepsPerBeat === 0) {
        const beat = step / stepsPerBeat
        emit('beat', { beat, beatInBar: beat % beatsPerBar, bar: Math.floor(beat / beatsPerBar), time })
      }

      advance()
    }
  }

  return {
    get bpm() {
      return bpm
    },
    get running() {
      return running
    },
    get stepDuration() {
      return stepDuration()
    },
    stepsPerBeat,
    beatsPerBar,
    lookahead,
    setBpm(value) {
      bpm = validBpm(value)
    },
    start(time = source.currentTime + 0.05) {
      if (running) return
      running = true
      step = 0
      nextStepTime = time
      emit('start', { time })
      tick()
      timer = setInterval(tick, interval)
    },
    stop() {
      if (!running) return
      running = false
      clearInterval(timer)
      timer = undefined
      emit('stop', { time: source.currentTime })
    },
    tick,
  }
}

function validBpm(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError(`bpm must be a positive number, got ${bpm}`)
  return bpm
}

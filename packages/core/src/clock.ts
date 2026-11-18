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
 *
 * Transport: the clock works like the transport of a tape machine. It has a position (seconds at
 * full speed) and a speed (1 is full speed, 0 is stopped, below 0 is backwards). Each step has its
 * place on the timeline; a step plays when the transport gets to it. So the steps follow the speed:
 * at half speed they come half as often.
 * - Start: the transport speeds up from 0 to 1 (`spinUp` seconds).
 * - Stop: it slows down to 0 (`spinDown` seconds). It keeps its place.
 * - Rewind: it goes backwards (at the tempo `rewindBpm`) to the first step of the bar it is in
 *   (the start of the sequence), with short ramps (`rewindRamp`). No steps play; `rewindstep`
 *   events tell where it is.
 * Sound sources can follow the speed too (pitch): see `speedAt` and the `speedchange` event.
 */

/** Anything with an audio clock. AudioContext and OfflineAudioContext both fit. */
export interface TimeSource {
  readonly currentTime: number
}

export interface StepEvent {
  /** Step number since the start of the transport: 0, 1, 2, ... */
  step: number
  /** Step position in the bar: 0 to (stepsPerBeat * beatsPerBar - 1). */
  stepInBar: number
  /** Audio time (seconds, AudioContext clock) when this step plays. */
  time: number
  /** Seconds (audio time) until the next step: longer while the transport is slow. */
  duration: number
}

/** The transport speed at an audio time. */
export interface SpeedPoint {
  time: number
  speed: number
}

/**
 * How the transport speed changes: it goes in straight lines from point to point. Before the first
 * point the speed is the first point's speed; after the last point, the last point's speed.
 * Two points at the same time: the speed jumps there.
 */
export type SpeedPlan = readonly SpeedPoint[]

export interface BeatEvent {
  /** Beat number since the start of the transport: 0, 1, 2, ... */
  beat: number
  /** Beat position in the bar: 0 to (beatsPerBar - 1). 0 is the first beat of a bar. */
  beatInBar: number
  /** Bar number since the start of the transport: 0, 1, 2, ... */
  bar: number
  /** Audio time (seconds, AudioContext clock) when this beat plays. */
  time: number
}

export interface ClockEventMap {
  /**
   * The transport starts to play. It then speeds up: see `speedchange`.
   * `step`: the next step it plays, where it stopped last time (0 the first time).
   */
  start: { time: number; step: number }
  /** The transport has stopped playing (after it slowed down, or when a rewind turned it around). */
  stop: { time: number }
  /** The transport speed starts to change (start, stop, rewind). `plan`: how, from now on. */
  speedchange: { plan: SpeedPlan }
  step: StepEvent
  beat: BeatEvent
  /** A rewind starts: the transport goes back to `step` (the first step of a bar). */
  rewind: { time: number; step: number }
  /**
   * While it rewinds: the transport goes back past a step. `step` is the next step it plays from
   * there (the same as `clock.step`). It is 0 when the transport is back at the start.
   */
  rewindstep: { step: number; time: number }
  /** The rewind is over: the transport is still (at the start, or where the rewind was stopped). */
  rewindend: { time: number }
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
  /** Seconds the transport takes to speed up from 0 to 1 on start. 0: at once. Default: 0. */
  spinUp?: number
  /** Seconds the transport takes to slow down from 1 to 0 on stop. 0: at once. Default: 0. */
  spinDown?: number
  /**
   * How fast the transport goes backwards when it rewinds, as a tempo: the steps go by backwards at
   * this bpm. Default: 130.
   */
  rewindBpm?: number
  /** Seconds the transport takes to get from 0 to the full rewind speed (and back to 0). Default: 0.2. */
  rewindRamp?: number
}

export type ClockEmit = <K extends keyof ClockEventMap>(type: K, detail: ClockEventMap[K]) => void

export interface Clock {
  readonly bpm: number
  /** True while the transport plays: from start until it has stopped (also while it slows down). */
  readonly running: boolean
  /** True while it slows down to stop. */
  readonly stopping: boolean
  /** True while it rewinds to the start (not when the rewind was stopped and it slows down). */
  readonly rewinding: boolean
  /** The transport speed now: 1 is full speed, 0 is stopped, below 0 is backwards. */
  readonly speed: number
  /** How the speed changes from now on. */
  readonly plan: SpeedPlan
  readonly spinUp: number
  readonly spinDown: number
  /** Length of one step in seconds, at full speed. */
  readonly stepDuration: number
  readonly stepsPerBeat: number
  readonly beatsPerBar: number
  readonly lookahead: number
  /** The next step it plays: 0, 1, 2, ... It keeps its value when the clock stops. */
  readonly step: number
  /** The transport speed at an audio time (as far as it is known now). */
  speedAt(time: number): number
  /**
   * How far the transport moves between two audio times, in seconds at full speed (negative:
   * backwards). Example: a sound started at `from` with the transport speed has played
   * `travel(from, now)` seconds of itself.
   */
  travel(from: number, to: number): number
  /** Where the transport is at an audio time, in seconds at full speed from its start. */
  positionAt(time: number): number
  /**
   * Where the transport is at an audio time, in steps (not rounded): 16 is exactly at step 16, 16.5
   * halfway to the next step. It follows the steps, also after a tempo change.
   */
  stepsAt(time: number): number
  /** Change the tempo. Steps that are already announced keep their time. */
  setBpm(bpm: number): void
  /**
   * Start, and speed the transport up. It goes on from where it is (like a tape machine, it keeps
   * its place); the first time, from step 0. While it slows down to stop: speed up again from there. While
   * it rewinds: stop the rewind fast, then play from there.
   * @param time Audio time when it starts. Default: a little after now,
   * so the first step is not already late when it is scheduled.
   */
  start(time?: number): void
  /** Slow the transport down, then stop (the `stop` event comes when it has stopped). While it rewinds: stop the rewind. */
  stop(): void
  /**
   * Rewind to the first step of the bar the transport is in (the start of the sequence): backwards,
   * like a tape machine. While it plays, it turns around. At the first step already: nothing happens.
   */
  rewind(): void
  /** Stop at once: no slow-down and no events. For clean-up. */
  halt(): void
  /** Announce every step inside the lookahead window. The timer calls this. */
  tick(): void
}

type Mode = 'stopped' | 'playing' | 'stopping' | 'rewinding' | 'braking'

export function createClock(source: TimeSource, emit: ClockEmit, options: ClockOptions = {}): Clock {
  const stepsPerBeat = options.stepsPerBeat ?? 4
  const beatsPerBar = options.beatsPerBar ?? 4
  const lookahead = options.lookahead ?? 0.1
  const interval = options.interval ?? 25
  const spinUp = Math.max(0, options.spinUp ?? 0)
  const spinDown = Math.max(0, options.spinDown ?? 0)
  const rewindBpm = Math.max(1, options.rewindBpm ?? 130)
  const rewindRamp = Math.max(0.001, options.rewindRamp ?? 0.2)
  /** The rewind speed (times full speed): the steps go by at rewindBpm. */
  const rewindSpeed = () => rewindBpm / bpm
  /** How fast the rewind speed changes (speed per second). */
  const rewindAccel = () => rewindSpeed() / rewindRamp

  let bpm = validBpm(options.bpm ?? 120)
  let mode: Mode = 'stopped'
  /** The next step it plays. */
  let step = 0
  /** The place of one step on the timeline: step `base.step` is at `base.position` (see stepPosition). */
  let base = { step: 0, position: 0 }
  /** Where the transport is at one time; positionAt adds how far it moved from there. */
  let anchor = { time: 0, position: 0 }
  let plan: SpeedPoint[] = [{ time: 0, speed: 0 }]
  /** Look for the next step (or the next rewind step) from this time on. */
  let cursor = 0
  /** A rewind turned the playing transport around: the `stop` event comes at this time. */
  let stopAt: number | null = null
  /** The step a rewind goes back to (the first step of a bar). */
  let rewindTo = 0
  let timer: ReturnType<typeof setInterval> | undefined

  const stepDuration = () => 60 / bpm / stepsPerBeat
  const stepPosition = (index: number) => base.position + (index - base.step) * stepDuration()

  /**
   * The speed at `time`. Where the speed jumps (two points at one time), it is the speed after the
   * jump; with `before`, the speed just before it (for the end of a stretch of time).
   */
  const speedAt = (time: number, before = false) => {
    // The last point at (or before) `time`, then a straight line to the next point.
    let i = -1
    while (i + 1 < plan.length && (before ? plan[i + 1]!.time < time : plan[i + 1]!.time <= time)) i++
    if (i < 0) return plan[0]!.speed
    const a = plan[i]!
    const b = plan[i + 1]
    if (!b) return a.speed
    return a.speed + ((b.speed - a.speed) * (time - a.time)) / (b.time - a.time)
  }

  /** The times between `from` and `to` where the speed bends or crosses 0, in order. */
  const corners = (from: number, to: number) => {
    const times = [from, to]
    plan.forEach((b, i) => {
      times.push(b.time)
      const a = plan[i - 1]
      if (a && a.speed * b.speed < 0) times.push(a.time + ((b.time - a.time) * a.speed) / (a.speed - b.speed))
    })
    return [...new Set(times.filter((time) => time >= from && time <= to))].sort((x, y) => x - y)
  }

  const travel = (from: number, to: number): number => {
    if (to < from) return -travel(to, from)
    const points = corners(from, to)
    let distance = 0
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1]!, points[i]!]
      distance += ((speedAt(a) + speedAt(b, true)) / 2) * (b - a)
    }
    return distance
  }

  const positionAt = (time: number) => anchor.position + travel(anchor.time, time)

  /** The first audio time from `from` on when the transport is at `target`. Infinity: never. */
  const timeAt = (target: number, from: number) => {
    let left = target - positionAt(from)
    if (Math.abs(left) < 1e-12) return from
    const last = plan.at(-1)!
    const points = corners(from, Math.max(from, last.time))
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1]!, points[i]!]
      const [sa, sb] = [speedAt(a), speedAt(b, true)]
      const area = ((sa + sb) / 2) * (b - a)
      // Between two corners the speed has one direction, so the transport gets to `left` at most once.
      if (area !== 0 && Math.sign(area) === Math.sign(left) && Math.abs(left) <= Math.abs(area)) {
        const slope = (sb - sa) / (b - a)
        if (Math.abs(slope) < 1e-12) return a + left / sa
        // Solve sa·x + slope·x²/2 = left. Take the root where the speed has the right direction.
        const root = Math.sqrt(Math.max(0, sa * sa + 2 * slope * left))
        return a + (-sa + Math.sign(sa + sb) * root) / slope
      }
      left -= area
    }
    // After the last point the speed stays the same.
    const speed = last.speed
    return speed !== 0 && Math.sign(speed) === Math.sign(left) ? Math.max(from, last.time) + left / speed : Infinity
  }

  /** Use a new speed plan from now on. The transport keeps its place. */
  const setPlan = (points: SpeedPoint[]) => {
    const now = source.currentTime
    anchor = { time: now, position: positionAt(now) }
    plan = points
    emit('speedchange', { plan: points.map((point) => ({ ...point })) })
  }

  const startTimer = () => {
    if (timer === undefined) timer = setInterval(tick, interval)
  }
  const stopTimer = () => {
    clearInterval(timer)
    timer = undefined
  }

  /** Announce the steps the transport gets to before `until`. */
  const playSteps = (now: number) => {
    let time = timeAt(stepPosition(step), cursor)
    // A step that is a little late still plays (Web Audio plays it at once).
    // But if the timer was very late (for example, the computer was asleep),
    // skip the missed steps. Playing them all at once would sound bad.
    while (time < now - lookahead) {
      step++
      cursor = time
      time = timeAt(stepPosition(step), time)
    }
    const stepsPerBar = stepsPerBeat * beatsPerBar
    while (time < now + lookahead) {
      const next = timeAt(stepPosition(step + 1), time)
      const duration = Number.isFinite(next) ? next - time : stepDuration()
      emit('step', { step, stepInBar: step % stepsPerBar, time, duration })
      if (step % stepsPerBeat === 0) {
        const beat = step / stepsPerBeat
        emit('beat', { beat, beatInBar: beat % beatsPerBar, bar: Math.floor(beat / beatsPerBar), time })
      }
      step++
      cursor = time
      time = next
    }
  }

  /** While it rewinds: announce each step the transport goes back past, before `until`. */
  const rewindSteps = (until: number) => {
    while (step > rewindTo) {
      const time = timeAt(stepPosition(step - 1), cursor)
      if (!(time < until)) return
      step--
      cursor = time
      emit('rewindstep', { step, time })
    }
  }

  /** The rewind is over at `time`. At the end: the transport is exactly at the first step of the bar. */
  const endRewind = (time: number, atEnd: boolean) => {
    if (atEnd) {
      if (step !== rewindTo) {
        step = rewindTo
        emit('rewindstep', { step, time })
      }
      anchor = { time, position: stepPosition(rewindTo) }
    }
    mode = 'stopped'
    emit('rewindend', { time })
  }

  const sendStop = () => {
    if (stopAt === null) return
    emit('stop', { time: stopAt })
    stopAt = null
  }

  const tick = () => {
    const now = source.currentTime
    const end = plan.at(-1)!.time
    if (mode === 'playing' || mode === 'stopping') {
      playSteps(now)
      // Slowing down: when the transport has stopped, the clock stops.
      if (mode === 'stopping' && now >= end) {
        mode = 'stopped'
        stopTimer()
        emit('stop', { time: end })
      }
    } else if (mode === 'rewinding' || mode === 'braking') {
      if (stopAt !== null && now >= stopAt) sendStop()
      rewindSteps(now + lookahead)
      if (now >= end) {
        sendStop()
        stopTimer()
        endRewind(end, mode === 'rewinding')
      }
    }
  }

  /** Stop a rewind: slow down fast to 0. Returns the time when the transport is still. */
  const brake = () => {
    const now = source.currentTime
    const speed = speedAt(now)
    const still = now + Math.abs(speed) / rewindAccel()
    setPlan([{ time: now, speed }, { time: still, speed: 0 }])
    return still
  }

  return {
    get bpm() {
      return bpm
    },
    get running() {
      return mode === 'playing' || mode === 'stopping'
    },
    get stopping() {
      return mode === 'stopping'
    },
    get rewinding() {
      return mode === 'rewinding'
    },
    get speed() {
      return speedAt(source.currentTime)
    },
    get plan() {
      return plan.map((point) => ({ ...point }))
    },
    get stepDuration() {
      return stepDuration()
    },
    get step() {
      return step
    },
    stepsPerBeat,
    beatsPerBar,
    lookahead,
    spinUp,
    spinDown,
    speedAt: (time) => speedAt(time),
    travel,
    positionAt,
    stepsAt: (time) => base.step + (positionAt(time) - base.position) / stepDuration(),
    setBpm(value) {
      const next = validBpm(value)
      // The next step keeps its place on the timeline; the steps after it use the new tempo.
      base = { step, position: stepPosition(step) }
      bpm = next
    },
    start(time = source.currentTime + 0.05) {
      if (mode === 'playing') return
      const now = source.currentTime
      if (mode === 'stopping') {
        // It slows down: speed up again from here. It takes the part of spinUp that is left.
        const speed = speedAt(now)
        mode = 'playing'
        setPlan([{ time: now, speed }, { time: now + spinUp * (1 - speed), speed: 1 }])
        tick()
        return
      }
      if (mode === 'rewinding' || mode === 'braking') {
        // Stop the rewind fast, then play from where the transport is then.
        const still = brake()
        sendStop()
        rewindSteps(still + 1e-9)
        emit('rewindend', { time: still })
        setPlan([...plan, { time: still, speed: 0 }, { time: still + spinUp, speed: 1 }])
        mode = 'playing'
        cursor = still
        emit('start', { time: still, step })
        tick()
        startTimer()
        return
      }
      // Stopped: go on from where the transport is. (Before `time` it stays still.)
      mode = 'playing'
      cursor = time
      setPlan([
        { time: now, speed: 0 },
        { time, speed: 0 },
        { time: time + spinUp, speed: 1 },
      ])
      emit('start', { time, step })
      tick()
      startTimer()
    },
    stop() {
      if (mode === 'rewinding') {
        mode = 'braking'
        brake()
        return
      }
      if (mode !== 'playing') return
      const now = source.currentTime
      const speed = speedAt(now)
      // It slows down from the speed it has now: a transport that just started stops sooner.
      const length = spinDown * speed
      if (length <= 0) {
        setPlan([{ time: now, speed: 0 }])
        mode = 'stopped'
        stopTimer()
        emit('stop', { time: now })
        return
      }
      mode = 'stopping'
      setPlan([{ time: now, speed }, { time: now + length, speed: 0 }])
    },
    rewind() {
      if (mode === 'rewinding') return
      const now = source.currentTime
      const position = positionAt(now)
      const speed = speedAt(now)
      // The step the transport is on: the last one it got to (steps announced ahead of it don't count;
      // exactly at the first step of a bar, that is the one).
      let on = step
      while (on > 0 && stepPosition(on) > position + 1e-9) on--
      // Back to the first step of that bar.
      const stepsPerBar = stepsPerBeat * beatsPerBar
      const target = Math.max(0, Math.floor(Math.max(0, on) / stepsPerBar) * stepsPerBar)
      const distance = position - stepPosition(target)
      if (distance <= 1e-9 && speed <= 0) return
      rewindTo = target
      emit('rewind', { time: now, step: target })
      // From the speed now (forwards, or a little backwards) to the rewind speed, backwards; then
      // back to 0 exactly at that step. The ramps change the speed at `rewindAccel`.
      // Distance: distance + speed²/2a (it still goes forwards while it turns) - V²/a (the two
      // ramps) - V·cruise (full rewind speed) = 0.
      const accel = rewindAccel()
      const forward = (speed * speed) / (2 * accel)
      // (Already backwards faster than this peak: keep that speed; it may go a little too far.)
      const peak = Math.max(-speed, Math.min(rewindSpeed(), Math.sqrt(Math.max(0, accel * (distance + forward)))))
      const cruise = Math.max(0, (distance + forward - (peak * peak) / accel) / peak)
      const turned = now + (speed + peak) / accel
      if (mode === 'playing' || mode === 'stopping') stopAt = speed > 0 ? now + speed / accel : now
      mode = 'rewinding'
      cursor = now
      setPlan([
        { time: now, speed },
        { time: turned, speed: -peak },
        { time: turned + cruise, speed: -peak },
        { time: turned + cruise + peak / accel, speed: 0 },
      ])
      tick()
      startTimer()
    },
    halt() {
      mode = 'stopped'
      stopTimer()
    },
    tick,
  }
}

function validBpm(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError(`bpm must be a positive number, got ${bpm}`)
  return bpm
}

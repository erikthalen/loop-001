import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ClockEventMap, type ClockOptions, createClock } from './clock'

// A fake audio clock. Tests move time forward by hand.
function setup(options: ClockOptions = {}) {
  const source = { currentTime: 0 }
  const events: { type: keyof ClockEventMap; detail: any }[] = []
  const clock = createClock(
    source,
    (type, detail) => events.push({ type, detail }),
    options,
  )
  const of = <K extends keyof ClockEventMap>(type: K): ClockEventMap[K][] =>
    events.filter((e) => e.type === type).map((e) => e.detail)
  return { source, clock, events, of }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createClock', () => {
  it('has a step length that matches the bpm', () => {
    const { clock } = setup({ bpm: 120, stepsPerBeat: 4 })
    expect(clock.stepDuration).toBe(0.125) // 120 bpm = 0.5 s per beat, 4 steps per beat
  })

  it('emits start, then steps inside the lookahead window', () => {
    const { clock, of, events } = setup({ bpm: 120, lookahead: 0.3 })
    clock.start(0)
    expect(events.find((e) => e.type === 'start')).toEqual({
      type: 'start',
      detail: { time: 0, step: 0 },
    })
    // Steps at 0, 0.125, 0.25 are inside 0..0.3
    expect(of('step').map((s) => s.time)).toEqual([0, 0.125, 0.25])
    expect(of('step').map((s) => s.step)).toEqual([0, 1, 2])
  })

  it('emits a beat on every stepsPerBeat-th step, with bar position', () => {
    const { clock, source, of } = setup({
      bpm: 60,
      stepsPerBeat: 2,
      beatsPerBar: 3,
      lookahead: 0.1,
    })
    clock.start(0)
    for (let t = 0; t <= 4; t += 0.025) {
      source.currentTime = t
      vi.advanceTimersByTime(25)
    }
    const beats = of('beat')
    expect(beats.map((b) => b.time)).toEqual([0, 1, 2, 3, 4])
    expect(beats.map((b) => b.beatInBar)).toEqual([0, 1, 2, 0, 1])
    expect(beats.map((b) => b.bar)).toEqual([0, 0, 0, 1, 1])
  })

  it('schedules every step exactly once, with even spacing', () => {
    const { clock, source, of } = setup({ bpm: 120 })
    clock.start(0)
    for (let t = 0; t < 2; t += 0.025) {
      source.currentTime = t
      vi.advanceTimersByTime(25)
    }
    const steps = of('step')
    steps.forEach((s, i) => {
      expect(s.step).toBe(i)
      expect(s.time).toBeCloseTo(i * 0.125, 9)
    })
    // No step is announced more than `lookahead` before it plays
    expect(steps.at(-1)!.time).toBeLessThan(2 + 0.1)
  })

  it('uses the new bpm for steps after a tempo change', () => {
    const { clock, source, of } = setup({
      bpm: 120,
      stepsPerBeat: 1,
      lookahead: 0.01,
    })
    clock.start(0) // beat at 0
    clock.setBpm(60) // next beat should be 0.5 s later (already advanced), then 1 s apart
    for (let t = 0; t <= 3; t += 0.025) {
      source.currentTime = t
      vi.advanceTimersByTime(25)
    }
    expect(of('beat').map((b) => b.time)).toEqual([0, 0.5, 1.5, 2.5])
  })

  it('skips missed steps instead of playing them all at once', () => {
    const { clock, source, of } = setup({ bpm: 120, lookahead: 0.1 })
    clock.start(0)
    source.currentTime = 10 // the timer was asleep for 10 seconds
    vi.advanceTimersByTime(25)
    const late = of('step').filter((s) => s.time > 0.1)
    expect(late.every((s) => s.time >= 10)).toBe(true)
    expect(late.length).toBe(1) // only the step at 10.0 is inside 10..10.1
  })

  it('still plays a step that is only a little late', () => {
    const { clock, source, of } = setup({ bpm: 120, lookahead: 0.1 })
    clock.start(0) // window 0..0.1: announces the step at 0 only
    source.currentTime = 0.13 // timer is late: the step at 0.125 is now 5 ms in the past
    vi.advanceTimersByTime(25)
    expect(of('step').map((s) => s.time)).toEqual([0, 0.125])
  })

  it('stops emitting after stop()', () => {
    const { clock, source, of } = setup({ bpm: 120 })
    clock.start(0)
    clock.stop()
    const count = of('step').length
    source.currentTime = 1
    vi.advanceTimersByTime(1000)
    expect(of('step').length).toBe(count)
    expect(of('stop')).toHaveLength(1)
    expect(clock.running).toBe(false)
  })

  describe('transport speed', () => {
    const run = (source: { currentTime: number }, until: number) => {
      for (let t = source.currentTime; t <= until; t += 0.005) {
        source.currentTime = t
        vi.advanceTimersByTime(25)
      }
    }

    it('is at full speed at once without spinUp', () => {
      const { clock } = setup()
      clock.start(0)
      expect(clock.speedAt(0)).toBe(1)
    })

    it('speeds up on start: the steps come closer, then even', () => {
      const { clock, source, of } = setup({ bpm: 120, spinUp: 1 })
      clock.start(0)
      expect(clock.speedAt(0)).toBe(0)
      expect(clock.speedAt(0.5)).toBeCloseTo(0.5, 9)
      expect(of('speedchange')).toHaveLength(1)
      run(source, 3)
      const times = of('step').map((s) => s.time)
      const gaps = times.slice(1).map((t, i) => t - times[i]!)
      // While it speeds up, each gap is shorter than the one before; at full speed: 0.125 s.
      expect(gaps[1]).toBeLessThan(gaps[0]!)
      expect(gaps.at(-1)).toBeCloseTo(0.125, 9)
      // The second step is where the transport has moved one step: t²/2 = 0.125, so t = 0.5.
      expect(times[1]).toBeCloseTo(0.5, 9)
      // The transport travel matches the steps.
      expect(clock.travel(0, times[4]!)).toBeCloseTo(4 * 0.125, 9)
    })

    it('slows down on stop, then stops', () => {
      const { clock, source, of } = setup({ bpm: 120, spinDown: 1 })
      clock.start(0)
      run(source, 1)
      clock.stop()
      expect(clock.stopping).toBe(true)
      expect(clock.running).toBe(true)
      expect(of('stop')).toHaveLength(0)
      run(source, 3)
      expect(clock.running).toBe(false)
      expect(of('stop')).toEqual([{ time: expect.closeTo(2, 2) }])
      // Steps after the stop: further and further apart, and none after the transport has stopped.
      const late = of('step')
        .map((s) => s.time)
        .filter((t) => t > 1.1)
      expect(late.length).toBeGreaterThan(1)
      expect(late[1]! - late[0]!).toBeGreaterThan(0.125)
      expect(late.every((t) => t <= 2)).toBe(true)
      // The transport moved 0.5 s while it slowed down (half of 1 s at speed 1 to 0).
      expect(clock.travel(1, 2)).toBeCloseTo(0.5, 2)
    })

    it('speeds up again from where it is, if started while it slows down', () => {
      const { clock, source, of } = setup({ bpm: 120, spinUp: 1, spinDown: 1 })
      clock.start(0)
      run(source, 2)
      clock.stop()
      run(source, 2.5)
      clock.start()
      expect(of('start')).toHaveLength(1)
      expect(of('stop')).toHaveLength(0)
      const [from, to] = of('speedchange').at(-1)!.plan
      expect(from!.speed).toBeCloseTo(0.5, 1)
      expect(to!.speed).toBe(1)
      expect(to!.time - from!.time).toBeCloseTo(0.5, 1)
      run(source, 4)
      expect(clock.running).toBe(true)
      expect(clock.speed).toBe(1)
    })

    it('after a stop, the next start goes on from the place on the transport', () => {
      const { clock, source, of } = setup({ bpm: 120, spinDown: 1 })
      clock.start(0)
      run(source, 1)
      clock.stop()
      run(source, 2.5)
      const position = clock.positionAt(2.5)
      const next = clock.step
      // The transport stopped between two steps: the next step is a bit further on.
      expect(position).toBeLessThan(next * 0.125)
      clock.start(3)
      run(source, 3.5)
      const first = of('step').find((s) => s.step === next)!
      expect(first.time).toBeCloseTo(3 + (next * 0.125 - position), 6)
    })
  })

  describe('rewind', () => {
    const run = (source: { currentTime: number }, until: number) => {
      for (let t = source.currentTime; t <= until; t += 0.005) {
        source.currentTime = t
        vi.advanceTimersByTime(25)
      }
    }

    it('goes back to the first step of the bar while playing: it turns around, goes back, then stops there', () => {
      const { clock, source, of } = setup({
        bpm: 120,
        rewindBpm: 240,
        rewindRamp: 0.1,
      })
      clock.start(0)
      run(source, 2.6) // about 20 steps: in the second bar (steps 16 to 31)
      const steps = of('step').length
      clock.rewind()
      expect(clock.rewinding).toBe(true)
      expect(clock.running).toBe(false)
      expect(clock.speedAt(2.59)).toBe(1)
      run(source, 4)
      // The stop event came when it turned around; no step played after the turn.
      expect(of('stop')).toHaveLength(1)
      const turned = of('stop')[0]!.time
      expect(
        of('step')
          .slice(steps)
          .every((s) => s.time <= turned),
      ).toBe(true)
      // Backwards at the rewind tempo: 240 bpm at a tempo of 120 is twice the full speed.
      expect(clock.speedAt(turned + 0.15)).toBeCloseTo(-2, 6)
      // The rewind steps go down one by one, to step 16 (the first step of the bar): no further.
      const back = of('rewindstep').map((r) => r.step)
      expect(back.at(-1)).toBe(16)
      expect(back).toEqual([...back].sort((a, b) => b - a))
      expect(of('rewindend')).toHaveLength(1)
      expect(clock.rewinding).toBe(false)
      expect(clock.step).toBe(16)
      expect(clock.positionAt(4)).toBeCloseTo(16 * 0.125, 9)
      expect(clock.speedAt(4)).toBe(0)
      // Rewind again at the first step: nothing happens.
      clock.rewind()
      expect(clock.rewinding).toBe(false)
    })

    it('ramps up and down: the speed changes in straight lines, not at once', () => {
      const { clock, source } = setup({
        bpm: 120,
        rewindBpm: 130,
        rewindRamp: 0.2,
      })
      clock.start(0)
      run(source, 1.6)
      clock.stop()
      clock.rewind()
      const [start, full, , end] = clock.plan
      // From still to full rewind speed (130 / 120) in 0.2 s; at the end the same back to 0.
      expect(start!.speed).toBe(0)
      expect(full!.speed).toBeCloseTo(-130 / 120, 9)
      expect(full!.time - start!.time).toBeCloseTo(0.2, 9)
      expect(end!.speed).toBe(0)
    })

    it('plays from the first step of the bar after a rewind', () => {
      const { clock, source, of } = setup({ bpm: 120 })
      clock.start(0)
      run(source, 1)
      clock.stop()
      clock.rewind()
      run(source, 3)
      clock.start(3.5)
      run(source, 3.6)
      expect(of('start').at(-1)).toEqual({ time: 3.5, step: 0 })
      expect(of('step').find((s) => s.time >= 3.5)).toMatchObject({
        step: 0,
        time: 3.5,
      })
    })

    it('ends exactly at the first step of the bar, also after a tempo change', () => {
      const { clock, source } = setup({
        bpm: 120,
        rewindBpm: 240,
        rewindRamp: 0.1,
      })
      clock.start(0)
      run(source, 1.3) // about 10 steps at 120 bpm
      clock.setBpm(97)
      run(source, 3.3) // into the second bar at 97 bpm
      clock.stop()
      clock.rewind()
      run(source, 8)
      expect(clock.step).toBe(16)
      expect(clock.stepsAt(8)).toBeCloseTo(16, 9)
    })

    it('stops the rewind on stop, and keeps that place', () => {
      const { clock, source, of } = setup({
        bpm: 120,
        rewindBpm: 240,
        rewindRamp: 0.1,
      })
      clock.start(0)
      run(source, 3.9) // 31 steps: the last step of the second bar
      clock.stop()
      clock.rewind()
      run(source, 4.5)
      clock.stop()
      expect(clock.rewinding).toBe(false)
      run(source, 5)
      expect(of('rewindend')).toHaveLength(1)
      const step = clock.step
      expect(step).toBeGreaterThan(16)
      expect(step).toBeLessThan(32)
      expect(of('rewindstep').at(-1)!.step).toBe(step)
    })

    it('plays from where it is, if started while it rewinds', () => {
      const { clock, source, of } = setup({
        bpm: 120,
        rewindBpm: 240,
        rewindRamp: 0.1,
      })
      clock.start(0)
      run(source, 3.9)
      clock.stop()
      clock.rewind()
      run(source, 4.5)
      clock.start()
      expect(of('rewindend')).toHaveLength(1)
      const start = of('start').at(-1)!
      expect(start.step).toBe(clock.step)
      run(source, 6)
      expect(clock.running).toBe(true)
      expect(of('step').at(-1)!.step).toBeGreaterThan(start.step)
    })
  })

  it('starts again from where it stopped', () => {
    const { clock, source, of } = setup({ bpm: 120, lookahead: 0.1 })
    clock.start(0)
    for (let t = 0; t <= 0.6; t += 0.025) {
      source.currentTime = t
      vi.advanceTimersByTime(25)
    }
    clock.stop()
    const played = of('step').map((s) => s.step)
    const next = played.at(-1)! + 1
    expect(clock.step).toBe(next)
    const position = clock.positionAt(1)
    source.currentTime = 5
    clock.start(5)
    expect(of('start').at(-1)).toEqual({ time: 5, step: next })
    // The first step after the new start is the next one, at the new start time.
    for (let t = 5; t <= 5.5; t += 0.025) {
      source.currentTime = t
      vi.advanceTimersByTime(25)
    }
    const after = of('step').slice(played.length)
    // The transport stopped between two steps: the next step comes when the transport gets there.
    expect(after[0]).toMatchObject({ step: next, stepInBar: next % 16 })
    expect(after[0]!.time).toBeCloseTo(5 + next * 0.125 - position, 9)
  })

  it('rejects a bad bpm', () => {
    const { clock } = setup()
    expect(() => clock.setBpm(0)).toThrow(RangeError)
    expect(() => clock.setBpm(Number.NaN)).toThrow(RangeError)
  })
})

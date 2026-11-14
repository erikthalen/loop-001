import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClock, type ClockEventMap, type ClockOptions } from './clock'

// A fake audio clock. Tests move time forward by hand.
function setup(options: ClockOptions = {}) {
  const source = { currentTime: 0 }
  const events: { type: keyof ClockEventMap; detail: any }[] = []
  const clock = createClock(source, (type, detail) => events.push({ type, detail }), options)
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
    expect(events[0]).toEqual({ type: 'start', detail: { time: 0 } })
    // Steps at 0, 0.125, 0.25 are inside 0..0.3
    expect(of('step').map((s) => s.time)).toEqual([0, 0.125, 0.25])
    expect(of('step').map((s) => s.step)).toEqual([0, 1, 2])
  })

  it('emits a beat on every stepsPerBeat-th step, with bar position', () => {
    const { clock, source, of } = setup({ bpm: 60, stepsPerBeat: 2, beatsPerBar: 3, lookahead: 0.1 })
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
    const { clock, source, of } = setup({ bpm: 120, stepsPerBeat: 1, lookahead: 0.01 })
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

  it('rejects a bad bpm', () => {
    const { clock } = setup()
    expect(() => clock.setBpm(0)).toThrow(RangeError)
    expect(() => clock.setBpm(Number.NaN)).toThrow(RangeError)
  })
})

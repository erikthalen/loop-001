import { describe, expect, it } from 'vitest'
import { createOdometer, wheelCounts } from './odometer'

const DIGITS = [{ unit: 100 }, { unit: 10 }, { unit: 1 }]

describe('wheelCounts', () => {
  it('turns a higher wheel only while the number passes its last 1 (a real odometer)', () => {
    expect(wheelCounts(DIGITS, 375)).toEqual([3, 37, 375])
    expect(wheelCounts(DIGITS, 99.5)).toEqual([0.5, 9.5, 99.5])
    expect(wheelCounts(DIGITS, -4)).toEqual([0, 0, 0])
  })
})

describe('createOdometer', () => {
  it('starts every wheel at once after a jump, and they get there together', () => {
    const counter = createOdometer(DIGITS, 375)
    counter.roll(250, 1 / 60)
    const [hundreds, tens, ones] = counter.wheels
    // All three moved down in the first frame (the same part of their way), not only the last one.
    expect(hundreds).toBeLessThan(3)
    expect(hundreds).toBeGreaterThan(2)
    expect(tens).toBeLessThan(7)
    // The last wheel spins through many digits (375 → 345.8 after one frame), so it shows 5.8.
    expect(ones).not.toBe(5)
    expect(counter.moving).toBe(true)
  })

  it('stops on whole digits', () => {
    const counter = createOdometer(DIGITS, 375)
    for (let frame = 0; frame < 120 && counter.roll(250, 1 / 60); frame++);
    expect(counter.moving).toBe(false)
    expect(counter.wheels).toEqual([2, 5, 0])
  })

  it('wraps each wheel to its size (a clock: the tens of seconds go to 5)', () => {
    const counter = createOdometer([{ unit: 10, size: 6 }, { unit: 1 }], 61)
    expect(counter.wheels).toEqual([0, 1])
  })

  it('jumps at once', () => {
    const counter = createOdometer(DIGITS, 0)
    counter.jump(42)
    expect(counter.wheels).toEqual([0, 4, 2])
    expect(counter.moving).toBe(false)
  })
})

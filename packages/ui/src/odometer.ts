/**
 * Odometer: digit wheels that roll to a number, like the counter of a tape machine. For counters
 * drawn on a canvas (the sampler's time, the delay's time).
 *
 * A real odometer turns a wheel only while the wheel to its right rolls over from 9 to 0. When the
 * number jumps (375 → 250), that is a tiny part of the way, so the higher wheels would snap instead
 * of roll. Here, each wheel rolls on its own, towards its place for the new number: they all start
 * at once and get there together. From 375 to 250, the hundreds wheel rolls 1 digit, the tens wheel
 * 12 and the last wheel 125. While the number stands still, every wheel stops on a whole digit.
 *
 *   const counter = createOdometer([{ unit: 100 }, { unit: 10 }, { unit: 1 }])
 *   // each frame:
 *   counter.roll(ms, seconds)  // `seconds` since the last frame
 *   counter.wheels             // [3, 7.5, 5]: wheel 2 is halfway from 7 to 8
 */

export interface OdometerWheel {
  /** How much of the number one digit of this wheel is: 1 for the last wheel, 10 for the one before it, ... */
  readonly unit: number
  /** How many digits the wheel has. Default: 10. (The tens of seconds of a clock: 6.) */
  readonly size?: number
}

export interface Odometer {
  /** Each wheel's place, 0 to its size: 2.5 is halfway from 2 to 3 (the 2 moves up, the 3 comes in). */
  readonly wheels: readonly number[]
  /** True while a wheel still turns towards the number. */
  readonly moving: boolean
  /** Turn the wheels towards `value` for `seconds` of time (since the last frame). Returns `moving`. */
  roll(value: number, seconds: number): boolean
  /** Put the wheels at `value` at once, no rolling (for example with reduced motion). */
  jump(value: number): void
}

/** How fast the wheels get to a new number: this much of the way that is left, per second. */
const SPEED = 14
/** Closer than this (a part of one digit), a wheel is there. */
const THERE = 0.001

/**
 * Where each wheel is for a number, as a count of its digits (not wrapped to its size): the place
 * a real odometer would show. 0 or less: all zeros.
 */
export function wheelCounts(
  wheels: readonly OdometerWheel[],
  value: number,
): number[] {
  const v = Math.max(0, value)
  return wheels.map(({ unit }) => {
    const whole = Math.floor(v / unit)
    // The last wheel turns all the time; the others only while the number passes its last 1.
    const turn =
      unit <= 1 ? (v / unit) % 1 : Math.max(0, (v % unit) - (unit - 1))
    return whole + turn
  })
}

export function createOdometer(
  wheels: readonly OdometerWheel[],
  value = 0,
): Odometer {
  let counts = wheelCounts(wheels, value)
  let moving = false
  const odometer: Odometer = {
    get wheels() {
      return counts.map((count, i) => count % (wheels[i]!.size ?? 10))
    },
    get moving() {
      return moving
    },
    roll(value, seconds) {
      const targets = wheelCounts(wheels, value)
      const step = Math.min(1, Math.max(0, seconds) * SPEED)
      moving = false
      counts = counts.map((count, i) => {
        const target = targets[i]!
        const next = count + (target - count) * step
        if (Math.abs(target - next) < THERE) return target
        moving = true
        return next
      })
      return moving
    },
    jump(value) {
      counts = wheelCounts(wheels, value)
      moving = false
    },
  }
  return odometer
}

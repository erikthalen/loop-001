/**
 * Water surface physics: the classic "two height buffers" ripple algorithm
 * (Hugo Elias, explained by Roy Willemse in "The Water Effect Explained", gamedev.net).
 *
 * The surface is a square grid of heights. One buffer has the heights now,
 * the other has the heights one step ago. Each step, every cell becomes:
 *
 *   next = (left + right + up + down) / 2 - previous
 *
 * This is a discrete wave equation: a bump spreads out as rings.
 * Then a little damping makes the waves die out.
 */

export interface WaterOptions {
  /** Cells along one side of the grid. */
  size: number
  /** Half the width of the water in world units. The grid covers -extent to +extent. */
  extent: number
  /** How much of a wave is kept per step, 0 to 1. Default: 0.992. */
  damping?: number
}

export interface Water {
  readonly size: number
  readonly extent: number
  /** The heights now (world units), row by row. Row = z, column = x. */
  readonly heights: Float32Array
  /** Move the waves forward by one step. */
  step(): void
  /** Push the surface up (amount > 0) or down (amount < 0) in a smooth round bump. */
  disturb(x: number, z: number, radius: number, amount: number): void
  /** The height at a world position (0 outside the grid). */
  heightAt(x: number, z: number): number
  /** How much the height at a world position changed in the last step. */
  velocityAt(x: number, z: number): number
  /** The largest wave height. Near 0 means the water is calm. */
  energy(): number
}

export function createWater({ size, extent, damping = 0.992 }: WaterOptions): Water {
  let current = new Float32Array(size * size)
  let previous = new Float32Array(size * size)

  // Waves die out near the edges, so they do not bounce back (a "sponge" border).
  const keep = new Float32Array(size * size)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const edge = Math.min(row, col, size - 1 - row, size - 1 - col) / (size * 0.12)
      keep[row * size + col] = damping * (edge >= 1 ? 1 : 0.85 + 0.15 * edge)
    }
  }

  const toCell = (value: number) => ((value / extent) * 0.5 + 0.5) * (size - 1)
  const index = (x: number, z: number) => {
    const col = Math.round(toCell(x))
    const row = Math.round(toCell(z))
    return col < 0 || row < 0 || col >= size || row >= size ? -1 : row * size + col
  }

  return {
    size,
    extent,
    get heights() {
      return current
    },

    step() {
      // `previous` becomes `next`: the formula only needs each old value once.
      for (let row = 1; row < size - 1; row++) {
        for (let col = 1; col < size - 1; col++) {
          const i = row * size + col
          const next = (current[i - 1]! + current[i + 1]! + current[i - size]! + current[i + size]!) / 2 - previous[i]!
          previous[i] = next * keep[i]!
        }
      }
      ;[current, previous] = [previous, current]
    },

    disturb(x, z, radius, amount) {
      const cells = (radius / (2 * extent)) * (size - 1)
      const cx = toCell(x)
      const cz = toCell(z)
      for (let row = Math.max(1, Math.floor(cz - cells)); row <= Math.min(size - 2, Math.ceil(cz + cells)); row++) {
        for (let col = Math.max(1, Math.floor(cx - cells)); col <= Math.min(size - 2, Math.ceil(cx + cells)); col++) {
          const d = Math.hypot(col - cx, row - cz) / cells
          if (d < 1) current[row * size + col]! += amount * (0.5 + 0.5 * Math.cos(Math.PI * d))
        }
      }
    },

    heightAt(x, z) {
      const i = index(x, z)
      return i < 0 ? 0 : current[i]!
    },

    velocityAt(x, z) {
      const i = index(x, z)
      return i < 0 ? 0 : current[i]! - previous[i]!
    },

    energy() {
      let max = 0
      for (let i = 0; i < current.length; i += 7) max = Math.max(max, Math.abs(current[i]!))
      return max
    },
  }
}

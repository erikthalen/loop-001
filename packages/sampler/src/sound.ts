/**
 * A recorded sound as text, so it can be saved in the project file (JSON).
 * To keep the project small: one channel (mono), 16 bits, and about 24 000 samples a second.
 * That is enough for a lo-fi sampler. 5 seconds is about 320 kB of text.
 */
export interface SavedSound {
  /** Samples per second. */
  rate: number
  /** 16-bit samples (little-endian), as base64 text. */
  data: string
}

/** A higher sample rate is made smaller by taking the average of 2 or more samples. */
const TARGET_RATE = 24_000

export function encodeSound(buffer: AudioBuffer): SavedSound {
  const input = buffer.getChannelData(0)
  const step = Math.max(1, Math.round(buffer.sampleRate / TARGET_RATE))
  const length = Math.floor(input.length / step)
  const bytes = new DataView(new ArrayBuffer(length * 2))
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let k = 0; k < step; k++) sum += input[i * step + k]!
    const value = Math.max(-1, Math.min(1, sum / step))
    bytes.setInt16(i * 2, Math.round(value * 32767), true)
  }
  // btoa takes a "binary string". Build it in parts: one huge String.fromCharCode call can fail.
  const array = new Uint8Array(bytes.buffer)
  let binary = ''
  for (let i = 0; i < array.length; i += 0x8000)
    binary += String.fromCharCode(...array.subarray(i, i + 0x8000))
  return { rate: buffer.sampleRate / step, data: btoa(binary) }
}

/** The saved text back to sound. null if the data is broken. */
export function decodeSound(saved: unknown): AudioBuffer | null {
  try {
    const { rate, data } = saved as SavedSound
    if (typeof rate !== 'number' || typeof data !== 'string') return null
    const binary = atob(data)
    const length = Math.floor(binary.length / 2)
    if (length === 0) return null
    const bytes = new DataView(new ArrayBuffer(length * 2))
    for (let i = 0; i < length * 2; i++) bytes.setUint8(i, binary.charCodeAt(i))
    const buffer = new AudioBuffer({ length, sampleRate: rate })
    const output = buffer.getChannelData(0)
    for (let i = 0; i < length; i++)
      output[i] = bytes.getInt16(i * 2, true) / 32767
    return buffer
  } catch {
    return null
  }
}

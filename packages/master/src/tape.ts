/**
 * The tape: Master records the sound that reaches it (plugged into its In; usually the whole
 * sound) at the transport position. When the transport goes backwards (rewind), the tape
 * plays that recording backwards, at the transport speed. So a rewind sounds like a real tape (or
 * vinyl) going back: the real music, backwards and fast.
 *
 *   (cables into In) ─▶ tape ─▶ volume ─▶ speakers (core.output)
 *                       └──── Master ────┘
 *
 * - Speed 0 or more: the sound goes through, unchanged. While the transport moves forwards, it is
 *   also recorded at the transport position.
 * - Speed below 0: the sound coming in is silent here; the tape plays its recording backwards
 *   instead. A slow tape is quieter (like a real tape head), so it does not click when it turns around.
 *
 * It keeps only a short piece: the last TAPE_SECONDS. A rewind goes back at most one bar (see
 * clock.ts in @loop/core), so that is enough. Further back the tape is blank (silent).
 * The speed comes in as a sound signal (core.speedSignal), so it follows the transport exactly.
 */

/**
 * How many seconds of tape it keeps (at full speed): one bar at the slowest tempo (16 steps at
 * 20 bpm is 12 s), and a little more for the turn-around.
 */
export const TAPE_SECONDS = 13

const PROCESSOR = 'loop-tape'

// The AudioWorklet code. It runs in the audio thread, so it is plain JavaScript in a string.
const code = /* js */ `
const BLOCK = 128
class Tape extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'speed', defaultValue: 0, automationRate: 'a-rate' }]
  }
  constructor(options) {
    super()
    this.size = Math.ceil((options.processorOptions.seconds * sampleRate) / BLOCK) * BLOCK
    this.channels = [new Float32Array(this.size), new Float32Array(this.size)]
    // Which part of the tape each block of the ring holds (-1: nothing yet).
    this.blocks = new Float64Array(this.size / BLOCK).fill(-1)
    // Where the tape is, in frames (samples) at full speed.
    this.position = 0
    this.port.onmessage = ({ data }) => {
      if (typeof data.position === 'number') this.position = data.position * sampleRate
    }
  }
  write(frame, left, right) {
    const index = frame % this.size
    const block = Math.floor(frame / BLOCK)
    const slot = Math.floor(index / BLOCK)
    if (this.blocks[slot] !== block) {
      // A new part of the tape: wipe the old sound in this block first.
      this.channels[0].fill(0, slot * BLOCK, slot * BLOCK + BLOCK)
      this.channels[1].fill(0, slot * BLOCK, slot * BLOCK + BLOCK)
      this.blocks[slot] = block
    }
    this.channels[0][index] = left
    this.channels[1][index] = right
  }
  at(channel, frame) {
    if (frame < 0) return 0
    const index = frame % this.size
    return this.blocks[Math.floor(index / BLOCK)] === Math.floor(frame / BLOCK) ? this.channels[channel][index] : 0
  }
  read(channel, position) {
    const frame = Math.floor(position)
    const part = position - frame
    return this.at(channel, frame) * (1 - part) + this.at(channel, frame + 1) * part
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    const inLeft = input[0]
    const inRight = input[1] || input[0]
    const speeds = parameters.speed
    for (let n = 0; n < output[0].length; n++) {
      const speed = speeds.length > 1 ? speeds[n] : speeds[0]
      const left = inLeft ? inLeft[n] : 0
      const right = inRight ? inRight[n] : 0
      if (speed >= 0) {
        output[0][n] = left
        if (output[1]) output[1][n] = right
        if (speed > 0) {
          this.write(Math.max(0, Math.floor(this.position)), left, right)
          this.position += speed
        }
      } else {
        this.position += speed
        const loudness = Math.min(1, -speed)
        output[0][n] = this.read(0, this.position) * loudness
        if (output[1]) output[1][n] = this.read(1, this.position) * loudness
      }
    }
    return true
  }
}
registerProcessor('${PROCESSOR}', Tape)
`

export interface Tape {
  /** The tape's audio node: sound in, sound out. */
  readonly node: AudioWorkletNode
  /** Put the tape at a place (seconds at full speed), for example 0 after a rewind. */
  setPosition(seconds: number): void
  /** Unplug the tape (also from the speed signal). */
  dispose(): void
}

/**
 * The tape code is added once per audio context: a second time would register the same processor
 * name again, and that fails. So two Masters share the code (each still has its own tape).
 */
const loaded = new WeakMap<BaseAudioContext, Promise<void>>()

const load = (context: BaseAudioContext) => {
  let loading = loaded.get(context)
  if (!loading) {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    loading = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url))
    // It failed: try again next time.
    loading.catch(() => loaded.delete(context))
    loaded.set(context, loading)
  }
  return loading
}

/** Make a tape that follows `speedSignal` (core.speedSignal). It loads in the background. */
export async function createTape(context: BaseAudioContext, speedSignal: AudioNode): Promise<Tape> {
  await load(context)
  const node = new AudioWorkletNode(context, PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: { seconds: TAPE_SECONDS },
  })
  const speed = node.parameters.get('speed')!
  speed.value = 0
  speedSignal.connect(speed)
  return {
    node,
    setPosition: (seconds) => node.port.postMessage({ position: seconds }),
    dispose() {
      speedSignal.disconnect(speed)
      node.disconnect()
      node.port.close()
    },
  }
}

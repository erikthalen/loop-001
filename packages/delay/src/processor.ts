/**
 * The delay line, as an AudioWorklet: the echoes, with the feedback inside it.
 *
 * Why not a DelayNode with a GainNode back into it? Web Audio adds one render quantum (128
 * samples, about 2.7 ms) each time the sound goes around a loop of nodes (in Chrome). So each echo
 * would come a little later than the one before, and fast echoes would drift off the beat. In here,
 * each echo comes exactly `delayTime` after the one before.
 *
 *   in ─▶ (+) ─▶ [ring buffer] ─┬─▶ out (only the echoes)
 *          ▲                    │
 *          └──── × feedback ────┘
 *
 * `delayTime` (seconds) and `feedback` are a-rate parameters, so they glide smoothly (a new rate
 * glides there, and the pitch bends a little, like a tape delay).
 */

const PROCESSOR = 'loop-delay'

// The AudioWorklet code. It runs in the audio thread, so it is plain JavaScript in a string.
const code = /* js */ `
class Delay extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'delayTime', defaultValue: 0.25, minValue: 0, automationRate: 'a-rate' },
      { name: 'feedback', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
    ]
  }
  constructor(options) {
    super()
    this.size = Math.ceil(options.processorOptions.seconds * sampleRate) + 2
    this.channels = [new Float32Array(this.size), new Float32Array(this.size)]
    // Where the next sample is written.
    this.index = 0
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    const times = parameters.delayTime
    const feedbacks = parameters.feedback
    for (let n = 0; n < output[0].length; n++) {
      const time = times.length > 1 ? times[n] : times[0]
      const feedback = feedbacks.length > 1 ? feedbacks[n] : feedbacks[0]
      // At least 1 sample back, at most the whole ring. Between two samples: a straight line.
      const back = Math.min(this.size - 2, Math.max(1, time * sampleRate))
      let read = this.index - back
      if (read < 0) read += this.size
      const first = Math.floor(read)
      const part = read - first
      const second = first + 1 === this.size ? 0 : first + 1
      for (let c = 0; c < 2; c++) {
        const ring = this.channels[c]
        const echo = ring[first] * (1 - part) + ring[second] * part
        // A mono input goes to both sides.
        const source = input[c] || input[0]
        let next = (source ? source[n] : 0) + feedback * echo
        // Very quiet echoes become 0 (tiny numbers are slow to compute with).
        if (next < 1e-15 && next > -1e-15) next = 0
        ring[this.index] = next
        if (output[c]) output[c][n] = echo
      }
      this.index = this.index + 1 === this.size ? 0 : this.index + 1
    }
    // Keep running, also when nothing comes in: the echoes go on.
    return true
  }
}
registerProcessor('${PROCESSOR}', Delay)
`

/**
 * The code is added once per audio context: a second time would register the same processor
 * name again, and that fails. So two delays share the code (each has its own delay line).
 */
const loaded = new WeakMap<BaseAudioContext, Promise<void>>()

const load = (context: BaseAudioContext) => {
  let loading = loaded.get(context)
  if (!loading) {
    const url = URL.createObjectURL(
      new Blob([code], { type: 'text/javascript' }),
    )
    loading = context.audioWorklet
      .addModule(url)
      .finally(() => URL.revokeObjectURL(url))
    // It failed: try again next time.
    loading.catch(() => loaded.delete(context))
    loaded.set(context, loading)
  }
  return loading
}

/** Make a delay line that can delay up to `seconds`. It loads in the background. */
export async function createDelayLine(
  context: BaseAudioContext,
  seconds: number,
): Promise<AudioWorkletNode> {
  await load(context)
  return new AudioWorkletNode(context, PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: { seconds },
  })
}

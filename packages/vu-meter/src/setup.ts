import { defineModuleSetup } from '@loop/core'

/** 0 VU is this many dB below full scale (0 dBFS): the usual studio level. */
export const VU_REFERENCE_DBFS = -18

/**
 * Audio: a stereo level meter. It only listens: it has an input and no output. To see a sound,
 * plug the same output into the meter too (an output can feed many inputs).
 *
 *   input ─▶ splitter ─┬─▶ left analyser
 *                      └─▶ right analyser
 *
 * The input always has 2 channels: a mono sound (like the metronome) shows on both meters.
 */
export const setup = defineModuleSetup((ctx) => {
  const { audio } = ctx
  const input = new GainNode(audio, { channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' })
  const splitter = new ChannelSplitterNode(audio, { numberOfOutputs: 2 })
  // fftSize 2048: about 43 ms of sound at 48 kHz per reading.
  const analysers = [new AnalyserNode(audio, { fftSize: 2048 }), new AnalyserNode(audio, { fftSize: 2048 })] as const
  input.connect(splitter)
  splitter.connect(analysers[0], 0)
  splitter.connect(analysers[1], 1)

  const samples = new Float32Array(analysers[0].fftSize)

  /** How loud one channel is now, in VU. Silence is -Infinity. */
  const levelOf = (analyser: AnalyserNode) => {
    analyser.getFloatTimeDomainData(samples)
    let sum = 0
    for (const sample of samples) sum += sample * sample
    const rms = Math.sqrt(sum / samples.length)
    return 20 * Math.log10(rms) - VU_REFERENCE_DBFS
  }

  return {
    input,
    /** How loud the left and the right channel are now, in VU (0 VU = -18 dBFS). */
    levels: (): [left: number, right: number] => [levelOf(analysers[0]), levelOf(analysers[1])],
  }
})

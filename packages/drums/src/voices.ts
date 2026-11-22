/**
 * The 6 drums. Each one is made from scratch on every hit, from oscillators, noise, filters and
 * volume shapes (like a Roland TR-808: no samples). Each drum has 4 settings, each 0 to 1. A drum
 * turns them into real values (Hz, seconds) itself.
 *
 * A hit makes new audio nodes, starts them at the hit's time, and takes them away when the sound
 * has ended. That is cheap: a few nodes per hit.
 */

/** One setting of a drum: its name on the screen, and its value in a new drum machine (0 to 1). */
export interface VoiceParam {
  readonly name: string
  readonly default: number
}

/** What a drum needs to play one hit. */
export interface Hit {
  readonly audio: BaseAudioContext
  /** The exact audio time of the hit. */
  readonly time: number
  /**
   * The transport speed (1: normal). Like a tape: at half speed, an octave lower and twice as
   * long. The hit button always plays at 1.
   */
  readonly rate: number
  /** The drum's settings, 0 to 1, in the order of its `params`. */
  readonly params: readonly number[]
  /** White noise, 1 second, made once per drum machine. */
  readonly noise: AudioBuffer
  /** Where the sound goes: the channel's output. */
  readonly output: AudioNode
}

export interface Voice {
  /** Two letters, on the screen. */
  readonly label: string
  /** The full name, for screen readers. */
  readonly name: string
  readonly params: readonly [VoiceParam, VoiceParam, VoiceParam, VoiceParam]
  /** Play one hit. */
  play(hit: Hit): void
}

/** 0 to 1 → a to b, in a straight line. */
const lin = (value: number, a: number, b: number) => a + (b - a) * value
/** 0 to 1 → a to b, in equal steps of pitch or time (better for Hz and seconds). */
const exp = (value: number, a: number, b: number) => a * (b / a) ** value

/**
 * The nodes of one hit. `end()` stops all its sources at a time, and takes all its nodes away
 * when the last source has ended.
 */
function createSound(audio: BaseAudioContext) {
  const nodes: AudioNode[] = []
  const sources: AudioScheduledSourceNode[] = []
  return {
    /** Keep a node, to take it away at the end. */
    add<T extends AudioNode>(node: T): T {
      nodes.push(node)
      if (node instanceof AudioScheduledSourceNode) sources.push(node)
      return node
    },
    /** Stop the sources at `time`, then take all the nodes away. */
    end(time: number) {
      let playing = sources.length
      for (const source of sources) {
        source.onended = () => {
          if (--playing > 0) return
          for (const node of nodes) node.disconnect()
        }
        source.stop(Math.max(time, audio.currentTime))
      }
    },
  }
}

/**
 * A volume shape: up to `peak` in 1 ms (no click), then down. After `decay` seconds, less than
 * 1% is left. Returns a gain node with that shape.
 */
function envelope(
  audio: BaseAudioContext,
  time: number,
  peak: number,
  decay: number,
): GainNode {
  const gain = new GainNode(audio, { gain: 0 })
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(peak, time + 0.001)
  gain.gain.setTargetAtTime(0, time + 0.001, decay / 5)
  return gain
}

/** Noise from the shared buffer, from a random place in it, so two hits never sound the same. */
function noiseSource(hit: Hit): AudioBufferSourceNode {
  const source = new AudioBufferSourceNode(hit.audio, {
    buffer: hit.noise,
    loop: true,
    playbackRate: hit.rate,
  })
  source.start(hit.time, Math.random() * hit.noise.duration)
  return source
}

function oscillator(
  hit: Hit,
  type: OscillatorType,
  frequency: number,
): OscillatorNode {
  const osc = new OscillatorNode(hit.audio, {
    type,
    frequency: frequency * hit.rate,
  })
  osc.start(hit.time)
  return osc
}

/** Bass drum: a sine that falls fast in pitch, and a short click. */
const bassDrum: Voice = {
  label: 'BD',
  name: 'Bass drum',
  params: [
    { name: 'tune', default: 0.35 },
    { name: 'decay', default: 0.5 },
    { name: 'punch', default: 0.5 },
    { name: 'click', default: 0.3 },
  ],
  play(hit) {
    const { audio, time, rate } = hit
    const [tune = 0, decayParam = 0, punch = 0, click = 0] = hit.params
    const sound = createSound(audio)
    const pitch = exp(tune, 38, 90) * rate
    const decay = exp(decayParam, 0.08, 1.4) / rate
    // The pitch starts higher (punch), then falls to the note in about 30 ms.
    const body = sound.add(oscillator(hit, 'sine', pitch))
    body.frequency.setValueAtTime(pitch * exp(punch, 1, 7), time)
    body.frequency.setTargetAtTime(pitch, time, 0.012 / rate)
    const bodyGain = sound.add(envelope(audio, time, 0.75, decay))
    body.connect(bodyGain).connect(hit.output)

    if (click > 0) {
      const noise = sound.add(noiseSource(hit))
      const filter = sound.add(
        new BiquadFilterNode(audio, {
          type: 'highpass',
          frequency: 1200 * rate,
        }),
      )
      const clickGain = sound.add(envelope(audio, time, click * 0.45, 0.01))
      noise.connect(filter).connect(clickGain).connect(hit.output)
    }
    sound.end(time + decay)
  },
}

/** Snare drum: two tones (the drum) and noise through a high pass filter (the snares). */
const snareDrum: Voice = {
  label: 'SD',
  name: 'Snare drum',
  params: [
    { name: 'tune', default: 0.45 },
    { name: 'decay', default: 0.4 },
    { name: 'tone', default: 0.5 },
    { name: 'snappy', default: 0.6 },
  ],
  play(hit) {
    const { audio, time, rate } = hit
    const [tune = 0, decayParam = 0, tone = 0, snappy = 0] = hit.params
    const sound = createSound(audio)
    const pitch = exp(tune, 120, 320) * rate
    const decay = exp(decayParam, 0.06, 0.6) / rate
    const toneDecay = lin(decayParam, 0.06, 0.25) / rate

    const toneGain = sound.add(
      envelope(audio, time, lin(snappy, 0.4, 0.22), toneDecay),
    )
    toneGain.connect(hit.output)
    for (const ratio of [1, 1.47]) {
      const osc = sound.add(oscillator(hit, 'sine', pitch * ratio))
      // A small fall in pitch, like a real drum skin.
      osc.frequency.setValueAtTime(pitch * ratio * 1.25, time)
      osc.frequency.setTargetAtTime(pitch * ratio, time, 0.01 / rate)
      osc.connect(toneGain)
    }

    const noise = sound.add(noiseSource(hit))
    const filter = sound.add(
      new BiquadFilterNode(audio, {
        type: 'highpass',
        frequency: exp(tone, 1200, 8000) * rate,
      }),
    )
    const noiseGain = sound.add(envelope(audio, time, snappy * 0.55, decay))
    noise.connect(filter).connect(noiseGain).connect(hit.output)
    sound.end(time + Math.max(decay, toneDecay))
  },
}

/** Hand clap: 3 fast bursts of noise, then a tail, through a band pass filter. */
const handClap: Voice = {
  label: 'CP',
  name: 'Hand clap',
  params: [
    { name: 'tune', default: 0.45 },
    { name: 'decay', default: 0.35 },
    { name: 'tone', default: 0.4 },
    { name: 'spread', default: 0.4 },
  ],
  play(hit) {
    const { audio, time, rate } = hit
    const [tune = 0, decayParam = 0, tone = 0, spread = 0] = hit.params
    const sound = createSound(audio)
    const decay = exp(decayParam, 0.05, 0.9) / rate
    const gap = exp(spread, 0.004, 0.02) / rate

    const frequency = exp(tune, 600, 2600)
    // Low Q: a wide band, brighter. High Q: a narrow band, more of a "tock".
    const Q = exp(1 - tone, 0.6, 5)
    // A wide band lets more noise through: make it quieter, so all settings are about as loud.
    const level = 1.8 * Math.sqrt((Q * 1500) / frequency)

    const noise = sound.add(noiseSource(hit))
    const filter = sound.add(
      new BiquadFilterNode(audio, {
        type: 'bandpass',
        frequency: frequency * rate,
        Q,
      }),
    )
    const gain = sound.add(new GainNode(audio, { gain: 0 }))
    for (let i = 0; i < 3; i++) {
      const at = time + i * gap
      gain.gain.setValueAtTime(level, at)
      gain.gain.setTargetAtTime(0, at, 0.003 / rate)
    }
    const tail = time + 3 * gap
    gain.gain.setValueAtTime(level * 0.8, tail)
    gain.gain.setTargetAtTime(0, tail, decay / 5)
    noise.connect(filter).connect(gain).connect(hit.output)
    sound.end(tail + decay)
  },
}

/** The 6 square waves of a TR-808 cymbal, in Hz: together they sound like metal. */
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800]

/** A hi-hat (closed or open): metal and noise through a high pass filter. */
function hat(hit: Hit, decay: number) {
  const { audio, time, rate } = hit
  const [tune = 0, , tone = 0, metal = 0] = hit.params
  const sound = createSound(audio)
  const scale = exp(tune, 0.6, 1.7)

  const filter = sound.add(
    new BiquadFilterNode(audio, {
      type: 'highpass',
      frequency: exp(tone, 4000, 12000) * rate,
    }),
  )
  const gain = sound.add(envelope(audio, time, 0.9, decay))
  filter.connect(gain).connect(hit.output)

  if (metal > 0) {
    // The square waves are loud: each one is quiet, and a band pass keeps only their top.
    const mix = sound.add(new GainNode(audio, { gain: metal * 0.35 }))
    const band = sound.add(
      new BiquadFilterNode(audio, {
        type: 'bandpass',
        frequency: 10000 * rate,
        Q: 0.8,
      }),
    )
    for (const frequency of METAL)
      sound.add(oscillator(hit, 'square', frequency * scale)).connect(mix)
    mix.connect(band).connect(filter)
  }
  if (metal < 1) {
    const noise = sound.add(noiseSource(hit))
    const noiseGain = sound.add(new GainNode(audio, { gain: 1 - metal }))
    noise.connect(noiseGain).connect(filter)
  }
  sound.end(time + decay)
}

const hatParams = (decay: number) =>
  [
    { name: 'tune', default: 0.5 },
    { name: 'decay', default: decay },
    { name: 'tone', default: 0.5 },
    { name: 'metal', default: 0.6 },
  ] as const

/** Closed hi-hat: short. It also stops an open hi-hat that still rings (see setup.ts). */
const closedHat: Voice = {
  label: 'CH',
  name: 'Closed hi-hat',
  params: hatParams(0.3),
  play(hit) {
    hat(hit, exp(hit.params[1] ?? 0, 0.02, 0.25) / hit.rate)
  },
}

/** Open hi-hat: long. */
const openHat: Voice = {
  label: 'OH',
  name: 'Open hi-hat',
  params: hatParams(0.4),
  play(hit) {
    hat(hit, exp(hit.params[1] ?? 0, 0.1, 1.6) / hit.rate)
  },
}

/**
 * Rim shot: two tones far apart (like the TR-808's 455 and 1667 Hz), a click, and a high pass
 * filter, all very short. Turn tone down, tune down and decay up: it becomes a tom.
 */
const rimShot: Voice = {
  label: 'RS',
  name: 'Rim shot',
  params: [
    { name: 'tune', default: 0.55 },
    { name: 'decay', default: 0.15 },
    { name: 'tone', default: 0.6 },
    { name: 'snap', default: 0.5 },
  ],
  play(hit) {
    const { audio, time, rate } = hit
    const [tune = 0, decayParam = 0, tone = 0, snap = 0] = hit.params
    const sound = createSound(audio)
    const pitch = exp(tune, 90, 900) * rate
    const decay = exp(decayParam, 0.015, 0.8) / rate
    // A long decay falls in pitch a little, like a tom. A short one does not need to.
    const fall = 1 + decayParam * 0.4

    // The high pass only takes away the boom under the low tone.
    const filter = sound.add(
      new BiquadFilterNode(audio, { type: 'highpass', frequency: pitch * 0.6 }),
    )
    filter.connect(hit.output)

    const low = sound.add(oscillator(hit, 'sine', pitch))
    low.frequency.setValueAtTime(pitch * fall, time)
    low.frequency.setTargetAtTime(pitch, time, 0.03 / rate)
    const lowGain = sound.add(envelope(audio, time, 0.6, decay))
    low.connect(lowGain).connect(filter)

    if (tone > 0) {
      const high = sound.add(oscillator(hit, 'sine', pitch * 3.66))
      const highGain = sound.add(
        envelope(audio, time, tone * 0.35, Math.min(decay, 0.08 / rate)),
      )
      high.connect(highGain).connect(filter)
    }

    if (snap > 0) {
      const noise = sound.add(noiseSource(hit))
      const band = sound.add(
        new BiquadFilterNode(audio, {
          type: 'bandpass',
          frequency: 4000 * rate,
          Q: 1,
        }),
      )
      const snapGain = sound.add(envelope(audio, time, snap * 0.6, 0.012))
      noise.connect(band).connect(snapGain).connect(hit.output)
    }
    sound.end(time + Math.max(decay, 0.02))
  },
}

/** The drums, channel 1 first. */
export const VOICES: readonly Voice[] = [
  bassDrum,
  snareDrum,
  handClap,
  closedHat,
  openHat,
  rimShot,
]

/** The channels of the two hi-hats: a closed one stops an open one. */
export const CLOSED_HAT = VOICES.indexOf(closedHat)
export const OPEN_HAT = VOICES.indexOf(openHat)

/** White noise, 1 second. Made once per drum machine, shared by all its hits. */
export function createNoise(audio: BaseAudioContext): AudioBuffer {
  const buffer = new AudioBuffer({
    length: audio.sampleRate,
    sampleRate: audio.sampleRate,
  })
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

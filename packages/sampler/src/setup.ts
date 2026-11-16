import { defineModuleSetup } from '@loop/core'
import { decodeSound, encodeSound, type SavedSound } from './sound'

/** The number of sample channels. */
export const CHANNELS = 6
/** A recording stops by itself after this many seconds. */
export const MAX_SECONDS = 5
/** The start and end markers are always at least this far apart (part of the whole sound). */
const MIN_GAP = 0.02

/** One channel: a recorded sound, and the part of it that plays (from `start` to `end`, 0 to 1). */
interface Channel {
  buffer: AudioBuffer | null
  start: number
  end: number
  /** The sound as text for the project file. Made once per sound, because it is slow. */
  saved: SavedSound | null
}

export interface SamplerOptions {
  /** The channel that is shown and plays (0 to 5). Default: 0. */
  active?: number
  /** One entry per channel. null: the channel is empty. */
  channels?: ({ sound: SavedSound; start: number; end: number } | null)[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/**
 * Audio: records the microphone into one of 6 channels, and plays the part between the markers.
 * The microphone is never sent to the output, so it cannot make feedback.
 */
export const setup = defineModuleSetup((ctx, options: SamplerOptions = {}) => {
  const { audio } = ctx
  const output = new GainNode(audio, { gain: 1 })
  // Listens to the output, for the level meter in the picture.
  const outputAnalyser = new AnalyserNode(audio, { fftSize: 1024 })
  output.connect(outputAnalyser)

  // Options can come from a saved project file, so check everything.
  let active = isNumber(options.active) ? clamp(Math.round(options.active), 0, CHANNELS - 1) : 0
  const channels: Channel[] = Array.from({ length: CHANNELS }, (_, i) => {
    const saved = Array.isArray(options.channels) ? options.channels[i] : null
    const buffer = saved ? decodeSound(saved.sound) : null
    if (!saved || !buffer) return { buffer: null, start: 0, end: 1, saved: null }
    const start = isNumber(saved.start) ? clamp(saved.start, 0, 1 - MIN_GAP) : 0
    const end = isNumber(saved.end) ? clamp(saved.end, start + MIN_GAP, 1) : 1
    return { buffer, start, end, saved: saved.sound }
  })

  // The UI listens here for things that are not saved: recording, playing, messages.
  const listeners = new Set<() => void>()
  const update = () => listeners.forEach((listener) => listener())

  /** A short message for the user, for example when there is no microphone. */
  let message = ''

  // ——— Recording ———

  interface Recording {
    stream: MediaStream
    recorder: MediaRecorder
    analyser: AnalyserNode
    source: MediaStreamAudioSourceNode
    began: number
    timer: ReturnType<typeof setTimeout>
    channel: number
  }
  let recording: Recording | null = null
  /** True from the click on "rec" until the new sound is ready. */
  let busy = false
  const samples = new Float32Array(1024)

  /** The audio context only runs after a click. Recording and playing need it to run. */
  const wake = () => {
    if (audio instanceof AudioContext && audio.state === 'suspended') void audio.resume()
  }

  /** Start to record into the active channel. */
  const record = async () => {
    if (busy) return
    busy = true
    message = ''
    stop()
    wake()
    update()
    try {
      if (!(audio instanceof AudioContext)) throw new Error('No live audio context')
      // Turn off the phone-call cleaning: it changes the sound.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      if (ctx.signal.aborted || !busy) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      // MediaRecorder keeps the sound. The analyser only shows the level while recording.
      const source = new MediaStreamAudioSourceNode(audio, { mediaStream: stream })
      const analyser = new AnalyserNode(audio, { fftSize: 1024 })
      source.connect(analyser)
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      const channel = active
      recorder.ondataavailable = (event) => chunks.push(event.data)
      recorder.onstop = () => void finish(new Blob(chunks, { type: recorder.mimeType }), channel)
      recorder.start()
      recording = {
        stream, recorder, analyser, source, channel,
        began: performance.now(),
        timer: setTimeout(() => stopRecording(), MAX_SECONDS * 1000),
      }
    } catch {
      busy = false
      message = 'mic unavailable'
    }
    update()
  }

  /** Stop the recording. The new sound is ready a moment later. */
  const stopRecording = () => {
    const current = recording
    if (!current) {
      busy = false
      update()
      return
    }
    recording = null
    clearTimeout(current.timer)
    current.source.disconnect()
    if (current.recorder.state !== 'inactive') current.recorder.stop()
    current.stream.getTracks().forEach((track) => track.stop())
    update()
  }

  /** Turn the recorded file into sound, and put it in its channel. */
  const finish = async (blob: Blob, channel: number) => {
    try {
      const decoded = await audio.decodeAudioData(await blob.arrayBuffer())
      if (ctx.signal.aborted) return
      // One channel (mono): the average of the microphone's channels.
      const mono = new AudioBuffer({ length: decoded.length, sampleRate: decoded.sampleRate })
      const data = mono.getChannelData(0)
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        const input = decoded.getChannelData(c)
        for (let i = 0; i < data.length; i++) data[i]! += input[i]! / decoded.numberOfChannels
      }
      // Start just before the first loud part, so a click on "play" is not silent at first.
      let peak = 0
      for (const value of data) peak = Math.max(peak, Math.abs(value))
      const first = data.findIndex((value) => Math.abs(value) > peak * 0.08)
      channels[channel] = {
        buffer: mono,
        start: clamp(Math.max(0, first) / data.length - 0.01, 0, 1 - MIN_GAP),
        end: 1,
        saved: encodeSound(mono),
      }
      ctx.changed()
    } catch {
      message = 'recording failed'
    }
    busy = false
    update()
  }

  // ——— Playing ———

  interface Playing { source: AudioBufferSourceNode; began: number; offset: number; length: number; channel: number }
  /** The sound from the play button (it says "stop" while this plays). */
  let pressed: Playing | null = null
  /** The newest sound of each channel, from the play button or a trigger: the picture shows it. */
  const latest: (Playing | null)[] = Array.from({ length: CHANNELS }, () => null)

  /** Play a channel from its start marker to its end marker, at an exact audio time. */
  const trigger = (channel: number, time = audio.currentTime): Playing | null => {
    const { buffer, start, end } = channels[channel] ?? {}
    if (!buffer || start === undefined || end === undefined) return null
    const source = new AudioBufferSourceNode(audio, { buffer })
    source.connect(output)
    const offset = start * buffer.duration
    const length = Math.max(0.01, (end - start) * buffer.duration)
    source.start(time, offset, length)
    const started = { source, began: time, offset, length, channel }
    latest[channel] = started
    source.onended = () => {
      source.disconnect()
      if (latest[channel] === started) latest[channel] = null
    }
    return started
  }

  /** Play the active channel once (the play button). */
  const play = () => {
    if (recording || busy) return
    stop()
    wake()
    const started = trigger(active)
    if (!started) return
    pressed = started
    started.source.addEventListener('ended', () => {
      if (pressed !== started) return
      pressed = null
      update()
    })
    update()
  }

  /** Stop the sound from the play button. */
  const stop = () => {
    if (!pressed) return
    const { source } = pressed
    pressed = null
    source.stop()
    update()
  }

  // Triggers from modules before this one in the chain (for example a sequencer): play that channel
  // at that time. The play button does not change; the picture shows it (see nowPlaying).
  ctx.onTrigger(({ channel, time }) => void trigger(channel, time))

  ctx.onDispose(() => {
    busy = false
    stopRecording()
    stop()
  })

  /** Move a marker. The start stays before the end. */
  const setMarker = (which: 'start' | 'end', value: number) => {
    const channel = channels[active]!
    if (!channel.buffer) return
    if (which === 'start') channel.start = clamp(value, 0, channel.end - MIN_GAP)
    else channel.end = clamp(value, channel.start + MIN_GAP, 1)
    ctx.changed()
  }

  return {
    output,
    get active() {
      return active
    },
    /** Show another channel. Not while recording. */
    setActive(channel: number) {
      if (recording || busy || channel === active || !channels[channel]) return
      stop()
      active = channel
      ctx.changed()
      update()
    },
    /** The active channel's sound (null: empty), and where its markers are (0 to 1). */
    get sound() {
      const { buffer, start, end } = channels[active]!
      return { buffer, start, end }
    },
    /** Any channel's sound (null: empty), and where its markers are (0 to 1). */
    soundOf(channel: number) {
      const { buffer = null, start = 0, end = 1 } = channels[channel] ?? {}
      return { buffer, start, end }
    },
    /** True if the channel has a sound. */
    hasSound: (channel: number) => !!channels[channel]?.buffer,
    setStart: (value: number) => setMarker('start', value),
    setEnd: (value: number) => setMarker('end', value),

    /** True from the click on "rec" until the new sound is ready. */
    get recording() {
      return busy
    },
    /** Seconds since the recording began. */
    get recordedSeconds() {
      return recording ? (performance.now() - recording.began) / 1000 : 0
    },
    /** The microphone's loudest sample just now, 0 to 1. */
    level() {
      if (!recording) return 0
      recording.analyser.getFloatTimeDomainData(samples)
      let peak = 0
      for (const value of samples) peak = Math.max(peak, Math.abs(value))
      return Math.min(1, peak)
    },
    /** The loudest sample of the sampler's own sound just now, 0 to 1. */
    outputLevel() {
      outputAnalyser.getFloatTimeDomainData(samples)
      let peak = 0
      for (const value of samples) peak = Math.max(peak, Math.abs(value))
      return Math.min(1, peak)
    },
    record,
    stopRecording,

    /** True while the sound from the play button plays. */
    get playing() {
      return !!pressed
    },
    /**
     * The active channel's sound that plays now (from the play button or a trigger), or null:
     * nothing plays on it (or it has not started yet). `at`: where it is, 0 to 1 of the whole sound.
     * `progress`: how much of the cut has played, 0 to 1.
     */
    nowPlaying() {
      const sound = latest[active]
      if (!sound || audio.currentTime < sound.began) return null
      const duration = sound.source.buffer!.duration
      const played = clamp(audio.currentTime - sound.began, 0, sound.length)
      return { at: (sound.offset + played) / duration, progress: played / sound.length }
    },
    play,
    stop,
    /** Play any channel at an exact audio time (for example from a sequencer). */
    trigger: (channel: number, time?: number) => void trigger(channel, time),

    get message() {
      return message
    },
    /** Call `listener` when recording, playing or the message changes. Returns a function that stops it. */
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /** Saved with the project. Comes back as `options` when the project loads. */
    save: (): SamplerOptions => ({
      active,
      channels: channels.map(({ saved, start, end }) => (saved ? { sound: saved, start, end } : null)),
    }),
  }
})

// The module guide: one page per module (see the /modules routes in app.ts).
// Plain data only. app.ts runs in the service worker, so this file must not import the module
// packages (they make audio nodes). `type` is the module's `type` (see modules.ts) and its URL.
//
// How to write it:
// - Short. The reader knows what a delay or a mixer is: do not explain it. Say what this module
//   does in 1 to 3 sentences, then how to use it. No background, no pictures in words, no fluff.
// - ASD-STE100 Simplified Technical English (https://github.com/danyuchn/asd-ste100-skill):
//   one instruction per sentence, imperative steps, active voice, simple tenses, no phrasal verbs
//   ("plug into", "take away"), no semicolons.
// - One word, one meaning: connect (a cable), click (a button or a box), drag (a slider or a
//   marker), remove (a module or a step), erase (a project: the library's button).

/** A jack on the module (the cables are in the patchbay). */
export interface JackDoc {
  /** The name the patchbay shows, for example 'In' or '1–6' (a group of 6 jacks, one per channel). */
  readonly name: string
  readonly direction: 'in' | 'out'
  /** What goes through it: sound, or 6 channels of sound (6 jacks). */
  readonly kind: 'audio' | 'channels'
  readonly text: string
}

export interface ModuleDoc {
  /** The module's `type`, also its URL: /modules/<type>. */
  readonly type: string
  readonly name: string
  /** What it does: 1 to 3 short sentences. Also shown in the list of modules. */
  readonly summary: string
  /** How to use it, one step each. */
  readonly howTo: readonly string[]
  /** None: not in the core, so it has no jacks (the patchbay and the library). */
  readonly jacks?: readonly JackDoc[]
  /** Only what the reader must know and cannot see. */
  readonly tips?: readonly string[]
  /** What the page shows, under the docs. Default: the module alone, no cables, no sound. */
  readonly note?: string
}

const defineModuleDoc = (doc: ModuleDoc): ModuleDoc => doc

const master = defineModuleDoc({
  type: 'master',
  name: 'Master',
  summary:
    'Master sends the sound to the speakers. It controls the playback: start, stop and rewind. It also sets the volume of the output.',
  howTo: [
    'Click play to start. Click play again to stop.',
    'Click rew to rewind to the start. Click rew again to stop the rewind.',
    'Drag vol to set the volume.',
  ],
  jacks: [
    { name: 'In', direction: 'in', kind: 'audio', text: 'The sound to play.' },
  ],
  tips: ['A project can have only one Master.'],
})

const metronome = defineModuleDoc({
  type: 'metronome',
  name: 'Metronome',
  summary:
    'The metronome ticks on each beat. Its tempo slider sets the tempo of the whole project.',
  howTo: [
    'Connect Out to Master to hear the ticks.',
    'Drag Tempo to set the BPM (20 to 300).',
    'Click mute to stop the ticks.',
  ],
  jacks: [{ name: 'Out', direction: 'out', kind: 'audio', text: 'The ticks.' }],
})

const sampler = defineModuleDoc({
  type: 'sampler',
  name: 'Sampler',
  summary:
    'The sampler records up to 5 seconds from the microphone on each of its 6 channels. Its sequencer plays the channels in a pattern of 16 steps.',
  howTo: [
    'Click a channel number (1 to 6).',
    'Click rec to record. Click rec again to stop.',
    'Drag the markers to cut the sound.',
    'Click play to hear the cut sound.',
    'Click a box in the sequencer to add or remove a step.',
    'Each row of the sequencer plays the channel with the same number.',
  ],
  jacks: [
    {
      name: '1–6',
      direction: 'out',
      kind: 'channels',
      text: 'One jack for each channel. Connect all 6 to a mixer, or connect one channel to any input.',
    },
  ],
  tips: ['The arrow keys also move a marker.'],
})

const mixer = defineModuleDoc({
  type: 'mixer',
  name: 'Mixer',
  summary:
    'The mixer mixes 6 channels into one output. Each channel has a volume and two sends, A and B, for effects.',
  howTo: [
    'Connect 1–6 of a sampler to 1–6.',
    'Drag the slider of a channel to set its volume.',
    'Click MSR to remove a channel from the output. Its sends continue.',
    'Click →A or →B to send a channel to that bus.',
    'Connect Snd A to the In jack of an effect. Connect the Out jack of the effect to Rtn A.',
    'Drag SND to set the send level. Drag RTN to set the return level.',
  ],
  jacks: [
    {
      name: '1–6',
      direction: 'in',
      kind: 'channels',
      text: 'One jack for each channel. Connect a sampler, or connect any sound to one channel.',
    },
    {
      name: 'Rtn A, Rtn B',
      direction: 'in',
      kind: 'audio',
      text: 'The sound from the effects.',
    },
    { name: 'Out', direction: 'out', kind: 'audio', text: 'The mix.' },
    {
      name: 'Snd A, Snd B',
      direction: 'out',
      kind: 'audio',
      text: 'The sends, to the effects.',
    },
  ],
})

const delay = defineModuleDoc({
  type: 'delay',
  name: 'Delay',
  summary: 'The delay repeats the sound in time with the tempo.',
  howTo: [
    'Connect it to a send and return of the mixer.',
    'Drag dry/wet to set the level of the echoes.',
    'Drag feedback to set the number of echoes.',
    'Drag rate to set the time between echoes, as a note length. t is triplet, d is dotted.',
  ],
  jacks: [
    {
      name: 'In',
      direction: 'in',
      kind: 'audio',
      text: 'The sound to repeat.',
    },
    {
      name: 'Out',
      direction: 'out',
      kind: 'audio',
      text: 'The sound with the echoes.',
    },
  ],
  tips: ['On a mixer send, drag dry/wet fully to wet.'],
})

const lpFilter = defineModuleDoc({
  type: 'lp-filter',
  name: 'Low pass',
  summary: 'The low pass filter removes the high frequencies.',
  howTo: [
    'Connect a sound to In. Connect Out to the next module.',
    'Drag the left slider to set the cutoff.',
    'Drag the right slider to set the resonance.',
    'Select 12db or 24db for the slope.',
    'Click bypass to hear the sound without the filter.',
  ],
  jacks: [
    {
      name: 'In',
      direction: 'in',
      kind: 'audio',
      text: 'The sound to filter.',
    },
    {
      name: 'Out',
      direction: 'out',
      kind: 'audio',
      text: 'The filtered sound.',
    },
  ],
})

const vuMeter = defineModuleDoc({
  type: 'vu-meter',
  name: 'VU meter',
  summary:
    'The VU meter shows the level of a sound, left and right. It makes no sound.',
  howTo: [
    'Connect a sound to In.',
    'Keep the needles near 0 VU. Red is too loud.',
  ],
  jacks: [
    {
      name: 'In',
      direction: 'in',
      kind: 'audio',
      text: 'The sound to measure.',
    },
  ],
  tips: [
    'One output can connect to many inputs. Connect the same sound to Master and to the VU meter.',
  ],
})

const patchbay = defineModuleDoc({
  type: 'patchbay',
  name: 'Patchbay',
  summary:
    'The patchbay adds and removes modules. It connects the modules with cables, in a grid.',
  howTo: [
    'Click add and select a module. The module gets the usual cables.',
    'In the grid, each row is an output and each column is an input.',
    'Click a box to connect a cable. Click it again to disconnect it.',
    'A row or column with + is a group of channels. Its box connects all of them. Click + to see each channel on its own.',
    'A half-checked box: some of the channels are connected.',
    'A grey box cannot connect. Point to it to see why.',
    'Click remove. Click a module to remove it. Click done or press Esc to stop.',
  ],
  note: 'On this page, the patchbay shows a new project. Remove works only in the studio. This page saves nothing.',
})

const library = defineModuleDoc({
  type: 'library',
  name: 'Library',
  summary:
    'The library keeps your projects in this browser, as cassette tapes. It saves each change automatically.',
  howTo: [
    'Type in Name to rename the open project.',
    'Scroll the tapes, or use the arrow keys. The tape in the middle is picked.',
    'Click the picked tape, or click open, to open the project.',
    'Click new to start a blank project.',
    'Click × to erase the picked project. You cannot undo this.',
    'Click export to save the open project as a file. Click import to open a file.',
  ],
  tips: [
    'If the browser clears its data, your projects are gone. Export the projects that you want to keep.',
  ],
  note: 'On this page, the library shows example projects. Nothing here changes your real projects.',
})

/** All module docs: the modules as in `availableModules` (modules.ts), then the two that are not
 * in the core, in the order the studio shows them. */
export const moduleDocs: readonly ModuleDoc[] = [
  master,
  metronome,
  sampler,
  mixer,
  delay,
  lpFilter,
  vuMeter,
  patchbay,
  library,
]

export const moduleDocOf = (type: string) =>
  moduleDocs.find((doc) => doc.type === type)

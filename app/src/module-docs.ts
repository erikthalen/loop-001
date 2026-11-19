// The module guide: one page per module (see the /modules routes in app.ts).
// Plain data only. app.ts runs in the service worker, so this file must not import the module
// packages (they make audio nodes). `type` is the module's `type` (see modules.ts) and its URL.
//
// The copy follows ASD-STE100 Simplified Technical English (https://github.com/danyuchn/asd-ste100-skill):
// - Steps (howTo): one instruction per sentence, imperative, 20 words or fewer per sentence.
// - Other text: 25 words or fewer per sentence, active voice, simple tenses.
// - No phrasal verbs ("plug into", "take away"), no semicolons, no sentences without a verb.
// - One word, one meaning. Use these words, and only for this:
//     sound (audio)   connect / disconnect (a cable)   jack (a socket for a cable)
//     click (a button or a box)   drag (a slider or a marker)   clock (what Master starts)
//     project (a saved studio; "tape" only as the library's picture of it)
//     remove (a module or a step)   erase (a project: the library's button)

/** A jack on the module (the cables are in the patchbay). */
export interface JackDoc {
  /** The name the patchbay shows, for example 'In' or 'Ch 1–6'. */
  readonly name: string
  readonly direction: 'in' | 'out'
  /** What goes through it: sound, 6 channels of sound, or triggers. */
  readonly kind: 'audio' | 'channels' | 'trigger'
  readonly text: string
}

export interface ModuleDoc {
  /** The module's `type`, also its URL: /modules/<type>. */
  readonly type: string
  readonly name: string
  /** One or two sentences: what it is. */
  readonly summary: string
  /** What it does, one paragraph each. */
  readonly about: readonly string[]
  /** How to use it, one step each. */
  readonly howTo: readonly string[]
  /** None: not in the core, so it has no jacks (the patchbay and the library). */
  readonly jacks?: readonly JackDoc[]
  /** Good to know, one tip each. */
  readonly tips?: readonly string[]
  /** What the page shows, under the docs. Default: the module alone, no cables, no sound. */
  readonly note?: string
}

const defineModuleDoc = (doc: ModuleDoc): ModuleDoc => doc

const master = defineModuleDoc({
  type: 'master',
  name: 'Master',
  summary:
    'Master is the last module in the studio. It starts, stops and rewinds the clock, and it sets the volume.',
  about: [
    'Master is the end of the sound. All the sound goes into its In jack. Master sends this sound to your speakers.',
    'Master also controls the clock. All the other modules obey the clock. When the clock runs, the sequencer plays its steps, the metronome ticks, and the delay echoes on the beat.',
    'Master records the sound that you hear. When you rewind, Master plays this recording backwards, like a tape machine.',
  ],
  howTo: [
    'Click play to start the clock.',
    'Click play again to stop the clock. The sound becomes slower before it stops.',
    'Click rew to rewind to the start. During the rewind, you hear the recording backwards.',
    'To stop the rewind at its current position, click rew again.',
    'Drag vol to set the volume of all the sound.',
  ],
  jacks: [
    {
      name: 'In',
      direction: 'in',
      kind: 'audio',
      text: 'All the sound of the studio. Master sends it to the speakers.',
    },
  ],
  tips: [
    'A project can have only one Master.',
    'Without a Master, you hear no sound. You also have no play button.',
  ],
})

const metronome = defineModuleDoc({
  type: 'metronome',
  name: 'Metronome',
  summary:
    'The metronome ticks on each beat. It also sets the tempo of the studio.',
  about: [
    'The metronome plays a short tick on each beat. The tick on the first beat of each bar is higher.',
    'The tempo slider sets the tempo of the whole studio. When you change it, all the modules use the new tempo. This includes the sequencer, the delay and the Master recording.',
    'The picture shows the tempo. It swings on each beat, also when you mute the ticks.',
  ],
  howTo: [
    'To hear the ticks, connect Out to the In jack of Master.',
    'Drag Tempo to set the beats per minute, from 20 to 300.',
    'Click mute to stop the ticks. The tempo slider continues to work.',
  ],
  jacks: [{ name: 'Out', direction: 'out', kind: 'audio', text: 'The ticks.' }],
  tips: [
    'The ticks change with the speed of the clock. When the clock becomes slower, the ticks become lower and longer.',
  ],
})

const sequencer = defineModuleDoc({
  type: 'sequencer',
  name: 'Sequencer',
  summary:
    'The sequencer has 6 channels of 16 steps. It tells other modules when to play.',
  about: [
    'The sequencer makes no sound. On each step, it sends a trigger for each channel that is on. A trigger is a message that tells a module to play now.',
    'It has 6 rows, one for each channel. Each row has 16 steps, which make one bar of 16th notes. Each row has the same color as its channel in the sampler and the mixer.',
    'The line at the top grows to show the position of the clock in the bar. A frame shows the step that plays now.',
  ],
  howTo: [
    'Connect the Trig jack of the sequencer to the Trig jack of a sampler.',
    'Click an empty box to add a step.',
    'Click a checked box to remove the step.',
    'Click play on Master. Row 1 plays channel 1 of the sampler. Row 2 plays channel 2, and so on.',
  ],
  jacks: [
    {
      name: 'Trig',
      direction: 'out',
      kind: 'trigger',
      text: 'One trigger for each step that is on. Each trigger has its channel number.',
    },
  ],
  tips: [
    'For a first pattern, put a kick drum on steps 1, 5, 9 and 13. Musicians call this pattern "four on the floor".',
  ],
})

const sampler = defineModuleDoc({
  type: 'sampler',
  name: 'Sampler',
  summary:
    'The sampler records short sounds from your microphone. Then it plays them.',
  about: [
    'The sampler has 6 channels. Each channel holds one recording of up to 5 seconds.',
    'The sampler looks like a tape machine. The two markers are like scissors. Only the part between the markers plays.',
    'A trigger plays the sound on its channel. For example, a trigger on channel 3 plays the sound on channel 3.',
  ],
  howTo: [
    'Click a channel number (1 to 6) to select a channel.',
    'Click rec to start the recording.',
    'Make a sound.',
    'Click rec again to stop the recording. After 5 seconds, the recording stops automatically.',
    'Click play to hear the sound on this channel.',
    'Drag the start marker and the end marker to cut the sound.',
    'To move a marker with the keyboard, click the marker. Then use the arrow keys.',
    'Hold Shift for bigger steps. Home and End move the marker to the start or the end.',
    'To play the sounds in a pattern, connect Ch 1–6 to a mixer.',
    'Then connect the Trig jack of a sequencer to the Trig jack of the sampler.',
  ],
  jacks: [
    {
      name: 'Trig',
      direction: 'in',
      kind: 'trigger',
      text: 'Each trigger plays the sound on its channel.',
    },
    {
      name: 'Ch 1–6',
      direction: 'out',
      kind: 'channels',
      text: 'The cable carries each channel separately. A mixer can then set each channel.',
    },
  ],
  tips: [
    'The first time you record, the browser asks for permission to use the microphone.',
    'The sampler never sends the microphone to the speakers. Thus you get no feedback (a loud howl).',
    'The recordings are part of the project. The library saves them with the project.',
  ],
})

const mixer = defineModuleDoc({
  type: 'mixer',
  name: 'Mixer',
  summary:
    'The mixer mixes 6 channels into one sound. It has two sends for effects.',
  about: [
    'The mixer gets 6 channels on one cable, for example from a sampler. It sets the volume of each channel and adds the channels together.',
    'Each channel can also go to two send buses, A and B. A send bus is a path to an effect, for example a delay. The sound from the effect returns on the return jack of that bus.',
    'The sends come after the volume slider. Thus, when a channel is quieter, it also sends less.',
  ],
  howTo: [
    'Connect Ch 1–6 of a sampler to Ch 1–6 of the mixer.',
    'Drag the slider of a channel to set its volume.',
    'To remove a channel from the mix, click its MSR box to clear it. You then hear only the effects of that channel.',
    'To send a channel to a bus, click its →A box or its →B box.',
    'Connect Snd A to the In jack of an effect.',
    'Connect the Out jack of the effect to Rtn A.',
    'Do the same steps for bus B.',
    'Drag SND to set how much sound goes to the effect.',
    'Drag RTN to set how much sound returns from the effect.',
    'Connect Out to the next module, for example a low pass filter or Master.',
  ],
  jacks: [
    {
      name: 'Ch 1–6',
      direction: 'in',
      kind: 'channels',
      text: 'The 6 channels that the mixer mixes.',
    },
    {
      name: 'Rtn A, Rtn B',
      direction: 'in',
      kind: 'audio',
      text: 'The sound that returns from the effect on each bus.',
    },
    { name: 'Out', direction: 'out', kind: 'audio', text: 'The mixed sound.' },
    {
      name: 'Snd A, Snd B',
      direction: 'out',
      kind: 'audio',
      text: 'The channels that go to each bus, for an effect.',
    },
  ],
})

const delay = defineModuleDoc({
  type: 'delay',
  name: 'Delay',
  summary: 'The delay makes echoes on the beat.',
  about: [
    'The delay repeats the sound that comes in. Each echo comes one note length after the last one. Thus the echoes stay on the beat at all tempos.',
    'Each echo returns into the delay and makes the next echo. More feedback gives more echoes.',
    'The picture shows the echoes over one bar.',
  ],
  howTo: [
    'Connect Snd A of a mixer to the In jack of the delay.',
    'Connect the Out jack of the delay to Rtn A of the mixer.',
    'Drag dry/wet to set the mix. At the left, you hear only the sound that comes in. At the right, you hear only the echoes.',
    'Drag feedback to set how many echoes you hear.',
    'Drag rate to set the time between echoes, from a 1/32 note to a 1/2 note.',
    'In the rate names, "t" means triplet and "d" means dotted.',
  ],
  jacks: [
    {
      name: 'In',
      direction: 'in',
      kind: 'audio',
      text: 'The sound that the delay repeats.',
    },
    {
      name: 'Out',
      direction: 'out',
      kind: 'audio',
      text: 'The sound and its echoes. Dry/wet sets the mix of the two.',
    },
  ],
  tips: [
    'On a mixer send, drag dry/wet fully to the right. The mixer already sends the dry sound to its output.',
    'When you change the rate, the echoes glide to the new time, like a tape delay.',
  ],
})

const lpFilter = defineModuleDoc({
  type: 'lp-filter',
  name: 'Low pass',
  summary:
    'The low pass filter stops the high sounds. It sounds like music from next door.',
  about: [
    'A low pass filter passes the low sounds and stops the high sounds.',
    'Think of music from next door. The wall stops the high sounds, so you hear only the bass. The picture shows this with a speaker, a wall and an ear.',
    'The cutoff is the frequency where the filter starts to work. Resonance adds a peak at the cutoff. This peak makes the sound sharper.',
  ],
  howTo: [
    'Connect a sound to In.',
    'Connect Out to the next module.',
    'Drag the left slider (cutoff) down to stop more of the high sounds.',
    'Drag the right slider (resonance) up to add a peak at the cutoff.',
    'Select 12db for a soft filter, or 24db for a steep filter.',
    'Click bypass to hear the sound without the filter.',
  ],
  jacks: [
    {
      name: 'In',
      direction: 'in',
      kind: 'audio',
      text: 'The sound that the filter changes.',
    },
    {
      name: 'Out',
      direction: 'out',
      kind: 'audio',
      text: 'The filtered sound.',
    },
  ],
  tips: [
    'While the music plays, move the cutoff slowly. This makes a build-up.',
  ],
})

const vuMeter = defineModuleDoc({
  type: 'vu-meter',
  name: 'VU meter',
  summary:
    'The VU meter shows how loud the sound is on the left and on the right.',
  about: [
    'The VU meter only measures. It makes no sound and has no output.',
    'Two needles show the level of the left side and the right side, from −20 to +3 VU. Under the needles, two bars show the fast level and the peak.',
    'Green is OK, yellow is loud, and red is too loud.',
  ],
  howTo: [
    'Connect the sound that you want to measure to In.',
    'You can connect one output to many inputs. For example, connect the same output to Master and to the VU meter.',
    'Set the volumes so that the needles stay near 0. The needles must only touch the red.',
  ],
  jacks: [
    {
      name: 'In',
      direction: 'in',
      kind: 'audio',
      text: 'The sound that the meter measures.',
    },
  ],
  tips: [
    '0 VU is −18 dBFS (decibels below full scale). This is the usual level in a studio.',
  ],
})

const patchbay = defineModuleDoc({
  type: 'patchbay',
  name: 'Patchbay',
  summary:
    'In the patchbay, you add modules, remove modules and connect cables.',
  about: [
    'In a real studio, the patchbay is a wall of jacks. Here, the patchbay shows the cables as a grid of boxes.',
    'Each row is an output. Each column is an input. A checked box is a cable from that output to that input.',
    'The patchbay has one grid for each type of cable: sound, 6 channels and triggers. Each row has the cable color of its module.',
    'In the studio, the patchbay is always below the last module. You cannot move it, remove it or connect it. The library does not save it in a project.',
  ],
  howTo: [
    'Click add and select a module.',
    'The module appears at the end of the studio. The patchbay connects its usual cables automatically.',
    'To connect a cable, click the box where the output row meets the input column.',
    'To disconnect the cable, click the box again.',
    'You cannot click a grey box. To see the reason, move the pointer onto the box.',
    'To remove modules, click remove. The modules start to shake.',
    'Click a module to remove it.',
    'To stop, click done or press Esc.',
  ],
  tips: [
    'A project can have only one Master. When the project has a Master, Master is grey in the add list.',
    'You can connect one output to many inputs. For example, connect the low pass filter to Master and to the VU meter.',
  ],
  note: 'On this page, the patchbay shows the cables of a new project. The modules do not show, and nothing plays. When you add a module, it appears in the grid. Remove works only in the studio, because there you can click the modules. This page saves nothing.',
})

const library = defineModuleDoc({
  type: 'library',
  name: 'Library',
  summary:
    'The library holds your projects. It shows them as tapes on a shelf.',
  about: [
    'Each project is a tape. The open project is the tape on the machine. The shelf holds all your projects.',
    'The library saves each change that you make in the studio. The status next to the name shows if the save is complete.',
    'The library keeps your projects only in this browser. To keep a copy, or to move a project to a different computer, export it.',
    'In the studio, the library is always at the bottom. It is not a module in a project, because it holds the projects.',
  ],
  howTo: [
    'To change the name of the open project, type a new name in Name.',
    'Press Enter, or click outside the field. The library writes the new name on the project.',
    'To open a different project, click it on the shelf. The studio changes to that project.',
    'To start a blank project, click new.',
    'To erase a project, click × next to it. The library asks you first, because you cannot undo an erase.',
    'To download the open project as a file (.loop.json), click export.',
    'To add a project from a file, click import.',
  ],
  tips: [
    'You cannot undo an erase. If you want a copy of a project, export it first.',
    'If the browser clears its site data, your projects are gone. Export the projects that are important to you.',
  ],
  note: 'On this page, the library shows example projects. They are not real. Try all the controls. Nothing on this page changes your real projects. When you leave the page, the examples disappear.',
})

/** All module docs: the modules as in `availableModules` (modules.ts), then the two that are not
 * in the core, in the order the studio shows them. */
export const moduleDocs: readonly ModuleDoc[] = [
  master,
  metronome,
  sequencer,
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

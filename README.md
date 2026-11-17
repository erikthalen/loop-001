# loop-001

pnpm monorepo.

- `app/` – the PWA (Hono running inside a service worker, built with Vite)
- `packages/core` – `@loop/core`: AudioContext, clock, event bus, module system
- `packages/master` – `@loop/master`: play / stop and the master volume, HTML only; it makes no sound
- `packages/metronome` – `@loop/metronome`: test module, ticks on every beat
- `packages/lp-filter` – `@loop/lp-filter`: a low pass filter; the picture is "music from next door": a wall between a speaker and an ear lets only the low sounds through
- `packages/sequencer` – `@loop/sequencer`: a step sequencer (6 channels, 16 steps); it makes no sound, it only sends triggers to the modules after it
- `packages/mixer` – `@loop/mixer`: mixes the 6 channels of a sampler before it: a volume and two sends (A, B) per channel, and two send buses (send and return) ready for effects
- `packages/sampler` – `@loop/sampler`: records up to 5 seconds from the microphone into 6 channels, shown as a tape machine with scissors to cut the sound
- `packages/vu-meter` – `@loop/vu-meter`: a stereo VU meter (two dials with needles, and two level bars with peak hold); it only listens
- `packages/ui` – `@loop/ui`: the shared component library, in plain CSS files

## Commands (run from the repo root)

| Command          | What it does                                 |
| ---------------- | -------------------------------------------- |
| `pnpm install`   | Install all dependencies                     |
| `pnpm dev`       | Start the dev server                         |
| `pnpm build`     | Build to `app/dist/`                         |
| `pnpm preview`   | Serve the build locally (test the real PWA)  |
| `pnpm typecheck` | Type check all workspaces                    |
| `pnpm test`      | Run unit tests (core)                        |

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds the app and puts it on GitHub Pages on every push to `main`.

1. On GitHub: **Settings → Pages → Source: GitHub Actions** (one time).
2. Push to `main`. The site is at `https://<user>.github.io/<repo>/`.

The app works under any URL path. The build reads it from `BASE_PATH` (default `/`).
In code, use `import.meta.env.BASE_URL` for links, not a fixed `/`.

## How the PWA works

A PWA is a website that the browser can install like an app. It needs 3 things:

1. **HTTPS** (or `localhost` during development).
2. **A web app manifest** – `app/public/manifest.webmanifest`. Name, colors and icons for the installed app.
3. **A service worker** – `app/sw.ts`. A script that runs in the background, between the page and the network. It can answer requests itself, so the app works offline.

Here, the Hono app runs **inside the service worker**:

1. First visit: the server sends `app/index.html`. Its script (`app/src/register-sw.ts`) installs the service worker, then reloads the page once.
2. After that, every request goes to Hono (`app/src/app.ts`) first.
3. If Hono has a route, Hono answers. This also works offline.
4. If Hono returns 404, the request goes to the network (files in `app/public/`, Vite files).

So: add pages as Hono routes in `app/src/app.ts`.

## Good to know

- Dev tools: Chrome DevTools → **Application** tab → *Manifest* and *Service workers*.
- In dev, tick **Update on reload** in *Service workers*. Then every reload uses your newest `sw.ts` / `app.ts`.
- Hono runs in the browser. It cannot keep secrets or talk to a database directly. For that, add a real server later.
- Icons: source is `app/public/icons/icon.svg`. The PNG sizes and `app/public/favicon.ico` are made from it.

## UI library (`@loop/ui`)

Plain CSS files in `packages/ui/src/` (components in `packages/ui/src/components/`). Each file says how to use it at the top.

| File          | Classes / content                                                                 |
| ------------- | --------------------------------------------------------------------------------- |
| `tokens.css`  | The shared variables: `--loop-primary` (main color), `--loop-font`, and the display colors for the modules' screens (`--screen`, `--ink`, `--blue`, `--orange`, ...). |
| `base.css`    | Page font and colors, heading weight, focus ring, `.text-muted`, `.text-small`    |
| `layout.css`  | `.row`, `.stack` (other gap: `style="gap: 0.5rem"`)                              |
| `components/button.css` | `.button` + modifier classes `.primary`, `.ghost`, `.small` (for example `class="button small"`); `aria-pressed` |
| `components/input.css`  | `.input`                                                   |
| `components/range.css` | `input[type="range"]` (no class needed): a slider drawn fully in CSS that looks like Chrome's; primary color (or `--loop-primary` on the slider); light and dark mode. `.vertical`: lowest value at the bottom, length with `height` |
| `font.ts` | Fonts (files in `src/fonts/`). `addLoopFont()` + `LOOP_FONT`: Italian Plate No1 Mono, the app's font (`--loop-font`), weights 100 to 900, upright and italic; the app calls it once at start (`app/src/client.ts`). `addMatrixFont()` + `MATRIX_FONT`: MatrixType Display, LED pixels, weights 400 and 700 (metronome). `addVideoFont()` + `VIDEO_FONT`: Home Video, pixel, weights 400 and 700 (700 is reversed text) (low pass) |
| `components/display.css` | `.display`: a module's screen (275px wide, rounded). Its colors (`--screen`, `--ink`, `--muted`, `--line`, `--dim`, `--blue`, `--orange`, `--red`, `--green`, `--purple`) are in `tokens.css` |
| `components/field.css` | `.field`: a label with an input in it (small uppercase text next to the input) |
| `display.ts` | `CHANNEL_COLORS`: the 6 channel colors, as CSS colors (for CSS, or for a canvas) |
| `components/checkbox.css` | `input[type="checkbox"]` (no class needed): the native checkbox, drawn as a primary-color box with a white check |
| `components/radio.css` | `input[type="radio"]` (no class needed): the native radio button, drawn as a primary-color circle with a white dot |
| `components/progress.css` | `progress` (no class needed): a progress bar drawn fully in CSS that looks like Chrome's; primary color (or `--loop-primary` on the bar); light and dark mode; length with `width` |
| `components/meter.css` | `meter` (no class needed): a meter drawn fully in CSS that looks like Chrome's; green, yellow or red from `low`, `high` and `optimum`; light and dark mode; length with `width` |
| `components/panel.css`  | `.panel`, `.panel-title`                                                          |
| `components/menu.css`   | `.menu`, `.menu-title`, `.menu-list`, `.menu-item`, `.menu-divider`               |

- **Layer:** every rule is in `@layer ui`. Rules outside a layer always win, so the app and modules can override anything.
- **The app** puts the library in a `<style>` tag of the page (`app/src/app.ts`). It shows on first paint and works offline.
- **A module** adds it to its Shadow DOM: `ui: { styles: [uiStyles, styles], ... }`. All modules share one parsed copy.
- **New component:** add `packages/ui/src/components/<name>.css` with its rules inside `@layer ui { }`. It is included automatically. A test checks the layer.

## Audio architecture

All audio runs on the page (`app/src/client.ts`). A service worker has no Web Audio API.

```
UI (client.ts) ──methods──▶ Core ──events──▶ modules (Metronome, Low pass, ...)
                             │                   │
                         AudioContext ◀── audio nodes (the audio chain, below)
```

**The audio chain** (`packages/core/src/chain.ts`): like cables between hardware boxes. Sound flows
through the modules in the order they were added, then to the speakers:

```
core.input ─▶ module 1 ─▶ module 2 ─▶ ... ─▶ core.output ─▶ speakers
```

| Module has       | Example    | The sound from before ...                  | The module's own sound |
| ---------------- | ---------- | ------------------------------------------ | ---------------------- |
| input and output | Low pass   | goes through the module                    | goes on                |
| only output      | Metronome  | goes past the module                       | is mixed in            |
| only input       | VU meter   | goes to the module, and also past it       | (none)                 |

So a filter only changes the modules that come before it. `core.move(module, index)` changes the order
(the rack calls it when you drag a module by its handle; dnd-kit, `@dnd-kit/dom`). `core.input` is the start of the chain
(nothing is connected to it yet; later, for example, a microphone).

**Triggers** flow down the chain too, like MIDI or CV cables. A trigger says "play channel X at time T".
A module sends one with `ctx.send({ channel, time })`. Only the modules **after** it get it, with
`ctx.onTrigger(listener)`. Example: the sequencer sends a trigger for each step that is on, and a sampler
after it plays that channel. A sampler before the sequencer gets nothing.
A trigger can carry a `volume` (0 to 1, like MIDI velocity). A module on the way can change the triggers
that pass it with `ctx.passTrigger(change)` (return null to stop one).

**Channels** are separate sound cables next to the main chain. A module can send its sound per channel
(`channelOutputs`, for example the sampler), and a later module can take them in (`channelInputs`, the
mixer): channel 1 to channel 1, and so on. If no module after it takes them, the channels join the main
chain at the module that sent them, so they are still heard. See `planChannels` in `packages/core/src/chain.ts`.

- **Commands go in as function calls:** `core.start()`, `core.stop()`, `core.setBpm(90)`, `core.add(module)`.
- **News goes out as events:** `core.events.on('beat', ...)`. The event bus (`createEmitter` in `packages/core/src/events.ts`) is a typed wrapper around the browser's `EventTarget` + `CustomEvent`.
- **Events:** `start`, `stop`, `bpmchange`, `step` (every 16th note), `beat`, `moduleadd`, `moduleremove`, `modulemove`, `modulechange`.

### The app: adding and removing modules

| File                        | Job                                                                  |
| --------------------------- | -------------------------------------------------------------------- |
| `app/src/modules.ts`        | The list of modules a user can add. **Add new modules here.**        |
| `app/src/module-picker.ts`  | The "Add" list. A native popover (`popovertarget` on the Add button). |
| `app/src/rack.ts`           | Shows the core's modules in chain order. Follows `moduleadd` / `moduleremove` / `modulemove`. Drag a module by its handle (or Space + arrow keys) to move it in the chain. |
| `app/src/client.ts`         | Connects the buttons, the core, the picker and the rack.             |

The core owns the chain. The page only shows it:
Add → `core.add(definition)` → core sends `moduleadd` → the rack mounts the UI.
Remove → `module.remove()` → core sends `moduleremove` → the rack takes the UI away.

Remove mode: modules jiggle and show a "−" badge. A full-size button lies over each module, so a click removes it.
The module's own controls are `inert` (blocked) in this mode. Esc, "Done" or opening the Add list ends remove mode.

### Projects (local first)

Everything is saved in the browser. There is no server.

| File                         | Job                                                                       |
| ---------------------------- | ------------------------------------------------------------------------- |
| `app/src/project-store.ts`   | Keeps projects in **IndexedDB** (a native browser database). The only file that knows about storage. |
| `app/src/project-session.ts` | The open project. Saves it automatically ~0.4 s after each change, and when the page is hidden. |
| `app/src/project-file.ts`    | Export / import format: a `.loop.json` file.                              |
| `app/src/project-menu.ts`    | The "Projects" menu: New, Import, Export, open, delete. And the name and "Saved" status. |
| `packages/core/src/project.ts` | `serializeProject(core)`, `parseProject(data)`, `restoreProject(core, data, modules)`. |

Saved data (`ProjectData`): `{ version: 1, bpm, modules: [{ type, state }] }`. If the format changes, raise `version` and convert old data in `parseProject`.

**A module saves its own settings:**

- `type: 'my-module'` in `defineAudioModule`: a stable key. Never change it, or old projects lose the module.
- `save()` in the setup result: returns plain JSON data. When the project loads, this data comes back as `options`.
- `ctx.changed()`: call it when that data changes. The app then saves.
- Saved data can come from a file, so check its types in `setup` (see `packages/metronome/src/setup.ts`).

### Timing: why events carry a `time`

JavaScript timers are not exact. The audio clock (`context.currentTime`) is.
So the clock looks ~100 ms ahead and sends `step`/`beat` events **early**. Each event has the exact audio `time`.
Modules schedule sound at that time: `oscillator.start(time)`.
To sync the screen to the sound, wait `time - context.currentTime` seconds (see `client.ts`).

**Never** make a sound "now" inside an event listener. Always use the event's `time`.

### Tape speed: start and stop like a tape machine

The clock runs like a tape. On start the tape speeds up from 0 to 1 (`SPIN_UP`, 0.4 s). On stop it slows down
to 0 (`SPIN_DOWN`, 0.9 s), then the `stop` event comes. The steps and beats follow the speed, so all modules
get slower or faster triggers by themselves. Click play while it slows down: it speeds up again from there.

- `core.speed` / `core.speedAt(time)`: the speed (1 full, 0 still, below 0 backwards). `core.stopping`: true while it slows down.
- The `speedchange` event: the speed starts to change (`{ plan }`: points in time, straight lines between them).
- `core.speedSignal`: the speed as a sound signal. Connect it to an AudioParam to follow it.
  The sampler connects it to `playbackRate` (speed and pitch), the metronome to its tick's frequency.
- `core.clock.travel(from, to)`: how far the tape moved between two times (seconds at full speed).

The tape keeps its place: stop, then start, and it goes on from the next step (`core.clock.step`).

**Rewind** (`core.rewind()`, the "rew" button in Master): the tape goes backwards to the first step of the
bar it is in (the start of the sequence), no further. It ramps up to `REWIND_BPM` (130 bpm, backwards) in
`REWIND_RAMP` (0.2 s), and ramps down at the end. No steps play; `rewindstep` events tell where the tape is,
and `rewindend` comes at the end. The sound is real: the end of the chain records onto a short tape (the last
13 s, one bar at the slowest tempo; see `packages/core/src/tape.ts`, an AudioWorklet), and a rewind plays it
backwards. The tape is before `core.output`, so the master volume works on it too.

### Write a module

The repo uses typed functions, not classes: `createCore`, `createClock`, `createEmitter`, `defineAudioModule`.

```ts
import { defineAudioModule } from '@loop/core'

export const myModule = defineAudioModule({
  type: 'my-module',
  name: 'My module',
  setup(ctx, options: { volume?: number } = {}) {
    const output = new GainNode(ctx.audio, { gain: options.volume ?? 1 })

    // Removed for you when the module is removed.
    ctx.on('step', ({ time, stepInBar }) => {
      /* schedule sound at `time` */
    })
    ctx.onDispose(() => {
      /* extra clean-up, if you need it */
    })

    // Return audio nodes, plus any functions you want to offer.
    return { output, setVolume: (v: number) => (output.gain.value = v) }
  },
})

// In the app:
const core = createCore({ bpm: 120 })
const mine = core.add(myModule, { volume: 0.5 }) // fully typed: mine.setVolume(...)
mine.remove()
```

### Module UI: HTML, CSS and JS

A module can have a `ui`. It uses only native browser features:

| Part       | Field      | How                                                                                  |
| ---------- | ---------- | ------------------------------------------------------------------------------------ |
| HTML       | `template` | `html` tagged template. Values are escaped. Always quote attributes: `value="${x}"`. |
| CSS        | `styles`   | `css` tagged template. Becomes a native `CSSStyleSheet` (made once, then shared).    |
| JS         | `script`   | Runs after the HTML is in place. Connect inputs to the module here.                  |

```ts
import { css, defineAudioModule, html } from '@loop/core'

export const myModule = defineAudioModule({
  type: 'my-module',
  name: 'My module',
  setup(ctx) { /* ... */ return { output, setVolume } },
  ui: {
    styles: css`
      :host { display: block; }
      button { color: var(--loop-primary); }
    `,
    template: ({ module }) => html`<h2>${module.name}</h2><button>Mute</button>`,
    script: ({ root, module, on, signal }) => {
      root.querySelector('button')!.addEventListener('click', () => module.setVolume(0), { signal })
      on('beat', ({ time }) => { /* update the UI */ })
    },
  },
})

// In the app:
core.add(myModule).mount(document.querySelector('#rack')!)
```

#### One file per part

For a real module, put each part in its own file (see `packages/metronome/src/`):

```
src/
  setup.ts     export const setup    = defineModuleSetup((ctx, options: MyOptions = {}) => { ... })
  styles.ts    export const styles   = css`...`
  template.ts  export const template = defineModuleTemplate<typeof setup>(({ module }) => html`...`)
  script.ts    export const script   = defineModuleScript<typeof setup>(({ root, module }) => { ... })
  index.ts     export const myModule = defineAudioModule({ type, name, setup, ui: { styles, template, script } })
```

`typeof setup` tells the template and the script what the module offers, for example `module.setVolume`.
Use `import type { setup } from './setup'`: it only imports the type, not the code.

- **Scoped CSS:** each UI lives in its own **Shadow DOM**. Module CSS cannot leak out. App CSS cannot leak in.
- **Theme:** the shared CSS variables are in `packages/ui/src/tokens.css`: `--loop-primary` (main color), `--loop-font`, and the display colors (`--screen`, `--ink`, `--blue`, ...). They pass into the Shadow DOM. The font (Italian Plate No1 Mono, `packages/ui/src/fonts/Italian Plate/`, added with `addLoopFont()`) has weights 100 to 900, upright and italic.
- **Layout:** the app places modules (`#rack`). The module styles its own box with `:host`. App CSS on the host element (`#rack > section`) wins over `:host`.
- **Clean-up:** use `signal` for DOM listeners and `on` for core events. Both are removed when the UI unmounts or the module is removed.
- **No custom elements:** they need classes. Shadow DOM on a plain `<section>` gives the same scoping.

A module can add its own event types:

```ts
declare module '@loop/core' {
  interface CoreEventMap { 'mymodule:hit': { time: number } }
}
```

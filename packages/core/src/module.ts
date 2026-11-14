import type { Core, CoreEventMap } from './core'
import type { ListenOptions, Listener } from './events'
import type { CSSTemplate, HTMLTemplate } from './ui'

/** Listen to a core event. The listener is removed for you at clean-up time. */
export type ScopedOn = <K extends keyof CoreEventMap & string>(
  type: K,
  listener: Listener<CoreEventMap[K]>,
  options?: Omit<ListenOptions, 'signal'>,
) => () => void

/**
 * What a module's `setup` gets from the core.
 * Listeners added with `on` are removed for you when the module is removed.
 */
export interface ModuleContext {
  readonly core: Core
  /** The audio context. Use it to make audio nodes. */
  readonly audio: BaseAudioContext
  /** Listen to a core event. The listener is removed when the module is removed. */
  readonly on: ScopedOn
  /** Aborts when the module is removed. Pass it to other APIs that take a signal. */
  readonly signal: AbortSignal
  /** Run a function when the module is removed. */
  onDispose(fn: () => void): void
  /** Tell the core that the module's saved state changed (for example, the volume). The app saves the project. */
  changed(): void
}

/** What `setup` returns: audio nodes, plus any functions or values the module wants to offer. */
export interface ModuleSetupResult {
  /** The node that receives sound. Leave it out if the module has no input. */
  input?: AudioNode
  /** The node that sends sound out. Leave it out if the module makes no sound. */
  output?: AudioNode
  /**
   * Return the settings to save with the project. Must be plain JSON data.
   * When the project loads, this data is passed back to `setup` as `options`.
   * Call `ctx.changed()` when the data changes.
   */
  save?: () => unknown
  /** Anything else: functions or values the module offers, for example `setVolume`. */
  [key: string]: unknown
}

/** What a module UI's `template` and `script` get. */
export interface ModuleUIContext<Result extends ModuleSetupResult> {
  /** The module: everything `setup` returned, plus `id`, `name`, `remove`. */
  readonly module: AudioModule<Result>
  readonly core: Core
}

export interface ModuleUIScriptContext<Result extends ModuleSetupResult> extends ModuleUIContext<Result> {
  /** The module's own Shadow DOM. Query your elements here: `root.querySelector(...)`. */
  readonly root: ShadowRoot
  /** Listen to a core event. The listener is removed when the UI is unmounted. */
  readonly on: ScopedOn
  /**
   * Aborts when the UI is unmounted. Pass it to DOM listeners so they are removed too:
   * `button.addEventListener('click', fn, { signal })`
   */
  readonly signal: AbortSignal
}

/** Audio part of a module. Called by `core.add()`. Make audio nodes and listen to events here. */
export type ModuleSetup<Options = any, Result extends ModuleSetupResult = ModuleSetupResult> = (
  ctx: ModuleContext,
  options: Options,
) => Result

/** The type that a `setup` function returns. */
export type SetupResultOf<Setup extends ModuleSetup> = ReturnType<Setup>

/** HTML part of a module UI. */
export type ModuleTemplate<Result extends ModuleSetupResult = ModuleSetupResult> = (
  ctx: ModuleUIContext<Result>,
) => HTMLTemplate

/** JS part of a module UI. Runs after the HTML is in place. */
export type ModuleScript<Result extends ModuleSetupResult = ModuleSetupResult> = (
  ctx: ModuleUIScriptContext<Result>,
) => void

/** CSS part of a module UI. It only applies inside the module's Shadow DOM. */
export type ModuleStyles = CSSTemplate | readonly CSSTemplate[]

/** A module's UI: HTML (`template`), CSS (`styles`) and JS (`script`). */
export interface ModuleUI<Result extends ModuleSetupResult> {
  readonly styles?: ModuleStyles
  readonly template: ModuleTemplate<Result>
  readonly script?: ModuleScript<Result>
}

export interface AudioModuleDefinition<Options, Result extends ModuleSetupResult> {
  /**
   * Unique, stable key for this kind of module, for example 'metronome'.
   * Saved projects use it to find the module again, so never change it.
   */
  readonly type: string
  /** Name to show to the user. */
  readonly name: string
  /** One short sentence to show to the user, for example in a list of modules. */
  readonly description?: string
  /** Called by `core.add()`. Make audio nodes and listen to events here. */
  readonly setup: ModuleSetup<Options, Result>
  /** Optional UI. The app shows it with `module.mount(element)`. */
  readonly ui?: ModuleUI<Result>
}

/** Any module definition. Use it for lists of modules, for example the modules a user can add. */
export type AnyAudioModuleDefinition = AudioModuleDefinition<any, any>

/** A module that was added to a core: the setup result, plus the fields below. */
export type AudioModule<Result extends ModuleSetupResult = ModuleSetupResult> = Result & {
  readonly id: string
  /** The definition's `type`, for example 'metronome'. */
  readonly type: string
  readonly name: string
  /**
   * Show the module's UI inside `parent`. Returns a function that removes the UI.
   * The UI is also removed when the module is removed.
   */
  mount(parent: Element): () => void
  /** Remove the module from the core. Same as `core.remove(module)`. */
  remove(): void
}

/**
 * Define an audio module. This only adds types; it returns the definition as it is.
 *
 *   export const myModule = defineAudioModule({
 *     type: 'my-module',
 *     name: 'My module',
 *     setup(ctx, options: { volume?: number } = {}) {
 *       const output = new GainNode(ctx.audio, { gain: options.volume ?? 1 })
 *       ctx.on('beat', ({ time }) => { ... })
 *       return { output }
 *     },
 *     ui: {
 *       styles: css`h2 { color: var(--loop-primary); }`,
 *       template: ({ module }) => html`<h2>${module.name}</h2>`,
 *       script: ({ root, module, signal }) => { ... },
 *     },
 *   })
 *
 *   const instance = core.add(myModule, { volume: 0.5 })
 *   instance.mount(document.querySelector('#rack')!)
 */
export function defineAudioModule<Options = void, Result extends ModuleSetupResult = ModuleSetupResult>(
  definition: AudioModuleDefinition<Options, Result>,
): AudioModuleDefinition<Options, Result> {
  return definition
}

// ---- Helpers for modules split into files ----
// They only add types; each returns its argument as it is.
//
//   setup.ts     export const setup = defineModuleSetup((ctx, options: MyOptions = {}) => { ... })
//   template.ts  export const template = defineModuleTemplate<typeof setup>(({ module }) => html`...`)
//   script.ts    export const script = defineModuleScript<typeof setup>(({ root, module }) => { ... })
//   styles.ts    export const styles = css`...`
//   index.ts     export const myModule = defineAudioModule({ name, setup, ui: { styles, template, script } })
//
// `typeof setup` tells the template and the script what the module offers (for example `setVolume`).

/** Define the audio part of a module. */
export function defineModuleSetup<Options = void, Result extends ModuleSetupResult = ModuleSetupResult>(
  setup: ModuleSetup<Options, Result>,
): ModuleSetup<Options, Result> {
  return setup
}

/** Define the HTML part of a module UI. Pass `typeof setup` to get the module's types. */
export function defineModuleTemplate<Setup extends ModuleSetup>(
  template: ModuleTemplate<SetupResultOf<Setup>>,
): ModuleTemplate<SetupResultOf<Setup>> {
  return template
}

/** Define the JS part of a module UI. Pass `typeof setup` to get the module's types. */
export function defineModuleScript<Setup extends ModuleSetup>(
  script: ModuleScript<SetupResultOf<Setup>>,
): ModuleScript<SetupResultOf<Setup>> {
  return script
}

/**
 * The `options` argument of `core.add()`. You can leave it out when the module
 * has no options, or when every option is optional.
 */
export type OptionsArg<Options> = undefined extends Options
  ? [options?: Options]
  : {} extends Options
    ? [options?: Options]
    : [options: Options]

import type { Core, CoreEventMap } from './core'
import type { Listener, ListenOptions } from './events'

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

/**
 * What `setup` returns: audio nodes, plus any functions or values the module wants to offer.
 * The core makes a jack (a port, see patch.ts) for each node, and the user connects the jacks
 * with cables. A module with no cables gets no sound and sends none.
 */
export interface ModuleSetupResult {
  /** The node that receives sound: the "In" jack. Leave it out if the module has no input. */
  input?: AudioNode
  /** The node that sends sound out: the "Out" jack. Leave it out if the module makes no sound. */
  output?: AudioNode
  /**
   * One output per channel (channel 1 first): the module sends each channel's sound separately,
   * for example a sampler. One jack each: "Ch 1" (`out-1`), "Ch 2" (`out-2`), ..., in one group
   * (see Port in patch.ts).
   */
  channelOutputs?: readonly AudioNode[]
  /** One input per channel (a mixer): "Ch 1" (`in-1`), "Ch 2" (`in-2`), ..., in one group. */
  channelInputs?: readonly AudioNode[]
  /** Send buses (aux sends), bus A first: one "Snd A", "Snd B", ... jack each (a mixer). */
  sendOutputs?: readonly AudioNode[]
  /** Returns, bus A first: one "Rtn A", "Rtn B", ... jack each, where an effect plays back in (a mixer). */
  returnInputs?: readonly AudioNode[]
  /**
   * A node that plays straight into the speakers (core.output), with no jack and no cable. For the
   * end of the sound: Master. New sound sources are patched into this module (see autoPatch).
   */
  speakerOutput?: AudioNode
  /**
   * Which input jacks reach which output jacks inside the module, as [input port id, output port
   * id] pairs (see patch.ts for the ids). The core uses it to stop loops. Leave it out: every
   * input reaches every output. A mixer: the returns reach "out" but not the sends.
   */
  routes?: readonly (readonly [input: string, output: string])[]
  /**
   * Return the settings to save with the project. Must be plain JSON data.
   * When the project loads, this data is passed back to `setup` as `options`.
   * Call `ctx.changed()` when the data changes.
   */
  save?: () => unknown
  /** Anything else: functions or values the module offers, for example `setVolume`. */
  [key: string]: unknown
}

/** Audio part of a module. Called by `core.add()`. Make audio nodes and listen to events here. */
export type ModuleSetup<
  // biome-ignore lint/suspicious/noExplicitAny: default so `extends ModuleSetup` matches any options
  Options = any,
  Result extends ModuleSetupResult = ModuleSetupResult,
> = (ctx: ModuleContext, options: Options) => Result

/** The type that a `setup` function returns. */
export type SetupResultOf<Setup extends ModuleSetup> = ReturnType<Setup>

export interface AudioModuleDefinition<
  Options,
  Result extends ModuleSetupResult,
> {
  /**
   * Unique, stable key for this kind of module, for example 'metronome'.
   * Saved projects use it to find the module again, so never change it.
   */
  readonly type: string
  /** Name to show to the user. */
  readonly name: string
  /** Short form name to show to the user. */
  readonly label: string
  /** One short sentence to show to the user, for example in a list of modules. */
  readonly description?: string
  /** True: only one of this module can be in the core at a time (Master). */
  readonly unique?: boolean
  /** Called by `core.add()`. Make audio nodes and listen to events here. */
  readonly setup: ModuleSetup<Options, Result>
}

/** Any module definition. Use it for lists of modules, for example the modules a user can add. */
// biome-ignore lint/suspicious/noExplicitAny: Options and Result are invariant, so only `any` accepts every definition
export type AnyAudioModuleDefinition = AudioModuleDefinition<any, any>

/** A module that was added to a core: the setup result, plus the fields below. */
export type AudioModule<Result extends ModuleSetupResult = ModuleSetupResult> =
  Result & {
    readonly id: string
    /** The definition's `type`, for example 'metronome'. */
    readonly type: string
    readonly name: string
    readonly label: string
    /**
     * The definition that `core.add()` got, as it is (a UI package can keep its UI in it, see
     * `defineModule` in @loop/ui).
     */
    readonly definition: AnyAudioModuleDefinition
    /** Aborts when the module is removed. A UI uses it to remove itself too. */
    readonly signal: AbortSignal
    /** Remove the module from the core. Same as `core.remove(module)`. */
    remove(): void
  }

/**
 * Define an audio module: the sound part. This only adds types; it returns the definition as it is.
 * A module with a UI uses `defineModule` from @loop/ui instead: the same, plus a `ui`.
 *
 *   export const myModule = defineAudioModule({
 *     type: 'my-module',
 *     name: 'My module',
 *     setup(ctx, options: { volume?: number } = {}) {
 *       const output = new GainNode(ctx.audio, { gain: options.volume ?? 1 })
 *       ctx.on('beat', ({ time }) => { ... })
 *       return { output }
 *     },
 *   })
 *
 *   const instance = core.add(myModule, { volume: 0.5 })
 */
export function defineAudioModule<
  Options = void,
  Result extends ModuleSetupResult = ModuleSetupResult,
>(
  definition: AudioModuleDefinition<Options, Result>,
): AudioModuleDefinition<Options, Result> {
  return definition
}

// A module split into files: setup.ts has the sound part (defineModuleSetup, below), the other
// files have the UI part (see module.ts in @loop/ui).

/** Define the audio part of a module. */
export function defineModuleSetup<
  Options = void,
  Result extends ModuleSetupResult = ModuleSetupResult,
>(setup: ModuleSetup<Options, Result>): ModuleSetup<Options, Result> {
  return setup
}

/**
 * The `options` argument of `core.add()`. You can leave it out when the module
 * has no options, or when every option is optional.
 */
export type OptionsArg<Options> = undefined extends Options
  ? [options?: Options]
  : // biome-ignore lint/complexity/noBannedTypes: `{} extends Options` is true when every option is optional
    {} extends Options
    ? [options?: Options]
    : [options: Options]

/**
 * The UI part of a module: its HTML (`template`), CSS (`styles`) and JS (`script`).
 *
 * @loop/core only knows the sound part (`setup`). This file adds the UI on top:
 * - `defineModule`: a core module definition, plus a `ui`.
 * - `mountModule`: show a module's UI on the page.
 *
 *   export const myModule = defineModule({
 *     type: 'my-module',
 *     name: 'My module',
 *     setup(ctx, options: { volume?: number } = {}) { ... return { output } },
 *     ui: {
 *       styles: css`h2 { color: var(--loop-primary); }`,
 *       template: ({ module }) => html`<h2>${module.name}</h2>`,
 *       script: ({ root, module, signal }) => { ... },
 *     },
 *   })
 *
 *   const instance = core.add(myModule, { volume: 0.5 })
 *   mountModule(core, instance, document.querySelector('#rack')!)
 *
 * A module split into files:
 *
 *   setup.ts     export const setup = defineModuleSetup((ctx, options: MyOptions = {}) => { ... })  (@loop/core)
 *   template.ts  export const template = defineModuleTemplate<typeof setup>(({ module }) => html`...`)
 *   script.ts    export const script = defineModuleScript<typeof setup>(({ root, module }) => { ... })
 *   styles.ts    export const styles = css`...`
 *   index.ts     export const myModule = defineModule({ type, name, setup, ui: { styles, template, script } })
 *
 * `typeof setup` tells the template and the script what the module offers (for example `setVolume`).
 */

import type {
  AudioModule,
  AudioModuleDefinition,
  Core,
  ModuleSetup,
  ModuleSetupResult,
  ScopedOn,
  SetupResultOf,
} from '@loop/core'
import { type CSSTemplate, type HTMLTemplate, html, mountView } from './view'

/** What a module UI's `template` and `script` get. */
export interface ModuleUIContext<Result extends ModuleSetupResult> {
  /** The module: everything `setup` returned, plus `id`, `name`, `remove`. */
  readonly module: AudioModule<Result>
  readonly core: Core
}

export interface ModuleUIScriptContext<Result extends ModuleSetupResult>
  extends ModuleUIContext<Result> {
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

/** HTML part of a module UI. */
export type ModuleTemplate<
  Result extends ModuleSetupResult = ModuleSetupResult,
> = (ctx: ModuleUIContext<Result>) => HTMLTemplate

/** JS part of a module UI. Runs after the HTML is in place. */
export type ModuleScript<Result extends ModuleSetupResult = ModuleSetupResult> =
  (ctx: ModuleUIScriptContext<Result>) => void

/** CSS part of a module UI. It only applies inside the module's Shadow DOM. */
export type ModuleStyles = CSSTemplate | readonly CSSTemplate[]

/** A module's UI: HTML (`template`), CSS (`styles`) and JS (`script`). */
export interface ModuleUI<Result extends ModuleSetupResult> {
  readonly styles?: ModuleStyles
  readonly template: ModuleTemplate<Result>
  readonly script?: ModuleScript<Result>
}

/** A core module definition (the sound), plus its UI. `core.add()` takes it as it is. */
export interface ModuleDefinition<Options, Result extends ModuleSetupResult>
  extends AudioModuleDefinition<Options, Result> {
  /** Optional UI. Show it with `mountModule(core, module, element)`. */
  readonly ui?: ModuleUI<Result>
}

/** Any module definition with a UI. */
// biome-ignore lint/suspicious/noExplicitAny: Options and Result are invariant, so only `any` accepts every definition
export type AnyModuleDefinition = ModuleDefinition<any, any>

/** Define a module with a UI. This only adds types; it returns the definition as it is. */
export function defineModule<
  Options = void,
  Result extends ModuleSetupResult = ModuleSetupResult,
>(
  definition: ModuleDefinition<Options, Result>,
): ModuleDefinition<Options, Result> {
  return definition
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
 * Show a module's UI at the end of `parent`, in its own Shadow DOM (see mountView). Returns a
 * function that removes it. It is also removed when the module is removed from the core.
 * A module with no `ui` shows an empty box.
 */
export function mountModule(
  core: Core,
  module: AudioModule,
  parent: Element,
): () => void {
  // The core keeps the definition as `core.add()` got it, so one from defineModule has its ui.
  const { ui } = module.definition as AnyModuleDefinition
  const script = ui?.script
  return mountView(
    parent,
    {
      label: module.name,
      styles: ui?.styles,
      template: ui ? ui.template({ module, core }) : html``,
      script:
        script &&
        ((root, signal) => {
          const on: ScopedOn = (type, listener, options) =>
            core.events.on(type, listener, { ...options, signal })
          script({ module, core, root, signal, on })
        }),
    },
    { signal: module.signal, attributes: { 'data-module': module.id } },
  )
}

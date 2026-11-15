import { modulesAfter, planChain, type ChainConnection } from './chain'
import { createClock, type Clock, type ClockEventMap, type ClockOptions } from './clock'
import { createEmitter, type Emitter } from './events'
import type { AudioModule, AudioModuleDefinition, ModuleContext, ModuleSetupResult, OptionsArg, ScopedOn, Trigger } from './module'
import { render, toStyleSheet } from './ui'

/**
 * All events the core sends. Modules listen with `ctx.on(...)` or `core.events.on(...)`.
 *
 * This is an interface, so a module package can add its own events:
 *
 *   declare module '@loop/core' {
 *     interface CoreEventMap { 'mymodule:hit': { time: number } }
 *   }
 */
export interface CoreEventMap extends ClockEventMap {
  bpmchange: { bpm: number }
  /** A module was added to the end of the chain. */
  moduleadd: { module: AudioModule }
  /** A module was removed from the chain. */
  moduleremove: { module: AudioModule }
  /** A module moved to a new place in the chain. `index` is its new place (0 = first). */
  modulemove: { module: AudioModule; index: number }
  /** A module's saved state changed (the module called `ctx.changed()`). */
  modulechange: { module: AudioModule }
}

export interface CoreOptions extends ClockOptions {
  /** Use your own audio context, for example an OfflineAudioContext in tests. */
  context?: BaseAudioContext
}

/**
 * The heart of the app. It owns the AudioContext, the clock, the event bus and the modules.
 *
 * Rule of thumb:
 * - To TELL the core to do something, call a function: `core.start()`, `core.setBpm(90)`.
 * - To HEAR what happened, listen to an event: `core.events.on('beat', ...)`.
 */
export interface Core {
  readonly context: BaseAudioContext
  /**
   * Start of the audio chain. Sound connected here flows through every module, in order.
   * Nothing is connected yet (later, for example, a microphone).
   */
  readonly input: GainNode
  /** Master output: the end of the audio chain. It goes to the speakers. */
  readonly output: GainNode
  readonly events: Emitter<CoreEventMap>
  readonly clock: Clock
  readonly bpm: number
  readonly playing: boolean
  readonly modules: ReadonlyMap<string, AudioModule>
  setBpm(bpm: number): void
  /**
   * Start playback. Call this from a user action (a click or a key press):
   * browsers only allow audio to start after the user does something on the page.
   */
  start(): Promise<void>
  stop(): void
  /** Set up a module and put it at the end of the audio chain (see chain.ts). */
  add<Options, Result extends ModuleSetupResult>(
    definition: AudioModuleDefinition<Options, Result>,
    ...options: OptionsArg<Options>
  ): AudioModule<Result>
  /** Take a module out of the audio chain and run its clean-up. */
  remove(module: AudioModule): void
  /**
   * Move a module to a new place in the audio chain (0 = first). The sound then flows through
   * the modules in the new order. `modules` follows the same order.
   */
  move(module: AudioModule, index: number): void
  /** Stop, remove all modules and close the audio context. */
  dispose(): Promise<void>
}

export function createCore(options: CoreOptions = {}): Core {
  const context = options.context ?? new AudioContext({ latencyHint: 'interactive' })
  const input = new GainNode(context)
  const output = new GainNode(context)
  output.connect(context.destination)

  const events = createEmitter<CoreEventMap>()
  // The clock sends its events through the core's event bus.
  // (CoreEventMap extends ClockEventMap, so the cast is safe.)
  const clock = createClock(
    context,
    <K extends keyof ClockEventMap>(type: K, detail: ClockEventMap[K]) =>
      events.emit(type, detail as CoreEventMap[K]),
    options,
  )

  const modules = new Map<string, AudioModule>()
  const cleanups = new Map<string, () => void>()

  // The audio chain (see chain.ts). Each module gets an out jack. The modules are in the
  // chain in the order of `modules` (the order they were added).
  const jacks = new Map<string, GainNode>()
  let cables: ChainConnection<AudioNode>[] = []

  // Triggers (see Trigger in module.ts) flow down the chain like sound: a module's triggers
  // only reach the modules after it. Each module's trigger listeners, by module id.
  const triggerListeners = new Map<string, ((trigger: Trigger) => void)[]>()
  const sendTrigger = (from: string, trigger: Trigger) => {
    for (const id of modulesAfter([...modules.keys()], from)) {
      for (const listener of triggerListeners.get(id) ?? []) {
        // Like the event bus: one broken listener does not stop the others.
        try {
          listener(trigger)
        } catch (error) {
          reportError(error)
        }
      }
    }
  }

  /** Unplug the old cables and plug in the new ones. Only touches cables that the core made. */
  const rewire = () => {
    for (const [from, to] of cables) {
      try {
        from.disconnect(to)
      } catch {
        // Already gone, for example a removed module disconnected its own output.
      }
    }
    const slots = [...modules.values()].map((module) => ({
      input: module.input,
      output: module.output,
      jack: jacks.get(module.id)!,
    }))
    cables = planChain<AudioNode>(input, slots, output)
    for (const [from, to] of cables) from.connect(to)
  }

  const remove = (module: AudioModule) => {
    const cleanup = cleanups.get(module.id)
    if (!cleanup) return
    modules.delete(module.id)
    cleanups.delete(module.id)
    rewire()
    jacks.get(module.id)?.disconnect()
    jacks.delete(module.id)
    module.output?.disconnect()
    cleanup()
    events.emit('moduleremove', { module })
  }

  const core: Core = {
    context,
    input,
    output,
    events,
    clock,
    modules,
    get bpm() {
      return clock.bpm
    },
    get playing() {
      return clock.running
    },
    setBpm(bpm) {
      if (bpm === clock.bpm) return
      clock.setBpm(bpm)
      events.emit('bpmchange', { bpm: clock.bpm })
    },
    async start() {
      if (context instanceof AudioContext && context.state !== 'running') await context.resume()
      clock.start()
    },
    stop() {
      clock.stop()
    },
    add(definition, ...[moduleOptions]) {
      const id = crypto.randomUUID()
      const controller = new AbortController()
      const disposers: (() => void)[] = []
      const scopedOn = (signal: AbortSignal): ScopedOn => (type, listener, listenOptions) =>
        events.on(type, listener, { ...listenOptions, signal })

      const ctx: ModuleContext = {
        core,
        audio: context,
        signal: controller.signal,
        on: scopedOn(controller.signal),
        onDispose: (fn) => disposers.push(fn),
        send: (trigger) => sendTrigger(id, trigger),
        onTrigger: (listener) => {
          if (controller.signal.aborted) return
          const listeners = triggerListeners.get(id) ?? []
          listeners.push(listener)
          triggerListeners.set(id, listeners)
        },
        changed: () => {
          // Only after setup is done and while the module is still in the chain.
          if (modules.get(id) === module) events.emit('modulechange', { module })
        },
      }

      const result = definition.setup(ctx, moduleOptions as never)

      // Add id, name, mount and remove to the object that setup returned.
      // (Object.assign keeps any getters that setup defined, for example `get volume()`.)
      const module: AudioModule<typeof result> = Object.assign(result, {
        id,
        type: definition.type,
        name: definition.name,
        remove: () => remove(module),
        mount(parent: Element) {
          // The UI gets its own Shadow DOM: its CSS cannot leak out, and page CSS cannot leak in.
          const host = document.createElement('section')
          host.dataset.module = id
          host.setAttribute('aria-label', definition.name)
          const root = host.attachShadow({ mode: 'open' })

          // Unmount when the UI is removed OR when the module is removed.
          const mounted = new AbortController()
          const signal = AbortSignal.any([mounted.signal, controller.signal])
          const unmount = () => {
            mounted.abort()
            host.remove()
          }
          controller.signal.addEventListener('abort', unmount, { signal: mounted.signal })

          const ui = definition.ui
          if (ui) {
            const styles = ui.styles ? [ui.styles].flat() : []
            root.adoptedStyleSheets = styles.map(toStyleSheet)
            render(ui.template({ module, core }), root)
          }
          parent.append(host)
          ui?.script?.({ module, core, root, signal, on: scopedOn(signal) })
          return unmount
        },
      })

      jacks.set(id, new GainNode(context))
      modules.set(id, module)
      rewire()
      cleanups.set(id, () => {
        controller.abort()
        triggerListeners.delete(id)
        for (const fn of disposers.reverse()) fn()
      })
      events.emit('moduleadd', { module })
      return module
    },
    remove,
    move(module, index) {
      if (modules.get(module.id) !== module) return
      const order = [...modules.values()].filter((other) => other !== module)
      const to = Math.max(0, Math.min(order.length, Math.round(index)))
      if (to === [...modules.keys()].indexOf(module.id)) return
      order.splice(to, 0, module)
      // A Map keeps the order things were added in, so add them again in the new order.
      modules.clear()
      for (const other of order) modules.set(other.id, other)
      rewire()
      events.emit('modulemove', { module, index: to })
    },
    async dispose() {
      clock.stop()
      for (const module of [...modules.values()]) remove(module)
      if (context instanceof AudioContext) await context.close()
    },
  }

  return core
}

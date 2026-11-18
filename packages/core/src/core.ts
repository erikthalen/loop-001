import {
  autoPatch,
  checkCable,
  routeTrigger,
  samePlug,
  type Cable,
  type CableCheck,
  type PatchModule,
  type Plug,
  type Port,
} from "./patch";
import {
  createClock,
  type Clock,
  type ClockEventMap,
  type ClockOptions,
} from "./clock";
import { createEmitter, type Emitter } from "./events";
import type {
  AudioModule,
  AudioModuleDefinition,
  ModuleContext,
  ModuleSetupResult,
  OptionsArg,
  ScopedOn,
  Trigger,
} from "./module";
import { render, toStyleSheet } from "./ui";

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
  bpmchange: { bpm: number };
  /** A module was added (at the end of the rack). */
  moduleadd: { module: AudioModule };
  /** A module was removed (its cables first: a `cablechange` for each). */
  moduleremove: { module: AudioModule };
  /** A module moved to a new place in the rack. `index` is its new place (0 = first). */
  modulemove: { module: AudioModule; index: number };
  /** A cable was plugged in (`connected: true`) or taken out (false). See patch.ts. */
  cablechange: { cable: Cable; connected: boolean };
  /** A module's saved state changed (the module called `ctx.changed()`). */
  modulechange: { module: AudioModule };
}

/** How long the transport takes to speed up on start, and to slow down on stop (seconds). */
export const SPIN_UP = 0.3;
export const SPIN_DOWN = 0.6;
/**
 * Rewind: how fast the transport goes backwards, as a tempo (the steps go by backwards at this bpm), and
 * how long it takes to get there (seconds).
 */
export const REWIND_BPM = 200;
export const REWIND_RAMP = 0.6;

export interface CoreOptions extends ClockOptions {
  /** Use your own audio context, for example an OfflineAudioContext in tests. */
  context?: BaseAudioContext;
}

/**
 * The heart of the app. It owns the AudioContext, the clock, the event bus and the modules.
 *
 * Rule of thumb:
 * - To TELL the core to do something, call a function: `core.start()`, `core.setBpm(90)`.
 * - To HEAR what happened, listen to an event: `core.events.on('beat', ...)`.
 */
export interface Core {
  readonly context: BaseAudioContext;
  /**
   * The speakers. A module plays into them with `speakerOutput` (Master), not with a cable. The
   * core leaves its volume at 1: it plays the sound as loud as it gets it.
   */
  readonly output: GainNode;
  readonly events: Emitter<CoreEventMap>;
  readonly clock: Clock;
  readonly bpm: number;
  /** True from start until the transport has stopped (also while it slows down after `stop()`). */
  readonly playing: boolean;
  /** True while the transport slows down after `stop()`. */
  readonly stopping: boolean;
  /** True while the transport rewinds to the start (see `rewind()`). */
  readonly rewinding: boolean;
  /**
   * The transport speed now: 1 is full speed (normal tempo and pitch), 0 is stopped, below 0 is
   * backwards (rewind). On start it goes up from 0 to 1, on stop down to 0, like a tape machine.
   * The clock (steps, beats) follows it.
   * The `speedchange` event tells when it starts to change, and how.
   */
  readonly speed: number;
  /** The transport speed at an audio time (as far as it is known now). */
  speedAt(time: number): number;
  /**
   * The transport speed as a sound signal (see `speed`). Connect it to an AudioParam to follow the speed,
   * for example the pitch of a sample: set `source.playbackRate.value = 0`, then
   * `core.speedSignal.connect(source.playbackRate)`.
   */
  readonly speedSignal: AudioNode;
  readonly modules: ReadonlyMap<string, AudioModule>;
  setBpm(bpm: number): void;
  /**
   * Start playback. Call this from a user action (a click or a key press):
   * browsers only allow audio to start after the user does something on the page.
   */
  start(): Promise<void>;
  /** Slow down and stop (it keeps its place). While it rewinds: stop the rewind. */
  stop(): void;
  /**
   * Rewind to the first step of the bar (the start of the sequence): the transport goes backwards.
   * While it plays, it turns around. (Master records the sound and plays it backwards while it
   * rewinds.) Call this from a user action (like `start`).
   */
  rewind(): Promise<void>;
  /**
   * Set up a module and put it at the end of the rack. It has no cables yet: call
   * `autoPatch(module)` to give it the usual ones, or `connect()` your own.
   * Throws if the definition is `unique` and one is already in the core (see `canAdd`).
   */
  add<Options, Result extends ModuleSetupResult>(
    definition: AudioModuleDefinition<Options, Result>,
    ...options: OptionsArg<Options>
  ): AudioModule<Result>;
  /** False if the definition is `unique` and one is already in the core. */
  canAdd(definition: AudioModuleDefinition<any, any>): boolean;
  /** Take out the module's cables, then remove the module and run its clean-up. */
  remove(module: AudioModule): void;
  /**
   * Move a module to a new place in the rack (0 = first). `modules` follows the same order.
   * Only the order changes: the cables stay where they are.
   */
  move(module: AudioModule, index: number): void;
  /** The cables, in the order they were plugged in. */
  readonly cables: readonly Cable[];
  /** A module's jacks: inputs first, then outputs. */
  ports(module: string): readonly Port[];
  /** Can a cable join these two jacks? (In any order.) If not, `reason` says why, for the user. */
  canConnect(a: Plug, b: Plug): CableCheck;
  /** Plug in a cable between two jacks (in any order). Returns the cable, or null if it cannot be. */
  connect(a: Plug, b: Plug): Cable | null;
  /** Take a cable out. */
  disconnect(cable: Cable): void;
  /** Give a module the usual cables, from the modules above it (see autoPatch in patch.ts). */
  autoPatch(module: AudioModule): void;
  /** Stop, remove all modules and close the audio context. */
  dispose(): Promise<void>;
}

export function createCore(options: CoreOptions = {}): Core {
  const context =
    options.context ?? new AudioContext({ latencyHint: "interactive" });
  const output = new GainNode(context);
  output.connect(context.destination);

  const events = createEmitter<CoreEventMap>();
  // The clock sends its events through the core's event bus.
  // (CoreEventMap extends ClockEventMap, so the cast is safe.)
  const clock = createClock(
    context,
    <K extends keyof ClockEventMap>(type: K, detail: ClockEventMap[K]) =>
      events.emit(type, detail as CoreEventMap[K]),
    {
      spinUp: SPIN_UP,
      spinDown: SPIN_DOWN,
      rewindBpm: REWIND_BPM,
      rewindRamp: REWIND_RAMP,
      ...options,
    },
  );

  // The transport speed as a sound signal. It follows each speed change of the clock exactly.
  const speedSignal = new ConstantSourceNode(context, { offset: 0 });
  speedSignal.start();
  // Chrome only moves a node's changes (the ramps) forward while something reads it all the time.
  // Sounds read it only while they play, so without this it stays stuck in the middle of a ramp
  // (everything too low). An analyser always reads its input, and it makes no sound.
  speedSignal.connect(new AnalyserNode(context, { fftSize: 32 }));
  events.on("speedchange", ({ plan }) => {
    const offset = speedSignal.offset;
    const now = context.currentTime;
    offset.cancelScheduledValues(0);
    // From the speed now, then in straight lines from point to point (a jump: two at one time).
    offset.setValueAtTime(clock.speedAt(now), now);
    let last = now;
    for (const { time, speed } of plan) {
      if (time <= now) continue;
      if (time === last) offset.setValueAtTime(speed, time);
      else offset.linearRampToValueAtTime(speed, time);
      last = time;
    }
  });

  const modules = new Map<string, AudioModule>();
  const cleanups = new Map<string, () => void>();

  // The patch (see patch.ts): each module's jacks, and the cables between them.
  const patchModules = new Map<string, PatchModule & { nodes: Map<string, readonly AudioNode[]> }>();
  let cables: Cable[] = [];
  let cableCount = 0;
  /** The audio connections each cable made, to undo them when it is taken out. */
  const wired = new Map<string, (readonly [AudioNode, AudioNode])[]>();
  const allPatchModules = () => [...patchModules.values()];
  const nodesOf = (plug: Plug): readonly AudioNode[] => patchModules.get(plug.module)?.nodes.get(plug.port) ?? [];

  // Triggers (see Trigger in module.ts) go along the trigger cables, from a module's trigger out to
  // the trigger in of each module plugged into it. A module on the way can change them.
  // Each module's trigger listeners and pass-through change, by module id.
  const triggerListeners = new Map<string, ((trigger: Trigger) => void)[]>();
  const triggerPasses = new Map<string, (trigger: Trigger) => Trigger | null>();
  const sendTrigger = (from: string, trigger: Trigger) =>
    routeTrigger(
      cables,
      from,
      trigger,
      (id) => ({
        listeners: triggerListeners.get(id),
        pass: triggerPasses.get(id),
      }),
      // Like the event bus: one broken listener does not stop the others.
      reportError,
    );

  const connect = (a: Plug, b: Plug): Cable | null => {
    const check = checkCable(allPatchModules(), cables, a, b);
    if (!check.ok) return null;
    const cable: Cable = { id: `cable-${++cableCount}`, from: check.from, to: check.to };
    // Channels: channel k to channel k. Audio: one node to one node. Triggers: no sound.
    const from = nodesOf(cable.from);
    const to = nodesOf(cable.to);
    const pairs = from.slice(0, to.length).map((node, k) => [node, to[k]!] as const);
    for (const [node, target] of pairs) node.connect(target);
    wired.set(cable.id, pairs);
    cables = [...cables, cable];
    events.emit("cablechange", { cable, connected: true });
    return cable;
  };

  const disconnect = (cable: Cable) => {
    const found = cables.find((other) => other.id === cable.id);
    if (!found) return;
    for (const [node, target] of wired.get(found.id) ?? []) {
      try {
        node.disconnect(target);
      } catch {
        // Already gone, for example a removed module disconnected its own output.
      }
    }
    wired.delete(found.id);
    cables = cables.filter((other) => other !== found);
    events.emit("cablechange", { cable: found, connected: false });
  };

  /** A module's jacks, from the audio nodes it has (see ModuleSetupResult in module.ts). */
  const patchModuleOf = (id: string, result: ModuleSetupResult) => {
    const ports: Port[] = [];
    const nodes = new Map<string, readonly AudioNode[]>();
    const port = (portId: string, label: string, kind: Port["kind"], direction: Port["direction"], list: readonly AudioNode[]) => {
      ports.push({ id: portId, label, kind, direction });
      nodes.set(portId, list);
    };
    const letter = (bus: number) => String.fromCharCode(97 + bus);
    const channels = (list: readonly AudioNode[]) => `Ch 1–${list.length}`;
    const passes = triggerPasses.has(id);
    if (triggerListeners.has(id) || passes) port("trigger-in", "Trig", "trigger", "in", []);
    if (result.channelInputs?.length) port("channels-in", channels(result.channelInputs), "channels", "in", result.channelInputs);
    if (result.input) port("in", "In", "audio", "in", [result.input]);
    result.returnInputs?.forEach((node, bus) => port(`return-${letter(bus)}`, `Rtn ${letter(bus).toUpperCase()}`, "audio", "in", [node]));
    if (result.output) port("out", "Out", "audio", "out", [result.output]);
    result.sendOutputs?.forEach((node, bus) => port(`send-${letter(bus)}`, `Snd ${letter(bus).toUpperCase()}`, "audio", "out", [node]));
    if (result.channelOutputs?.length) port("channels-out", channels(result.channelOutputs), "channels", "out", result.channelOutputs);
    if (result.triggerOutput || passes) port("trigger-out", "Trig", "trigger", "out", []);
    return { id, ports, nodes, routes: result.routes, end: !!result.speakerOutput };
  };

  const remove = (module: AudioModule) => {
    const cleanup = cleanups.get(module.id);
    if (!cleanup) return;
    for (const cable of cables) {
      if (cable.from.module === module.id || cable.to.module === module.id) disconnect(cable);
    }
    modules.delete(module.id);
    patchModules.delete(module.id);
    cleanups.delete(module.id);
    module.output?.disconnect();
    module.speakerOutput?.disconnect(output);
    cleanup();
    events.emit("moduleremove", { module });
  };

  const core: Core = {
    context,
    output,
    events,
    clock,
    modules,
    get bpm() {
      return clock.bpm;
    },
    get playing() {
      return clock.running;
    },
    get stopping() {
      return clock.stopping;
    },
    get rewinding() {
      return clock.rewinding;
    },
    get speed() {
      return clock.speed;
    },
    speedAt: (time) => clock.speedAt(time),
    speedSignal,
    setBpm(bpm) {
      if (bpm === clock.bpm) return;
      clock.setBpm(bpm);
      events.emit("bpmchange", { bpm: clock.bpm });
    },
    async start() {
      if (context instanceof AudioContext && context.state !== "running")
        await context.resume();
      clock.start();
    },
    stop() {
      clock.stop();
    },
    async rewind() {
      if (context instanceof AudioContext && context.state !== "running")
        await context.resume();
      clock.rewind();
    },
    add(definition, ...[moduleOptions]) {
      if (!core.canAdd(definition)) {
        throw new Error(`Only one ${definition.name} at a time.`);
      }
      const id = crypto.randomUUID();
      const controller = new AbortController();
      const disposers: (() => void)[] = [];
      const scopedOn =
        (signal: AbortSignal): ScopedOn =>
        (type, listener, listenOptions) =>
          events.on(type, listener, { ...listenOptions, signal });

      const ctx: ModuleContext = {
        core,
        audio: context,
        signal: controller.signal,
        on: scopedOn(controller.signal),
        onDispose: (fn) => disposers.push(fn),
        send: (trigger) => sendTrigger(id, trigger),
        onTrigger: (listener) => {
          if (controller.signal.aborted) return;
          const listeners = triggerListeners.get(id) ?? [];
          listeners.push(listener);
          triggerListeners.set(id, listeners);
        },
        passTrigger: (change) => {
          if (!controller.signal.aborted) triggerPasses.set(id, change);
        },
        changed: () => {
          // Only after setup is done and while the module is still in the core.
          if (modules.get(id) === module)
            events.emit("modulechange", { module });
        },
      };

      const result = definition.setup(ctx, moduleOptions as never);

      // Add id, name, mount and remove to the object that setup returned.
      // (Object.assign keeps any getters that setup defined, for example `get volume()`.)
      const module: AudioModule<typeof result> = Object.assign(result, {
        id,
        type: definition.type,
        name: definition.name,
        remove: () => remove(module),
        mount(parent: Element) {
          // The UI gets its own Shadow DOM: its CSS cannot leak out, and page CSS cannot leak in.
          const host = document.createElement("section");
          host.dataset.module = id;
          host.setAttribute("aria-label", definition.name);
          const root = host.attachShadow({ mode: "open" });

          // Unmount when the UI is removed OR when the module is removed.
          const mounted = new AbortController();
          const signal = AbortSignal.any([mounted.signal, controller.signal]);
          const unmount = () => {
            mounted.abort();
            host.remove();
          };
          controller.signal.addEventListener("abort", unmount, {
            signal: mounted.signal,
          });

          const ui = definition.ui;
          if (ui) {
            const styles = ui.styles ? [ui.styles].flat() : [];
            root.adoptedStyleSheets = styles.map(toStyleSheet);
            render(ui.template({ module, core }), root);
          }
          parent.append(host);
          ui?.script?.({ module, core, root, signal, on: scopedOn(signal) });
          return unmount;
        },
      });

      patchModules.set(id, patchModuleOf(id, result));
      result.speakerOutput?.connect(output);
      modules.set(id, module);
      cleanups.set(id, () => {
        controller.abort();
        triggerListeners.delete(id);
        triggerPasses.delete(id);
        for (const fn of disposers.reverse()) fn();
      });
      events.emit("moduleadd", { module });
      return module;
    },
    canAdd: (definition) =>
      !definition.unique || ![...modules.values()].some((module) => module.type === definition.type),
    remove,
    move(module, index) {
      if (modules.get(module.id) !== module) return;
      const order = [...modules.values()].filter((other) => other !== module);
      const to = Math.max(0, Math.min(order.length, Math.round(index)));
      if (to === [...modules.keys()].indexOf(module.id)) return;
      order.splice(to, 0, module);
      // A Map keeps the order things were added in, so add them again in the new order.
      modules.clear();
      for (const other of order) modules.set(other.id, other);
      events.emit("modulemove", { module, index: to });
    },
    get cables() {
      return cables;
    },
    ports: (id) => patchModules.get(id)?.ports ?? [],
    canConnect: (a, b) => checkCable(allPatchModules(), cables, a, b),
    connect,
    disconnect,
    autoPatch(module) {
      const order = [...modules.keys()].map((id) => patchModules.get(id)!);
      const change = autoPatch(order, cables, module.id);
      for (const old of change.remove) {
        const cable = cables.find((c) => samePlug(c.from, old.from) && samePlug(c.to, old.to));
        if (cable) disconnect(cable);
      }
      for (const { from, to } of change.add) connect(from, to);
    },
    async dispose() {
      clock.halt();
      for (const module of [...modules.values()]) remove(module);
      speedSignal.stop();
      if (context instanceof AudioContext) await context.close();
    },
  };

  return core;
}

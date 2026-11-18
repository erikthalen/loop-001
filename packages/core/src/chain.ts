/**
 * The audio chain: sound flows through the modules one after the other, like cables between
 * hardware boxes, and then to the speakers.
 *
 *   core.input ─▶ module 1 ─▶ module 2 ─▶ ... ─▶ core.output ─▶ speakers
 *
 * Each module gets an "out jack" (a junction node) from the core. What reaches the jack goes on
 * to the next module. What a module does with the sound depends on the nodes it has:
 *
 * | Module has          | Example         | The sound from before ...                  | The module's sound |
 * | ------------------- | --------------- | ------------------------------------------ | ------------------ |
 * | input and output    | filter          | goes through the module                    | goes to the jack   |
 * | only output         | metronome       | goes past the module, to the jack (thru)   | is mixed in        |
 * | only input          | meter, recorder | goes to the module AND past it, to the jack | (none)             |
 * | neither             | a UI only       | goes past the module, to the jack          | (none)             |
 *
 * This file only plans the cables. It knows nothing about Web Audio, so it is easy to test.
 */

/** One module in the chain, as the chain sees it. `N` is a node (an AudioNode in the app). */
export interface ChainSlot<N> {
  /** The module's input, if it takes sound in. */
  readonly input?: N
  /** The module's output, if it sends sound out. */
  readonly output?: N
  /** The out jack that the core made for this module. */
  readonly jack: N
}

/** One cable: from a node to a node. */
export type ChainConnection<N> = readonly [from: N, to: N]

/** All cables for the chain `start ─▶ slots ─▶ end`, in order. */
export function planChain<N>(start: N, slots: readonly ChainSlot<N>[], end: N): ChainConnection<N>[] {
  const connections: ChainConnection<N>[] = []
  let previous = start
  for (const slot of slots) {
    if (slot.input) connections.push([previous, slot.input])
    // No way through the module: the sound from before goes past it.
    if (!slot.input || !slot.output) connections.push([previous, slot.jack])
    if (slot.output) connections.push([slot.output, slot.jack])
    previous = slot.jack
  }
  connections.push([previous, end])
  return connections
}

/** One module, as the channel cables see it (see planChannels). */
export interface ChannelSlot<N> {
  /** The module's out jack (where its sound joins the main chain). */
  readonly jack: N
  /** One output per channel: the module sends each channel's sound out separately (a sampler). */
  readonly channelOutputs?: readonly N[]
  /** One input per channel: the module takes the channels in (a mixer). */
  readonly channelInputs?: readonly N[]
}

/**
 * The channel cables. Besides the main chain, a module can send its sound per channel (for
 * example a sampler: channel 1, channel 2...), and a later module can take the channels in (a
 * mixer). Channel k of every module that sends goes to channel k of the next module that takes
 * them. Sound that no module after it takes joins the main chain at the module that sent it (its
 * jack), so it is still heard, as if the module had a normal output.
 */
export function planChannels<N>(slots: readonly ChannelSlot<N>[]): ChainConnection<N>[] {
  const connections: ChainConnection<N>[] = []
  // Per channel: the outputs that wait for a module that takes them, and their module's jack.
  const waiting: { output: N; jack: N }[][] = []
  for (const slot of slots) {
    slot.channelInputs?.forEach((input, k) => {
      for (const { output } of waiting[k] ?? []) connections.push([output, input])
      waiting[k] = []
    })
    slot.channelOutputs?.forEach((output, k) => {
      ;(waiting[k] ??= []).push({ output, jack: slot.jack })
    })
  }
  // Not taken by any module after it: into the main chain, at the module that sent it.
  for (const channel of waiting) for (const { output, jack } of channel ?? []) connections.push([output, jack])
  return connections
}

/** One module, as the send cables see it (see planSends). */
export interface SendSlot<N> {
  /** One send bus per bus (bus A first): the module sends some of its sound out (a mixer). */
  readonly sendOutputs?: readonly N[]
  /** One return per bus: where the effect on that bus plays back into the module (a mixer). */
  readonly returnInputs?: readonly N[]
  /** The module is an effect on a send bus (a delay): which bus, and its input and output. */
  readonly sendEffect?: { readonly bus: number; readonly input: N; readonly output: N }
}

/**
 * The index of the module whose send bus `bus` an effect at `index` takes: the closest module
 * before it that has that bus (a mixer). -1: none.
 */
export function sendSourceOf<N>(slots: readonly SendSlot<N>[], index: number, bus: number): number {
  for (let i = index - 1; i >= 0; i--) if (slots[i]?.sendOutputs?.[bus]) return i
  return -1
}

/**
 * The send cables, like the aux sends of a hardware mixer: an effect on send bus k (a delay) takes
 * send bus k of the closest module before it that has one (a mixer), and plays into that module's
 * return k:
 *
 *   mixer: send A ─▶ delay (on send A) ─▶ mixer: return A
 *
 * An effect with no mixer before it gets no sound. Several effects on the same bus each get it.
 */
export function planSends<N>(slots: readonly SendSlot<N>[]): ChainConnection<N>[] {
  const connections: ChainConnection<N>[] = []
  slots.forEach((slot, index) => {
    const effect = slot.sendEffect
    if (!effect) return
    const source = slots[sendSourceOf(slots, index, effect.bus)]
    const send = source?.sendOutputs?.[effect.bus]
    if (!send) return
    connections.push([send, effect.input])
    const back = source.returnInputs?.[effect.bus]
    if (back) connections.push([effect.output, back])
  })
  return connections
}

/** One module's output stage, as the cables see it (see planStages). */
export interface StageSlot<N> {
  readonly input: N
  readonly output: N
}

/**
 * The output stage: after the end of the chain, before the speakers. The modules that have one
 * (for example Master: the rewind tape and the volume) are put in a row, in chain order:
 *
 *   end of the chain ─▶ stage 1 ─▶ stage 2 ─▶ ... ─▶ core.output ─▶ speakers
 *
 * So the whole sound goes through every stage, and where a module is in the chain only sets the
 * order of the stages. No stages: the end of the chain goes straight to `end`.
 */
export function planStages<N>(start: N, stages: readonly StageSlot<N>[], end: N): ChainConnection<N>[] {
  const connections: ChainConnection<N>[] = []
  let previous = start
  for (const stage of stages) {
    connections.push([previous, stage.input])
    previous = stage.output
  }
  connections.push([previous, end])
  return connections
}

/**
 * The ids after `from` in the chain order: the modules that get `from`'s triggers.
 * Empty if `from` is not in the chain.
 */
export function modulesAfter(order: readonly string[], from: string): string[] {
  const index = order.indexOf(from)
  return index < 0 ? [] : order.slice(index + 1)
}

/** What one module does with the triggers that reach it (see routeTrigger). */
export interface TriggerStop<T> {
  /** Called with each trigger that reaches the module. */
  readonly listeners?: readonly ((trigger: T) => void)[]
  /** Changes the trigger for the modules after this one. null: stop it here. */
  readonly pass?: (trigger: T) => T | null
}

/**
 * Send a trigger down the chain, from `from` to the end, like sound through hardware boxes:
 * each module after `from` hears the trigger, then may change it (or stop it) for the modules after
 * it. Modules before `from` never get it. A listener or pass that throws is reported to `onError`
 * and skipped (the trigger goes on unchanged).
 */
export function routeTrigger<T>(
  order: readonly string[],
  from: string,
  trigger: T,
  stopOf: (id: string) => TriggerStop<T> | undefined,
  onError: (error: unknown) => void = () => {},
): void {
  let current: T | null = trigger
  for (const id of modulesAfter(order, from)) {
    const stop = stopOf(id)
    for (const listener of stop?.listeners ?? []) {
      try {
        listener(current)
      } catch (error) {
        onError(error)
      }
    }
    if (!stop?.pass) continue
    try {
      current = stop.pass(current)
    } catch (error) {
      onError(error)
    }
    if (current === null) return
  }
}

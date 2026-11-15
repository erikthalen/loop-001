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

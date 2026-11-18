/**
 * The patch: modules are connected with cables, like hardware boxes. A cable goes from an output
 * jack (a "port") of one module to an input jack of another. Nothing else connects them: a module
 * with no cables gets no sound and sends none.
 *
 *   sequencer ─trig─▶ sampler ═ch 1–6═▶ mixer ─out─▶ low pass ─out─▶ master ▶ speakers
 *                                        │snd a      ▲rtn a
 *                                        └─▶ delay ──┘
 *
 * The speakers have no jack: one module (Master) plays straight into them (`speakerOutput` in
 * module.ts). That module is the end of the sound (`end`).
 *
 * Three kinds of cable, and a cable only joins two jacks of the same kind:
 * - audio: one sound.
 * - channels: one sound per channel, side by side (a sampler's 6 channels into a mixer).
 * - trigger: "play channel X at time T" (a sequencer into a sampler). No sound.
 *
 * An output can feed many inputs, and an input can take many outputs (the sounds add up).
 * A loop is not allowed: Web Audio makes a loop silent. To find loops, each module says which of
 * its inputs reach which of its outputs (`routes`). By default, every input reaches every output.
 *
 * This file knows nothing about Web Audio, so it is easy to test.
 */

export type PortKind = 'audio' | 'channels' | 'trigger'

/** One jack of a module. */
export interface Port {
  /** Unique in its module, for example 'in', 'out', 'send-a', 'channels-in'. Saved in projects. */
  readonly id: string
  /** Short name to show, for example 'In', 'Snd A', 'Ch 1–6'. */
  readonly label: string
  readonly kind: PortKind
  readonly direction: 'in' | 'out'
}

/** One end of a cable: a module and one of its ports. */
export interface Plug {
  readonly module: string
  readonly port: string
}

export interface Cable {
  /** Unique while the app runs (not saved). */
  readonly id: string
  /** Always an output port. */
  readonly from: Plug
  /** Always an input port. */
  readonly to: Plug
}

/** A module, as the patch sees it: its jacks, and which inputs reach which outputs. */
export interface PatchModule {
  readonly id: string
  readonly ports: readonly Port[]
  /** [input port id, output port id] pairs. Leave it out: every input reaches every output. */
  readonly routes?: readonly (readonly [input: string, output: string])[]
  /** True: it plays straight into the speakers (Master). New sound sources play into it. */
  readonly end?: boolean
}

export type CableCheck =
  | { readonly ok: true; readonly from: Plug; readonly to: Plug }
  | { readonly ok: false; readonly reason: string }

export const samePlug = (a: Plug, b: Plug) => a.module === b.module && a.port === b.port

/** The port a plug points to, or undefined. */
export function portOf(modules: readonly PatchModule[], plug: Plug): Port | undefined {
  return modules.find((module) => module.id === plug.module)?.ports.find((port) => port.id === plug.port)
}

/** The outputs that an input of a module reaches inside the module (see `routes`). */
function outputsOf(module: PatchModule, input: string): string[] {
  const outputs = module.ports.filter((port) => port.direction === 'out').map((port) => port.id)
  if (!module.routes) return outputs
  return module.routes.filter(([from, to]) => from === input && outputs.includes(to)).map(([, to]) => to)
}

/** Does sound (or a trigger) get from `start` to `goal`, through cables and through modules? */
export function reaches(
  modules: readonly PatchModule[],
  cables: readonly Pick<Cable, 'from' | 'to'>[],
  start: Plug,
  goal: Plug,
): boolean {
  const seen = new Set<string>()
  const stack = [start]
  while (stack.length) {
    const plug = stack.pop()!
    if (samePlug(plug, goal)) return true
    const key = `${plug.module}\n${plug.port}`
    if (seen.has(key)) continue
    seen.add(key)
    const port = portOf(modules, plug)
    if (!port) continue
    if (port.direction === 'in') {
      const module = modules.find((m) => m.id === plug.module)!
      for (const output of outputsOf(module, plug.port)) stack.push({ module: plug.module, port: output })
    } else {
      for (const cable of cables) if (samePlug(cable.from, plug)) stack.push(cable.to)
    }
  }
  return false
}

/**
 * Can a cable join `a` and `b`? They can be given in any order (output first, or input first).
 * If yes, it says which end is the output (`from`) and which is the input (`to`).
 */
export function checkCable(
  modules: readonly PatchModule[],
  cables: readonly Pick<Cable, 'from' | 'to'>[],
  a: Plug,
  b: Plug,
): CableCheck {
  const portA = portOf(modules, a)
  const portB = portOf(modules, b)
  if (!portA || !portB) return { ok: false, reason: 'That jack does not exist.' }
  if (samePlug(a, b)) return { ok: false, reason: 'A jack cannot connect to itself.' }
  if (portA.direction === portB.direction) {
    return { ok: false, reason: portA.direction === 'in' ? 'Both are inputs. Connect an output to an input.' : 'Both are outputs. Connect an output to an input.' }
  }
  if (portA.kind !== portB.kind) {
    const kinds = [portA.kind, portB.kind]
    return {
      ok: false,
      reason: kinds.includes('trigger') ? 'Triggers only go to trigger jacks.' : 'Channels only go to a channels jack.',
    }
  }
  const [from, to] = portA.direction === 'out' ? [a, b] : [b, a]
  if (cables.some((cable) => samePlug(cable.from, from) && samePlug(cable.to, to))) {
    return { ok: false, reason: 'These two are already connected.' }
  }
  if (reaches(modules, cables, to, from)) return { ok: false, reason: 'That makes a loop, and a loop goes silent.' }
  return { ok: true, from: { ...from }, to: { ...to } }
}

/** What autoPatch wants to change: cables to take out, then cables to put in. */
export interface PatchChange {
  readonly remove: readonly Pick<Cable, 'from' | 'to'>[]
  readonly add: readonly Pick<Cable, 'from' | 'to'>[]
}

/**
 * Cables for a module that was just added, so it works without patching by hand. `modules` is in
 * rack order (the new one in it, usually last). It only looks at the modules above the new one,
 * and at the end module (`end`: Master):
 * - Trigger in: from the closest module above with a trigger out. The same for channels.
 * - An effect (audio in and out): goes in after the closest module above with an audio out. That
 *   module's cables now come from the effect, and the module plays into the effect.
 *   No module above (or it had no cables): the effect plays into the end module.
 * - Only an audio in (a meter, or Master itself): listens to the closest module above with an
 *   audio out.
 * - Only an audio out (a metronome): plays into the end module.
 * No end module: those cables are left out.
 * Sends and returns are never patched for you. A cable that would make a loop is left out.
 */
export function autoPatch(
  modules: readonly PatchModule[],
  cables: readonly Pick<Cable, 'from' | 'to'>[],
  id: string,
): PatchChange {
  const index = modules.findIndex((module) => module.id === id)
  const module = modules[index]
  if (!module) return { remove: [], add: [] }
  let current = [...cables]
  const remove: Pick<Cable, 'from' | 'to'>[] = []
  const add: Pick<Cable, 'from' | 'to'>[] = []
  const has = (m: PatchModule, port: string, direction: 'in' | 'out') =>
    m.ports.some((p) => p.id === port && p.direction === direction)
  const above = (port: string) => modules.slice(0, index).reverse().find((m) => has(m, port, 'out'))
  const plug = (m: string, port: string): Plug => ({ module: m, port })
  const tryAdd = (from: Plug, to: Plug) => {
    const check = checkCable(modules, current, from, to)
    if (!check.ok) return false
    const cable = { from: check.from, to: check.to }
    current.push(cable)
    add.push(cable)
    return true
  }

  for (const port of ['trigger', 'channels'] as const) {
    if (!has(module, `${port}-in`, 'in')) continue
    const source = above(`${port}-out`)
    if (source) tryAdd(plug(source.id, `${port}-out`), plug(id, `${port}-in`))
  }

  const audioIn = has(module, 'in', 'in')
  const audioOut = has(module, 'out', 'out')
  const end = modules.find((m) => m.end && m.id !== id && has(m, 'in', 'in'))
  const intoEnd = () => end && tryAdd(plug(id, 'out'), plug(end.id, 'in'))
  if (audioIn && audioOut) {
    const source = above('out')
    const from = source && plug(source.id, 'out')
    const targets = from ? current.filter((cable) => samePlug(cable.from, from)) : []
    current = current.filter((cable) => !targets.includes(cable))
    remove.push(...targets)
    if (from) tryAdd(from, plug(id, 'in'))
    if (targets.length) for (const { to } of targets) tryAdd(plug(id, 'out'), to)
    else intoEnd()
  } else if (audioIn) {
    const source = above('out')
    if (source) tryAdd(plug(source.id, 'out'), plug(id, 'in'))
  } else if (audioOut) {
    intoEnd()
  }
  return { remove, add }
}

/**
 * The modules a trigger goes to: each module plugged into `from`'s trigger out. `pass` can change
 * the trigger for the modules after one (or stop it: null), and those get it from that module's
 * trigger out. A listener or pass that throws is reported to `onError` and skipped.
 */
export function routeTrigger<T>(
  cables: readonly Pick<Cable, 'from' | 'to'>[],
  from: string,
  trigger: T,
  stopOf: (id: string) => { readonly listeners?: readonly ((trigger: T) => void)[]; readonly pass?: (trigger: T) => T | null } | undefined,
  onError: (error: unknown) => void = () => {},
  depth = 0,
): void {
  // Loops are not allowed, so this is only a guard.
  if (depth > 64) return
  for (const cable of cables) {
    if (cable.from.module !== from || cable.from.port !== 'trigger-out' || cable.to.port !== 'trigger-in') continue
    const id = cable.to.module
    const stop = stopOf(id)
    for (const listener of stop?.listeners ?? []) {
      try {
        listener(trigger)
      } catch (error) {
        onError(error)
      }
    }
    if (!stop?.pass) continue
    let next: T | null = trigger
    try {
      next = stop.pass(trigger)
    } catch (error) {
      onError(error)
    }
    if (next !== null) routeTrigger(cables, id, next, stopOf, onError, depth + 1)
  }
}

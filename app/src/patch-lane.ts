import { html, render, type AudioModule, type Cable, type Core, type Plug, type Port } from '@loop/core'
import { CHANNEL_COLORS } from '@loop/ui'

export interface PatchLaneOptions {
  /** Holds the rack. The cables are drawn over it, in its left padding. */
  root: HTMLElement
  /** The color of the cables out of a module. */
  colorOf: (module: AudioModule) => string
}

export interface PatchLane {
  /** The jack strip for a module: put it in the module's slot (it sits left of the module). */
  jackStrip(module: AudioModule): HTMLElement
}

/** The distance between two tracks of the lane, in px. */
const TRACK = 4
/** The first track's distance from the jack strips, in px. */
const FIRST_TRACK = 3

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const keyOf = (plug: Plug) => `${plug.module}\n${plug.port}`
const plugOf = (element: Element): Plug => {
  const { module, port } = (element as HTMLElement).dataset
  return { module: module!, port: port! }
}
const f = (n: number) => n.toFixed(1)

/**
 * The short label under a jack (written downwards, so the strip stays narrow): "CH", "TRIG", and
 * only the bus letter for a send or return ("A": the dot or ring says which one). Screen readers
 * get the full name (the port's label).
 */
function shortLabel(port: Port): string {
  if (port.kind === 'channels') return 'Ch'
  if (port.kind === 'trigger') return 'Trig'
  const bus = /^(?:send|return)-(\w+)$/.exec(port.id)
  return bus ? bus[1]!.toUpperCase() : port.label
}
type Point = { x: number; y: number }

/**
 * The cables, drawn in a lane left of the rack. Each module gets a jack strip on its left: a ring is
 * an input, a dot is an output. Every cable runs in the lane, so no cable crosses a module:
 *
 *    lane     jacks  module
 *   ╭──────── ● Out  ┌────────┐
 *   │ ╭────── ○ In   │ Delay  │
 *   │ │              └────────┘
 *   │ ╰────── ● Snd A ┌───────┐
 *   ╰──────── ○ Rtn A │ Mixer │
 *
 * - Drag from a jack: a cable. Let go on a jack that lights up: it is plugged in (core.connect).
 * - Drag the end of a cable off an input: it comes out (or goes into the jack you let go on).
 * - Click a jack (or Enter): then click a lit jack to connect them. Escape stops.
 * - Click a cable: it is selected. Delete (or Backspace) takes it out.
 *
 * Short cables are near the rack, long ones further out. An output that feeds several inputs is one
 * line with a branch to each. A channels cable is dashed in the 6 channel colors, a trigger cable is dotted.
 * The rack moves the modules (dnd-kit); the cables follow every frame, and slide to their new tracks.
 */
export function createPatchLane(core: Core, options: PatchLaneOptions): PatchLane {
  const { root, colorOf } = options

  // ——— The drawing layer ———
  root.insertAdjacentHTML(
    'beforeend',
    `<svg class="wires" aria-hidden="true"><g class="base"></g><g class="over"></g><g class="temp"></g><g class="hits"></g></svg>`,
  )
  const wires = root.querySelector<SVGSVGElement>('.wires')!
  const layer = {
    base: wires.querySelector('.base')!,
    over: wires.querySelector('.over')!,
    temp: wires.querySelector('.temp')!,
    hits: wires.querySelector('.hits')!,
  }

  /** The dot of each jack, by plug. Only the real ones: dnd-kit makes copies while it drags. */
  const dots = new Map<string, HTMLElement>()

  const portOf = (plug: Plug): Port | undefined => core.ports(plug.module).find((port) => port.id === plug.port)
  const moduleName = (id: string) => core.modules.get(id)?.name ?? '?'
  const name = (plug: Plug) => `${moduleName(plug.module)} ${portOf(plug)?.label ?? plug.port}`
  const color = (plug: Plug) => {
    const module = core.modules.get(plug.module)
    return module ? colorOf(module) : 'var(--ink)'
  }

  function strip(id: string): HTMLElement {
    const element = document.createElement('div')
    element.className = 'jacks'
    const ports = core.ports(id)
    const jack = (port: Port) => html`
      <button type="button" class="jack ${port.direction}" data-module="${id}" data-port="${port.id}">
        <span class="dot"></span><span class="label">${shortLabel(port)}</span>
      </button>
    `
    const group = (direction: Port['direction']) => {
      const list = ports.filter((port) => port.direction === direction)
      return list.length ? html`<div class="jack-group">${list.map(jack)}</div>` : ''
    }
    render(html`${group('in')}${group('out')}`, element)
    for (const button of element.querySelectorAll('.jack')) dots.set(keyOf(plugOf(button)), button.querySelector<HTMLElement>('.dot')!)
    return element
  }

  /**
   * The jack strips' left edge: the lane is left of it. A dragged module moves, so measure an
   * empty, invisible strip that never moves (it sits where every strip sits, left of the rack).
   */
  const edgeStrip = document.createElement('div')
  edgeStrip.className = 'jacks'
  edgeStrip.style.visibility = 'hidden'
  edgeStrip.setAttribute('aria-hidden', 'true')
  root.append(edgeStrip)

  core.events.on('moduleremove', ({ module }) => {
    for (const key of [...dots.keys()]) if (key.startsWith(`${module.id}\n`)) dots.delete(key)
  })

  // ——— State ———
  let selected: string | null = null
  /** A pointer is down on a jack (a click, or the start of a drag). */
  let press: { plug: Plug; x: number; y: number; moved: boolean } | null = null
  /** A cable in your hand: from `from` (the end that stays plugged in), to the pointer. */
  let drag: { from: Plug; picked?: Cable; point?: Point; over?: Plug } | null = null
  /** A clicked jack, waiting for a second click on another jack. */
  let pending: Plug | null = null

  /** Update the jacks (connectable, labels). The cables are drawn every frame. */
  function refresh() {
    const origin = drag?.from ?? pending
    root.classList.toggle('connecting', !!origin)
    for (const [key, dot] of dots) {
      const jack = dot.parentElement!
      const plug = plugOf(jack)
      const mine = core.cables.filter((c) => keyOf(c.from) === key || keyOf(c.to) === key)
      const can = !!origin && keyOf(origin) !== key && core.canConnect(origin, plug).ok
      jack.classList.toggle('origin', !!origin && keyOf(origin) === key)
      jack.classList.toggle('can', can)
      jack.classList.toggle('hot', can && !!drag?.over && keyOf(drag.over) === key)
      const others = mine.map((c) => (keyOf(c.from) === key ? name(c.to) : name(c.from)))
      jack.setAttribute(
        'aria-label',
        `${name(plug)} ${portOf(plug)?.direction === 'in' ? 'input' : 'output'}. ` +
          (others.length ? `Connected to ${others.join(', ')}.` : 'Not connected.'),
      )
    }
  }
  for (const type of ['cablechange', 'moduleadd', 'moduleremove', 'modulemove'] as const) {
    core.events.on(type, () => {
      if (selected && !core.cables.some((c) => c.id === selected)) selected = null
      refresh()
    })
  }

  // ——— Drawing: every frame, because the modules move (dnd-kit) ———
  const sig = { base: '', over: '', temp: '', hits: '' }
  const set = (key: keyof typeof sig, markup: string) => {
    if (sig[key] === markup) return
    sig[key] = markup
    layer[key].innerHTML = markup
  }
  /** Each output's track, as it slides to a new one (a fraction while it moves). */
  const trackOf = new Map<string, number>()
  let outerTrack = 1
  let last = 0

  /** A U from a to b (a above b), its upright at x (left of both). */
  function uPath(a: Point, b: Point, x: number, radius = 4) {
    const r = Math.max(0, Math.min(radius, Math.abs(b.y - a.y) / 2))
    return `M${f(a.x)} ${f(a.y)}H${f(x + r)}Q${f(x)} ${f(a.y)} ${f(x)} ${f(a.y + r)}V${f(b.y - r)}Q${f(x)} ${f(b.y)} ${f(x + r)} ${f(b.y)}H${f(b.x)}`
  }
  /** How long each channel's color is along a channels cable, in px. */
  const STRIPE = 10
  /**
   * A channels cable: as thin as any cable, in the 6 channel colors one after the other (hard
   * stops), like a rainbow cut in pieces. Six copies of the path, each one dashed: a STRIPE of its
   * color, then a gap for the other five, each copy moved on by one STRIPE.
   */
  function rainbow(d: string, width: number) {
    const gap = STRIPE * (CHANNEL_COLORS.length - 1)
    return CHANNEL_COLORS.map(
      (channel, k) =>
        `<path d="${d}" style="stroke:${channel};stroke-linecap:butt" stroke-width="${width}" stroke-dasharray="${STRIPE} ${gap}" stroke-dashoffset="${-k * STRIPE}"/>`,
    ).join('')
  }
  const plugDot = (p: Point, fill: string) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="2.7" style="fill:${fill}"/>`
  const dash = (plug: Plug) => (portOf(plug)?.kind === 'trigger' ? ' stroke-dasharray="2 3.5"' : '')
  function cableSvg(cable: Cable, a: Point, b: Point, x: number, width: number) {
    const [top, bottom] = a.y <= b.y ? [a, b] : [b, a]
    if (portOf(cable.from)?.kind === 'channels') {
      return rainbow(uPath(top, bottom, x), width) + plugDot(a, 'var(--ink)') + plugDot(b, 'var(--ink)')
    }
    const c = color(cable.from)
    return `<path d="${uPath(top, bottom, x)}" style="stroke:${c}" stroke-width="${width}"${dash(cable.from)}/>` + plugDot(a, c) + plugDot(b, c)
  }

  function draw(seconds: number) {
    const step = reducedMotion.matches ? 1 : Math.min(1, seconds * 12)
    const box = root.getBoundingClientRect()
    const edge = edgeStrip.getBoundingClientRect().left - box.left
    const pos = new Map<string, Point>()
    for (const [key, dot] of dots) {
      const r = dot.getBoundingClientRect()
      pos.set(key, { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top })
    }
    const at = (plug: Plug) => pos.get(keyOf(plug))
    const cables = core.cables.filter((c) => at(c.from) && at(c.to))

    // One net per output: it can feed several inputs, which share its upright.
    const groups = new Map<string, Cable[]>()
    for (const c of cables) {
      const key = keyOf(c.from)
      groups.set(key, [...(groups.get(key) ?? []), c])
    }
    const nets = [...groups].map(([key, list]) => {
      const ys = [at(list[0]!.from)!.y, ...list.map((c) => at(c.to)!.y)]
      return { key, list, top: Math.min(...ys), bottom: Math.max(...ys), track: 0 }
    })
    // Short nets near the rack, long ones further out: each takes the first free track.
    nets.sort((a, b) => a.bottom - a.top - (b.bottom - b.top))
    const tracks: (typeof nets)[] = []
    for (const net of nets) {
      let t = 0
      while (tracks[t]?.some((o) => !(net.bottom + 8 < o.top || net.top - 8 > o.bottom))) t++
      ;(tracks[t] ??= []).push(net)
      net.track = t
    }
    outerTrack += (Math.max(1, tracks.length) - outerTrack) * step
    const xOf = new Map<string, number>()
    for (const net of nets) {
      let t = trackOf.get(net.key) ?? net.track
      t += (net.track - t) * step
      if (Math.abs(net.track - t) < 0.01) t = net.track
      trackOf.set(net.key, t)
      xOf.set(net.key, edge - FIRST_TRACK - t * TRACK)
    }

    let base = ''
    for (const net of nets) {
      const x = xOf.get(net.key)!
      if (net.list.length === 1) {
        const c = net.list[0]!
        base += cableSvg(c, at(c.from)!, at(c.to)!, x, 1.3)
        continue
      }
      // Several inputs: one upright, and a branch to each, with a dot where it leaves the upright.
      const from = net.list[0]!.from
      const ends = [at(from)!, ...net.list.map((c) => at(c.to)!)].sort((a, b) => a.y - b.y)
      const c = color(from)
      base += `<path d="${uPath(ends[0]!, ends.at(-1)!, x)}" style="stroke:${c}" stroke-width="1.3"${dash(from)}/>`
      for (const e of ends.slice(1, -1)) {
        base += `<path d="M${f(x)} ${f(e.y)}H${f(e.x)}" style="stroke:${c}" stroke-width="1.3"${dash(from)}/><circle cx="${f(x)}" cy="${f(e.y)}" r="2" style="fill:${c}"/>`
      }
      for (const e of ends) base += plugDot(e, c)
    }
    set('base', base)

    // The selected cable, thicker, so you see what Delete takes out.
    const chosen = cables.find((c) => c.id === selected)
    set('over', chosen ? cableSvg(chosen, at(chosen.from)!, at(chosen.to)!, xOf.get(keyOf(chosen.from))!, 2.4) : '')

    // The cable in your hand: to the jack it would go into, or to the pointer.
    let temp = ''
    const start = drag && at(drag.from)
    if (drag?.point && start) {
      const x = edge - FIRST_TRACK - outerTrack * TRACK
      const target = (drag.over && core.canConnect(drag.from, drag.over).ok && at(drag.over)) || drag.point
      const kind = portOf(drag.from)?.kind
      const c = kind === 'channels' ? 'var(--ink)' : color(drag.from)
      const d = `M${f(start.x)} ${f(start.y)}H${f(x)}V${f(target.y)}H${f(target.x)}`
      temp =
        (kind === 'channels' ? rainbow(d, 1.6) : `<path d="${d}" style="stroke:${c}" stroke-width="1.6"${dash(drag.from)}/>`) +
        plugDot(start, c) +
        `<circle cx="${f(target.x)}" cy="${f(target.y)}" r="3.6" style="fill:${c}"/>`
    }
    set('temp', temp)

    // What the pointer can hit: only the part in the lane, so a cable never covers a jack.
    let hits = ''
    if (!drag) {
      for (const c of cables) {
        const a = { x: edge - 2, y: at(c.from)!.y }
        const b = { x: edge - 2, y: at(c.to)!.y }
        const [top, bottom] = a.y <= b.y ? [a, b] : [b, a]
        hits += `<path data-cable="${c.id}" d="${uPath(top, bottom, xOf.get(keyOf(c.from))!)}"/>`
      }
    }
    set('hits', hits)
  }
  const frame = (now: number) => {
    const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
    last = now
    draw(seconds)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  // ——— Cables: drag, click, keyboard ———
  const jackAt = (event: PointerEvent): Plug | undefined => {
    const jack = document.elementFromPoint(event.clientX, event.clientY)?.closest('.jack')
    // A jack of a dnd-kit copy is not a real jack.
    return jack && dots.get(keyOf(plugOf(jack))) === jack.querySelector('.dot') ? plugOf(jack) : undefined
  }

  function beginDrag(plug: Plug) {
    const held =
      portOf(plug)?.direction === 'in'
        ? [...core.cables].reverse().find((c) => keyOf(c.to) === keyOf(plug))
        : undefined
    if (held) {
      core.disconnect(held)
      drag = { from: held.from, picked: held }
    } else drag = { from: plug }
    pending = null
    selected = null
    document.body.classList.add('patching')
    refresh()
  }
  function endDrag(over: Plug | undefined) {
    const held = drag!
    drag = null
    document.body.classList.remove('patching')
    // Let go on a jack that fits: plugged in. Anywhere else: a picked-up cable stays out.
    if (over) core.connect(held.from, over)
    refresh()
  }
  function clickJack(plug: Plug) {
    if (pending) {
      // The same jack again: stop. A jack that fits: plugged in. Another one: keep waiting.
      if (keyOf(pending) === keyOf(plug)) pending = null
      else if (core.connect(pending, plug)) pending = null
      return refresh()
    }
    pending = plug
    selected = null
    refresh()
  }

  root.addEventListener('pointerdown', (event) => {
    const jack = (event.target as Element).closest('.jack')
    if (!jack || event.button !== 0) return
    event.preventDefault()
    jack.setPointerCapture(event.pointerId)
    press = { plug: plugOf(jack), x: event.clientX, y: event.clientY, moved: false }
  })
  // Move and let go: on the whole window, so the cable follows the pointer anywhere on the page.
  window.addEventListener('pointermove', (event) => {
    if (!press) return
    if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) {
      press.moved = true
      beginDrag(press.plug)
    }
    if (!drag) return
    const box = root.getBoundingClientRect()
    drag.point = { x: event.clientX - box.left, y: event.clientY - box.top }
    const over = jackAt(event)
    if ((over && keyOf(over)) !== (drag.over && keyOf(drag.over))) {
      drag.over = over
      refresh()
    }
  })
  window.addEventListener('pointerup', (event) => {
    if (!press) return
    const { moved, plug } = press
    press = null
    if (moved && drag) endDrag(jackAt(event))
    else if (!moved) clickJack(plug)
  })
  window.addEventListener('pointercancel', () => {
    press = null
    if (!drag) return
    // Put a picked-up cable back where it was.
    if (drag.picked) core.connect(drag.picked.from, drag.picked.to)
    drag = null
    document.body.classList.remove('patching')
    refresh()
  })
  // Keyboard: Enter or Space on a jack does what a click does.
  root.addEventListener('click', (event) => {
    const jack = (event.target as Element).closest('.jack')
    if (jack && event.detail === 0) clickJack(plugOf(jack))
  })

  // Select a cable, and take it out.
  layer.hits.addEventListener('click', (event) => {
    const id = (event.target as SVGElement).dataset?.cable
    const cable = core.cables.find((c) => c.id === id)
    if (!cable) return
    event.stopPropagation()
    selected = cable.id
    pending = null
    refresh()
  })
  const removeSelected = () => {
    const cable = core.cables.find((c) => c.id === selected)
    if (!cable) return
    selected = null
    core.disconnect(cable)
  }
  document.addEventListener('click', (event) => {
    if ((event.target as Element).closest('.jack, .wires')) return
    if (!selected && !pending) return
    selected = null
    pending = null
    refresh()
  })
  document.addEventListener('keydown', (event) => {
    const typing = (event.target as Element).closest('input, textarea, select, [contenteditable]')
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected && !typing) {
      event.preventDefault()
      removeSelected()
    }
    if (event.key === 'Escape' && (pending || selected)) {
      pending = null
      selected = null
      refresh()
    }
  })

  refresh()
  return {
    jackStrip(module) {
      const element = strip(module.id)
      // The module's type, so the page can place one module's strip differently (Master).
      element.dataset.type = module.type
      return element
    },
  }
}

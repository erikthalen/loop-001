import {
  type AudioModule,
  type Core,
  html,
  type Plug,
  type Port,
  type PortKind,
  render,
} from '@loop/core'

export interface MatrixOptions {
  /** Where the tables go (in the patchbay). */
  root: HTMLElement
  /** The color of the cables out of a module: its row's checkboxes are in that color. */
  colorOf: (module: AudioModule) => string
  /** Stop following the core when this aborts (the patchbay is unmounted). */
  signal: AbortSignal
}

/** The kinds of cable, in the order their tables show. A table only shows when it has a row and a column. */
const KINDS: readonly { kind: PortKind; title: string }[] = [
  { kind: 'audio', title: 'Audio' },
  { kind: 'trigger', title: 'Trigger' },
  { kind: 'channels', title: 'Channels' },
]

type Jack = { module: AudioModule; port: Port; plug: Plug }

const keyOf = (plug: Plug) => `${plug.module}\n${plug.port}`

/**
 * The patch as a grid of checkboxes, like the pin matrix of an old synth: one table per kind of
 * cable, an output per row, an input per column. A checked box is a cable.
 *
 *              Delay  LP  Master
 *               In    In    In
 *   Mixer Out   ☐     ☑     ☐
 *   Mixer Snd A ☑     ☐     ☐
 *   LP Out      ·     ·     ☑      (· = disabled: that cable would make a loop)
 *
 * - Check a box: a cable (core.connect). Uncheck it: the cable comes out.
 * - A box that cannot be checked is disabled, and its title says why (core.canConnect).
 * - The tables are made again when a module comes, goes or moves. A cable only updates the
 *   boxes, so the focus stays where it is.
 *
 * Only native HTML: the matrix component of @loop/ui (components/matrix.css), a <table> of
 * checkboxes, each row in the color of the output's module (--loop-primary).
 */
export function showMatrix(core: Core, options: MatrixOptions): void {
  const { root, colorOf, signal } = options

  /** Every jack of every module, in rack order. */
  function jacks(direction: Port['direction'], kind: PortKind): Jack[] {
    return [...core.modules.values()].flatMap((module) =>
      core
        .ports(module.id)
        .filter((port) => port.direction === direction && port.kind === kind)
        .map((port) => ({
          module,
          port,
          plug: { module: module.id, port: port.id },
        })),
    )
  }

  function build() {
    const tables = KINDS.map(({ kind, title }) => {
      const outs = jacks('out', kind)
      const ins = jacks('in', kind)
      if (!outs.length || !ins.length) return ''
      return html`
        <table class="matrix">
          <caption>${title}</caption>
          <thead>
            <tr>
              <td></td>
              ${ins.map((input) => html`<th scope="col">${input.module.label} ${kind === 'audio' ? html`<small>${input.port.label}</small>` : ''}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${outs.map(
              (output) => html`
                <tr style="--loop-primary: ${colorOf(output.module)}">
                  <th scope="row">${kind === 'audio' ? html`<small>${output.port.label}</small>` : ''} ${output.module.label}</th>
                  ${ins.map(
                    (input) => html`
                      <td>
                        <input
                          type="checkbox"
                          data-from="${keyOf(output.plug)}"
                          data-to="${keyOf(input.plug)}"
                          aria-label="${output.module.name} ${output.port.label} to ${input.module.name} ${input.port.label}"
                        />
                      </td>
                    `,
                  )}
                </tr>
              `,
            )}
          </tbody>
        </table>
      `
    })
    render(html`${tables}`, root)
    if (!root.querySelector('.matrix'))
      render(html`<p class="text-muted">No jacks to connect yet.</p>`, root)
    update()
  }

  const plugOf = (key: string): Plug => {
    const [module, port] = key.split('\n')
    return { module: module!, port: port! }
  }
  const cableBetween = (from: string, to: string) =>
    core.cables.find(
      (cable) => keyOf(cable.from) === from && keyOf(cable.to) === to,
    )

  /** Check the boxes that are cables. Disable the ones that cannot be, and say why. */
  function update() {
    for (const box of root.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    )) {
      const { from, to } = box.dataset as { from: string; to: string }
      const connected = !!cableBetween(from, to)
      const check = connected ? null : core.canConnect(plugOf(from), plugOf(to))
      box.checked = connected
      box.disabled = !!check && !check.ok
      box.title = check && !check.ok ? (check.reason ?? '') : ''
    }
  }

  root.addEventListener(
    'change',
    (event) => {
      const box = event.target as HTMLInputElement
      const { from, to } = box.dataset as { from?: string; to?: string }
      if (!from || !to) return
      if (box.checked) core.connect(plugOf(from), plugOf(to))
      else {
        const cable = cableBetween(from, to)
        if (cable) core.disconnect(cable)
      }
      // A cable that could not be made: the box goes back. Other boxes may be (dis)allowed now.
      update()
    },
    { signal },
  )

  for (const type of ['moduleadd', 'moduleremove', 'modulemove'] as const)
    core.events.on(type, build, { signal })
  core.events.on('cablechange', update, { signal })
  build()
}

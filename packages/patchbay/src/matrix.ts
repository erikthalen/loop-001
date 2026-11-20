import type { AudioModule, Core, Plug, Port } from '@loop/core'
import { type HTMLTemplate, html, render } from '@loop/ui'

export interface MatrixOptions {
  /** Where the table goes (in the patchbay). */
  root: HTMLElement
  /** The color of the cables out of a module: its row's checkboxes are in that color. */
  colorOf: (module: AudioModule) => string
  /** Stop following the core when this aborts (the patchbay is unmounted). */
  signal: AbortSignal
}

type Jack = { module: AudioModule; port: Port; plug: Plug }

/**
 * A row (an output) or a column (an input) of the matrix: one jack, or a group of jacks (a
 * module's channels, see `group` on Port in @loop/core).
 */
interface Line {
  /** Unique in the matrix. */
  readonly key: string
  /** The id of its header cell: aria-controls points to it. */
  readonly id: string
  readonly module: AudioModule
  /** The jack's label ('Out', 'Ch 2'), or the group's ('1–6'). */
  readonly label: string
  readonly jacks: readonly Jack[]
  /** True: a group. It has a button that opens it, to show its jacks one by one. */
  readonly group: boolean
  /** A jack in a group: the group's line. It shows only while the group is open. */
  readonly parent?: Line
}

const keyOf = (plug: Plug) => `${plug.module}\n${plug.port}`

/**
 * The patch as a grid of checkboxes, like the pin matrix of an old synth: an output per row, an
 * input per column. A checked box is a cable.
 *
 *                Delay  LP  Mixer
 *                 In    In  1–6 +
 *   Sampler 1–6 +     ☐     ☐     ☑       (6 cables: Ch 1 to Ch 1, ..., Ch 6 to Ch 6)
 *   Mixer Out         ☐     ☑     ·       (· = disabled: that cable would make a loop)
 *   Mixer Snd A       ☑     ☐     ·
 *
 * - Check a box: a cable (core.connect). Uncheck it: the cable comes out.
 * - A group (a module's channels) is one row or column. Its box is all of its cables: a group
 *   to a group is channel k to channel k, a group to one jack is each channel to that jack. Some
 *   of them only: the box is half checked (indeterminate).
 * - The + on a group opens it: a row or column for each of its jacks, to connect them one by one.
 *   It is a native disclosure: a <button> with aria-expanded, and the jacks' cells are `hidden`.
 *   (<details> cannot do it: a table row cannot be inside a <details>.)
 * - A box that cannot be checked is disabled, and its title says why (core.canConnect).
 * - The table is made again when a module comes, goes or moves (open groups stay open). A cable
 *   only updates the boxes, so the focus stays where it is.
 *
 * Only native HTML: the matrix component of @loop/ui (components/matrix.css), a <table> of
 * checkboxes, each row in the color of the output's module (--loop-primary).
 */
export function showMatrix(core: Core, options: MatrixOptions): void {
  const { root, colorOf, signal } = options
  /** The groups that are open, by key. */
  const open = new Set<string>()
  /** Every row and column of the table now, by key. */
  let lines = new Map<string, Line>()
  let lineCount = 0

  /** The rows (outputs) or the columns (inputs): every jack of every module, in rack order. */
  function linesOf(direction: Port['direction']): Line[] {
    const result: Line[] = []
    for (const module of core.modules.values()) {
      const ports = core
        .ports(module.id)
        .filter((port) => port.direction === direction)
      const jackOf = (port: Port): Jack => ({
        module,
        port,
        plug: { module: module.id, port: port.id },
      })
      const line = (key: string, label: string, jacks: Jack[], parent?: Line) =>
        ({
          key,
          id: `line-${++lineCount}`,
          module,
          label,
          jacks,
          group: !parent && jacks.length > 1,
          parent,
        }) satisfies Line
      const groups = new Set<string>()
      for (const port of ports) {
        if (!port.group) {
          const jack = jackOf(port)
          result.push(line(keyOf(jack.plug), port.label, [jack]))
          continue
        }
        // A group: its line, then a line for each of its jacks (hidden while it is closed).
        if (groups.has(port.group)) continue
        groups.add(port.group)
        const jacks = ports.filter((p) => p.group === port.group).map(jackOf)
        const group = line(`${module.id}\n#${port.group}`, port.group, jacks)
        result.push(group)
        for (const jack of jacks)
          result.push(line(keyOf(jack.plug), jack.port.label, [jack], group))
      }
    }
    return result
  }

  /** The cables a box stands for: [output, input] pairs. */
  function pairsOf(row: Line, column: Line): (readonly [Plug, Plug])[] {
    // A group to a group: channel k to channel k.
    if (row.group && column.group)
      return row.jacks
        .slice(0, column.jacks.length)
        .map((out, k) => [out.plug, column.jacks[k]!.plug] as const)
    // Else every output to every input (one side is one jack).
    return row.jacks.flatMap((out) =>
      column.jacks.map((input) => [out.plug, input.plug] as const),
    )
  }

  const shown = (line: Line) => !line.parent || open.has(line.parent.key)
  /** A line's name, with the module first: "Mixer Snd A". */
  const nameOf = (line: Line) => `${line.module.name} ${line.label}`

  /** A row's or a column's header: a group's opens it (a disclosure button). */
  function header(line: Line, all: readonly Line[]): HTMLTemplate {
    const text = html`${line.module.label} <small>${line.label}</small>`
    if (!line.group) return text
    const children = all.filter((other) => other.parent === line)
    return html`<button
      type="button"
      class="fold"
      data-key="${line.key}"
      aria-expanded="${open.has(line.key)}"
      aria-controls="${children.map((child) => child.id).join(' ')}"
      aria-label="${nameOf(line)}, one by one"
    >
      ${text}
    </button>`
  }

  /** `hidden`, for a jack of a closed group. */
  const hiddenIf = (line: Line) => (shown(line) ? '' : 'hidden')

  function build() {
    lineCount = 0
    const outs = linesOf('out')
    const ins = linesOf('in')
    lines = new Map([...outs, ...ins].map((line) => [line.key, line]))
    if (!outs.length || !ins.length) {
      render(html`<p class="text-muted">No jacks to connect yet.</p>`, root)
      return
    }
    render(
      html`
        <table class="matrix" style="--columns: ${ins.filter(shown).length}">
          <caption>
            Cables
          </caption>
          <thead>
            <tr>
              <td></td>
              ${ins.map(
                (input) =>
                  html`<th
                    scope="col"
                    id="${input.id}"
                    data-parent="${input.parent?.key ?? ''}"
                    ${hiddenIf(input)}
                  >
                    ${header(input, ins)}
                  </th>`,
              )}
            </tr>
          </thead>
          <tbody>
            ${outs.map(
              (output) => html`
                <tr
                  id="${output.id}"
                  data-parent="${output.parent?.key ?? ''}"
                  style="--loop-primary: ${colorOf(output.module)}"
                  ${hiddenIf(output)}
                >
                  <th scope="row">${header(output, outs)}</th>
                  ${ins.map(
                    (input) => html`
                      <td
                        data-parent="${input.parent?.key ?? ''}"
                        ${hiddenIf(input)}
                      >
                        <input
                          type="checkbox"
                          data-row="${output.key}"
                          data-column="${input.key}"
                          aria-label="${nameOf(output)} to ${nameOf(input)}"
                        />
                      </td>
                    `,
                  )}
                </tr>
              `,
            )}
          </tbody>
        </table>
      `,
      root,
    )
    update()
  }

  const cableBetween = (from: Plug, to: Plug) =>
    core.cables.find(
      (cable) =>
        keyOf(cable.from) === keyOf(from) && keyOf(cable.to) === keyOf(to),
    )

  /** The cables of a box. */
  const pairsOfBox = (box: HTMLInputElement) => {
    const row = lines.get(box.dataset.row ?? '')
    const column = lines.get(box.dataset.column ?? '')
    return row && column ? pairsOf(row, column) : []
  }

  /**
   * Check the boxes that are cables (half: some of a group's cables). Disable the ones that
   * cannot be, and say why.
   */
  function update() {
    for (const box of root.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    )) {
      const pairs = pairsOfBox(box)
      const connected = pairs.filter(([from, to]) => cableBetween(from, to))
      const all = pairs.length > 0 && connected.length === pairs.length
      box.checked = all
      box.indeterminate = connected.length > 0 && !all
      const checks = connected.length
        ? []
        : pairs.map(([from, to]) => core.canConnect(from, to))
      const blocked = checks.length > 0 && checks.every((check) => !check.ok)
      box.disabled = blocked
      box.title = blocked ? (checks[0]?.reason ?? '') : ''
    }
  }

  root.addEventListener(
    'change',
    (event) => {
      const box = event.target as HTMLInputElement
      if (!box.matches('input[type="checkbox"][data-row]')) return
      // Checked (also from half checked): all of its cables. Unchecked: none of them.
      for (const [from, to] of pairsOfBox(box)) {
        const cable = cableBetween(from, to)
        if (box.checked && !cable) core.connect(from, to)
        if (!box.checked && cable) core.disconnect(cable)
      }
      // A cable that could not be made: the box goes back. Other boxes may be (dis)allowed now.
      update()
    },
    { signal },
  )

  // Open or close a group: show or hide the rows or columns of its jacks.
  root.addEventListener(
    'click',
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        'button.fold',
      )
      const key = button?.dataset.key
      if (!button || !key) return
      const isOpen = !open.has(key)
      if (isOpen) open.add(key)
      else open.delete(key)
      button.setAttribute('aria-expanded', String(isOpen))
      for (const cell of root.querySelectorAll<HTMLElement>('[data-parent]'))
        if (cell.dataset.parent === key) cell.hidden = !isOpen
      const table = root.querySelector<HTMLElement>('.matrix')
      table?.style.setProperty(
        '--columns',
        String(table.querySelectorAll('th[scope="col"]:not([hidden])').length),
      )
    },
    { signal },
  )

  for (const type of ['moduleadd', 'moduleremove', 'modulemove'] as const)
    core.events.on(type, build, { signal })
  core.events.on('cablechange', update, { signal })
  build()
}

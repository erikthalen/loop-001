/**
 * Small, native UI helpers for modules. No UI library.
 *
 * - `html`  – tagged template for HTML. Values are escaped (safe for user text).
 * - `css`   – tagged template for CSS. Becomes a native CSSStyleSheet when mounted.
 * - `render` – put an `html` template into an element or shadow root.
 *
 * Module UIs are mounted in their own Shadow DOM, so module CSS stays inside the module.
 * The app can theme modules with CSS custom properties (for example `--loop-primary`):
 * they pass into the Shadow DOM.
 */

const HTML_TEXT = Symbol('html')

/** The result of an `html` template. Use it with `render()` or inside another `html` template. */
export interface HTMLTemplate {
  readonly [HTML_TEXT]: string
}

/** The result of a `css` template. */
export interface CSSTemplate {
  readonly cssText: string
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function toHTML(value: unknown): string {
  if (value == null || value === false) return ''
  if (Array.isArray(value)) return value.map(toHTML).join('')
  if (typeof value === 'object' && HTML_TEXT in value)
    return (value as HTMLTemplate)[HTML_TEXT]
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]!)
}

/**
 * HTML tagged template.
 * - Strings and numbers are escaped.
 * - Other `html` templates and arrays of them are inserted as HTML.
 * - `null`, `undefined` and `false` insert nothing.
 * Always put quotes around attribute values: `value="${x}"`.
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): HTMLTemplate {
  let text = strings[0]!
  values.forEach((value, i) => {
    text += toHTML(value) + strings[i + 1]
  })
  return { [HTML_TEXT]: text, toString: () => text } as HTMLTemplate
}

/** CSS tagged template. Values are inserted as they are (CSS is written by the module author). */
export function css(
  strings: TemplateStringsArray,
  ...values: (string | number | CSSTemplate)[]
): CSSTemplate {
  let text = strings[0]!
  values.forEach((value, i) => {
    text +=
      (typeof value === 'object' ? value.cssText : String(value)) +
      strings[i + 1]
  })
  return { cssText: text }
}

/** A piece of UI with its own CSS: what `mountView` puts on the page. */
export interface View {
  /** Its name, for screen readers (the host element's aria-label). */
  readonly label: string
  /** Its CSS. It only applies inside the view. */
  readonly styles?: CSSTemplate | readonly CSSTemplate[]
  readonly template: HTMLTemplate
  /** Runs after the HTML is in place. `signal` aborts when the view is unmounted. */
  readonly script?: (root: ShadowRoot, signal: AbortSignal) => void
}

export interface MountViewOptions {
  /** Unmount by itself when this aborts (for example when its module is removed). */
  readonly signal?: AbortSignal
  /** Attributes for the host element, for example `{ 'data-module': id }`. */
  readonly attributes?: Readonly<Record<string, string>>
}

/**
 * Show a view at the end of `parent`, in its own Shadow DOM: its CSS cannot leak out, and page CSS
 * cannot leak in (CSS variables, like --loop-primary, still pass in). Returns a function that
 * removes it. Every module UI is shown like this (`module.mount`); so can a UI that is not a module.
 */
export function mountView(
  parent: Element,
  view: View,
  options: MountViewOptions = {},
): () => void {
  const host = document.createElement('section')
  for (const [name, value] of Object.entries(options.attributes ?? {}))
    host.setAttribute(name, value)
  host.setAttribute('aria-label', view.label)
  const root = host.attachShadow({ mode: 'open' })

  const mounted = new AbortController()
  const signal = options.signal
    ? AbortSignal.any([mounted.signal, options.signal])
    : mounted.signal
  const unmount = () => {
    mounted.abort()
    host.remove()
  }
  options.signal?.addEventListener('abort', unmount, { signal: mounted.signal })

  root.adoptedStyleSheets = (view.styles ? [view.styles].flat() : []).map(
    toStyleSheet,
  )
  render(view.template, root)
  parent.append(host)
  view.script?.(root, signal)
  return unmount
}

/** Replace the content of `target` with the template. */
export function render(
  template: HTMLTemplate,
  target: Element | ShadowRoot | DocumentFragment,
): void {
  const element = document.createElement('template')
  element.innerHTML = template[HTML_TEXT]
  target.replaceChildren(element.content)
}

// One CSSStyleSheet per `css` template, shared by every mounted copy of a module.
const sheets = new WeakMap<CSSTemplate, CSSStyleSheet>()

/** Turn a `css` template into a native CSSStyleSheet (made once, then reused). */
export function toStyleSheet(style: CSSTemplate): CSSStyleSheet {
  let sheet = sheets.get(style)
  if (!sheet) {
    sheet = new CSSStyleSheet()
    sheet.replaceSync(style.cssText)
    sheets.set(style, sheet)
  }
  return sheet
}

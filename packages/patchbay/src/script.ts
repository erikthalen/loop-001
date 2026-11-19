import type { Core } from '@loop/core'
import { showMatrix } from './matrix'
import type { PatchbayOptions } from './patchbay'

// JS: connect the HTML to the core. Everything is removed for us on unmount.
export function script(
  root: ShadowRoot,
  signal: AbortSignal,
  core: Core,
  options: PatchbayOptions,
): void {
  const {
    modules,
    rack,
    colorOf,
    onAdd,
    transition = (_type, update) => update(),
  } = options
  const $ = <T extends Element>(selector: string) =>
    root.querySelector<T>(selector)!
  const list = $<HTMLElement>('#add-list')
  const remove = $<HTMLButtonElement>('[name=remove]')
  const listen = { signal }

  // ——— Add: the list of modules ———
  // Each time it opens: only the modules that can be added now (for example not a second
  // Master). And remove mode ends.
  list.addEventListener(
    'beforetoggle',
    (event) => {
      if ((event as ToggleEvent).newState !== 'open') return
      rack.setRemoving(false)
      for (const button of list.querySelectorAll<HTMLButtonElement>(
        'button[data-index]',
      )) {
        const definition = modules[Number(button.dataset.index)]
        button.disabled = !definition || !core.canAdd(definition)
      }
    },
    listen,
  )

  list.addEventListener(
    'click',
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        'button[data-index]',
      )
      const definition = button && modules[Number(button.dataset.index)]
      if (!definition || !core.canAdd(definition)) return
      // Close the list first, so it is not in the transition's "old" picture.
      list.hidePopover()
      transition('add-module', () => {
        // The usual cables, from the modules above it (see autoPatch in @loop/core).
        const module = core.add(definition)
        core.autoPatch(module)
        onAdd?.(module)
      })
    },
    listen,
  )

  // ——— Remove: remove mode (the rack makes a click on a module remove it) ———
  const showRemoving = () => {
    remove.disabled = core.modules.size === 0
    remove.setAttribute('aria-pressed', String(rack.removing))
    remove.textContent = rack.removing ? 'done' : 'remove'
  }
  remove.addEventListener(
    'click',
    () => rack.setRemoving(!rack.removing),
    listen,
  )
  rack.onChange(showRemoving, listen)
  // Escape ends remove mode, wherever the focus is.
  document.addEventListener(
    'keydown',
    (event) =>
      event.key === 'Escape' && rack.removing && rack.setRemoving(false),
    listen,
  )
  showRemoving()

  // ——— The cables ———
  const matrices = root.querySelector<HTMLElement>('.matrices')
  if (matrices) showMatrix(core, { root: matrices, colorOf, signal })
}

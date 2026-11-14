import { html, render, type Core } from '@loop/core'

export interface Rack {
  /** True while the rack is in remove mode. */
  readonly removing: boolean
  setRemoving(value: boolean): void
}

export interface RackOptions {
  /** Called when remove mode turns on or off, or when modules are added or removed. */
  onChange?: (rack: Rack) => void
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/**
 * Shows the core's modules in `element`.
 * It follows the core: `moduleadd` shows a module, `moduleremove` takes it away.
 *
 * Remove mode: modules jiggle and a click on a module removes it from the core.
 */
export function createRack(core: Core, element: HTMLElement, options: RackOptions = {}): Rack {
  const slots = new Map<string, HTMLElement>()
  let removing = false

  const rack: Rack = {
    get removing() {
      return removing
    },
    setRemoving(value) {
      // Remove mode only makes sense when there is something to remove.
      removing = value && slots.size > 0
      element.toggleAttribute('data-removing', removing)
      // Block the module's own controls while in remove mode.
      for (const slot of slots.values()) {
        const ui = slot.querySelector('section')
        if (ui) ui.inert = removing
      }
      options.onChange?.(rack)
    },
  }

  core.events.on('moduleadd', ({ module }) => {
    const slot = document.createElement('div')
    slot.className = 'slot'
    // A full-size button over the module. Only visible in remove mode.
    render(html`<button type="button" class="remove-target" aria-label="Remove ${module.name}"></button>`, slot)
    slot.querySelector('button')!.addEventListener('click', () => module.remove())

    slots.set(module.id, slot)
    element.append(slot)
    module.mount(slot)
    if (removing) slot.querySelector('section')!.inert = true
    options.onChange?.(rack)
  })

  core.events.on('moduleremove', async ({ module }) => {
    const slot = slots.get(module.id)
    if (!slot) return
    slots.delete(module.id)
    if (slots.size === 0) rack.setRemoving(false)
    else options.onChange?.(rack)

    if (!reducedMotion.matches) {
      await slot.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.85 }], { duration: 150, easing: 'ease-in' })
        .finished
    }
    slot.remove()
  })

  return rack
}

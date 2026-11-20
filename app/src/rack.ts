import {
  type CollisionDetector,
  CollisionPriority,
  CollisionType,
} from '@dnd-kit/abstract'
import { DragDropManager } from '@dnd-kit/dom'
import { isSortable, Sortable } from '@dnd-kit/dom/sortable'
import { type AudioModule, type Core, html, render } from '@loop/core'

export interface Rack {
  /** True while the rack is in remove mode. */
  readonly removing: boolean
  setRemoving(value: boolean): void
  /** Call `listener` when remove mode turns on or off, or when modules are added or removed. */
  onChange(listener: () => void, options?: { signal?: AbortSignal }): void
  /**
   * Run `update` (a change to the modules) in a view transition of this type, for example
   * 'add-module', so the modules slide into their new place (CSS in app.ts).
   * Start it before the change: the "old" picture is taken first.
   */
  transition(type: string, update: () => void): void
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/** Six dots in two columns: the usual "you can drag this" sign. */
const GRIP = html`<svg width="6" height="10" viewBox="0 0 6 10" aria-hidden="true">
  <circle cx="1" cy="1" r="1" /><circle cx="5" cy="1" r="1" />
  <circle cx="1" cy="5" r="1" /><circle cx="5" cy="5" r="1" />
  <circle cx="1" cy="9" r="1" /><circle cx="5" cy="9" r="1" />
</svg>`

/** The place (index) of a sortable, or undefined for other things. */
const placeOf = (entity: unknown): number | undefined => {
  const index = (entity as { index?: unknown } | null)?.index
  return typeof index === 'number' ? index : undefined
}

/**
 * Where does the dragged module go? The rack is one column of modules with different heights,
 * so only the up/down position counts, and only in the direction you drag:
 * - Moving down: the module passes the module below it, once the pointer is past that module's middle.
 * - Moving up: the same, for the module above it.
 * It never swaps back with a module it just passed (that one is now on the other side),
 * so a short module next to a tall one does not flip back and forth.
 */
const passTheMiddle: CollisionDetector = ({ dragOperation, droppable }) => {
  const { position } = dragOperation
  const pointer = position.current
  // A sortable's place in the rack (the dragged module and the one it is over).
  const from = placeOf(dragOperation.source)
  const to = placeOf(droppable)
  if (!droppable.shape || from === undefined || to === undefined) return null
  const { top, bottom } = droppable.shape.boundingRectangle
  if (pointer.y < top || pointer.y > bottom) return null
  const middle = (top + bottom) / 2
  const passed =
    (position.direction === 'down' && to > from && pointer.y > middle) ||
    (position.direction === 'up' && to < from && pointer.y < middle)
  if (!passed) return null
  return {
    id: droppable.id,
    value: 1,
    type: CollisionType.Collision,
    priority: CollisionPriority.Normal,
  }
}

/**
 * Shows the core's modules in `element`, in the core's order (the rack order).
 * It follows the core: `moduleadd` shows a module, `moduleremove` takes it away,
 * `modulemove` puts it in its new place.
 *
 * Sort: drag a module by its handle (or focus the handle, press Space, then the arrow keys).
 * Dropping it calls `core.move()`. Only the order changes: the cables stay.
 * Drag and drop: dnd-kit (`@dnd-kit/dom`, the version without a framework).
 *
 * Remove mode: modules jiggle and a click on a module removes it from the core.
 */
export function createRack(core: Core, element: HTMLElement): Rack {
  const slots = new Map<string, HTMLElement>()
  const sortables = new Map<string, Sortable>()
  const manager = new DragDropManager()
  let removing = false
  /** True while a module is removed inside a view transition (see removeModule). */
  let inTransition = false
  const changes = new EventTarget()
  const notify = () => {
    changes.dispatchEvent(new Event('change'))
  }

  /** Put the slots in the core's order, and tell each sortable its place. */
  const followCore = () => {
    const wanted = [...core.modules.keys()]
      .map((id) => slots.get(id))
      .filter((slot) => slot !== undefined)
    // dnd-kit already moves the slots during a drag, so usually they are in place.
    // Compare only our slots: not dnd-kit's gap copy, and not a slot that is fading out.
    const current = [...element.children].filter((child) =>
      wanted.includes(child as HTMLElement),
    )
    if (current.some((slot, i) => slot !== wanted[i])) {
      for (const slot of wanted) element.append(slot)
    }
    wanted.forEach((slot, index) => {
      const sortable = sortables.get(slot.dataset.id!)
      if (sortable && sortable.index !== index) sortable.index = index
    })
  }

  // dnd-kit cannot measure a slot well: the module inside lives in a Shadow DOM.
  // - It fills the gap with a copy of the slot. A copy has no Shadow DOM, so it would be as
  //   small as an empty slot, and the other modules would move too little.
  // - It measures the dragged slot as only as wide as the handle, so the module would jump
  //   to the handle's place when the drag starts.
  // So fix the slot's size just before the drag: the copy gets it too. dnd-kit keeps the copy
  // in step with the slot, so keep the size until the copy is gone (after the drop animation).
  // Otherwise the gap shrinks while the module flies into place.
  manager.monitor.addEventListener('beforedragstart', ({ operation }) => {
    const slot = operation.source?.element
    if (!(slot instanceof HTMLElement)) return
    const { width, height } = slot.getBoundingClientRect()
    slot.style.width = `${width}px`
    slot.style.height = `${height}px`
  })

  const releaseSize = (slot: HTMLElement) => {
    const check = () => {
      if (element.querySelector('[data-dnd-placeholder]'))
        return requestAnimationFrame(check)
      slot.style.removeProperty('width')
      slot.style.removeProperty('height')
    }
    requestAnimationFrame(check)
  }

  // A drop: move the module in the core. The core sends `modulemove`, and followCore() runs.
  manager.monitor.addEventListener('dragend', ({ operation, canceled }) => {
    const { source } = operation
    const slot = source?.element
    if (slot instanceof HTMLElement) releaseSize(slot)
    if (canceled || !isSortable(source)) return
    const module = core.modules.get(String(source.id))
    if (module && source.index !== source.initialIndex)
      core.move(module, source.index)
  })

  /**
   * A change to the modules in a view transition of type `type`: every slot has its own
   * view-transition-name, so the modules slide into their new place (CSS in app.ts).
   * Reduced motion, or no view transitions in this browser: the change happens at once.
   */
  const transition = (type: string, update: () => void) => {
    if (reducedMotion.matches || !('startViewTransition' in document)) {
      update()
      return
    }
    document.startViewTransition({
      types: [type],
      update: () => {
        inTransition = true
        try {
          update()
        } finally {
          inTransition = false
        }
      },
    })
  }

  // The transition starts before the removal, because the core unmounts the module's UI
  // before `moduleremove`: the "old" picture still has the module in it.
  const removeModule = (module: AudioModule) =>
    transition('remove-module', () => module.remove())

  const rack: Rack = {
    get removing() {
      return removing
    },
    setRemoving(value) {
      // Remove mode only makes sense when there is something to remove.
      removing = value && slots.size > 0
      element.toggleAttribute('data-removing', removing)
      // Block the module's own controls, and sorting, while in remove mode.
      for (const slot of slots.values()) {
        const ui = slot.querySelector('section')
        if (ui) ui.inert = removing
      }
      for (const sortable of sortables.values()) sortable.disabled = removing
      notify()
    },
    onChange: (listener, listenOptions) =>
      changes.addEventListener('change', listener, listenOptions),
    transition,
  }

  core.events.on('moduleadd', ({ module }) => {
    const slot = document.createElement('div')
    slot.className = 'slot'
    slot.dataset.id = module.id
    // Its own name, so a view transition moves each module on its own (see removeModule).
    slot.style.viewTransitionName = `module-${module.id}`
    render(
      html`
        <button type="button" class="drag-handle" aria-label="Move ${module.name}">${GRIP}</button>
        <!-- A full-size button over the module. Only visible in remove mode. -->
        <button type="button" class="remove-target" aria-label="Remove ${module.name}"></button>
      `,
      slot,
    )
    slot
      .querySelector('.remove-target')!
      .addEventListener('click', () => removeModule(module))

    slots.set(module.id, slot)
    element.append(slot)
    module.mount(slot)
    // The handle goes to the right of the module (after it, so Tab reaches it after the module too).
    slot.append(slot.querySelector('.drag-handle')!)
    if (removing) slot.querySelector('section')!.inert = true

    // Only the handle starts a drag: the module's own sliders and buttons keep working.
    const sortable = new Sortable(
      {
        id: module.id,
        index: slots.size - 1,
        element: slot,
        handle: slot.querySelector<HTMLElement>('.drag-handle')!,
        collisionDetector: passTheMiddle,
      },
      manager,
    )
    sortable.disabled = removing
    sortables.set(module.id, sortable)
    notify()
  })

  core.events.on('modulemove', followCore)

  core.events.on('moduleremove', async ({ module }) => {
    const slot = slots.get(module.id)
    if (!slot) return
    slots.delete(module.id)
    sortables.get(module.id)?.destroy()
    sortables.delete(module.id)
    if (slots.size === 0) rack.setRemoving(false)
    else notify()

    // In a view transition the slot must go at once: the transition animates it.
    // Otherwise (for example a project is loaded) it fades out first.
    if (!inTransition && !reducedMotion.matches) {
      await slot.animate(
        [
          { opacity: 1, scale: 1 },
          { opacity: 0, scale: 0.85 },
        ],
        { duration: 150, easing: 'ease-in' },
      ).finished
    }
    slot.remove()
    followCore()
  })

  return rack
}

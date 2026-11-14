import { html, render, type AnyAudioModuleDefinition } from '@loop/core'

export interface ModulePickerOptions {
  /** The popover element (it has the `popover` attribute). */
  popover: HTMLElement
  /** The list inside the popover. */
  list: HTMLElement
  modules: readonly AnyAudioModuleDefinition[]
  /** Called when the user picks a module. */
  onPick: (definition: AnyAudioModuleDefinition) => void
}

/**
 * The list of modules a user can add.
 * The browser opens and closes it (Popover API: `popovertarget` on the Add button).
 */
export function createModulePicker({ popover, list, modules, onPick }: ModulePickerOptions): void {
  render(
    html`${modules.map(
      (definition, index) => html`
        <li>
          <button type="button" class="menu-item" data-index="${index}">
            <strong>${definition.name}</strong>
            ${definition.description ? html`<small>${definition.description}</small>` : ''}
          </button>
        </li>
      `,
    )}`,
    list,
  )

  list.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-index]')
    const definition = button && modules[Number(button.dataset.index)]
    if (!definition) return
    onPick(definition)
    popover.hidePopover()
  })
}

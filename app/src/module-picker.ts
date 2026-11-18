import { html, render, type AnyAudioModuleDefinition } from "@loop/core";

export interface ModulePickerOptions {
  /** The popover element (it has the `popover` attribute). */
  popover: HTMLElement;
  /** The list inside the popover. */
  list: HTMLElement;
  modules: readonly AnyAudioModuleDefinition[];
  /** Called when the user picks a module. */
  onPick: (definition: AnyAudioModuleDefinition) => void;
  /** False: the module cannot be added now (for example a second Master). Its button is disabled. */
  canAdd?: (definition: AnyAudioModuleDefinition) => boolean;
}

/**
 * The list of modules a user can add.
 * The browser opens and closes it (Popover API: `popovertarget` on the Add button).
 */
export function createModulePicker({
  popover,
  list,
  modules,
  onPick,
  canAdd = () => true,
}: ModulePickerOptions): void {
  render(
    html`<li><small>Add a module</small></li>
      ${modules.map(
        (definition, index) => html`
          <li>
            <button
              type="button"
              class="button ghost"
              data-index="${index}"
            >
              ${definition.name}
            </button>
          </li>
        `,
      )}`,
    list,
  );

  // Each time the list opens: only the modules that can be added now are enabled.
  popover.addEventListener("beforetoggle", (event) => {
    if ((event as ToggleEvent).newState !== "open") return;
    for (const button of list.querySelectorAll<HTMLButtonElement>("button[data-index]")) {
      const definition = modules[Number(button.dataset.index)];
      button.disabled = !definition || !canAdd(definition);
    }
  });

  list.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-index]",
    );
    const definition = button && modules[Number(button.dataset.index)];
    if (!definition || !canAdd(definition)) return;
    onPick(definition);
    popover.hidePopover();
  });
}

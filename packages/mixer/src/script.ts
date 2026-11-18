import { defineModuleScript } from '@loop/core'
import type { setup } from './setup'

// JS: connect the HTML to the module. Everything is removed for us on unmount.
// The sliders are 0 to 100; the module uses 0 to 1.
export const script = defineModuleScript<typeof setup>(({ root, module, signal }) => {
  const percent = (value: number) => `${Math.round(value * 100)} percent`

  /** Connect one slider: `set` changes the module, `get` reads it back (for screen readers). */
  const slider = (input: HTMLInputElement, set: (value: number) => void, get: () => number) => {
    const show = () => input.setAttribute('aria-valuetext', percent(get()))
    input.addEventListener('input', () => {
      set(input.valueAsNumber / 100)
      show()
    }, { signal })
    show()
  }
  const all = (selector: string) => root.querySelectorAll<HTMLInputElement>(selector)

  for (const input of all('[name=volume]')) {
    const channel = Number(input.dataset.channel)
    slider(input, (value) => module.setVolume(channel, value), () => module.volumes[channel]!)
  }
  for (const input of all('[name=send-level]')) {
    const bus = Number(input.dataset.bus)
    slider(input, (value) => module.setSendLevel(bus, value), () => module.sendLevels[bus]!)
  }
  for (const input of all('[name=return-level]')) {
    const bus = Number(input.dataset.bus)
    slider(input, (value) => module.setReturnLevel(bus, value), () => module.returnLevels[bus]!)
  }

  // The main checkboxes: this channel goes to the mixer's output, or only to its sends.
  for (const input of all('[name=main]')) {
    const channel = Number(input.dataset.channel)
    input.addEventListener('change', () => module.setMain(channel, input.checked), { signal })
  }

  // The send checkboxes: send this channel to this send bus, or not.
  for (const input of all('[name=send]')) {
    const bus = Number(input.dataset.bus)
    const channel = Number(input.dataset.channel)
    input.addEventListener('change', () => module.setSend(bus, channel, input.checked), { signal })
  }
})

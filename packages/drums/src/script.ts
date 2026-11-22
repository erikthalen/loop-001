import { connectSequencer } from '@loop/sequencer'
import { defineModuleScript } from '@loop/ui'
import type { setup } from './setup'
import { VOICES } from './voices'

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(
  ({ root, module, core, on, signal }) => {
    const radios = [...root.querySelectorAll<HTMLInputElement>('[name=voice]')]
    const sliders = [...root.querySelectorAll<HTMLInputElement>('[name=param]')]
    const names = [...root.querySelectorAll<HTMLElement>('.param-name')]
    const hit = root.querySelector<HTMLButtonElement>('.hit')!

    /** The sliders show the active drum: its setting names and values. */
    const show = () => {
      const voice = VOICES[module.active]!
      const params = module.paramsOf(module.active)
      sliders.forEach((slider, i) => {
        const name = voice.params[i]!.name
        names[i]!.textContent = name
        slider.value = String(Math.round(params[i]! * 100))
        slider.setAttribute('aria-label', `${voice.name} ${name}`)
      })
      hit.setAttribute('aria-label', `Hit ${voice.name}`)
    }
    show()

    for (const radio of radios)
      radio.addEventListener(
        'change',
        () => {
          module.setActive(Number(radio.value))
          show()
        },
        { signal },
      )

    for (const slider of sliders)
      slider.addEventListener(
        'input',
        () =>
          module.setParam(
            module.active,
            Number(slider.dataset.param),
            Number(slider.value) / 100,
          ),
        { signal },
      )

    hit.addEventListener('click', () => module.hit(), { signal })

    // ——— The sequencer, on its own screen under the drums (@loop/sequencer) ———
    connectSequencer({
      section: root.querySelector<HTMLElement>('.sequencer')!,
      sequencer: module,
      core,
      on,
      signal,
    })
  },
)

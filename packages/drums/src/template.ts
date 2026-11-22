import { sequencerTemplate } from '@loop/sequencer'
import { defineModuleTemplate, html } from '@loop/ui'
import type { setup } from './setup'
import { VOICES } from './voices'

// HTML: made once, when the UI is mounted. Two screens: the drums, and under it the sequencer
// (@loop/sequencer). Classes come from @loop/ui (display, field, button, sr-only) and styles.ts;
// @loop/ui also styles the radio buttons and the sliders.
// On top: one radio button per drum, and "hit". Under it: the 4 settings of the picked drum. The
// script changes the names and values of the sliders when another drum is picked.
export const template = defineModuleTemplate<typeof setup>(({ module }) => {
  const params = module.paramsOf(module.active)
  const voice = VOICES[module.active]!
  return html`
    <h2 class="sr-only">${module.name}</h2>
    <section class="display drums">
      <div class="controls">
        <fieldset class="voices">
          <legend class="sr-only">Drum</legend>
          ${VOICES.map(
            ({ label, name }, i) => html`
              <label class="field voice">
                <input
                  type="radio"
                  name="voice"
                  value="${i}"
                  aria-label="${name}"
                  ${module.active === i ? 'checked' : ''}
                />
                <span>${label}</span>
              </label>
            `,
          )}
        </fieldset>
        <button class="button small hit" type="button">hit</button>
      </div>

      <div class="sliders">
        ${voice.params.map(
          ({ name }, i) => html`
            <label class="field">
              <span class="param-name">${name}</span>
              <input
                name="param"
                type="range"
                min="0"
                max="100"
                step="1"
                data-param="${i}"
                value="${Math.round(params[i]! * 100)}"
              />
            </label>
          `,
        )}
      </div>
    </section>
    ${sequencerTemplate(
      module.pattern,
      module.page,
      VOICES.map(({ label, name }) => ({ label, name })),
    )}
  `
})

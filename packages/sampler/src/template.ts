import { defineModuleTemplate, html } from '@loop/core'
import { CHANNEL_COLORS } from '@loop/ui'
import { CHANNELS, type setup } from './setup'

// HTML: made once, when the UI is mounted. Classes come from @loop/ui (display, field, button,
// sr-only) and styles.ts; @loop/ui also styles the radio buttons and the checkbox. The script draws the tape and keeps the text up to date.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>

      <div class="wave">
        <canvas class="picture" role="img"></canvas>
        <!-- The channel number, top left: a flip screen. All numbers stand in a column, in a
             window one number high. The script slides the column up or down to the active channel. -->
        <span
          class="channel-number"
          aria-hidden="true"
          style="--active: ${module.active}"
        >
          <span class="channel-strip">
            ${Array.from(
              { length: CHANNELS },
              (_, i) =>
                html`<span style="color: ${CHANNEL_COLORS[i]}">${i + 1}</span>`,
            )}
          </span>
        </span>
        <!-- "● rec" or a message, next to the channel number. -->
        <span class="status" role="status"></span>
        <!-- Play, top right. -->
        <button class="button small play" type="button">play</button>
        <!-- The markers: drag them, or use the arrow keys. They ride on the tape with their channel. -->
        <div class="cut-window">
          <div class="cuts">
            <button
              class="marker start"
              type="button"
              role="slider"
              aria-label="Start cut"
              aria-valuemin="0"
              aria-valuemax="100"
            ></button>
            <button
              class="marker end"
              type="button"
              role="slider"
              aria-label="End cut"
              aria-valuemin="0"
              aria-valuemax="100"
            ></button>
          </div>
        </div>
      </div>

      <!-- One row: the channels, then rec. -->
      <div class="controls">
        <fieldset class="channels">
          <legend class="sr-only">Channel</legend>
          ${Array.from(
            { length: CHANNELS },
            (_, i) => html`
              <label class="field channel" style="--c: ${CHANNEL_COLORS[i]}">
                <input
                  type="radio"
                  name="channel"
                  value="${i}"
                  ${module.active === i ? 'checked' : ''}
                />
                <span>${i + 1}</span>
              </label>
            `,
          )}
        </fieldset>
        <label class="field rec">
          <input name="rec" type="checkbox" />
          <span>rec</span>
        </label>
      </div>
    </section>
  `,
)

import { defineModuleTemplate, html } from '@loop/core'
import { CHANNEL_COLORS } from '@loop/ui'
import { BUS_NAMES, CHANNELS, type setup } from './setup'

// HTML: made once, when the UI is mounted. Only HTML from @loop/ui (display, vertical, sr-only;
// it also styles the sliders and the checkboxes).
// A grid of 10 columns and 5 rows. Per channel, from the top:
//   row 1: main: does the channel go to the mixer's output?
//   row 2: send A
//   row 3: send B
//   row 4: the volume slider
//   row 5: the channel's number
// Per send bus (two columns: SND and RTN): rows 1 to 3 empty, the sliders (row 4), the name.
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>
      <div class="strips">
        <!-- <div class="strip"></div>
        <div class="strip"></div> -->
        <div class="strip">
          <span class="master-name">MSR</span>
          <span>→A</span>
          <span>→B</span>
        </div>
        ${Array.from(
          { length: CHANNELS },
          (_, i) => html`
            <div class="strip" style="--c: ${CHANNEL_COLORS[i]}">
              <input
                name="main"
                type="checkbox"
                data-channel="${i}"
                aria-label="Channel ${i + 1} to the mixer's output"
                ${module.mains[i] ? html`checked` : ''}
              />
              ${BUS_NAMES.map(
                (bus, b) => html`
                  <input
                    name="send"
                    type="checkbox"
                    data-bus="${b}"
                    data-channel="${i}"
                    aria-label="Channel ${i + 1} send ${bus}"
                    ${module.sends[b]![i] ? html`checked` : ''}
                  />
                `,
              )}
              <input
                class="vertical"
                name="volume"
                type="range"
                min="0"
                max="100"
                step="1"
                value="${Math.round(module.volumes[i]! * 100)}"
                data-channel="${i}"
                aria-label="Channel ${i + 1} volume"
              />
              <span class="name" aria-hidden="true">${i + 1}</span>
            </div>
          `,
        )}
        ${BUS_NAMES.map(
          (bus, b) => html`
            <!-- Send bus ${bus}: how much goes to the effect, and how much comes back. -->
            <div class="strip busses bus">
              <input
                class="vertical"
                name="send-level"
                type="range"
                min="0"
                max="100"
                step="1"
                value="${Math.round(module.sendLevels[b]! * 100)}"
                data-bus="${b}"
                aria-label="Send ${bus}"
              />

              <input
                class="vertical"
                name="return-level"
                type="range"
                min="0"
                max="100"
                step="1"
                value="${Math.round(module.returnLevels[b]! * 100)}"
                data-bus="${b}"
                aria-label="Return ${bus}"
              />

              <span class="name" aria-hidden="true">SND</span>
              <span class="name" aria-hidden="true">RTN</span>
              <span class="name bus-name" aria-hidden="true">${bus}</span>
              <!-- <span class="bus-name" aria-hidden="true">{bus}</span> -->
            </div>
          `,
        )}
      </div>
    </section>
  `,
)

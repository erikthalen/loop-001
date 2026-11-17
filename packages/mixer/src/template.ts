import { defineModuleTemplate, html } from "@loop/core";
import { CHANNEL_COLORS } from "@loop/ui";
import { BUS_NAMES, CHANNELS, type setup } from "./setup";

// HTML: made once, when the UI is mounted. Only HTML from @loop/ui (display, vertical, sr-only;
// it also styles the sliders and the checkboxes).
// A grid of 10 columns and 4 rows:
//   row 1: the sliders: 6 channel volumes, then SND and RTN of bus A, then of bus B
//   row 2: the names
//   row 3: the send A checkboxes, and the name "A" under the sliders of bus A
//   row 4: the send B checkboxes, and the name "B" under the sliders of bus B
export const template = defineModuleTemplate<typeof setup>(
  ({ module }) => html`
    <section class="display">
      <h2 class="sr-only">${module.name}</h2>
      <div class="strips">
        ${Array.from(
          { length: CHANNELS },
          (_, i) => html`
            <div class="strip" style="--c: ${CHANNEL_COLORS[i]}">
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
              ${BUS_NAMES.map(
                (bus, b) => html`
                  <input
                    name="send"
                    type="checkbox"
                    data-bus="${b}"
                    data-channel="${i}"
                    aria-label="Channel ${i + 1} send ${bus}"
                    ${module.sends[b]![i] ? html`checked` : ""}
                  />
                `,
              )}
            </div>
          `,
        )}
        ${BUS_NAMES.map(
          (bus, b) => html`
            <!-- Send bus ${bus}: how much goes to the effect, and how much comes back. -->
            <div class="strip bus">
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
              <span class="name" aria-hidden="true">snd</span>
            </div>
            <div class="strip bus">
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
              <span class="name" aria-hidden="true">rtn</span>
            </div>
            <span class="bus-name" aria-hidden="true">${bus}</span>
          `,
        )}
      </div>
    </section>
  `,
);

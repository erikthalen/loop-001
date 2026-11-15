import { css } from "@loop/core";
import { VIDEO_FONT } from "@loop/ui";

// CSS: only applies inside this module. The inputs (range, checkbox) come from @loop/ui and are
// not styled here: the module only sets their color (--loop-primary) and the slider length.
// The rules here are outside a cascade layer, so they win over @loop/ui.
// The display copies the LP-01 design: a dark screen, the sound before (grey) and after (blue)
// the filter, the filter curve (amber), and the resonance in red.
export const styles = css`
  :host {
    display: inline-block;

    --blue: light-dark(#2bafff, #7cc4f0);
    --red: #f0502a;
    --amber: #f0b24a;
  }

  p {
    margin: 0;
  }

  /* The screen: 300 x 195px. The small text is 8px. */
  .display {
    /* @loop/ui colors its inputs with --loop-primary. On this screen that is blue. */
    --loop-primary: var(--blue);

    /* Colors for the canvas (script.ts reads them). */
    --spectrum-in: var(--color-neutral-200);
    --spectrum-out: var(--blue);
    --curve: var(--amber);
    --grid: var(--color-neutral-300);
    --axis: var(--color-neutral-700);

    display: flex;
    flex-direction: column;
    color: var(--color-neutral-1000);
    background: var(--color-neutral-100);
    border-radius: 10px;
    font-family: var(--loop-font);
    font-size: 12px;
    text-transform: uppercase;
  }

  /* Top: name, frequency, resonance */
  header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    letter-spacing: 0.14em;

    font-family: "${VIDEO_FONT}", var(--loop-font);

    > span {
      display: flex;
      gap: 10px;
    }
  }

  h2 {
    margin: 0;
    font: inherit;
    color: var(--color-neutral-900);
  }

  .readout {
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 5px;

    color: var(--blue);
  }

  .readout:not(.resonance-readout) {
    flex: 1;
  }

  .frequency-unit {
    /* color: var(--color-neutral-600); */
  }

  .resonance-readout {
    color: var(--red);
    min-width: 9.5ch;
  }

  /* Middle: frequency slider, picture, resonance */
  .main {
    display: flex;
    gap: 8px;
    margin-top: 7px;
  }

  /* The sliders are as long as the picture's plot (120px). The picture is 132px high:
     the plot plus 12px for the 100 / 1k / 10k labels. */
  .frequency-control,
  .resonance-control {
    display: flex;
    gap: 4px;
    height: 120px;
  }

  .range--vertical {
    height: 120px;
  }

  .resonance {
    --loop-primary: var(--red);
  }

  /* The scale next to the frequency slider. The thumb's middle moves between 8px from the top
     and 8px from the bottom, so the scale has the same inset. --at is the place on the scale. */
  .scale {
    position: relative;
    box-sizing: border-box;
    width: 5px;
    margin: 8px 0;
    border: 1px solid var(--color-neutral-700);
    border-left: none;
  }

  .tick {
    position: absolute;
    right: 0;
    bottom: calc(var(--at) * 100%);
    width: 4px;
    height: 1px;
    background: var(--color-neutral-700);
  }

  .spectrum {
    display: block;
    width: 177px;
    aspect-ratio: 200 / 132;
  }

  /*
   * The resonance meter: a tapered display of 40 cells (2px lit, 1px gap, like the bars in the
   * picture). The cells never move: the lowest --lit cells are red, the others are dark.
   * script.ts sets --lit (a whole number, so a cell is always fully on or off).
   */
  .meter {
    --lit: 1;
    position: relative;
    width: 14px;
    border-left: 1px dashed var(--color-neutral-300);
  }

  .meter::after {
    content: "";
    position: absolute;
    inset: 0 0 0 2px;
    clip-path: polygon(30% 0, 70% 0, 100% 100%, 0 100%);
    /* The cells: a 1px gap every 3px, from the bottom. */
    mask: repeating-linear-gradient(to top, #000 0 2px, transparent 2px 3px);
    background: linear-gradient(
      to top,
      var(--red) calc(var(--lit) * 3px),
      var(--color-neutral-200) 0
    );
  }

  /* Bottom: bypass and the slope */
  .bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 5px;
  }

  .bypass-field {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-neutral-800);
    cursor: pointer;
  }

  /* The slope: a small @loop/ui button, with amber text like the curve. Click it to switch.
     (Browsers do not pass text-transform on to buttons, so ask for it here.) */
  .slope {
    text-transform: uppercase;
  }
`;

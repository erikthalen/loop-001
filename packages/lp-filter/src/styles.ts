import { css } from "@loop/core";

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the inputs too. The module only sets their colors (--loop-primary).
// The rules here are outside a cascade layer, so they win over @loop/ui.
// The display: "music from next door" (scene.ts), in thin lines like the sampler.
export const styles = css`
  :host {
    display: inline-block;
  }

  .display {
    --loop-primary: var(--blue);

    gap: 8px;
  }

  /*
   * One row (a grid): a vertical slider on each side, the middle column between them.
   * The middle column sets the row's height. The sliders start at 0 high (so their own natural
   * height, 129px, does not count) and grow to fill the row (min-height: 100%).
   */
  .stage {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 8px;
  }

  input[type="range"].vertical {
    height: 0;
    min-height: 100%;
  }

  /* The middle column: the controls on top, the picture under them. */
  .screen {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .top-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .picture {
    display: block;
    width: 199px;
    height: 70px;
  }

  .resonance {
    --loop-primary: var(--orange);
  }

  .field input[type="checkbox"],
  .field input[type="radio"] {
    --loop-primary: var(--ink);
  }

  /* The slope: two radio buttons side by side. */
  .slope {
    display: flex;
    gap: 10px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /* Where the filter is: insert, send a, send b. Spread over the width, like the delay. */
  .route {
    display: flex;
    justify-content: space-between;
    margin: 0;
    padding: 0;
    border: 0;
  }
`;

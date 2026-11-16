import { css } from "@loop/core";

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (displayStyles); the inputs too. The module only sets their colors (--loop-primary).
// The rules here are outside a cascade layer, so they win over @loop/ui.
// The display: "music from next door" (scene.ts), in thin lines like the sampler.
export const styles = css`
  :host {
    display: inline-block;
  }

  .display {
    --loop-primary: var(--blue);
  }

  /* One row: a vertical slider on each side of the picture. */
  .stage {
    display: flex;
    gap: 8px;
  }

  .picture {
    display: block;
    width: 199px;
    height: 96px;
  }

  .range--vertical {
    height: 96px;
  }

  .resonance {
    --loop-primary: var(--orange);
  }

  /* Bottom: bypass and the slope. */
  .bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
  }

  .label .checkbox {
    --loop-primary: var(--ink);
  }

  /* The slope: a small @loop/ui button. Click it to switch between 12 and 24 dB/oct.
     (Browsers do not pass text-transform on to buttons, so ask for it here.) */
  .slope {
    text-transform: uppercase;
  }

  /* The 12 / 24 on the slope button: a flip screen. --at (0 or 1) slides the column. */
  .flip {
    display: inline-block;
    height: 1em;
    overflow: clip;
  }

  .flip-strip {
    display: flex;
    flex-direction: column;
    line-height: 1em;
    transform: translateY(calc(var(--at, 0) * -1em));
    transition: transform 0.3s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .flip-strip {
      transition: none;
    }
  }
`;

import { css } from '@loop/core'

// CSS: only applies inside this module.
// The display copies the VU-01 design: two pixel-art needle meters, left and right.
// Light mode: a cream face. Dark mode: a dark ("night") face.
export const styles = css`
  :host {
    display: inline-block;
  }

  .display {
    /* Colors for the canvas (script.ts reads them). */
    --face-light: light-dark(#f6eed8, #1c1a14);
    --face-dark: light-dark(#e4d8ba, #14120d);
    --ink: light-dark(#1d1a16, #efe6cf);
    --soft: light-dark(#4a4237, #5c5546);
    --ghost: light-dark(#cbbf9f, #3b372d);
    --red: light-dark(#e0401c, #ff5a2a);
    --lamp-off: light-dark(#d2c6a6, #3a3329);
    --dome: light-dark(#141414, #000000);

    display: flex;
    flex-direction: column;
    gap: 10px;
    color: var(--color-neutral-700);
    font-family: var(--loop-font);
    font-size: 8px;
    text-transform: uppercase;
  }

  /* 260px wide: two meters of 80 x 47 cells of 1.5px (meter.ts), with a thin frame.
     2px + 120px + 16px + 120px + 2px = 260px. */
  .meters {
    display: flex;
    gap: 8px;
    padding: 2px;
  }

  .meter {
    display: block;
    width: 120px;
    height: 70.5px;
    border-radius: 2px;
    box-shadow: 0 0 0 1.5px var(--color-neutral-300);
  }
`

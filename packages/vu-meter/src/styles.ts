import { css } from "@loop/core";

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css). The rules here are outside a cascade layer, so they win.
// The display: two VU dials and two level bars, in thin lines (like the sampler).
export const styles = css`
  :host {
    display: inline-block;
  }

  .picture {
    display: block;
    width: 247px;
    height: 66px;
  }

  /* One row under the picture: L and R, each with its meter over the rest of its half. */
  .levels {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 5px;
  }

  .level {
    flex: 1;
  }

  .level.left {
    color: var(--blue);
  }

  .level.right {
    color: var(--orange);
  }

  .level meter {
    flex: 1;
    width: auto;
    min-width: 0;
  }
`;

import { css } from "@loop/core";

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (displayStyles). The rules here are outside a cascade layer, so they win.
// The display: two VU dials and two level bars, in thin lines (like the sampler).
export const styles = css`
  :host {
    display: inline-block;
  }

  .picture {
    display: block;
    width: 247px;
    height: 80px;
  }
`;

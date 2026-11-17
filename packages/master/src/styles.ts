import { css } from "@loop/core";

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the checkbox and the slider too. The rules here are outside a cascade
// layer, so they win.
// The reels on top: they stick out above the screen (the space for that is kept free, so they
// don't cover the module above). Then one row: rewind, play, and the volume slider over the rest.
// OVERFLOW (40px) and the canvas size (275 x 140) are in reels.ts.
export const styles = css`
  :host {
    display: inline-block;
  }

  /* The free space above the screen, for the reels. (On the screen, not on :host: the page can
     change :host's padding.) */
  .display {
    margin-top: 40px;
  }

  /* The reels: as wide as the whole screen, and 40px above it (54px = 40px + the 14px padding).
     Nothing on the canvas reacts to the mouse, so it never blocks a click. */
  .reels {
    display: block;
    width: 275px;
    height: 140px;
    margin: -54px -14px 8px;
    pointer-events: none;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .volume {
    flex: 1;
  }

  .volume input {
    flex: 1;
    width: 0;
    min-width: 0;
  }
`;

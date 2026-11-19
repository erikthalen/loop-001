import { css } from '@loop/core'

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the checkboxes too. Here the grid's checkboxes only get their row's color (--c),
// like the SQ-01 design. The rules here are outside a cascade layer, so they win.
export const styles = css`
  :host {
    display: inline-block;
  }

  /*
   * 16 columns, 6 rows. A wider gap after every 4 steps (one beat).
   * 16 boxes of 13px, 12 gaps of 2px and 3 gaps of 5px: 247px, the full width.
   */
  /* The progress bar (from @loop/ui) over the whole width, above the steps. */
  .steps {
    display: block;
    width: 100%;
    margin-bottom: 10px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(16, auto);
    justify-content: start;
    gap: 2px 2px;
  }

  .grid input[type="checkbox"]:nth-child(4n + 1):not(:nth-child(16n + 1)) {
    margin-left: 3px;
  }

  /*
   * A step: the normal @loop/ui checkbox (size, check mark), in its row's color (--c).
   * On: filled with the color. Off: a frame in the color.
   * (Rules here win over @loop/ui, so the frame color is only for boxes that are off.)
   */
  .grid input[type="checkbox"] {
    --loop-primary: var(--c);
  }

  .grid input[type="checkbox"]:not(:checked) {
    border-color: var(--c);
  }

  /* The playing step: a frame in the ink color. */
  /* .grid input[type="checkbox"].now:not(:checked) {
    border-color: var(--ink);
  } */

  /* .grid input[type="checkbox"].now:checked {
    box-shadow: 0 0 0 1.5px var(--ink);
  } */
`

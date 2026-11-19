import { css } from '@loop/core'

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the sliders and checkboxes too. The rules here are outside a cascade
// layer, so they win.
// A grid of 10 columns: 6 channels (in the channel's color, --c), then send bus A (SND, RTN) and
// send bus B (SND, RTN). Each strip uses the rows of the grid (subgrid), so all rows line up.
export const styles = css`
  :host {
    display: inline-block;
  }

  .display {
    padding-bottom: 9px;
  }

  .strips {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    grid-template-rows: auto auto auto auto auto;
    gap: 3px 0px;
  }

  .strip {
    --loop-primary: var(--c);
    grid-row: 1 / span 5;
    display: grid;
    grid-template-rows: subgrid;
    justify-items: center;
    align-items: center;
    color: var(--c);
    font-size: 11px;
    font-weight: 600;
  }

  /* A send bus: only the slider and the name. A line before each bus (A, B). */
  .strip.bus {
    --c: var(--color-neutral-700);

    color: var(--ink);

    text-transform: uppercase;

    grid-column: span 2;
    grid-template-columns: 1fr 1fr;

    /* In line with the channel sliders (rows 1 to 3 are the channel checkboxes). */
    input[type="range"] {
      grid-row: 2 / span 3;
      height: 127px;
    }

    .name {
      font-size: 9px;
      font-weight: 600;
    }

    .bus-name {
      grid-column: span 2;
      text-align: center;
    }
  }

  .name {
    text-box: trim-both cap alphabetic;
  }

  .master-name {
    font-size: 9px;
    font-weight: 600;
    text-box: trim-both cap alphabetic;
  }

  /* The name of a bus: in the row of its checkboxes, under its two sliders. */

  .bus-name:nth-child(12) {
    grid-row: 4;
    grid-column: 9 / span 2;
  }

  input[type="range"].vertical {
    height: 95px;
  }

  /* The send checkboxes: in the channel's color. */
  input[type="checkbox"] {
    --loop-primary: var(--c);
  }
`

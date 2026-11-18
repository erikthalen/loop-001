import { css } from "@loop/core";

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the sliders and checkboxes too. The rules here are outside a cascade
// layer, so they win.
// A grid of 10 columns: 6 channels (in the channel's color, --c), then send bus A (SND, RTN) and
// send bus B (SND, RTN). Each strip uses the rows of the grid (subgrid), so all rows line up.
export const styles = css`
  :host {
    display: inline-block;
  }

  .strips {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    grid-template-rows: auto auto auto auto;
    gap: 3px 0px;
  }

  .strip {
    --loop-primary: var(--c);
    grid-row: 1 / span 4;
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
    --c: var(--ink);

    text-transform: uppercase;

    input[type="range"] {
      grid-row: span 2;
      height: 111px;
    }

    .name {
      font-size: 9px;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
  }

  /* The name of a bus: in the row of its checkboxes, under its two sliders. */

  .bus-name:nth-child(12) {
    grid-row: 4;
    grid-column: 9 / span 2;
  }

  input[type="range"].vertical {
    height: 95px;
  }

  .name {
    line-height: 13px;
  }

  /* The send checkboxes: in the channel's color. */
  input[type="checkbox"] {
    --loop-primary: var(--c);
  }
`;

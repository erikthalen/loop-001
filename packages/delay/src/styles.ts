import { css } from '@loop/ui'

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the inputs too. The rules here are outside a cascade layer, so they
// win over @loop/ui.
// The picture (picture.ts) on top, the three sliders in a grid (name, slider).
export const styles = css`
  :host {
    display: inline-block;
  }

  .display {
    /* --loop-primary: var(--green); */
    gap: 4px;
  }

  .picture {
    display: block;
    width: 247px;
    height: 66px;
  }

  /* Two columns: the names, and the sliders over the rest of the width. */
  .sliders {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0px 4px;
    align-items: center;
  }

  /* The label's text and slider go into the grid's two columns (clicking the text still works). */
  .sliders .field {
    display: contents;
  }

  .sliders input {
    width: 100%;
    min-width: 0;
  }
`

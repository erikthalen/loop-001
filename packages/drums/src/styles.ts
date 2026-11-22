import { css } from '@loop/ui'

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the inputs too. The rules here are outside a cascade layer, so they
// win over @loop/ui.
// The drums on top (the drum to show, "hit", and its 4 sliders), the sequencer under it.
export const styles = css`
  /* Two screens, one under the other: the drums, then the sequencer (@loop/sequencer).
     No gap, and no round corners where they meet: they look like one screen. */
  :host {
    display: inline-flex;
    flex-direction: column;
  }

  .drums {
    --loop-primary: var(--orange);

    gap: 10px;
    padding-bottom: 5px;
    border-end-end-radius: 0;
    border-end-start-radius: 0;
  }

  .sequencer {
    padding-top: 5px;

    /* The row names are two letters (BD, SD, ...): a smaller size, so they fit next to the steps. */
    .grid span {
      font-size: 9px;
    }
    border-start-end-radius: 0;
    border-start-start-radius: 0;
  }

  /* One row: the drums (spread out), then hit. */
  .controls {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .voices {
    flex: 1;
    display: flex;
    justify-content: space-between;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /* Two columns: the names, and the sliders over the rest of the width. The names column fits
     the longest name, so the sliders do not move when another drum is picked. */
  .sliders {
    display: grid;
    grid-template-columns: 6.5ch 1fr;
    gap: 0 4px;
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

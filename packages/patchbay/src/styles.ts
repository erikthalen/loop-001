import { css } from '@loop/ui'

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the buttons, the menu and the matrix too. The rules here are outside
// a cascade layer, so they win.
// Add and remove on top, then the matrix. A wide matrix (many modules) scrolls sideways.
export const styles = css`
  :host {
    display: inline-block;
  }

  .display {
    gap: 8px;
  }

  .controls {
    display: flex;
    gap: 6px;
    justify-content: space-between;
  }

  .matrices {
    overflow-x: auto;
  }

  button[name="add"] {
    border: none;
    background-color: var(--green);
    color: var(--color-neutral-0);
  }

  button[name="remove"] {
    border: none;
    background-color: var(--red);
    color: var(--color-neutral-0);
  }
`

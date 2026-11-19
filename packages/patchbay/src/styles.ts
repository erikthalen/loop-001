import { css } from '@loop/core'

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
  }

  .matrices {
    overflow-x: auto;
  }
`

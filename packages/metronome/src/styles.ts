import { css } from '@loop/core'

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the inputs too. The rules here are outside a cascade layer, so they win.
// Two rows. Top: the picture (a tape past a head, thin lines like the Master), with the tempo.
// Bottom: the controls.
// Both rows go from the left edge to the right edge, so their ends line up.
export const styles = css`
  :host {
    display: inline-block;
  }

  .display {
    /* @loop/ui colors its inputs (and the focus ring) with --loop-primary: the app's dodgerblue here.
       The picture's dot, cross and accent use it too. */
    

    gap: 8px;

    /* Tighter than the other modules. */
    padding: 10px 14px;
  }

  /* Top: the picture, over the whole width (picture.ts draws to its width; HEIGHT there). */
  .picture {
    display: block;
    width: 100%;
    height: 40px;
  }

  /* Bottom: tempo (grows and shrinks) and mute (its own size). */
  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .controls > * {
    flex: none;
  }

  /* The tempo: its name, then the slider over the rest of the space. A range input has a fixed
     natural width (about 129px); width 0 lets flex size it instead, so it never pushes the button
     out. */
  .controls > .tempo {
    flex: 1;
    min-width: 0;
  }

  .tempo input {
    flex: 1;
    width: 0;
    min-width: 0;
  }
`

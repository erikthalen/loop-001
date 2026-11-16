import { css } from "@loop/core";

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (displayStyles); the inputs too. The rules here are outside a cascade layer, so they win.
// One row: the picture on the left (thin lines, like the sampler), the controls on the right.
export const styles = css`
  :host {
    display: inline-block;
  }

  .display {
    /* @loop/ui colors its inputs (and the focus ring) with --loop-primary. Here that is orange. */
    --loop-primary: var(--orange);

    flex-direction: row;
    align-items: stretch;
    gap: 8px;
    /* Tighter than the other modules: one row, so less space around it. */
    padding: 10px 12px;
  }

  .screen {
    position: relative;
    flex: none;
  }

  .picture {
    display: block;
    width: 140px;
    height: 44px;
  }

  /* The tempo slider (a @loop/ui range), under the tempo digits. */
  /* From the tempo digits' left edge to the picture's right edge (where "BPM" ends). */
  .tempo {
    position: absolute;
    top: 28px;
    left: 50px;
    width: 90px;
  }

  /* The right side: the beats on top, mute and the time signature below. */
  .side {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: space-between;
  }

  /* One @loop/ui radio button per beat. The playing beat is checked.
     They only show the beat, so clicks go through them. */
  /* The top of the beats lines up with the top of the tempo digits. */
  .beats {
    display: flex;
    gap: 2px;
    margin-top: 3px;
    pointer-events: none;
  }

  .beat {
    --loop-primary: var(--ink);
  }

  /* Accent on: the first beat is orange. */
  .accent .beat:first-child {
    --loop-primary: var(--orange);
  }

  .accent .beat:first-child:not(:checked) {
    border-color: var(--orange);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .mute {
    --loop-primary: var(--ink);
    gap: 6px;
  }
`;

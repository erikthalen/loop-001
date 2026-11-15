import { css } from '@loop/core'
import { DISPLAY_FONT } from './font'

// CSS: only applies inside this module. The inputs (range, checkbox) and the button come from
// @loop/ui and are not styled here. The rules here are outside a cascade layer, so they win over @loop/ui.
// The display copies the MT-01 design: a black dot-matrix screen, white text, one signal orange for "now".
export const styles = css`
  :host {
    display: inline-block;

    --orange: #ff5a00;

    border: 2px solid var(--color-neutral-200);
    border-radius: 10px;
  }

  p {
    margin: 0;
  }

  /* The screen: 210 x 156px, a tight version of the design (320 x 272px). The small text stays 8px.
     The inputs and the button come from @loop/ui, so they keep the library's size. */
  .display {
    /* @loop/ui colors its inputs with --loop-primary. On this screen that is signal orange. */
    --loop-primary: var(--orange);

    box-sizing: border-box;
    width: 210px;
    padding: 11px 12px;
    display: flex;
    flex-direction: column;
    background: var(--color-neutral-50);
    color: var(--color-neutral-1000);
    border-radius: 10px;
    font-family: var(--loop-font);
    color-scheme: dark;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-neutral-600);
  }

  .title {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  h2 {
    margin: 0;
    font: inherit;
  }

  /* 11 x 13 icon pixels at 1.5px each: 3 screen pixels on a retina screen, so the pixel art stays sharp. */
  .icon {
    display: block;
    width: 16.5px;
    height: 19.5px;
    overflow: visible;
    color: var(--color-neutral-900);
  }

  .arm,
  .pivot {
    fill: var(--orange);
  }

  /* The time signature: a small @loop/ui button. Click it to change it. */
  .signature {
    letter-spacing: 0.04em;
  }

  /* The big number, with "bpm" and the tempo name on the right */
  .tempo {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: 3px;
  }

  .digits {
    display: flex;
    font-family: '${DISPLAY_FONT}', var(--loop-font);
    font-weight: 900;
    font-size: 62px;
    line-height: 0.95;
  }

  .digit.unlit {
    color: var(--color-neutral-300);
  }

  .tempo-words {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    padding-bottom: 7px;
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .unit {
    color: var(--color-neutral-600);
  }

  .marking {
    color: var(--orange);
  }

  /* Beat cells */
  .beats {
    display: flex;
    gap: 3px;
    margin-top: 6px;
  }

  .beat {
    flex: 1;
    height: 9px;
    border-radius: 1px;
    background: var(--color-neutral-300);
  }

  .beat:first-child {
    background: var(--color-neutral-300);
  }

  .accent .beat:first-child {
    box-shadow: inset 0 0 0 1px var(--orange);
  }

  .beat.on {
    background: var(--color-neutral-950);
  }

  .accent .beat.on:first-child {
    background: var(--orange);
    box-shadow: none;
  }

  /* Volume and accent, at the bottom of the screen */
  .controls {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .field {
    display: flex;
    gap: 6px;
  }

  /* The label in a 20px column, the slider fills the rest. */
  .volume {
    display: grid;
    grid-template-columns: 20px 1fr;
    align-items: center;
  }

  .control-label {
    color: var(--color-neutral-700);
  }

  .accent-field {
    color: var(--color-neutral-700);
    cursor: pointer;
  }
`

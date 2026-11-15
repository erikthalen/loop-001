import { css } from "@loop/core";
import { MATRIX_FONT } from "@loop/ui";

// CSS: only applies inside this module. The button comes from @loop/ui and is not styled here. The rules here are outside a cascade layer, so they win over @loop/ui.
// The display copies the MT-01 design: a black dot-matrix screen, white text, one signal orange for "now".
export const styles = css`
  :host {
    display: inline-block;

    --orange: #ff7100;
  }

  p {
    margin: 0;
  }

  /* The screen. The small text is 8px. The button comes from @loop/ui, so it keeps the library's size. */
  .display {
    /* @loop/ui uses --loop-primary (for example for the focus ring). On this screen that is signal orange. */
    --loop-primary: var(--orange);

    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    color: var(--color-neutral-1000);
    background: var(--color-neutral-100);
    font-family: var(--loop-font);
  }

  /* Top: the icon and the tempo on the left, the words on the right, all on one bottom line. */
  .top {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  /* 11 x 13 icon pixels at 2.5px each: 5 screen pixels on a retina screen, so the pixel art stays sharp.
     Its bottom sits on the digits' baseline. */
  .icon {
    display: block;
    flex: none;
    width: 34px;
    overflow: visible;
    color: var(--color-neutral-900);
  }

  .arm,
  .pivot {
    fill: var(--orange);
  }

  /* The time signature: a small @loop/ui button. Click it to change it. */
  .signature {
    margin-bottom: auto;
  }

  /* The icon and the big number */
  .tempo {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .digits {
    display: flex;
    font-family: "${MATRIX_FONT}", var(--loop-font);
    font-weight: 400;
    font-size: 48px;
    line-height: 0.85;
    letter-spacing: -0.05em;
  }

  .digit.unlit {
    color: var(--color-neutral-300);
  }

  /* Signature and "bpm", stacked on the right */
  .tempo-words {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    height: stretch;
    gap: 2px;
    font-size: 16px;
    text-transform: uppercase;
  }

  .unit {
    color: var(--color-neutral-600);
    line-height: 0.7;
  }

  /* Beat cells */
  .beats {
    display: flex;
    gap: 3px;
    margin-top: 8px;
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

  /* .accent .beat:first-child {
    box-shadow: inset 0 0 0 1px var(--orange);
  } */

  .beat.on {
    background: var(--color-neutral-950);
  }

  .accent .beat.on:first-child {
    background: var(--orange);
    box-shadow: none;
  }
`;

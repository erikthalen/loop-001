import { css } from '@loop/core'
import { DISPLAY_FONT } from './font'

// CSS: only applies inside this module. Shared parts (sr-only, ...) come from @loop/ui.
// The display copies the MT-01 design: a black dot-matrix screen, white text, one signal orange for "now".
export const styles = css`
  :host {
    display: block;

    --screen: #0c0c0c;
    --bezel: var(--color-neutral-300);
    --white: #f2f2f2;
    --dim: #8c8c8c;
    --off: #242424;
    --off-first: #3a3a3a;
    --unlit-digit: #262626;
    --signal: #ff5a00;
  }

  /* The whole module is 275px wide. All sizes below are the design's sizes x 0.7. */
  article {
    width: 275px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  p {
    margin: 0;
  }

  /* The screen */
  .display {
    box-sizing: border-box;
    padding: 14px 15px;
    display: flex;
    flex-direction: column;
    background: var(--screen);
    color: var(--white);
    border-radius: 4px;
    box-shadow:
      inset 0 0 0 1px #000,
      inset 0 1px 6px rgba(0, 0, 0, 0.8),
      0 0 0 2px var(--bezel);
    font-family: var(--loop-font);
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--dim);
  }

  .title {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  h2 {
    margin: 0;
    font: inherit;
  }

  .icon {
    display: block;
    width: 15px;
    height: 15px;
    overflow: visible;
    color: var(--white);
  }

  .arm {
    fill: var(--signal);
  }

  /* The time signature. Click it to change it. */
  .signature {
    padding: 0;
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.04em;
    color: var(--white);
    background: none;
    border: 0;
    cursor: pointer;
  }

  .signature:hover {
    color: var(--signal);
  }

  .signature:focus-visible {
    outline: 1px solid var(--signal);
    outline-offset: 2px;
  }

  /* The big number */
  .tempo {
    display: flex;
    align-items: flex-end;
    gap: 7px;
    margin-top: 7px;
  }

  .digits {
    display: flex;
    font-family: '${DISPLAY_FONT}', var(--loop-font);
    font-weight: 900;
    font-size: 90px;
    line-height: 0.95;
  }

  .digit.unlit {
    color: var(--unlit-digit);
  }

  .unit {
    font-size: 8px;
    letter-spacing: 0.12em;
    color: var(--dim);
    padding-bottom: 11px;
  }

  .marking {
    margin-top: 3px;
    font-size: 8px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--signal);
  }

  /* The swinging ball. --side: 0 is left, 0.5 is centre, 1 is right. */
  .track {
    position: relative;
    height: 10px;
    margin-top: 14px;
    border-bottom: 1px dashed #333;
  }

  .ball {
    --side: 0.5;
    position: absolute;
    top: 0;
    left: calc(var(--side) * (100% - 10px));
    width: 10px;
    height: 10px;
    background: var(--signal);
    transition: left 200ms ease;
  }

  /* Beat cells */
  .beats {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }

  .beat {
    flex: 1;
    height: 14px;
    border-radius: 1px;
    background: var(--off);
  }

  .beat:first-child {
    background: var(--off-first);
  }

  .accent .beat:first-child {
    box-shadow: inset 0 0 0 1px var(--signal);
  }

  .beat.on {
    background: var(--white);
  }

  .accent .beat.on:first-child {
    background: var(--signal);
    box-shadow: none;
  }

  /* Volume: a row of segments. The real slider lies on top, invisible. */
  .volume {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .volume-label {
    width: 28px;
    color: var(--dim);
  }

  .volume-bar {
    position: relative;
    flex: 1;
    height: 14px;
    display: flex;
    align-items: center;
  }

  /* .volume-bar:focus-within {
    outline: 1px solid var(--white);
    outline-offset: 3px;
  } */

  .segments {
    display: flex;
    gap: 2px;
    width: 100%;
    height: 11px;
  }

  .segment {
    flex: 1;
    background: var(--off);
  }

  .segment.lit {
    background: var(--white);
  }

  .volume-bar input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .volume > .volume-value {
    width: 22px;
    text-align: right;
    color: var(--white);
  }

  /* Accent: a button with an on/off switch */
  .accent-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 31px;
    margin-top: 11px;
    padding: 0 8px;
    font: inherit;
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #b0b0b0;
    background: transparent;
    border: 1px solid var(--off-first);
    border-radius: 1px;
    cursor: pointer;
    transition: transform 60ms;
  }

  /* .accent-toggle:active {
    transform: translateY(1px);
  } */

  .accent-toggle:focus-visible {
    outline: 1px solid var(--white);
    outline-offset: 2px;
  }

  .accent-state {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .accent-label {
    color: var(--dim);
  }

  .accent .accent-label {
    color: var(--signal);
  }

  .switch {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: 25px;
    height: 13px;
    border: 1px solid #555;
  }

  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    display: block;
    width: 10px;
    height: 7px;
    background: #555;
  }

  .accent .knob {
    left: 11px;
    background: var(--signal);
  }

  /* Status line */
  .status {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    margin-top: 11px;
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--dim);

    > span:last-of-type {
      justify-self: end;
    }
  }

  .running .state {
    color: var(--signal);
  }

  @media (prefers-reduced-motion: reduce) {
    .ball {
      transition: none !important;
    }
  }
`

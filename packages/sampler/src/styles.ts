import { css } from "@loop/core";
import { VIDEO_FONT } from "@loop/ui";

// CSS: only applies inside this module. The inputs (radio, checkbox, button) come from @loop/ui and
// are not styled here: the module only sets their color (--loop-primary).
// The rules here are outside a cascade layer, so they win over @loop/ui.
// The display copies the SP-01 design: the sound as cells, green between the markers, red for "rec".
export const styles = css`
  :host {
    display: inline-block;

    --green: light-dark(#14a46a, #3ddc97);
    --rec: light-dark(#e2382a, #ff4d3d);
  }

  p,
  h2,
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    font: inherit;
  }

  /* The screen: 275px wide. The small text is 10px. */
  .display {
    /* @loop/ui colors its inputs with --loop-primary. On this screen that is green. */
    --loop-primary: var(--green);

    /* Colors for the canvas (script.ts reads them). */
    --wave-background: var(--color-neutral-100);
    --wave-middle: var(--color-neutral-400);
    --wave-bright: var(--green);
    --wave-dim: light-dark(#b5dcc8, #1f3a2f);
    --wave-playhead: var(--color-neutral-1000);
    --wave-text: var(--color-neutral-700);

    display: flex;
    flex-direction: column;
    width: 275px;
    color: var(--color-neutral-1000);
    background: var(--color-neutral-100);
    font-family: "${VIDEO_FONT}", var(--loop-font);
    font-size: 10px;
    text-transform: uppercase;
  }

  /* The picture with the two markers on top, and the status in the top left corner. */
  .status {
    position: absolute;
    top: 5px;
    left: 5px;
    color: var(--rec);
    letter-spacing: 0.12em;
    line-height: 1;
    pointer-events: none;
  }

  .wave {
    position: relative;
  }

  .picture {
    display: block;
    width: 275px;
    height: 84px;
    border-radius: 3px;
  }

  /*
   * A marker: a 12px wide button (easy to grab) with a 1px line in the middle and a small flag:
   * at the top right for the start, at the bottom left for the end. --at is its place, 0 to 1.
   */
  .marker {
    --at: 0;
    position: absolute;
    top: 0;
    left: calc(var(--at) * 100% - 6px);
    width: 12px;
    height: 100%;
    padding: 0;
    border: 0;
    background:
      linear-gradient(var(--green), var(--green)) 6px 0 / 1px 100% no-repeat;
    cursor: ew-resize;
    touch-action: none;
  }

  .marker::after {
    content: "";
    position: absolute;
    width: 5px;
    height: 6px;
    background: var(--green);
  }

  .marker.start::after {
    top: 0;
    left: 7px;
  }

  .marker.end::after {
    bottom: 0;
    left: 1px;
  }

  .marker:focus-visible {
    outline: 2px solid var(--color-neutral-1000);
    outline-offset: 0;
  }

  .marker[hidden] {
    display: none;
  }

  .times {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    color: var(--color-neutral-700);
    text-transform: none;
  }

  /* Bottom: the channels on the left, rec and play on the right. */
  .bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
  }

  .channels {
    display: flex;
    gap: 8px;
  }

  .channel,
  .rec {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }

  /* The active channel's number is green. An empty channel's number is grey. */
  .channel.empty {
    color: var(--color-neutral-600);
  }

  .channel:has(:checked) {
    color: var(--green);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .rec {
    --loop-primary: var(--rec);
    letter-spacing: 0.12em;
    color: var(--color-neutral-800);
  }

  /* Browsers do not pass text-transform on to buttons, so ask for it here. */
  .play {
    min-width: 5ch;
    text-transform: uppercase;
  }
`;

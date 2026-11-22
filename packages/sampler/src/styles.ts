import { css } from '@loop/ui'

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the inputs too. The module only sets their colors (--loop-primary).
// The rules here are outside a cascade layer, so they win over @loop/ui.
// The display is a tape machine in thin lines, with two markers to cut the sound.
export const styles = css`
  /* Two screens, one under the other: the sampler, then its sequencer (@loop/sequencer).
     No gap, and no round corners where they meet: they look like one screen. */
  :host {
    display: inline-flex;
    flex-direction: column;
  }

  .sampler {
    --loop-primary: var(--red);

    padding-bottom: 5px;
    border-end-end-radius: 0;
    border-end-start-radius: 0;
  }

  .sequencer {
    padding-top: 5px;
    border-start-end-radius: 0;
    border-start-start-radius: 0;
  }

  /* The picture, with the channel number, the status and the two markers on top of it. */
  .wave {
    position: relative;
  }

  .picture {
    display: block;
    width: 247px;
    height: 120px;
  }

  /*
   * The channel number, top left: a flip screen. A window one number high shows one number of a
   * column 1 to 6. --at (0 to 5) slides the column up or down: the script sets it to where the
   * tape is, so the number moves with the tape and stops when the tape stops. Before the script
   * runs, --active (the channel) places it.
   * Each number gets a full 26px row, so no part of the next number shows in the window.
   */
  .channel-number {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    height: 26px;
    overflow: clip;
    font-size: 26px;
    font-weight: 200;
    line-height: 26px;
    pointer-events: none;
  }

  .channel-strip {
    display: flex;
    flex-direction: column;
    transform: translateY(calc(var(--at, var(--active, 0)) * -26px));
  }

  /* "● rec" or a message, top right, left of the level meter. */
  .status {
    position: absolute;
    top: 9px;
    left: 22px;
    color: var(--red);
    font-size: 10px;
    line-height: 1;
    pointer-events: none;
  }

  /*
   * The two markers ride on the tape: while the tape winds to another channel, the script moves
   * .cuts sideways with it, so the old channel's markers slide out and the new ones slide in.
   * .cut-window stays still. It is 10px wider than the picture on each side, so a marker at the
   * very start or end can still be grabbed. While winding, the window cuts off everything outside
   * the picture (the 10px too), so a marker is never seen outside it.
   */
  .cut-window {
    position: absolute;
    top: 81px;
    left: -10px;
    right: -10px;
    height: 39px;
    pointer-events: none;
  }

  .cut-window.winding {
    clip-path: inset(-4px 10px);
    /* clip-path only hides: the markers far outside still make the page wider (Safari on a phone
       then zooms out). overflow-x: clip cuts them off for real. Only sideways, and only while
       winding: the focus ring may stick out of the window at other times. */
    overflow-x: clip;
  }

  .cuts {
    position: absolute;
    inset: 0;
  }

  /*
   * A marker: a line from the ticks down through the sound and the tracks.
   * A 20px wide button, so it is easy to grab. --at is its place, 0 to 1.
   */
  .marker {
    --at: 0;
    position: absolute;
    top: 0;
    left: calc(var(--at) * (100% - 20px));
    width: 20px;
    height: 100%;
    padding: 0;
    border: 0;
    background: linear-gradient(var(--blue), var(--blue)) 9.5px 0 / 1px 100%
      no-repeat;
    cursor: ew-resize;
    touch-action: none;
    pointer-events: auto;
  }

  .marker:disabled {
    cursor: default;
  }

  .marker:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* The channels, spread over the whole width. Each one in its own color (--c). */
  /* One row under the picture: the channels (spread out), then rec. */
  .controls {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 10px;
  }

  .channels {
    flex: 1;
    display: flex;
    justify-content: space-between;
  }

  .channel {
    --loop-primary: var(--c);
    color: var(--c);

    input {
      border-color: var(--loop-primary);
    }

    &.empty {
      --loop-primary: var(--color-neutral-800);
      color: var(--loop-primary);
    }
  }

  /* An empty channel: a darker color (but the active one is always bright). */
  .channel.empty:not(:has(:checked)) {
    /* color: color-mix(in srgb, var(--loop-primary) 45%, var(--screen)); */
  }

  .rec {
    --loop-primary: var(--red);
  }

  /* Play: top right of the picture, above the level meter. */
  .play {
    position: absolute;
    top: 0;
    right: 0;
  }
`

import { css } from '@loop/ui'

// CSS: the sequencer's screen, under the sampler's. Every rule starts with .sequencer, so it
// does not touch the sampler's own screen. The screen and the colors come from @loop/ui
// (components/display.css); the checkboxes too. Here the grid's checkboxes only get their row's
// color (--c), like the SQ-01 design. The rules here are outside a cascade layer, so they win.
export const sequencerStyles = css`
  /*
   * 16 columns, 6 rows. A wider gap after every 4 steps (one beat).
   * 16 boxes of 13px, 12 gaps of 2px and 3 gaps of 5px: 247px, the full width.
   */
  /* The progress bar (from @loop/ui) over the whole width, above the steps. */
  .sequencer .steps {
    display: block;
    width: 100%;
    margin-bottom: 10px;
  }

  .sequencer .grid {
    display: grid;
    grid-template-columns: repeat(17, auto);
    align-items: center;
    justify-content: end;
    gap: 2px;
  }

  /* A wider gap before steps 5, 9 and 13: the start of each beat. By step number, not by place
     in the grid: each row also has its label, so counting children would be off. */
  .sequencer
    .grid
    input[type="checkbox"]:is(
      [data-step="4"],
      [data-step="8"],
      [data-step="12"]
    ) {
    margin-left: 3px;
  }

  .sequencer .grid span {
    color: var(--loop-primary);
    text-box: trim-both cap alphabetic;
  }

  /*
   * A step: the normal @loop/ui checkbox (size, check mark), in its row's color (--c).
   * On: filled with the color. Off: a frame in the color.
   * (Rules here win over @loop/ui, so the frame color is only for boxes that are off.)
   */
  .sequencer .grid input[type="checkbox"] {
    --loop-primary: var(--c);
  }
`

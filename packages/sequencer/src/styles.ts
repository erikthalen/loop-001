import { css } from "@loop/core";

// CSS: only applies inside this module. The checkboxes come from @loop/ui; here they only get a place
// in the grid and a mark for the playing step.
export const styles = css`
  :host {
    display: inline-block;
  }

  .display {
    background: var(--color-neutral-100);
  }

  /* 16 columns, 6 rows. A wider gap after every 4 steps (one beat), so the beats are easy to see. */
  .grid {
    display: grid;
    grid-template-columns: repeat(16, auto);
    gap: 4px 3px;
  }

  .checkbox:nth-child(4n + 1):not(:nth-child(16n + 1)) {
    margin-left: 5px;
  }

  /* The first step of each beat: a slightly darker frame. */
  .checkbox:nth-child(4n + 1):not(:checked) {
    border-color: var(--color-neutral-700);
  }

  /* The playing step. */
  .checkbox.now {
    /* border-color: var(--loop-primary); */
    box-shadow: 0 0 0 1px var(--color-neutral-1000);
  }

  .checkbox.now:checked {
    filter: brightness(1.3);
  }
`;

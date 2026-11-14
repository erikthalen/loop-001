import { css } from "@loop/core";

// CSS: only applies inside this module. Shared parts (panel, row, field, ...) come from @loop/ui.
export const styles = css`
  :host {
    display: block;
  }

  article {
    display: grid;

    > * {
      grid-area: 1 / 1;
    }

    > header {
      z-index: 1;
      padding: 5px;
    }
    
    > footer {
      z-index: 1;
      align-self: end;
      padding: 5px;

      display: flex;
      flex-direction: column;
      gap: 5px;
    }
  }

  .beats {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .beat {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: #dde3ec;
  }
  canvas {
    display: block;
    width: 200px;
    height: 200px;
    border-radius: 5px;
    background: #2b2b2b; /* the same grey as BACKGROUND in drop.ts */
  }
  .beat.on {
    background: var(--loop-primary);
  }
`;

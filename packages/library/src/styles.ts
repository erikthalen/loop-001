import { css } from "@loop/core";

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the text input, the radio buttons and the buttons too. The rules
// here are outside a cascade layer, so they win.
// From the top: the tape on the machine (its name, and "saved" on the right), the shelf (it
// scrolls when there are many tapes), then new, import and export.
export const styles = css`
  :host {
    display: inline-block;
  }

  .display {
    gap: 12px;
  }

  .machine {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .name {
    flex: 1;
    min-width: 0;

    input {
      flex: 1;
      width: 0;
      min-width: 0;
      font-family: var(--loop-font);
      letter-spacing: normal;
      text-transform: none;
    }
  }

  /* Saved: quiet. Not saved: red, so you notice. */
  .status {
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
    text-align: end;
    width: 6ch;

    &[data-status="saved"] {
      color: var(--green);
    }

    &[data-status="saving"] {
      color: var(--orange);
    }

    &[data-status="error"] {
      color: var(--red);
    }
  }

  .shelf {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;

    legend {
      margin-bottom: 6px;
    }
  }

  /* About five tapes high; then it scrolls. */
  .tapes {
    max-height: 125px;
    overflow-y: auto;
    list-style: none;
    border-top: 1px solid var(--dim);

    li {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  /* One tape: the radio button, its name, and when it was saved. The whole row is the label. */
  .tape {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 5px 0;
    color: var(--muted);
    cursor: pointer;

    &:has(:checked),
    &:hover {
      color: var(--ink);
    }
  }

  .tape-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  time {
    font-size: 9px;
    color: var(--muted);
    white-space: nowrap;
  }

  .erase {
    padding: 0 2.8px;
    color: var(--red);
    font-size: 14px;
    line-height: 1;

    &:hover {
      background-color: color-mix(var(--red) 20%, transparent);
    }
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  /* The dialogs are from @loop/ui (components/dialog.css). Erase is red: it cannot be undone. */
  .ask-erase [value="erase"] {
    --loop-primary: var(--red);
  }
`;

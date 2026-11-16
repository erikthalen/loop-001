/*
 * The shared look of the module screens ("displays"): the colors and the screen box.
 * Every module uses it, so they look like one family:
 *
 *   ui: { styles: [uiStyles, displayStyles, styles], template, script }
 *
 * The colors follow the design: a dark screen with light ink and five accent colors. In light mode,
 * the screen is light and the accents are darker, so they stay easy to read.
 * The rules are in the `ui` layer, so a module's own CSS always wins.
 */

const cssText = /* css */ `
@layer ui {
  :host {
    --screen: var(--color-neutral-50);
    --ink: var(--color-neutral-1000);
    --muted: var(--color-neutral-700);
    --line: var(--color-neutral-400);
    --dim: var(--color-neutral-300);

    --blue: light-dark(#1f5fd6, #4d7cff);
    --orange: light-dark(#b06a00, #f2a541);
    --red: light-dark(#d93a22, #ff4b33);
    --green: light-dark(#1d8f55, #46d18b);
    --purple: light-dark(#7650d0, #b48cff);
  }

  /* The screen: 275px wide, 14px inside it on every side (so the content is 247px wide). */
  .display {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 275px;
    padding: 14px;
    color: var(--ink);
    background: var(--screen);
    border-radius: 14px;
    font-family: var(--loop-font);
    font-size: 11px;
  }

  /* Dark mode: the check mark is black, like the screen, so it also shows on a light (ink) box. */
  @media (prefers-color-scheme: dark) {
    .display .checkbox:checked {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4.5 12.5l5 5L19.5 7' fill='none' stroke='%23000000' stroke-width='3.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    }
  }

  /* Small text labels next to inputs, for example "rec" or "bypass". */
  .label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
  }
}
`

/** The shared display styles. Same shape as `uiStyles`, so modules can put it in `styles`. */
export const displayStyles: { readonly cssText: string } = { cssText }

/**
 * The colors of the 6 channels (sequencer rows, sampler channels), as CSS colors.
 * Use them in CSS, or turn them into rgb() for a canvas (see the modules' scripts).
 */
export const CHANNEL_COLORS = [
  'var(--blue)',
  'var(--orange)',
  'var(--ink)',
  'var(--red)',
  'var(--green)',
  'var(--purple)',
] as const

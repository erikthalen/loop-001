import { css } from "@loop/core";
import { CASSETTE_HEIGHT, CASSETTE_WIDTH } from "./cassette";

/** The size of a cassette on the shelf, in CSS px (cassette.ts draws it at this size). */
export const SHELF_TAPE_WIDTH = 110;
/** The same shape as a real cassette. */
export const SHELF_TAPE_HEIGHT = Math.round(
  (SHELF_TAPE_WIDTH * CASSETTE_HEIGHT) / CASSETTE_WIDTH,
);
/**
 * One step of the stack, in px: from one tape to the next. A little less than the tape, so the
 * tapes next to the middle one sit close to it. Not less than 90% of the tape: at 80% size (see
 * tape-size) the neighbors would overlap the middle tape (half a tape + half of 80% of a tape).
 */
const SHELF_STEP = Math.round(SHELF_TAPE_WIDTH * 0.95);

/** On hover: how much the cassette grows. */
const HOVER_SCALE = 1.06;
/** Room above and below the cassettes, so a hovered one is not cut off (the row hides overflow). */
const HOVER_ROOM = Math.ceil((SHELF_TAPE_HEIGHT * (HOVER_SCALE - 1)) / 2) + 1;

/**
 * CSS's ease-in-out, cubic-bezier(0.42, 0, 0.58, 1): how far along the curve is at `x` (0 to 1).
 * It finds the curve's own position for `x` by halving (the curve's x always goes up).
 */
const easeInOut = (x: number) => {
  const curve = (t: number, p1: number, p2: number) =>
    3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (curve(mid, 0.42, 0.58) < x) low = mid;
    else high = mid;
  }
  return curve((low + high) / 2, 0, 1);
};

/**
 * Gradient stops for an eased fade, from `from`% to `to`% (see larsenwork.com/easing-gradients):
 * many small steps along the ease-in-out curve, so the fade has no hard start or end.
 */
const easedFade = (from: number, to: number, fadeIn: boolean) =>
  Array.from({ length: 13 }, (_, i) => {
    const x = i / 12;
    return {
      offset: from + (to - from) * x,
      alpha: fadeIn ? easeInOut(x) : 1 - easeInOut(x),
    };
  });

/**
 * How grainy the fade is.
 * - `amount`: how much of the fade is grain, 0 to 1 (0: a smooth gradient, 1: only grain).
 * - `grain`: the frequency of the noise, per px (higher: finer grain; about 6 gives single-pixel
 *   grain, like film or TV static; 1 gives soft blotches).
 * - `softness`: how hard each grain is (lower: softer, more like a blur; higher: sharp dots).
 */
const GRAIN = { amount: 0.35, grain: 6, softness: 8 };

/**
 * The shelf's mask: the tapes fade out over the first and the last 10% of the row, a smooth fade
 * with some grain in it. An SVG:
 * 1. The eased fade: a gradient.
 * 2. The grain: the fade mixed half and half with noise (feTurbulence), then each pixel cut to
 *    visible or hidden (feComponentTransfer). Near the middle almost all are visible, at the edge
 *    almost none.
 * 3. The two mixed (GRAIN.amount). Both are fully visible in the middle and hidden at the edge, so
 *    only the fade between changes.
 */
const EDGE_FADE = (() => {
  const stops = [...easedFade(0, 10, true), ...easedFade(90, 100, false)]
    .map(
      ({ offset, alpha }) =>
        `<stop offset="${offset.toFixed(2)}%" stop-color="#fff" stop-opacity="${alpha.toFixed(3)}"/>`,
    )
    .join("");
  // Alpha out = softness × (fade + noise) / 2, centered on 0.5: under it hidden, over it visible.
  const slope = GRAIN.softness;
  const intercept = 0.5 - slope / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <linearGradient id="fade">${stops}</linearGradient>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="${GRAIN.grain}" numOctaves="1" seed="7" result="noise"/>
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="dots"/>
        <feComposite in="SourceGraphic" in2="dots" operator="arithmetic" k2="0.5" k3="0.5"/>
        <feComponentTransfer result="grainy">
          <feFuncA type="linear" slope="${slope}" intercept="${intercept}"/>
        </feComponentTransfer>
        <feComposite in="SourceGraphic" in2="grainy" operator="arithmetic" k2="${1 - GRAIN.amount}" k3="${GRAIN.amount}"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#fade)" filter="url(#grain)"/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the text input, the radio buttons and the buttons too. The rules
// here are outside a cascade layer, so they win.
// From the top: the tape on the machine (its name, and "saved" on the right), the shelf (the
// cassettes, a stack you swipe through), the picked tape, then new, import and export.
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
    gap: 4px;
    min-width: 0;
  }

  /*
   * The cassettes: a smart stack (like the widget stacks on a phone). One tape in the middle, the
   * ones next to it smaller, peeking in at the sides. Swipe sideways: each swipe stops at the next
   * tape. The tape in the middle is full size, and it shrinks as it leaves (the next one grows).
   * A scroll-driven animation does it, with no JavaScript: each slot's place in the row is its own
   * timeline (--tape).
   */
  .tapes {
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    /* The tapes fade out at the edges, through grain (EDGE_FADE, at the top of this file). */
    mask-image: ${EDGE_FADE};

    margin-inline: -14px;
    /* Room for a hovered cassette to grow, without moving the rest of the screen. */
    padding-block: ${HOVER_ROOM}px;
    margin-block: ${-HOVER_ROOM}px;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .track {
    display: flex;
    /* As wide as all the tapes. Else it is only as wide as the row, the tapes go past its end,
       and the padding on the right is not after the last tape. */
    width: max-content;
    /* Room on both sides, so the first and the last tape can come to the middle too. */
    padding-inline: calc(50% - ${SHELF_STEP / 2}px);
    list-style: none;

    li {
      position: relative;
      flex: 0 0 ${SHELF_STEP}px;
      height: ${SHELF_TAPE_HEIGHT}px;
      scroll-snap-align: center;
      scroll-snap-stop: always;
      /* The inset: the tape is full size a little before it is in the middle. */
      view-timeline: --tape inline 30%;
    }
  }

  /* One tape: a button as big as the cassette, in the middle of its slot. */
  .tape {
    position: absolute;
    top: 0;
    left: 50%;
    width: ${SHELF_TAPE_WIDTH}px;
    height: ${SHELF_TAPE_HEIGHT}px;
    margin-left: ${-SHELF_TAPE_WIDTH / 2}px;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    animation: tape-size cubic-bezier(0, 0.5, 1, 0.5) both;
    animation-timeline: --tape;
    animation-range: cover;

    &:focus-visible {
      outline: none;
    }
    &:focus-visible .cassette {
      outline: 2px solid var(--loop-primary);
      outline-offset: 1px;
      border-radius: 5px;
    }

    &[aria-current="true"] {
      canvas {
        opacity: 0.6;
        filter: blur(1px);
      }
    }
  }

  .cassette {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* "On": this tape is on the machine (the open project). A label on top of the cassette, in the
     middle. It is in the tape's button, so it grows and shrinks with the cassette. */
  .on-machine {
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    padding: 2px 6px 1px;
    border-radius: 4px;
    background: var(--green);
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    text-transform: uppercase;
    pointer-events: none;
  }

  /*
   * Hover: the cassette grows a little. This shows that a click does something (it opens the
   * tape). Not for the tape that is open already: a click on it does nothing. The scroll animation
   * above sets "scale", so the hover uses "transform" (the two multiply).
   */
  @media (hover: hover) {
    .tape {
      transition: transform 0.2s ease;
    }
    li:hover .tape:not([aria-current="true"]) {
      transform: scale(${HOVER_SCALE});
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tape {
      transition: none;
    }
  }

  @keyframes tape-size {
    0% {
      scale: 0.8;
    }
    50% {
      scale: 1;
    }
    100% {
      scale: 0.8;
    }
  }

  /*
   * The captions: one per tape, each as wide as the row, all in one long row under the tapes. The
   * row slides along as the tapes scroll: a scroll-driven animation on the tapes' scroll (--shelf),
   * from the first caption (scrolled to the start) to the last one (scrolled to the end). Each step
   * of the tapes is one caption, so the picked tape's caption is always in the middle. The captions
   * are wider than a step of the tapes, so they slide faster than the tapes.
   */
  .shelf {
    timeline-scope: --shelf;
  }
  .tapes {
    scroll-timeline: --shelf inline;
  }

  /* A container, so a caption can be as wide as the row (100cqw). */
  .captions {
    overflow: hidden;
    container-type: inline-size;
    margin-top: 4px;
    margin-inline: -14px;
  }

  .caption-track {
    display: flex;
    /* As wide as all the captions, so the slide reaches the last one. */
    width: max-content;
    animation: captions-slide linear both;
    animation-timeline: --shelf;
  }

  /* From the first caption to the last: the row moves left by its own width, less one caption. */
  @keyframes captions-slide {
    from {
      translate: 0;
    }
    to {
      translate: calc(-100% + 100cqw);
    }
  }

  /* No scroll-driven animations in this browser: only the picked tape's caption shows. */
  @supports not (animation-timeline: scroll()) {
    .caption:not([data-picked]) {
      display: none;
    }
  }

  /*
   * One caption, in three rows, all in the middle:
   *   name
   *   date
   *   remove
   */
  .caption {
    flex: 0 0 100cqw;
    /* Exactly one row wide, also with a long name (it is cut with "…"). */
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    row-gap: 2px;
    text-align: center;
  }

  .caption-name {
    /* Not wider than the caption, so a long name is cut with "…". */
    max-width: 100%;
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
    color: var(--red);

    &:hover {
      background-color: color-mix(in srgb, var(--red) 20%, transparent);
    }
  }

  .actions {
    display: flex;
    gap: 6px;

    button:first-of-type {
      margin-right: auto;
    }
  }

  /* The dialogs are from @loop/ui (components/dialog.css). Erase is red: it cannot be undone. */
  .ask-erase [value="erase"] {
    --loop-primary: var(--red);
  }
`;

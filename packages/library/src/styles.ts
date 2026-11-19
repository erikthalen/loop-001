import { css } from "@loop/core";
import { CASSETTE_HEIGHT, CASSETTE_WIDTH } from "./cassette";

/** The size of a cassette on the shelf, in CSS px (cassette.ts draws it at this size). */
export const SHELF_TAPE_WIDTH = 185;
/** The same shape as a real cassette. */
export const SHELF_TAPE_HEIGHT = Math.round(
  (SHELF_TAPE_WIDTH * CASSETTE_HEIGHT) / CASSETTE_WIDTH,
);

/**
 * The cover flow (the shelf of cassettes, see .tapes below). Tune it here: the keyframes are made
 * from these numbers.
 */
const FLOW = {
  /** The width of the row: the content of the screen (275px, less 14px padding on each side). */
  width: 247,
  /** How far you scroll from one tape to the next, in px. More: the tapes move slower. */
  scroll: 100,
  /** How far apart the tapes look, in px. Less than `scroll`, so they move slower than you scroll. */
  spacing: 40,
  /**
   * Next to the middle: how far the tapes move out of its way, in px. Halfway between two tapes,
   * both must stay apart: room + spacing / 2 > half the tape width × cos(near.turn).
   */
  room: 85,
  /** Next to the middle: how far back the tapes stand (px), and how far they are turned. */
  near: { depth: 63, turn: 33 },
  /** At the edge of the row: further back, and turned more. On the way there, the effect grows. */
  far: { depth: 190, turn: 62 },
};

/**
 * The keyframes of one tape, from its place in the row. A slot's view timeline runs from 0% (it
 * comes in on the right) through 50% (in the middle) to 100% (out on the left). `s` is how far it
 * is from the middle, in px.
 * - Within half a step of the middle, it turns to face you (it stands up, comes forward, moves in).
 *   So halfway between two tapes, both stand turned with a gap: they never cut into each other.
 * - Further out, it goes back and turns more, evenly with the distance, all the way to the edge.
 * - Every tape is drawn nearer to the middle than it really is (spacing / scroll), so the tapes
 *   move slower than you scroll.
 */
const flowKeyframes = () => {
  const range = FLOW.width + FLOW.scroll;
  const half = FLOW.scroll / 2;
  const edge = range / 2;
  const slow = FLOW.spacing / FLOW.scroll;
  const at = (s: number) => 50 - (s / range) * 100;
  /** The tape at `s` px from the middle; side 1: right, -1: left. */
  const pose = (s: number, side: 1 | -1) => {
    const near = Math.min(1, s / half);
    const out = Math.max(0, (s - half) / (edge - half));
    const x = s * (slow - 1) + FLOW.room * near;
    const depth =
      FLOW.near.depth * near + (FLOW.far.depth - FLOW.near.depth) * out;
    const turn = FLOW.near.turn * near + (FLOW.far.turn - FLOW.near.turn) * out;
    const n = (value: number) => value.toFixed(2);
    return `transform: translateX(${n(side * x)}px) translateZ(${n(-depth)}px) rotateY(${n(-side * turn)}deg);`;
  };
  const frame = (percent: number, rule: string) =>
    `${percent.toFixed(3)}% { ${rule} }`;
  return [
    frame(0, pose(edge, 1)),
    frame(at(half), pose(half, 1)),
    frame(50, pose(0, 1)),
    frame(100 - at(half), pose(half, -1)),
    frame(100, pose(edge, -1)),
  ].join("\n");
};

// CSS: only applies inside this module. The screen and the colors come from @loop/ui
// (components/display.css); the text input, the radio buttons and the buttons too. The rules
// here are outside a cascade layer, so they win.
// From the top: the tape on the machine (its name, and "saved" on the right), the shelf (a row of
// cassettes, a cover flow), the picked tape, then new, import and export.
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
   * The cassettes: a row that scrolls sideways and snaps each tape to the middle. A cover flow:
   * the tape in the middle faces you; the others stand turned, further back, like records in a box.
   *
   * - .tapes scrolls, and gives the depth (perspective). .track is one 3D space for all the
   *   tapes, so the browser draws the nearer tape in front, smoothly, as you scroll (no z-index).
   * - Each <li> is a slot: one step of scrolling. The tape in it is wider than the slot.
   * - Scroll-driven animations move the tapes, with no JavaScript: each slot's place in the row is
   *   its own timeline (--tape). The keyframes come from FLOW, at the top of this file.
   */
  .tapes {
    --slot: ${FLOW.scroll}px;
    position: relative;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    perspective: 420px;
    /* The tapes fade out at the edges. */
    mask-image: linear-gradient(
      to right,
      transparent,
      black 18%,
      black 82%,
      transparent
    );
    margin-inline: -14px;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .track {
    display: flex;
    width: max-content;
    min-width: 100%;
    padding: 4px calc(50% - var(--slot) / 2);
    list-style: none;
    transform-style: preserve-3d;

    li {
      position: relative;
      flex: none;
      width: var(--slot);
      height: ${SHELF_TAPE_HEIGHT}px;
      scroll-snap-align: center;
      transform-style: preserve-3d;
      view-timeline: --tape inline;
    }
  }

  /* One tape: a button as big as the cassette, over the middle of its slot. */
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
    animation: tape-flow linear both;
    animation-timeline: --tape;

    &:focus-visible {
      outline: none;
    }
    &:focus-visible .cassette {
      outline: 2px solid var(--loop-primary);
      outline-offset: 1px;
      border-radius: 5px;
    }
  }

  .cassette {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* See flowKeyframes, at the top of this file. */
  @keyframes tape-flow {
    ${flowKeyframes()}
  }

  /* No scroll-driven animations in this browser: a flat row, one tape next to the other. */
  @supports not (animation-timeline: view()) {
    .tapes {
      --slot: ${SHELF_TAPE_WIDTH + 6}px;
    }
  }

  /* The picked tape (in the middle): its name, when it was saved, open (or "on"), erase. */
  .picked {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 22px;

    /* The button styles set a display: keep hidden things hidden. */
    [hidden] {
      display: none;
    }
  }

  .picked-name {
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

  /* The picked tape is on the machine (the open project). */
  .on-machine {
    color: var(--green);
    font-weight: 600;
    text-transform: uppercase;
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

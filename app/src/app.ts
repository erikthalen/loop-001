import { Hono } from "hono";
import { html, raw } from "hono/html";
import { uiStyles } from "@loop/ui";

// This Hono app runs INSIDE the service worker (in the browser).
// It answers page requests, so pages work offline too.
// Note: a service worker has no Web Audio. All audio code runs in the page,
// in src/client.ts. Hono only sends the HTML.
export const app = new Hono();

// The path the app lives under: "/", or for example "/loop-001/" on GitHub Pages.
const base = import.meta.env.BASE_URL;

// Dev: Vite serves the TypeScript source. Build: vite.config.ts outputs a fixed client.js.
const clientScript = import.meta.env.DEV
  ? `${base}src/client.ts`
  : `${base}client.js`;

const layout = (title: string, body: ReturnType<typeof html>) =>
  html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1677ff" />
        <link rel="manifest" href="${base}manifest.webmanifest" />
        <link rel="icon" href="${base}favicon.ico" sizes="32x32" />
        <link rel="icon" href="${base}icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="${base}icons/apple-touch-icon.png" />
        <title>${title}</title>
        <!-- @loop/ui: the shared component library (buttons, inputs, menus, ...). -->
        <style>
          ${raw(uiStyles.cssText)}
        </style>
        <!-- App-only styles: page layout, menus placement, the rack and remove mode. -->
        <style>
          body {
            padding: 0.5rem;

            > main {
              /* The cable lane and the jack strips sit in the left padding (see patch-lane.ts).
                 Their width is fixed, so the modules never move sideways. */
              --lane: 50px;
              --strip: 10px;
              width: 275px;
              margin: auto;
              /* padding-left: calc(var(--lane) + var(--strip) + 3px); */
            }
          }

          /* Project bar */
          .project-bar {
            margin-bottom: 0.5rem;
          }

          #project-name {
            width: 100%;
          }

          #save-status[data-status="error"] {
            color: #cc0000;
            font-weight: 500;
          }

          /* Popovers place themselves under their button (see popover.css in @loop/ui). */
          #project-menu {
            min-width: 20rem;
          }
          .menu-actions {
            padding: 0.25rem;
          }
          #project-list {
            max-height: 50vh;
            overflow: auto;

            ul {
              display: contents;
            }

            li {
              display: flex;
              align-items: stretch;
            }

            small {
              color: var(--color-neutral-500);
            }

            [data-action="delete"] {
              font-size: 1.25rem;
              color: #667085;
            }

            .button[aria-current="true"] strong::after {
              content: " (open)";
              font-weight: 300;
              color: #667085;
            }
          }

          /* The app places the modules. Each module styles its own inside. */
          #patch {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
            margin-top: 10px;
          }
          #rack {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
            max-width: 32rem;
          }

          /* ---- Cables (see patch-lane.ts) ---- */
          /* The jack strip: left of the module, as tall as it. A ring is an input, a dot an output. */
          .jacks {
            position: absolute;
            top: 0;
            right: calc(100% + 3px);
            box-sizing: border-box;
            width: var(--strip);
            height: 100%;
            padding: 14px 0;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            border-radius: 10px;

            z-index: 3;
          }
          /* Master's screen starts 40px down (the reels stick out above it): so does its strip. */
          .jacks[data-type="master"] {
            top: 40px;
            height: calc(100% - 40px);
          }
          .jack-group {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
          }
          /* The jacks are the jack component of @loop/ui (components/jack.css).
             While a cable is in your hand, the jacks it fits light up (.can), the others fade. */
          #patch.connecting .jack:not(.can):not(.origin) {
            opacity: 0.3;
          }

          /* The cables: over the rack, but only the lines in the lane take the pointer. */
          .wires {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
            pointer-events: none;
            z-index: 2;

            path {
              fill: none;
              stroke-linecap: round;
              stroke-linejoin: round;
            }
            .hits path {
              stroke: transparent;
              stroke-width: 12;
              pointer-events: stroke;
              cursor: pointer;
            }
          }
          body.patching,
          body.patching * {
            cursor: grabbing !important;
          }

          #rack:not(:has(.slot))::before {
            content: "No modules yet. Click Add.";
            color: #667085;
          }

          /* A slot: the module, then the drag handle on its right. */
          .slot {
            position: relative;
            display: flex;
            gap: 0.25rem;

            /* While you drag it, dnd-kit makes the slot a popover (so it floats above the page).
               @loop/ui gives popovers a frame (border, shadow, round corners): not here. */
            &[popover] {
              border: 0;
              border-radius: 0;
              box-shadow: none;
              padding: 0;
              background: none;
            }

            &:not(:hover) {
              .drag-handle {
                opacity: 0;
                pointer-events: none;
              }
            }
          }

          /* Drag a module by its handle to change the order (see rack.ts). */
          .drag-handle {
            display: grid;
            place-items: center;
            flex: none;
            width: 1rem;
            padding: 0;
            color: var(--color-neutral-500);
            background: none;
            border: 0;
            border-radius: 4px;
            cursor: grab;
            /* Touch: dragging the handle moves the module, not the page. */
            touch-action: none;
          }
          .drag-handle:hover {
            color: var(--color-neutral-800);
            background: var(--color-neutral-200);
          }
          .drag-handle:active {
            cursor: grabbing;
          }
          .drag-handle svg {
            fill: currentColor;
          }
          #rack[data-removing] .drag-handle {
            visibility: hidden;
          }

          /* Remove mode: modules jiggle, a badge shows, a click removes the module. */
          .slot .remove-target {
            display: none;
          }
          #rack[data-removing] .slot .remove-target {
            display: block;
            position: absolute;
            inset: 0;
            z-index: 1;
            padding: 0;
            background: transparent;
            border: 0;
            border-radius: 0.75rem;
            cursor: pointer;
          }
          .remove-target::before {
            content: "−";
            position: absolute;
            top: -0.6rem;
            left: 0rem;
            display: grid;
            place-items: center;
            width: 1rem;
            height: 1rem;
            border-radius: 50%;
            background: var(--color-neutral-300);
            color: var(--color-neutral-1000);
            font-size: 1rem;
            line-height: 1;
          }
          #rack[data-removing] .slot {
            animation: jiggle 0.25s ease-in-out infinite alternate;
          }
          #rack[data-removing] .slot:nth-child(even) {
            animation-delay: -0.125s;
          }
          @keyframes jiggle {
            from {
              rotate: -0.6deg;
            }
            to {
              rotate: 0.6deg;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            #rack[data-removing] .slot {
              animation: none;
              outline: 2px dashed var(--loop-primary);
              outline-offset: 4px;
              border-radius: 0.75rem;
            }
          }
        </style>
        ${import.meta.env.DEV
          ? html`<script type="module" src="${base}@vite/client"></script>`
          : ""}
        <script type="module" src="${clientScript}"></script>
      </head>
      <body>
        ${body}
      </body>
    </html>`;

app.get(base, (c) =>
  c.html(
    layout(
      "Loop 001",
      html`<main>
        <h1 class="sr-only">Loop 001</h1>

        <div class="row">
          <button
            id="project-menu-button"
            class="button"
            type="button"
            popovertarget="project-menu"
          >
            Projects
          </button>
          <div id="project-menu" popover>
            <menu>
              <li>
                <button id="project-new" class="button small" type="button">
                  New
                </button>
              </li>
              <li>
                <button id="project-import" class="button small" type="button">
                  Import…
                </button>
              </li>
              <li>
                <button id="project-export" class="button small" type="button">
                  Export
                </button>
                <input id="project-file" type="file" hidden />
              </li>
              <li><hr /></li>
              <li><small>Projects</small></li>
              <ul id="project-list"></ul>
            </menu>

            <div class="menu-actions row" style="gap: 0.5rem"></div>
          </div>
        </div>
        <div class="row">
          <input
            id="project-name"
            class="input"
            type="text"
            aria-label="Project name"
            autocomplete="off"
          />
          <span
            id="save-status"
            class="text-muted text-small sr-only"
            role="status"
          ></span>
        </div>
        <div class="row">
          <button
            id="add"
            class="button small"
            type="button"
            popovertarget="module-picker"
          >
            Add
          </button>
          <button
            id="remove"
            class="button small"
            type="button"
            aria-pressed="false"
            disabled
          >
            Remove
          </button>
        </div>
        <div id="module-picker" class="menu" popover>
          <menu id="module-list"></menu>
        </div>
        <div id="patch">
          <div id="rack"></div>
        </div>
      </main>`,
    ),
  ),
);

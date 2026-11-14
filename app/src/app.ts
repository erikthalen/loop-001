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
const clientScript = import.meta.env.DEV ? `${base}src/client.ts` : `${base}client.js`;

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
        <link
          rel="preload"
          href="${base}fonts/italian-plate-no1-mono-light.woff2"
          as="font"
          type="font/woff2"
          crossorigin
        />
        <link
          rel="preload"
          href="${base}fonts/italian-plate-no1-mono-medium.woff2"
          as="font"
          type="font/woff2"
          crossorigin
        />
        <style>
          @font-face {
            font-family: "Italian Plate No1 Mono";
            src: url("${base}fonts/italian-plate-no1-mono-light.woff2")
              format("woff2");
            font-weight: 300;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: "Italian Plate No1 Mono";
            src: url("${base}fonts/italian-plate-no1-mono-medium.woff2")
              format("woff2");
            font-weight: 500;
            font-style: normal;
            font-display: swap;
          }
        </style>
        <!-- @loop/ui: the shared component library (buttons, inputs, menus, ...). -->
        <style>
          ${raw(uiStyles.cssText)}
        </style>
        <!-- App-only styles: page layout, menus placement, the rack and remove mode. -->
        <style>
          body {
            padding: 0.5rem;
          }

          /* Project bar */
          .project-bar {
            margin-bottom: 0.5rem;
          }

          #project-name {
            width: 8rem;
          }

          #save-status[data-status="error"] {
            color: #cc0000;
            font-weight: 500;
          }
          /* Room for "300", so the layout does not jump while dragging. */
          #bpm-value {
            min-width: 3ch;
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
          }
          #project-list li {
            display: flex;
            align-items: stretch;
          }
          #project-list [data-action="delete"] {
            font-size: 1.25rem;
            color: #667085;
          }
          #project-list .menu-item[aria-current="true"] strong::after {
            content: " (open)";
            font-weight: 300;
            color: #667085;
          }

          /* The app places the modules. Each module styles its own inside. */
          #rack {
            display: grid;
            gap: 1rem;
            margin-top: 1.5rem;
            max-width: 32rem;
          }
          #rack:not(:has(.slot))::before {
            content: "No modules yet. Click Add.";
            color: #667085;
          }

          /* Remove mode: modules jiggle, a badge shows, a click removes the module. */
          .slot {
            position: relative;
          }
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
            left: -0.6rem;
            display: grid;
            place-items: center;
            width: 1.5rem;
            height: 1.5rem;
            border-radius: 50%;
            background: #555;
            color: white;
            font-size: 1.25rem;
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
      html`<header class="project-bar row">
          <h1>Loop 001</h1>
          <button
            id="project-menu-button"
            class="button"
            type="button"
            popovertarget="project-menu"
          >
            Projects
          </button>
          <input
            id="project-name"
            class="input"
            type="text"
            aria-label="Project name"
            autocomplete="off"
          />
          <span
            id="save-status"
            class="text-muted text-small"
            role="status"
          ></span>
        </header>
        <div id="project-menu" class="popover menu" popover>
          <div class="menu-actions row" style="gap: 0.5rem">
            <button
              id="project-new"
              class="button"
              data-size="small"
              type="button"
            >
              New
            </button>
            <button
              id="project-import"
              class="button"
              data-size="small"
              type="button"
            >
              Import…
            </button>
            <button
              id="project-export"
              class="button"
              data-size="small"
              type="button"
            >
              Export
            </button>
            <input id="project-file" type="file" hidden />
          </div>
          <hr class="menu-divider" />
          <h2 class="menu-title">Projects</h2>
          <ul id="project-list" class="menu-list"></ul>
        </div>
        <div class="row">
          <label class="field">
            <input
              id="play"
              class="checkbox"
              type="checkbox"
              aria-label="play and pauses"
            />
          </label>
        </div>
        <div class="row">
          <label class="field">
            <input
              id="bpm"
              class="range"
              type="range"
              min="20"
              max="300"
              step="1"
              value="120"
            />
            <output class="sr-only" id="bpm-value" for="bpm">120</output>
          </label>
        </div>
        <div class="row">
          <button
            id="add"
            class="button"
            type="button"
            popovertarget="module-picker"
          >
            Add
          </button>
          <button
            id="remove"
            class="button"
            type="button"
            aria-pressed="false"
            disabled
          >
            Remove
          </button>
        </div>
        <div id="module-picker" class="popover menu" popover>
          <h2 class="menu-title">Add a module</h2>
          <ul id="module-list" class="menu-list"></ul>
        </div>
        <div id="rack"></div>`,
    ),
  ),
);

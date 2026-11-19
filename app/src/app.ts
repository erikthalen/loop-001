import { uiStyles } from "@loop/ui";
import { Hono } from "hono";
import { html, raw } from "hono/html";
import { type ModuleDoc, moduleDocOf, moduleDocs } from "./module-docs";

// This Hono app runs INSIDE the service worker (in the browser).
// It answers page requests, so pages work offline too.
// Note: a service worker has no Web Audio. All audio code runs in the page,
// in src/client.ts. Hono only sends the HTML.
export const app = new Hono();

// The path the app lives under: "/", or for example "/loop-001/" on GitHub Pages.
const base = import.meta.env.BASE_URL;

/** The page scripts: the studio (client), and a module page (module-page). */
type PageScript = "client" | "module-page";

// Dev: Vite serves the TypeScript source. Build: vite.config.ts outputs a fixed <name>.js.
const scriptUrl = (name: PageScript) =>
  import.meta.env.DEV ? `${base}src/${name}.ts` : `${base}${name}.js`;

const layout = (
  title: string,
  body: ReturnType<typeof html>,
  script: PageScript = "client",
) =>
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
            content: "No modules yet. Click add in the patchbay below.";
            color: #667085;
          }

          /* A slot: the module, then the drag handle on its right. */
          .slot {
            position: relative;
            display: flex;
            gap: 0.25rem;
            /* Each slot has its own view-transition-name (set in rack.ts, from the module id). */
            view-transition-class: module;

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

          /* The patchbay and the library are under the rack: they move when a module goes,
             so they take part in the view transition too (the same class as the modules). */
          #patchbay {
            view-transition-name: patchbay;
            view-transition-class: module;
          }
          #library {
            view-transition-name: library;
            view-transition-class: module;
          }

          /* A module is added or removed (view transition, see rack.ts): the modules, the
             patchbay and the library slide into their new place. */
          html:active-view-transition-type(
              add-module,
              remove-module
            )::view-transition-group(.module) {
            animation-duration: 0.3s;
            animation-timing-function: cubic-bezier(0.2, 0, 0, 1);
          }
          /* The removed module (only in the old picture) shrinks away. */
          html:active-view-transition-type(remove-module)::view-transition-old(
              .module
            ):only-child {
            animation: module-out 0.15s ease-in both;
          }
          /* The added module (only in the new picture) grows in, once there is room for it. */
          html:active-view-transition-type(add-module)::view-transition-new(
              .module
            ):only-child {
            animation: module-out 0.2s ease-out 0.1s reverse both;
          }
          @keyframes module-out {
            to {
              opacity: 0;
              scale: 0.85;
            }
          }

          /* ---- The module guide (/modules and /modules/<type>) ---- */
          /* The link to the guide, under the library on the studio page. */
          .page-links {
            margin: 1.5rem 0 1rem;
            text-align: center;
          }
          .page-links a,
          .guide a {
            color: var(--color-neutral-800);
            text-decoration-color: var(--color-neutral-400);
            text-underline-offset: 3px;
          }
          .page-links a:hover,
          .guide a:hover {
            color: var(--color-neutral-1000);
            text-decoration-color: currentColor;
          }
          /* The module, alone, at the top of its page. */
          #module {
            display: flex;
            justify-content: center;
            margin-top: 10px;
          }
          .guide {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            padding: 1.5rem 0 2rem;
            line-height: 1.5;
            /* Text to read: let people select and copy it. */
            user-select: text;

            h1 {
              /* font-size: 1.5rem;
              line-height: 1.2; */
              margin-bottom: 0.5rem;
            }
            h2 {
              margin-bottom: 0.5rem;
              /* font-size: 0.75rem; */
              /* text-transform: uppercase; */
              /* letter-spacing: 0.08em; */
              color: var(--color-neutral-700);
            }
            section > * + * {
              margin-top: 0.5rem;
            }
            ol,
            ul {
              padding-left: 1.25rem;
            }
            li + li {
              margin-top: 0.35rem;
            }
          }
          .summary {
            /* font-size: 1rem; */
            color: var(--color-neutral-800);
          }
          .jacks-list {
            list-style: none;
            padding: 0;

            li {
              display: grid;
              grid-template-columns: 5.5rem 1fr;
              gap: 0.5rem;
            }
            b {
              font-weight: 500;
            }
            .text-muted {
              display: block;
              font-size: 0.7rem;
              text-transform: uppercase;
            }
          }
          .note {
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            background: var(--color-neutral-100);
            color: var(--color-neutral-800);
          }
          /* The other modules, at the end of each page. */
          .module-list {
            padding: 0;

            li + li {
              margin-top: 0.25rem;
            }
            a[aria-current="page"] {
              font-weight: 500;
              color: var(--color-neutral-1000);
              text-decoration: none;
            }

            span {
              display: none;
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
        <script type="module" src="${scriptUrl(script)}"></script>
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

        <div id="patch">
          <div id="rack"></div>
          <!-- The patchbay module: add, remove, and the cables (see @loop/patchbay). Under the
               last module, not in the rack: it cannot be moved, removed or patched. -->
          <div id="patchbay"></div>
          <!-- The library module: the projects, under the last module (see library.ts and
               @loop/library). Not in the rack: it cannot be moved, removed or patched. -->
          <div id="library"></div>
        </div>

        <nav class="page-links" aria-label="Pages">
          <a href="${base}modules">Module guide</a>
        </nav>
      </main>`,
    ),
  ),
);

// ---- The module guide: a list of the modules, and one page per module ----
// Each module page shows the module (module-page.ts mounts it into #module), then its docs
// (module-docs.ts). The same <main> width as the studio.

const KIND_NAMES = {
  audio: "Sound",
  channels: "6 channels",
  trigger: "Triggers",
} as const;

/** Links to all the modules. The one on this page is marked. */
const moduleList = (current?: string) =>
  html`<ul class="module-list">
    ${moduleDocs.map(
      (doc) =>
        html`<li>
          <a
            href="${base}modules/${doc.type}"
            ${doc.type === current ? raw('aria-current="page"') : ""}
            >${doc.name}</a
          >
          ${doc.type === current
            ? ""
            : html`<span class="text-muted"> – ${doc.summary}</span>`}
        </li>`,
    )}
  </ul>`;

const modulePage = (doc: ModuleDoc) =>
  html`<main>
    <div id="module" data-type="${doc.type}"></div>

    <article class="guide">
      <header>
        <h1>${doc.name}</h1>
        <p class="summary">${doc.summary}</p>
      </header>

      <section>
        <h2>What it does</h2>
        ${doc.about.map((text) => html`<p>${text}</p>`)}
      </section>

      <section>
        <h2>How to use it</h2>
        <ol>
          ${doc.howTo.map((text) => html`<li>${text}</li>`)}
        </ol>
      </section>

      ${doc.jacks?.length
        ? html`<section>
            <h2>Jacks</h2>
            <ul class="jacks-list">
              ${doc.jacks.map(
                (jack) =>
                  html`<li>
                    <span>
                      <b>${jack.name}</b>
                      <span class="text-muted"
                        >${jack.direction} · ${KIND_NAMES[jack.kind]}</span
                      >
                    </span>
                    <span>${jack.text}</span>
                  </li>`,
              )}
            </ul>
            <p class="text-muted">
              A jack is a socket for a cable. You connect the jacks in the
              patchbay, in the studio.
            </p>
          </section>`
        : ""}
      ${doc.tips?.length
        ? html`<section>
            <h2>Good to know</h2>
            <ul>
              ${doc.tips.map((text) => html`<li>${text}</li>`)}
            </ul>
          </section>`
        : ""}

      <p class="note">
        ${doc.note ??
        "On this page, the module has no cables, so it makes no sound. This page does not save your settings."}
        To use it in a project, <a href="${base}">open the studio</a>.
      </p>

      <nav aria-label="Modules">
        <h2>All modules</h2>
        ${moduleList(doc.type)}
      </nav>
    </article>
  </main>`;

app.get(`${base}modules`, (c) =>
  c.html(
    layout(
      "Modules – Loop 001",
      html`<main>
        <article class="guide">
          <header>
            <h1>Module guide</h1>
            <p class="summary">
              Read what each module is, what it does and how to use it.
            </p>
          </header>
          <nav aria-label="Modules">${moduleList()}</nav>
          <p><a href="${base}">← Go to the studio</a></p>
        </article>
      </main>`,
      "module-page",
    ),
  ),
);

app.get(`${base}modules/:type`, (c) => {
  const doc = moduleDocOf(c.req.param("type"));
  // An unknown module: go to the list. (A 404 would go to the network, see sw.ts.)
  if (!doc) return c.redirect(`${base}modules`);
  return c.html(
    layout(`${doc.name} – Loop 001`, modulePage(doc), "module-page"),
  );
});

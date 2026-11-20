import { uiStyles } from '@loop/ui'
import { Hono } from 'hono'
import { html, raw } from 'hono/html'
import { type ModuleDoc, moduleDocOf, moduleDocs } from './module-docs'
import { SKELETON_HEIGHT, skeletonSvg } from './skeleton'

// This Hono app runs INSIDE the service worker (in the browser).
// It answers page requests, so pages work offline too.
// Note: a service worker has no Web Audio. All audio code runs in the page,
// in src/client.ts. Hono only sends the HTML.
export const app = new Hono()

// The path the app lives under: "/", or for example "/loop-001/" on GitHub Pages.
const base = import.meta.env.BASE_URL

/** The page scripts: the studio (client), and a module page (module-page). */
type PageScript = 'client' | 'module-page'

// Dev: Vite serves the TypeScript source. Build: vite.config.ts outputs a fixed <name>.js.
const scriptUrl = (name: PageScript) =>
  import.meta.env.DEV ? `${base}src/${name}.ts` : `${base}${name}.js`

const layout = (
  title: string,
  body: ReturnType<typeof html>,
  script: PageScript = 'client',
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
        <!-- @loop/ui: the components (buttons, inputs, menus, ...) and the app's own styles (app.css). -->
        <style>
          ${raw(uiStyles.cssText)}
        </style>
        ${
          import.meta.env.DEV
            ? html`<script type="module" src="${base}@vite/client"></script>`
            : ''
        }
        <script type="module" src="${scriptUrl(script)}"></script>
      </head>
      <body>
        ${body}
      </body>
    </html>`

app.get(base, (c) =>
  c.html(
    layout(
      'Loop 001',
      html`<main>
        <h1 class="sr-only">Loop 001</h1>

        <div id="patch" style="--skeleton-height: ${SKELETON_HEIGHT}px">
          <!-- The loading screen: hidden when the modules are ready (client.ts). -->
          <div class="skeleton">${raw(skeletonSvg())}</div>
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
)

// ---- The module guide: a list of the modules, and one page per module ----
// Each module page shows the module (module-page.ts mounts it into #module), then its docs
// (module-docs.ts). The same <main> width as the studio.

const KIND_NAMES = {
  audio: 'Sound',
  channels: '6 channels',
  trigger: 'Triggers',
} as const

/** Links to all the modules. The one on this page is marked. */
const moduleList = (current?: string) =>
  html`<ul class="module-list">
    ${moduleDocs.map(
      (doc) =>
        html`<li>
          <a
            href="${base}modules/${doc.type}"
            ${doc.type === current ? raw('aria-current="page"') : ''}
            >${doc.name}</a
          >
          ${
            doc.type === current
              ? ''
              : html`<span class="text-muted"> – ${doc.summary}</span>`
          }
        </li>`,
    )}
  </ul>`

const modulePage = (doc: ModuleDoc) =>
  html`<main>
    <div id="module" data-type="${doc.type}"></div>

    <article class="guide prose">
      <header>
        <h1>${doc.name}</h1>
        <p class="summary">${doc.summary}</p>
      </header>

      <section>
        <h2>How to use it</h2>
        <ol>
          ${doc.howTo.map((text) => html`<li>${text}</li>`)}
        </ol>
      </section>

      ${
        doc.jacks?.length
          ? html`<section>
            <h2 id="jacks-title">Jacks</h2>
            <table aria-labelledby="jacks-title">
              <thead>
                <tr>
                  <th scope="col">Jack</th>
                  <th scope="col">Signal</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                ${doc.jacks.map(
                  (jack) =>
                    html`<tr>
                      <th scope="row">${jack.name}</th>
                      <td>${KIND_NAMES[jack.kind]} ${jack.direction}</td>
                      <td>${jack.text}</td>
                    </tr>`,
                )}
              </tbody>
            </table>
            <p class="text-muted">
              Connect the jacks in the <a href="${base}modules/patchbay">patchbay</a>.
            </p>
          </section>`
          : ''
      }
      ${
        doc.tips?.length
          ? html`<section>
            <h2>Good to know</h2>
            <ul>
              ${doc.tips.map((text) => html`<li>${text}</li>`)}
            </ul>
          </section>`
          : ''
      }

      <p class="note">
        ${
          doc.note ??
          'On this page, the module has no cables and makes no sound.'
        }
        To use it, <a href="${base}">open the studio</a>.
      </p>

      <nav aria-label="Modules">
        <h2>All modules</h2>
        ${moduleList(doc.type)}
      </nav>
    </article>
  </main>`

app.get(`${base}modules`, (c) =>
  c.html(
    layout(
      'Modules – Loop 001',
      html`<main>
        <article class="guide prose">
          <header>
            <h1>Module guide</h1>
            <p class="summary">
              How to use each module.
            </p>
          </header>
          <nav aria-label="Modules">${moduleList()}</nav>
          <p><a href="${base}">← Go to the studio</a></p>
        </article>
      </main>`,
      'module-page',
    ),
  ),
)

app.get(`${base}modules/:type`, (c) => {
  const doc = moduleDocOf(c.req.param('type'))
  // An unknown module: go to the list. (A 404 would go to the network, see sw.ts.)
  if (!doc) return c.redirect(`${base}modules`)
  return c.html(
    layout(`${doc.name} – Loop 001`, modulePage(doc), 'module-page'),
  )
})

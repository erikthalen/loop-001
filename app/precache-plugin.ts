import type { Plugin } from 'vite'

/**
 * The files of one version of the app, for the service worker (sw.ts). On install, it downloads
 * them all into a new cache. `version` changes when any file changes, so each new build makes a
 * new sw.js, and the browser sees an update.
 */
export interface Precache {
  readonly version: string
  /** Paths relative to the app's base URL, for example 'client.js'. */
  readonly files: readonly string[]
}

const FILE = 'precache.json'
const ID = 'virtual:precache'
const RESOLVED_ID = `\0${ID}`

/**
 * Step 1 of `pnpm build` (vite.config.ts): write dist/precache.json, the list of the files this
 * build made. Not the HTML (Hono makes the pages) and not the files in public/ (sw.ts keeps those).
 */
export function writePrecacheList(): Plugin {
  return {
    name: 'write-precache-list',
    apply: 'build',
    async generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        .filter((file) => !file.endsWith('.html'))
        .sort()
      // The version: a hash of the file names and the code. Most names already have a hash in
      // them. client.js and module-page.js do not, so their code counts too.
      const text = files
        .map((file) => {
          const output = bundle[file]!
          return `${file}\n${output.type === 'chunk' ? output.code : ''}`
        })
        .join('\n')
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text),
      )
      const version = [...new Uint8Array(digest).slice(0, 8)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
      const precache: Precache = { version, files }
      this.emitFile({
        type: 'asset',
        fileName: FILE,
        source: JSON.stringify(precache),
      })
    },
  }
}

/**
 * `import precache from 'virtual:precache'` in sw.ts.
 * - Step 2 of `pnpm build` (vite.sw.config.ts): the list from step 1, built into sw.js.
 * - Dev: no list. Vite serves the files, and sw.ts only caches what the page asks for.
 */
export function readPrecacheList(): Plugin {
  let root = ''
  let serve = true
  return {
    name: 'read-precache-list',
    configResolved(config) {
      root = config.root
      serve = config.command === 'serve'
    },
    resolveId: (id) => (id === ID ? RESOLVED_ID : undefined),
    load(id) {
      if (id !== RESOLVED_ID) return
      if (serve) {
        const dev: Precache = { version: 'dev', files: [] }
        return `export default ${JSON.stringify(dev)}`
      }
      // Fails if step 1 did not run: build with `pnpm build`, not only the service worker.
      return `export { default } from ${JSON.stringify(`${root}/dist/${FILE}`)}`
    },
  }
}

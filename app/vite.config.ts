import { defineConfig, searchForWorkspaceRoot, type Plugin } from 'vite'

/**
 * Vite only watches the app folder for NEW files. The workspace packages live outside it,
 * so a new file there (for example a new CSS component in packages/ui/src/components/)
 * was not noticed until the dev server restarted. Watch the packages folder too.
 */
function watchWorkspacePackages(): Plugin {
  return {
    name: 'watch-workspace-packages',
    configureServer(server) {
      server.watcher.add(`${searchForWorkspaceRoot(server.config.root)}/packages`)
    },
  }
}

// Node's `process` (no @types/node in this project, so say what we use).
declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  // The URL path the app lives under. "/" by default. GitHub Pages sets it, for example "/loop-001/".
  base: process.env.BASE_PATH || '/',
  plugins: [watchWorkspacePackages()],
  optimizeDeps: {
    // sw.ts is not linked from index.html, so tell Vite to scan it for deps.
    entries: ['index.html', 'sw.ts'],
  },
  build: {
    rolldownOptions: {
      input: {
        index: 'index.html',
        // The page script for Hono's pages. Hono (in the service worker) cannot know
        // hashed file names, so this one gets a fixed name: client.js
        client: 'src/client.ts',
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'client' ? 'client.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
})

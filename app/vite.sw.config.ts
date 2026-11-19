import { defineConfig } from 'vite'
import { readPrecacheList } from './precache-plugin.ts'

// Second build step: bundle the service worker into one plain script, dist/sw.js.
// Node's `process` (no @types/node in this project, so say what we use).
declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  // Same base path as vite.config.ts. The service worker builds its URLs from it.
  base: process.env.BASE_PATH || '/',
  publicDir: false,
  // The list of files from the first build step (dist/precache.json), built into sw.js.
  plugins: [readPrecacheList()],
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'sw.ts',
      formats: ['iife'],
      name: 'sw',
      fileName: () => 'sw.js',
    },
  },
})

import { defineConfig } from 'vitest/config'

// Vitest skips CSS by default. The tests check the CSS, so turn it on.
export default defineConfig({ test: { css: true } })

import { describe, expect, it } from 'vitest'
import { uiStyles } from './index'

// Every CSS file, as text (a Vite feature).
const files = import.meta.glob<string>(['./*.css', './components/*.css'], { query: '?raw', import: 'default', eager: true })

describe('@loop/ui', () => {
  it('puts every file in the "ui" layer', () => {
    for (const [path, text] of Object.entries(files)) expect(text, path).toMatch(/@layer ui \{/)
  })

  it('includes every file in the exported CSS', () => {
    for (const [path, text] of Object.entries(files)) expect(uiStyles.cssText, path).toContain(text.trim())
  })

  it('puts the variables first', () => {
    expect(uiStyles.cssText.indexOf('--loop-primary:')).toBeLessThan(uiStyles.cssText.indexOf('.button'))
  })

  it('only has the two shared variables: --loop-primary and --loop-font', () => {
    const defined = new Set(uiStyles.cssText.match(/--[a-z0-9-]+(?=\s*:)/g))
    expect([...defined].sort()).toEqual(['--loop-font', '--loop-primary'])
  })
})

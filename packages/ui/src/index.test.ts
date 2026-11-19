import { describe, expect, it } from 'vitest'
import { uiStyles } from './index'

// Every CSS file, as text (a Vite feature).
const files = import.meta.glob<string>(['./*.css', './components/*.css'], { query: '?raw', import: 'default', eager: true })

/** The CSS variables a file sets (not the ones in its comments, which only show how to use it). */
const defined = (css: string) => [...new Set(css.replace(/\/\*[\s\S]*?\*\//g, '').match(/--[a-z0-9-]+(?=\s*:)/g))]

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

  it('defines the shared variables (--loop-primary, --loop-font) in tokens.css', () => {
    expect(defined(files['./tokens.css']!)).toEqual(expect.arrayContaining(['--loop-primary', '--loop-font']))
  })

  it('lets a component only define its own variables, named after its file (--range-*)', () => {
    for (const [path, text] of Object.entries(files)) {
      const name = /components\/(.+)\.css$/.exec(path)?.[1]
      if (!name) continue
      for (const variable of defined(text)) expect(variable, path).toMatch(new RegExp(`^--${name}-`))
    }
  })
})

import { describe, expect, it } from 'vitest'
import { css, html } from './ui'

describe('html', () => {
  it('escapes values', () => {
    const name = '<img src=x onerror="alert(1)">'
    expect(String(html`<p title="${name}">${name}</p>`)).toBe(
      '<p title="&lt;img src=x onerror=&quot;alert(1)&quot;&gt;">&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>',
    )
  })

  it('inserts nested templates and arrays as HTML', () => {
    const items = ['a', 'b'].map((x) => html`<li>${x}</li>`)
    expect(String(html`<ul>${items}</ul>`)).toBe(
      '<ul><li>a</li><li>b</li></ul>',
    )
  })

  it('inserts nothing for null, undefined and false, but keeps 0', () => {
    expect(String(html`[${null}${undefined}${false}${0}]`)).toBe('[0]')
  })
})

describe('css', () => {
  it('joins strings, numbers and other css templates', () => {
    const base = css`a { color: red; }`
    expect(css`${base} p { margin: ${2}px; }`.cssText).toBe(
      'a { color: red; } p { margin: 2px; }',
    )
  })
})

// Doto: the dot-matrix font for the display digits. SIL Open Font License.
// The font file is part of this package, so the module brings its own font to any app.
import dotoUrl from './fonts/doto-black.woff2?url'

/** The font-family name to use in CSS. */
export const DISPLAY_FONT = 'Doto'

let added = false

/**
 * Add the display font to the page (once).
 * A module UI lives in a Shadow DOM, and `@font-face` rules do not work there.
 * Fonts added to `document.fonts` work everywhere, also inside the Shadow DOM.
 */
export function addDisplayFont(): void {
  if (added || typeof FontFace === 'undefined') return
  added = true
  const font = new FontFace(DISPLAY_FONT, `url("${dotoUrl}") format("woff2")`, { weight: '900', display: 'swap' })
  document.fonts.add(font)
  font.load().catch((error) => console.warn('Could not load the metronome display font:', error))
}

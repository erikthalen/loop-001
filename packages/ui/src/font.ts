// Display fonts for modules. The font files are part of this package, so every module that uses
// one brings it to any app.
//
// - MatrixType Display: square pixels with gaps, like an LED display (metronome). Public domain
//   (CC0), see fonts/matrixtype/License.txt. Two weights: 400 and 700 (bold: no gaps).
//   The folder also has "MatrixType", with round dots; it is not added here.
// - Home Video: a pixel font like an old video player's screen (low pass filter). Public domain
//   (CC0), see fonts/home-video/License.txt. Capital letters only. Two weights:
//   400 (regular) and 700 ("bold": reversed, dark letters in a filled block, like a selected menu item).
//
// A module UI lives in a Shadow DOM, and `@font-face` rules do not work there.
// Fonts added to `document.fonts` work everywhere, also inside the Shadow DOM.
// The browser downloads a font file only when some text on the page uses it.
import matrixBoldUrl from './fonts/matrixtype/MatrixTypeDisplay-Bold.ttf?url'
import matrixRegularUrl from './fonts/matrixtype/MatrixTypeDisplay-Regular.ttf?url'
import homeVideoBoldUrl from './fonts/home-video/HomeVideo-Bold.ttf?url'
import homeVideoRegularUrl from './fonts/home-video/HomeVideo-Regular.ttf?url'

/** The MatrixType Display font-family name to use in CSS. Weights: 400 and 700. */
export const MATRIX_FONT = 'MatrixType Display'

/** The Home Video font-family name to use in CSS. Weights: 400, and 700 (reversed text). */
export const VIDEO_FONT = 'Home Video'

const added = new Set<string>()

/** Add a font file to the page, once per family and weight. */
function addFont(family: string, url: string, format: string, weight: string): void {
  const key = `${family} ${weight}`
  if (added.has(key) || typeof FontFace === 'undefined') return
  added.add(key)
  document.fonts.add(new FontFace(family, `url("${url}") format("${format}")`, { weight, display: 'swap' }))
}

/** Add the MatrixType Display font (regular and bold) to the page (once). */
export function addMatrixFont(): void {
  addFont(MATRIX_FONT, matrixRegularUrl, 'truetype', '400')
  addFont(MATRIX_FONT, matrixBoldUrl, 'truetype', '700')
}

/** Add the Home Video font (regular and bold) to the page (once). */
export function addVideoFont(): void {
  addFont(VIDEO_FONT, homeVideoRegularUrl, 'truetype', '400')
  addFont(VIDEO_FONT, homeVideoBoldUrl, 'truetype', '700')
}

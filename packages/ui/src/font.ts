// Fonts. The font files are part of this package, so every app and module that uses one brings it along.
//
// - Italian Plate No1 Mono: the font of the whole app (--loop-font). Weights 100 to 900, upright
//   and italic, in fonts/Italian Plate/. Add it once at start: addLoopFont().
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

/**
 * The Italian Plate No1 Mono files, by file name, for example "300-upright.woff2" or "700-italic.woff2".
 * (Vite finds them and gives each one a URL.)
 */
const loopFontFiles = import.meta.glob<string>('./fonts/Italian Plate/*.woff2', {
  query: '?url',
  import: 'default',
  eager: true,
})

/** The --loop-font family name. */
export const LOOP_FONT = 'Italian Plate No1 Mono'

/**
 * Add Italian Plate No1 Mono to the page (once): weights 100 to 900, upright and italic.
 * The browser downloads only the weights that some text uses.
 */
export function addLoopFont(): void {
  for (const [path, url] of Object.entries(loopFontFiles)) {
    const name = path.split('/').pop()!
    const weight = name.split('-')[0]!
    const style = name.includes('italic') ? 'italic' : 'normal'
    const key = `${LOOP_FONT} ${weight} ${style}`
    if (added.has(key) || typeof FontFace === 'undefined') continue
    added.add(key)
    document.fonts.add(new FontFace(LOOP_FONT, `url("${url}") format("woff2")`, { weight, style, display: 'swap' }))
  }
}

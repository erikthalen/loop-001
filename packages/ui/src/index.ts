// Types for `?inline` CSS imports and `import.meta.glob` (Vite features). Here, so every package
// that uses @loop/ui gets them too.
/// <reference types="vite/client" />

export { CHANNEL_COLORS } from './display'
/*
 * @loop/ui – how the modules look and get on the page:
 * - a small component library in plain CSS (below),
 * - the module UI: `defineModule`, `mountModule`, `html`, `css` (module.ts, view.ts).
 * @loop/core only knows the sound; it has no DOM code.
 *
 * The CSS:
 *
 * Every file puts its rules in the `ui` cascade layer.
 * Rules outside a layer (in the app or in a module) always win over layered rules,
 * so you can override anything here without fighting selector strength.
 *
 * Order: tokens, base, layout, then every file in components/ (a new file there is included
 * automatically), then app.css (the app's own pages: last, so it wins over the components).
 */
export {
  addLoopFont,
  addMatrixFont,
  addVideoFont,
  LOOP_FONT,
  MATRIX_FONT,
  VIDEO_FONT,
} from './font'
export {
  type AnyModuleDefinition,
  defineModule,
  defineModuleScript,
  defineModuleTemplate,
  type ModuleDefinition,
  type ModuleScript,
  type ModuleStyles,
  type ModuleTemplate,
  type ModuleUI,
  type ModuleUIContext,
  type ModuleUIScriptContext,
  mountModule,
} from './module'
export {
  createOdometer,
  type Odometer,
  type OdometerWheel,
  wheelCounts,
} from './odometer'
export {
  type CSSTemplate,
  css,
  type HTMLTemplate,
  html,
  type MountViewOptions,
  mountView,
  render,
  toStyleSheet,
  type View,
} from './view'

import app from './app.css?inline'
import base from './base.css?inline'
import layout from './layout.css?inline'
import tokens from './tokens.css?inline'
import type { CSSTemplate } from './view'

const components = import.meta.glob<string>('./components/*.css', {
  query: '?inline',
  import: 'default',
  eager: true,
})

/**
 * The whole UI library as one stylesheet.
 * It is a `css` template (see view.ts), so modules can use it in `styles`:
 *
 *   ui: { styles: [uiStyles, styles], template, script }
 *
 * The app puts the same text in a <style> tag of the page.
 */
export const uiStyles: CSSTemplate = {
  cssText: [tokens, base, layout, ...Object.values(components), app].join('\n'),
}

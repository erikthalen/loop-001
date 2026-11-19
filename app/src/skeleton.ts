// The loading screen: the silhouettes of the modules of a new project (see newProject in
// modules.ts), then the patchbay and the library. The studio shows it in place of the modules until
// they are ready (app.ts, client.ts). The start page shows it too (index.html, register-sw.ts).
// Plain strings only: app.ts runs in the service worker.

/**
 * Each part, top to bottom, in the order of newProject (modules.ts): the height of its screen, in
 * px, and the space above it (Master's reels). Measured in Chromium with a new project, so the real
 * modules appear in the same place. A module changes size: measure again and update its height.
 */
const PARTS: readonly { name: string; height: number; above?: number }[] = [
  { name: 'master', height: 139, above: 40 },
  { name: 'vu-meter', height: 120 },
  { name: 'sequencer', height: 134 },
  { name: 'sampler', height: 171 },
  { name: 'mixer', height: 176 },
  { name: 'delay', height: 146 },
  { name: 'lp-filter', height: 119 },
  { name: 'patchbay', height: 303 },
  { name: 'library', height: 243 },
]
/** The space between two modules (the gap of #patch and #rack in app.ts). */
const GAP = 5

/** The screen of every module (.display in @loop/ui). */
const WIDTH = 275
const RADIUS = 14
/** Master's two tape reels stick out above its screen (see reels.ts in @loop/master). */
const REELS = [64, 211] as const
const REEL_Y = 50
const REEL = 45

/** Where each screen starts, in px from the top of #patch: the parts above it, one after another. */
const SCREENS: { top: number; height: number }[] = []
for (const { height, above = 0 } of PARTS) {
  const last = SCREENS.at(-1)
  const top = (last ? last.top + last.height + GAP : 0) + above
  SCREENS.push({ top, height })
}

/** The height of the whole skeleton, in px. */
export const SKELETON_HEIGHT = Math.max(
  ...SCREENS.map(({ top, height }) => top + height),
)

/** The silhouettes as one SVG. Its color is `currentColor`: set `color` in CSS. */
export const skeletonSvg = (): string => {
  const screens = SCREENS.map(
    ({ top, height }) =>
      `<rect x="0" y="${top}" width="${WIDTH}" height="${height}" rx="${RADIUS}"/>`,
  )
  const reels = REELS.map(
    (x) => `<circle cx="${x}" cy="${REEL_Y}" r="${REEL}"/>`,
  )
  return `<svg width="${WIDTH}" height="${SKELETON_HEIGHT}" viewBox="0 0 ${WIDTH} ${SKELETON_HEIGHT}" fill="currentColor" aria-hidden="true">${[...reels, ...screens].join('')}</svg>`
}

/**
 * The CSS for `.skeleton`: the color, and a slow pulse (none with reduced motion).
 * The page places it.
 */
export const skeletonCss = `
  .skeleton {
    color: var(--color-neutral-100);
    pointer-events: none;
  }
  .skeleton svg {
    display: block;
    max-width: 100%;
    height: auto;
    animation: skeleton-pulse 1.6s ease-in-out infinite;
  }
  @keyframes skeleton-pulse {
    50% {
      opacity: 0.55;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton svg {
      animation: none;
    }
  }
`

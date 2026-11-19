// New versions of the app (see sw.ts). We look for a new version only when the app opens:
// - On each page load. The browser does this itself: it looks for a new sw.js.
// - When the app opens from the home screen. A phone often keeps the installed app in the
//   background, so opening it shows the page again without a page load. So we ask then.
// An open page in a browser tab does not ask. When a new version takes control, the page reloads
// to show it.

/** True when the app runs as an installed app (from the home screen), not in a browser tab. */
const isInstalled = () =>
  matchMedia('(display-mode: standalone)').matches ||
  // Safari on iOS: the older way to say the same.
  (navigator as { standalone?: boolean }).standalone === true

export interface UpdateOptions {
  /**
   * Wait until the page can reload without losing anything (for example: the music stopped, the
   * project is saved). Throw to not reload. Default: reload at once.
   */
  readonly whenSafe?: () => Promise<void>
}

export function watchForUpdates(options: UpdateOptions = {}): void {
  // Not controlled by the service worker: register-sw.ts handles that (first visit, hard refresh).
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller)
    return
  const worker = navigator.serviceWorker

  // The installed app opens again from the background: look for a new version.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !isInstalled()) return
    // No internet: nothing to get. The app keeps the version it has.
    if (!navigator.onLine) return
    try {
      await (await worker.getRegistration())?.update()
    } catch {
      // The server did not answer. The next time the app opens, it asks again.
    }
  })

  let reloading = false
  worker.addEventListener('controllerchange', async () => {
    if (reloading) return
    reloading = true
    try {
      await options.whenSafe?.()
    } catch (error) {
      // Not safe (for example the project could not be saved): keep this page as it is.
      // The new version shows on the next page load.
      console.error(
        'A new version is ready, but the page did not reload:',
        error,
      )
      return
    }
    location.reload()
  })
}

// Runs on the start page (index.html). It makes sure the service worker controls the page.
// After that, Hono inside the service worker answers page requests.
//
// We get here when:
// - this is the first visit (no service worker yet), or
// - the user did a hard refresh (Shift+Cmd+R). The browser then skips the service worker
//   for one page load, so the server sends this start page instead of the app.

const status = document.querySelector('#status')

function showError(message: string) {
  if (!status) return
  status.textContent = message + ' '
  const button = Object.assign(document.createElement('button'), {
    type: 'button',
    textContent: 'Reload',
  })
  button.addEventListener('click', () => location.reload())
  status.append(button)
}

async function start() {
  if (!('serviceWorker' in navigator)) {
    showError('This browser does not support service workers.')
    return
  }

  const hadController = Boolean(navigator.serviceWorker.controller)

  // When the service worker takes control of this page, reload once so the page comes from Hono.
  // (Only if it did not control the page before, so this can never loop.)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) location.reload()
  })

  // Dev: Vite serves the TypeScript file as an ES module.
  // Build: vite.sw.config.ts outputs a plain script, sw.js.
  // BASE_URL is the path the app lives under: "/", or for example "/loop-001/" on GitHub Pages.
  const base = import.meta.env.BASE_URL
  const url = import.meta.env.DEV ? `${base}sw.ts` : `${base}sw.js`
  const type = import.meta.env.DEV ? 'module' : 'classic'

  try {
    await navigator.serviceWorker.register(url, { scope: base, type })
    const registration = await navigator.serviceWorker.ready

    // Hard refresh: the service worker is already running, but it does not control this page,
    // and it will not take control by itself. Ask it to.
    if (!navigator.serviceWorker.controller)
      registration.active?.postMessage({ type: 'claim' })
  } catch (error) {
    console.error('Service worker registration failed:', error)
    showError('Could not start the app.')
    return
  }

  // Safety net: if the app has still not started (for example on a very slow network),
  // let the user try again. The page still reloads by itself if the service worker gets ready.
  setTimeout(() => showError('This takes longer than expected.'), 8000)
}

start()

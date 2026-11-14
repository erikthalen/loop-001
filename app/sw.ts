// Service worker entry. It must sit at the app root so it can control "/".
import { fire } from '@hono/service-worker'
import { app } from './src/app'

// Tell TypeScript that `self` is a service worker here.
// See https://github.com/microsoft/TypeScript/issues/14877
declare const self: ServiceWorkerGlobalScope

const CACHE = 'static-v1'

// Activate a new version at once and take control of open pages.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// A page that is not controlled (for example after a hard refresh, Shift+Cmd+R) asks us
// to take control. See src/register-sw.ts.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'claim') event.waitUntil(self.clients.claim())
})

// Requests that Hono does not handle (scripts, icons, ...):
// try the network first and keep a copy. When offline, use the copy.
async function networkFirst(input: RequestInfo | URL): Promise<Response> {
  const request = new Request(input)
  try {
    const response = await fetch(request)
    const sameOrigin = new URL(request.url).origin === self.location.origin
    if (request.method === 'GET' && sameOrigin && response.ok) {
      const cache = await caches.open(CACHE)
      await cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) return cached
    throw error
  }
}

// Send every fetch to Hono. If Hono returns 404, use networkFirst.
fire(app, { fetch: networkFirst })

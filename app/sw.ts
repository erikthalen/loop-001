// Service worker entry. It must sit at the app root so it can control "/".

import precache from 'virtual:precache'
import { fire } from '@hono/service-worker'
import { app } from './src/app'

// Tell TypeScript that `self` is a service worker here.
// See https://github.com/microsoft/TypeScript/issues/14877
declare const self: ServiceWorkerGlobalScope

// ---- Versions and caches ----
// Each build has its own version (precache-plugin.ts), and each version has its own cache.
// A new deploy makes a new sw.js. The browser sees it (on each page load, and when the page asks,
// see src/updates.ts) and installs it:
// 1. install: download all the files of the new version into a new cache. No internet: the
//    install fails, and the current version keeps running, from its cache.
// 2. activate: delete the caches of the old versions. Take control of the open pages.
// 3. The pages reload when it is safe (src/updates.ts).

const scope = new URL(import.meta.env.BASE_URL, self.location.origin)
/**
 * The names of this app's caches start with this. Other apps can share the origin (for example
 * <user>.github.io/<other-repo>/), so never touch a cache without it.
 */
const PREFIX = `loop:${scope.pathname}:`
const CACHE = `${PREFIX}${precache.version}`
/** The cache of the first versions, before each version had its own. */
const OLD_CACHE = 'static-v1'
const isOurs = (name: string) => name.startsWith(PREFIX) || name === OLD_CACHE

/** The files of this version, as full URLs. */
const PRECACHE = new Set(
  precache.files.map((file) => new URL(file, scope).href),
)

self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // cache: 'reload' skips the browser's HTTP cache, so these are the newest files.
      // If one file fails, nothing is added and the install fails.
      await cache.addAll(
        [...PRECACHE].map((url) => new Request(url, { cache: 'reload' })),
      )
      await keepPublicFiles(cache)
      // Do not wait until every page closes: take over at once.
      await self.skipWaiting()
    })(),
  ),
)

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== CACHE && isOurs(name)) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  ),
)

/**
 * The files in public/ (icons, the web manifest) are not in the version's list. Copy them from
 * the old caches, so they still work offline after an update. Not the old assets/ files: no page
 * of the new version asks for them.
 */
async function keepPublicFiles(cache: Cache) {
  const assets = new URL('assets/', scope).href
  for (const name of await caches.keys()) {
    if (name === CACHE || !isOurs(name)) continue
    const old = await caches.open(name)
    for (const request of await old.keys()) {
      if (request.url.startsWith(assets) || PRECACHE.has(request.url)) continue
      if (await cache.match(request)) continue
      const response = await old.match(request)
      if (response) await cache.put(request, response)
    }
  }
}

// A page that is not controlled (for example after a hard refresh, Shift+Cmd+R) asks us
// to take control. See src/register-sw.ts.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'claim') event.waitUntil(self.clients.claim())
})

// ---- Requests that Hono does not handle (scripts, icons, ...) ----

/** A file of this version: from its cache. Anything else: from the network first. */
async function fromCacheOrNetwork(input: RequestInfo | URL): Promise<Response> {
  const request = new Request(input)
  if (PRECACHE.has(request.url)) {
    const cached = await caches.match(request, { cacheName: CACHE })
    if (cached) return cached
  }
  return networkFirst(request)
}

/** Try the network first and keep a copy. When offline, use the copy. */
async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request)
    const sameOrigin = new URL(request.url).origin === self.location.origin
    if (request.method === 'GET' && sameOrigin && response.ok) {
      const cache = await caches.open(CACHE)
      await cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request, { cacheName: CACHE })
    if (cached) return cached
    throw error
  }
}

// Send every fetch to Hono. If Hono returns 404, use fromCacheOrNetwork.
fire(app, { fetch: fromCacheOrNetwork })

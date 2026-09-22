// Minimal service worker: activate immediately, network-first for navigations
// (so users always get the latest deploy), cache-fallback for static assets
// when offline. Intentionally tiny — no precache list to keep deploys simple.

const VERSION = 'qr-attendance-v1'
const STATIC_CACHE = `static-${VERSION}`

self.addEventListener('install', (event) => {
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys()
            await Promise.all(
                keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))
            )
            await self.clients.claim()
        })()
    )
})

self.addEventListener('fetch', (event) => {
    const { request } = event
    if (request.method !== 'GET') return

    // Don't intercept Firebase / API calls.
    const url = new URL(request.url)
    if (
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firebaseinstallations') ||
        url.hostname.includes('identitytoolkit') ||
        url.hostname.includes('firestore.googleapis')
    ) {
        return
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const fresh = await fetch(request)
                    return fresh
                } catch {
                    const cache = await caches.open(STATIC_CACHE)
                    const cached = await cache.match('/index.html')
                    return cached || Response.error()
                }
            })()
        )
        return
    }

    // For static assets: stale-while-revalidate.
    event.respondWith(
        (async () => {
            const cache = await caches.open(STATIC_CACHE)
            const cached = await cache.match(request)
            const networkPromise = fetch(request)
                .then((response) => {
                    if (response && response.status === 200 && response.type !== 'opaque') {
                        cache.put(request, response.clone())
                    }
                    return response
                })
                .catch(() => null)
            return cached || (await networkPromise) || Response.error()
        })()
    )
})

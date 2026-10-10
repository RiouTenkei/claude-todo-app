/// <reference lib="webworker" />

// Service worker: offline support, update handoff and reminder notification clicks.
// - Pages: network first, so new deploys show up straight away; cached copy when offline.
// - Built assets (hashed filenames) and icons: cache first, since they never change.
// - GitHub API calls are cross-origin and never cached.

export {};
declare const self: ServiceWorkerGlobalScope;
declare const __BUILD_ID__: string;

// A new cache name per deploy makes the browser see a new worker, which triggers the update prompt.
const CACHE = `todo-${__BUILD_ID__}`;

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(["./", "./manifest.webmanifest", "./icon-192.png"]))
  );
  // No skipWaiting here: the page asks for it when the user taps "Refresh".
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if ((event.data as { type?: string } | null)?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

async function networkFirstPage(request: Request): Promise<Response> {
  try {
    const res = await fetch(request);
    const cache = await caches.open(CACHE);
    await cache.put("./", res.clone());
    return res;
  } catch {
    return (await caches.match("./")) ?? Response.error();
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, res.clone());
  }
  return res;
}

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(request.mode === "navigate" ? networkFirstPage(request) : cacheFirst(request));
});

// Tapping a reminder opens (or focuses) the app.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
      const existing = windows[0];
      if (existing) return existing.focus();
      return self.clients.openWindow("./");
    })
  );
});

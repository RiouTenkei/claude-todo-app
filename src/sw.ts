/// <reference lib="webworker" />

// Service worker: makes the app open offline.
// - Pages: network first, so new deploys show up straight away; cached copy when offline.
// - Built assets (hashed filenames) and icons: cache first, since they never change.
// - GitHub API calls are cross-origin and never cached.

export {};
declare const self: ServiceWorkerGlobalScope;

const CACHE = "todo-v1";

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(["./", "./manifest.webmanifest", "./icon-192.png"]))
  );
  void self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
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

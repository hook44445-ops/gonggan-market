// 공간마켓 Service Worker
// Minimal SW for PWA installability.
// Navigations: NETWORK-FIRST (freshly deployed index.html with current asset
//   hashes always wins) — cache only as an offline fallback.
// Hashed static assets: cache-first (filename changes per build, so safe).

// ⚠️ Bump CACHE_VERSION on every deploy that must purge a stale shell.
// v1 served index.html cache-first, which pinned old asset hashes and caused a
// white screen after a new build. v2 fixes this.
const CACHE_VERSION = "gonggan-v2";

self.addEventListener("install", (e) => {
  // Best-effort precache of the app root for offline; non-fatal if it fails.
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.add("/").catch(() => {}))
  );
  // Take over immediately so the stale v1 shell is replaced ASAP.
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin, and Supabase API calls — always network for those.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/storage/")
  ) {
    return;
  }

  // Navigation: NETWORK-FIRST. Fetch fresh index.html so the current asset
  // hashes resolve; fall back to cached shell only when offline.
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put("/index.html", clone));
          return res;
        })
        .catch(() =>
          caches.match("/index.html").then((c) => c || caches.match("/"))
        )
    );
    return;
  }

  // Static assets: cache-first.
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
        }
        return res;
      });
    })
  );
});

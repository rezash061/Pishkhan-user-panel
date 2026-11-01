/* Pishkhan panel service worker (plan section 4).
 * App shell and static assets are cached; authenticated API responses (/api/*) and the hub (/hubs/*) are never cached.
 * When a page cannot be fetched offline, the cached /offline page is shown.
 * Web push (BE-1.14): the payload is {kind, title, body, link, workspaceId}; a click opens the link in that workspace. */
const VERSION = "v2";
const SHELL = `pk-shell-${VERSION}`;
const STATIC = `pk-static-${VERSION}`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/hubs/")) return;

  // Hashed build assets and fonts never change: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Pages: always the network (they are per-user and dynamic); the offline page when there is none.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline").then((r) => r || Response.error())));
  }
});

/** Same mapping as notificationHref in the app: backend links are workspace-relative paths. */
function pushHref(data) {
  const ws = data && data.workspaceId;
  if (!ws) return "/";
  const link = data.link;
  if (typeof link !== "string" || !link.startsWith("/") || link.startsWith("//")) return `/w/${ws}`;
  return `/w/${ws}${link.replace(/^\/settings\/channels\b/, "/channels")}`;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  const title = data.title || "پیشخوان";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || undefined,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir: "rtl",
      lang: "fa",
      // One visible notification per kind and workspace; a newer one replaces it and alerts again.
      tag: data.kind && data.workspaceId ? `${data.workspaceId}:${data.kind}` : undefined,
      renotify: Boolean(data.kind && data.workspaceId),
      data: { link: data.link || null, workspaceId: data.workspaceId || null },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(pushHref(event.notification.data), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      // Prefer a panel tab already open: focus it and take it to the link.
      const tab = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (tab) {
        const focused = await tab.focus();
        if (focused.url !== target && "navigate" in focused) await focused.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    }),
  );
});

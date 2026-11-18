/* Toilet Finder service worker.
 *
 * - Pages: network first, falling back to the saved copy (or /offline.html).
 * - /_next/static: cache first (file names are content-hashed).
 * - Toilet data: network first. Every toilet seen on the map is also kept in a
 *   local "saved toilets" list, so offline the map can still show toilets for
 *   any area you looked at before. Toilet detail responses are cached per id.
 * - Map tiles: cache first for tiles you already viewed (capped).
 * Writes (POST), admin, search and other sites are never touched.
 */
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const DATA = `data-${VERSION}`;
const TILES = `tiles-${VERSION}`;
const KEEP = [PAGES, STATIC, DATA, TILES];

const SAVED_TOILETS_URL = "/__offline/toilets.json";
const MAX_SAVED_TOILETS = 2000;
const MAX_TILES = 400;
const MAX_DETAILS = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll(["/", "/offline.html", "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(tile(req));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req, STATIC));
  } else if (url.pathname === "/api/toilets") {
    event.respondWith(toiletsInArea(req, url));
  } else if (/^\/api\/toilets\/[0-9a-f-]{36}$/.test(url.pathname)) {
    event.respondWith(networkFirst(req, DATA, MAX_DETAILS));
  } else if (req.mode === "navigate" && !url.pathname.startsWith("/admin") && !url.pathname.startsWith("/api/")) {
    event.respondWith(page(req));
  }
});

// ---------------------------------------------------------------------------
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) {
      await cache.put(req, res.clone());
      if (max) trim(cacheName, max);
    }
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return markOffline(hit);
    return Response.json({ error: "You're offline and this toilet isn't saved on your device yet." }, { status: 503 });
  }
}

async function page(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("/offline.html"));
  }
}

async function tile(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // Tiles are requested with CORS (crossOrigin on the tile layer), so the response is readable and small.
    if (res.ok && res.type !== "opaque") {
      await cache.put(req, res.clone());
      trim(TILES, MAX_TILES);
    }
    return res;
  } catch {
    return new Response("", { status: 504 });
  }
}

/** Map area request: network first; remember every toilet seen; offline, answer from the saved list. */
async function toiletsInArea(req, url) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(req);
    if (res.ok) {
      const { toilets } = await res.clone().json();
      await rememberToilets(cache, toilets);
    }
    return res;
  } catch {
    const saved = await savedToilets(cache);
    const [minLng, minLat, maxLng, maxLat] = (url.searchParams.get("bbox") || "").split(",").map(Number);
    const inside = saved.filter((t) => t.lng >= minLng && t.lng <= maxLng && t.lat >= minLat && t.lat <= maxLat);
    return new Response(JSON.stringify({ toilets: inside, offline: true }), {
      headers: { "Content-Type": "application/json", "X-Offline": "1" },
    });
  }
}

async function savedToilets(cache) {
  const res = await cache.match(SAVED_TOILETS_URL);
  if (!res) return [];
  try {
    return await res.json();
  } catch {
    return [];
  }
}

async function rememberToilets(cache, toilets) {
  if (!Array.isArray(toilets)) return;
  const byId = new Map((await savedToilets(cache)).map((t) => [t.id, t]));
  for (const t of toilets) {
    byId.delete(t.id); // re-insert so recently seen toilets stay at the end
    byId.set(t.id, t);
  }
  const list = [...byId.values()].slice(-MAX_SAVED_TOILETS);
  await cache.put(SAVED_TOILETS_URL, new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json" } }));
}

function markOffline(res) {
  const headers = new Headers(res.headers);
  headers.set("X-Offline", "1");
  return new Response(res.body, { status: res.status, headers });
}

/** Deletes the oldest entries beyond `max`. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = (await cache.keys()).filter((k) => !k.url.endsWith(SAVED_TOILETS_URL));
  const extra = keys.length - max;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

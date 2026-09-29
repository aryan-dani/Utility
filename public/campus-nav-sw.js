/**
 * Service worker companion for campus Wi-Fi and offline documents.
 * Loaded via Workbox importScripts before route handlers.
 *
 * On utilityos.tech / www, a failed or timed-out document navigation:
 * 1. Serves a previously cached document for that URL when present
 * 2. Else hops to the Vercel campus host while the device reports online
 * 3. Else falls through to /~offline
 *
 * Keep visited Planner/Timer/etc. available with no internet.
 */
(/* @preserve */ function () {
  var CAMPUS = "https://planner-flax-six.vercel.app";
  var TIMEOUT_MS = 2000;
  var CANONICAL = {
    "utilityos.tech": 1,
    "www.utilityos.tech": 1,
  };

  /**
   * Mirrors src/lib/pwa/offlineNavigation.ts (decideOfflineNavigation +
   * shouldBypassCampusNavigation). Keep both in sync — unit tests cover the TS copy.
   */
  function decide(hasCachedDocument, online) {
    if (hasCachedDocument) return "use-cache";
    if (online) return "campus-hop";
    return "offline-page";
  }

  function shouldBypass(pathname) {
    if (pathname.indexOf("/__/auth") === 0) return true;
    if (pathname === "/login" || pathname === "/signup") return true;
    return false;
  }

  async function matchCachedDocument(req) {
    if (!self.caches) return null;
    try {
      var hit = await caches.match(req, { ignoreVary: true });
      if (hit) return hit;
      var url = new URL(req.url);
      return (
        (await caches.match(url.pathname + url.search, { ignoreVary: true })) ||
        null
      );
    } catch (e) {
      return null;
    }
  }

  self.addEventListener("fetch", function (event) {
    var req = event.request;
    if (req.mode !== "navigate") return;

    var url;
    try {
      url = new URL(req.url);
    } catch (e) {
      return;
    }
    if (!CANONICAL[url.hostname]) return;
    // Let Workbox NetworkOnly (or the browser) own OAuth — do not respondWith.
    // Intercepting /__/auth/handler delays/breaks the popup close handshake while
    // IndexedDB already signed the opener in (blank window that hangs for seconds).
    if (shouldBypass(url.pathname)) return;

    event.respondWith(
      (async function () {
        var controller = new AbortController();
        var timer = setTimeout(function () {
          controller.abort();
        }, TIMEOUT_MS);
        try {
          var res = await fetch(req, { signal: controller.signal });
          clearTimeout(timer);
          if (res && res.ok) {
            // Return immediately; do not await cache.put (that delayed OAuth pages).
            try {
              var copy = res.clone();
              caches.open("pages").then(function (cache) {
                return cache.put(req, copy);
              }).catch(function () {
                /* quota / private mode */
              });
            } catch (e) {
              /* clone failed */
            }
            return res;
          }
          throw new Error("unreachable");
        } catch (err) {
          clearTimeout(timer);
          var cached = await matchCachedDocument(req);
          var online = !!(self.navigator && self.navigator.onLine);
          var action = decide(!!cached, online);

          if (action === "use-cache" && cached) return cached;

          if (action === "campus-hop") {
            return Response.redirect(
              CAMPUS + url.pathname + url.search + url.hash,
              302,
            );
          }

          if (typeof self.fallback === "function") {
            return self.fallback(req);
          }
          return Response.error();
        }
      })(),
    );
  });
})();

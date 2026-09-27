// ─────────────────────────────────────────────────────────────────────────────
//  probe-net.js — the half of probe.js's "net" that has to run in the page's
//  own MAIN world, not the extension's isolated one.
//
//  probe.js cancels navigation and form submission with a capture-phase
//  listener on `document` — that works from either world, because the DOM is
//  shared. But a click handler that calls `fetch(...)`, `location.assign(...)`
//  or `window.open(...)` directly, in script, is calling THAT SCRIPT'S OWN
//  globals — the page's fetch, the page's window.open — which are separate
//  objects from probe.js's, because probe.js runs isolated. Patching
//  `root.fetch` there patches a copy nothing else ever calls. This file is
//  injected into the MAIN world instead, so it patches the real ones.
//
//  Gated on a DOM attribute rather than a JS flag: a JS global set from the
//  isolated world is invisible here for the exact same reason described
//  above, but the DOM is not — `document.documentElement` is the one thing
//  both worlds are looking at. probe.js sets/clears the attribute; every
//  patched function below just checks it before deciding to pass through or
//  block. Blocked attempts are reported back the same way, in reverse: a
//  CustomEvent dispatched on `document`, which probe.js listens for.
//
//  Installed once per page load and left in place — every wrapper below is a
//  no-op pass-through whenever the attribute is absent, so there is nothing
//  to "undo" between runs and no window where a second injection would double
//  -wrap anything (the guard below prevents that outright).
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';
  if (window.__u1NetGuard) return;
  window.__u1NetGuard = true;

  var ATTR = 'data-u1-net-block';
  var active = function () {
    try { return document.documentElement.hasAttribute(ATTR); } catch (e) { return false; }
  };
  var note = function (where, url) {
    try {
      document.dispatchEvent(new CustomEvent('u1-net-blocked', {
        detail: { where: where, url: url == null ? '' : String(url) },
      }));
    } catch (e) {}
  };

  try {
    var fetchWas = window.fetch;
    if (fetchWas) {
      window.fetch = function (input, init) {
        if (active()) {
          note('fetch', typeof input === 'string' ? input : (input && input.url));
          // NOT a rejection. Measured on vio.com (Next.js): the router's
          // getRouteInfo awaits fetch for the route data on every link press;
          // a rejected promise there is a fatal data-fetch error, and Next
          // tears the whole React tree down into its "Application error: a
          // client-side exception has occurred" page — the scan destroyed
          // the page it was scanning, and the u1 engine then flooded the
          // console with "Skip link … not found for Landmark" as its
          // landmarks vanished. A request that simply never comes back is a
          // state every router already copes with (a slow network) and no
          // error path fires. The one settled case is the caller's own
          // AbortSignal: a router that moves on cancels the stale request,
          // and it expects an AbortError back — which reads as
          // "cancelled", never as "failed".
          var signal = (init && init.signal) || (input && typeof input === 'object' && input.signal) || null;
          return new Promise(function (resolve, reject) {
            if (!signal) return;
            var abort = function () {
              var err;
              try { err = new DOMException('The operation was aborted.', 'AbortError'); }
              catch (e) { err = new Error('The operation was aborted.'); err.name = 'AbortError'; }
              reject(err);
            };
            if (signal.aborted) return abort();
            try { signal.addEventListener('abort', abort, { once: true }); } catch (e) {}
          });
        }
        return fetchWas.apply(this, arguments);
      };
    }
  } catch (e) {}

  try {
    var sendWas = window.XMLHttpRequest && window.XMLHttpRequest.prototype.send;
    if (sendWas) {
      window.XMLHttpRequest.prototype.send = function () {
        if (active()) {
          note('xhr.send', '');
          var self = this;
          setTimeout(function () { try { self.dispatchEvent(new Event('error')); } catch (e) {} }, 0);
          return;
        }
        return sendWas.apply(this, arguments);
      };
    }
  } catch (e) {}

  try {
    var beaconWas = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
    if (beaconWas) {
      navigator.sendBeacon = function (url, data) {
        if (active()) { note('sendBeacon', url); return false; }
        return beaconWas(url, data);
      };
    }
  } catch (e) {}

  try {
    var openWas = window.open;
    if (openWas) {
      window.open = function (url) {
        if (active()) { note('window.open', url); return null; }
        return openWas.apply(this, arguments);
      };
    }
  } catch (e) {}

  // Deliberately NOT attempting location.assign/location.replace here.
  // Measured directly against real Chromium: `location.assign = fn` does not
  // throw and `typeof location.assign` reports "function" afterwards, but the
  // reference silently does not change (`location.assign === <the original>`
  // stays true) and the real navigation runs regardless of the wrapper —
  // Location is a spec'd "legacy platform object" exempt from ordinary
  // property assignment for exactly this kind of interception. Shipping a
  // wrapper that never actually runs would be worse than having none: the
  // absence of a "location.assign" entry in `blocked` would read as "nothing
  // tried to navigate" when something did. The panel's own tab-URL watch
  // (see autoOpenCapture's comment on the same limitation) is the real
  // recovery path for this one.
  try {
    var pushWas = history.pushState && history.pushState.bind(history);
    if (pushWas) {
      history.pushState = function (s, t, u) {
        if (active()) { note('history.pushState', u); return; }
        return pushWas(s, t, u);
      };
    }
  } catch (e) {}

  try {
    var replStateWas = history.replaceState && history.replaceState.bind(history);
    if (replStateWas) {
      history.replaceState = function (s, t, u) {
        if (active()) { note('history.replaceState', u); return; }
        return replStateWas(s, t, u);
      };
    }
  } catch (e) {}
})();

// ─────────────────────────────────────────────────────────────────────────────
//  event-recorder.js — OPT-IN precise event detection.
//
//  Registered dynamically (NOT in manifest.json) by panel.js:
//    chrome.scripting.registerContentScripts([{ id:'u1-event-recorder',
//      matches:['<all_urls>'], js:['event-recorder.js'],
//      runAt:'document_start', world:'MAIN' }])
//
//  addEventListener registrations are invisible after the fact — DevTools'
//  getEventListeners is not available to extensions. The only way to know which
//  element really has a click handler is to be there when it is registered, so
//  this wraps EventTarget.prototype at document_start and keeps a tally.
//
//  Consequence the UI must state: it only sees listeners added AFTER it loads,
//  so the page must be reloaded once after the toggle is switched on.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';
  if (window.__u1EventMap) return; // already installed

  const map = new WeakMap(); // element → Map(type → count)

  // The WeakMap answers "does THIS element have a handler", which is all that
  // was needed while the collector only ever asked about elements it had
  // already found some other way. It cannot answer "which elements have one" —
  // and that is the only question that finds a menu built from anonymous divs,
  // because such an element matches no tag, class or role we could search for.
  //
  // So interaction listeners also go into an enumerable set. Only interaction
  // types: a page registers hundreds of resize/scroll/message listeners and
  // none of them make an element a control.
  const INTERACTION = /^(click|mousedown|pointerdown|touchstart|keydown|keyup|keypress)$/;
  const roots = new Set();
  const MAX_ROOTS = 3000;   // a bound, so a chatty SPA cannot grow this forever

  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;

  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    try {
      if (this && this.nodeType === 1) {
        let m = map.get(this);
        if (!m) { m = new Map(); map.set(this, m); }
        m.set(type, (m.get(type) || 0) + 1);
        if (INTERACTION.test(type) && roots.size < MAX_ROOTS) roots.add(this);
      }
    } catch {}
    return origAdd.call(this, type, fn, opts);
  };

  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    try {
      if (this && this.nodeType === 1) {
        const m = map.get(this);
        if (m && m.has(type)) {
          const n = m.get(type) - 1;
          if (n > 0) m.set(type, n); else m.delete(type);
        }
      }
    } catch {}
    return origRemove.call(this, type, fn, opts);
  };

  window.__u1EventMap = {
    has: (el) => { const m = map.get(el); return !!(m && m.size); },
    types: (el) => { const m = map.get(el); return m ? Array.from(m.keys()) : []; },
    // Every element that took an interaction listener and is still on the page.
    // Detached nodes are filtered here rather than removed on the way out: an
    // SPA that re-renders would otherwise have us chasing its garbage, and the
    // set is bounded anyway.
    all: () => {
      const live = [];
      for (const el of roots) { if (el.isConnected) live.push(el); else roots.delete(el); }
      return live;
    },
  };
})();

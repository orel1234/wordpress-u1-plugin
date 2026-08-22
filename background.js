'use strict';

// The service worker reads the same saved data the panel does, so it goes
// through the same store. importScripts is how a classic MV3 worker loads a
// dependency — there is no <script> tag and no module graph here.
importScripts('store.js');

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// ── Config-on-reload injection ─────────────────────────────────────────────
// When panel.js asks us to "apply config on next load", we store the request
// and inject window.u1.config at document_start so U1 reads it on init.

const pendingInjections = new Map(); // tabId → { config, once }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only act on messages from this extension's own pages. A message that
  // triggers arbitrary config injection into a tab must not be actionable by
  // anything else; without externally_connectable a web page can't reach here,
  // but a script injected into the isolated world could, so check explicitly.
  if (sender.id !== chrome.runtime.id) return false;

  if (msg.action === 'injectConfigOnReload') {
    const { tabId, config } = msg;
    pendingInjections.set(tabId, { config });
    chrome.tabs.reload(tabId);
    sendResponse({ ok: true });
  }
  return false;
});

function getHostnameFromTab(tab) {
  // MUST match panel.js's getHostname(), which strips a leading "www." — otherwise
  // background reads config_www.example.com while panel saved config_example.com,
  // and the injected config is stale/empty.
  try {
    return tab && tab.url
      ? (new URL(tab.url).hostname || '').replace(/^www\./i, '')
      : null;
  } catch { return null; }
}

function isSafeHttpUrl(u) {
  try { const p = new URL(String(u).trim()); return p.protocol === 'http:' || p.protocol === 'https:'; }
  catch { return false; }
}

function isSystemUrl(url) {
  return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') || url.startsWith('about:');
}

async function injectConfig(tabId, config) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    injectImmediately: true,
    func: (cfg) => {
      const preExisted = window.u1 !== undefined;
      console.log('[U1 Studio] document_start: window.u1 already exists?', preExisted, preExisted ? window.u1 : '(not yet)');

      window.u1 = window.u1 || {};
      window.u1.config = cfg;
      console.log('[U1 Studio] preset window.u1.config =', cfg);

      // Assign synthetic ids for CSS-selector skip-link targets. Runs at DOM
      // ready and is retried a few times, because some targets are rendered by
      // the site's own JS slightly after DOMContentLoaded. We do NOT call
      // u1.setConfiguration() — it was observed to WIPE config.skipLinks. The
      // reliable path is presetting window.u1.config before U1 initializes,
      // which the logs confirm U1 keeps.
      const assignSyntheticIds = () => {
        if (!Array.isArray(cfg.skipLinks)) return 0;
        let done = 0;
        cfg.skipLinks.forEach(sl => {
          if (sl.syntheticId && sl.selector) {
            try {
              const el = document.querySelector(sl.selector);
              if (el) {
                // Set our id when the element has none, or overwrite a STALE
                // "u1-anchor-*" id left by a previous run (else the stored
                // target #u1-anchor-<newtoken> would never match the element).
                if (!el.id || /^u1-anchor-/.test(el.id)) el.id = sl.syntheticId;
                done++;
              }
            } catch {}
          } else { done++; }
        });
        return done;
      };
      const total = Array.isArray(cfg.skipLinks) ? cfg.skipLinks.length : 0;
      const run = () => {
        let tries = 0;
        const poll = setInterval(() => {
          tries++;
          const done = assignSyntheticIds();
          if (done >= total || tries >= 15) {
            clearInterval(poll);
            console.log('[U1 Studio] synthetic-id pass complete:', done, 'of', total, 'targets resolved after', tries * 300, 'ms');
          }
        }, 300);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
      else run();
    },
    args: [config],
  });
}

// Apply saved u1.fix.* mappings as soon as window.u1.fix is available on the
// page. U1 processes each element once per page load, so mappings MUST be
// registered right when u1.fix appears (before/at U1's first scan) — applying
// them later from the panel is too late, which is why auto-apply "did nothing".
async function injectMappings(tabId, mappings) {
  // The library corrections must be on the page BEFORE any u1.fix.* call, since
  // part of what they do is wrap those functions. Injecting here — the same
  // moment the mappings are armed — is what makes an auto-applied page behave
  // like the exported bundle rather than like raw U1. The patch guards itself
  // against a second install, and a failure must not stop the mappings.
  try {
    await chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN', injectImmediately: true, files: ['u1-patch.js'],
    });
  } catch {}
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    injectImmediately: true,
    func: (list) => {
      if (window.__u1MappingsArmed) return; // avoid double-arming within one page load
      window.__u1MappingsArmed = true;
      const stripEmpty = (o) => {
        if (!o || typeof o !== 'object') return;
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (v === '' || v == null) delete o[k];
          else if (typeof v === 'object') { stripEmpty(v); if (!Object.keys(v).length) delete o[k]; }
        }
      };
      const applyAll = () => {
        const raw = window.u1 !== undefined ? window.u1
                  : window.U1 !== undefined ? window.U1 : window.user1st;
        if (!raw || !raw.fix) return false;
        let applied = 0;
        list.forEach(it => {
          try {
            if (typeof raw.fix[it.type] === 'function') {
              stripEmpty(it.config && it.config.selectors);
              raw.fix[it.type](it.firstArg || it.primary, it.config);
              applied++;
            }
          } catch (e) { /* keep going */ }
        });
        console.log('[U1 Studio] auto-applied', applied, 'of', list.length, 'mappings');
        return true;
      };
      if (applyAll()) return; // u1.fix already present
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if (applyAll() || tries >= 40) clearInterval(poll); // give up after ~12s
      }, 300);
    },
    args: [mappings],
  });
}

// Auto-apply CUSTOM keyboard-grid mappings (the extension's own accessible
// grid/datepicker engine — not a u1.fix call). Without this they only applied
// while the side panel was open, so a fresh page load silently lost them.
async function injectKeyboardGrids(tabId, grids) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['grid-nav.js'] });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (list) => {
      if (!window.__u1InstallGridFromMapping || !window.__u1MakeClickable ||
          !window.__u1InstallTabsFromMapping || !window.__u1InstallBreadcrumbFromMapping) {
        console.log('[U1 Studio] keyboard-grid: ENGINE NOT LOADED (grid-nav.js missing) for', list.length, 'mapping(s)');
        return;
      }
      let n = 0; const errs = [];
      list.forEach(m => {
        try {
          const r = (m.custom === 'keyboardClickable')
            ? window.__u1MakeClickable({ selector: m.primary,
                role: (m.config && m.config.role) || 'button',
                label: (m.config && m.config.label) || '' })
            : (m.custom === 'keyboardTabs')
            ? window.__u1InstallTabsFromMapping(m.primary, m.config)
            : (m.custom === 'breadcrumb')
            ? window.__u1InstallBreadcrumbFromMapping(m.primary, m.config)
            : window.__u1InstallGridFromMapping(m.primary, m.config);
          if (r && r.ok) n++; else errs.push((r && r.err) || 'unknown');
        } catch (e) { errs.push(e.message); }
      });
      console.log('[U1 Studio] keyboard-grid: armed', n, 'of', list.length, errs.length ? errs : '');
    },
    args: [grids],
  });
}

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (isSystemUrl(tab?.url)) return;

  // ── At page-start: inject config (explicit reload request OR persistent
  // per-hostname auto-inject). The one-shot `pendingInjections` path only
  // fires once right after "Run Config" is clicked — without the persistent
  // check below, config (skip links, colors, language) would be lost again
  // on the very next navigation/reload, which is why skip links that need a
  // synthetic id (assigned only during injection) kept disappearing.
  if (info.status === 'loading') {
    const pending = pendingInjections.get(tabId);
    if (pending) {
      pendingInjections.delete(tabId);
      try { await injectConfig(tabId, pending.config); } catch {}
      return;
    }

    const hostname = getHostnameFromTab(tab);
    if (!hostname) return;
    const stored = await U1Store.get([`manualInject_${hostname}`, `config_${hostname}`, `mappings_${hostname}`]);
    // Auto-inject the saved config on EVERY load for this hostname — not just
    // ones where U1 was manually injected — so skip links / colors / language
    // persist across normal site navigation.
    if (stored[`config_${hostname}`]) {
      try { await injectConfig(tabId, stored[`config_${hostname}`]); } catch {}
    }
    // Arm the mappings poll as early as possible (document_start) so fix.* runs
    // the instant window.u1.fix appears — before U1's first scan when possible.
    const earlyAll = stored[`mappings_${hostname}`] || [];
    const early = earlyAll.filter(m => m && typeof m === 'object' && m.type && (m.primary || m.firstArg) && !m.custom);
    if (early.length) { try { await injectMappings(tabId, early); } catch {} }
    // Arm the custom keyboard-grid engine early too (idempotent — it guards itself).
    const earlyGrids = earlyAll.filter(m => m && typeof m === 'object' && (m.custom === 'keyboardGrid' || m.custom === 'keyboardClickable' || m.custom === 'keyboardTabs' || m.custom === 'breadcrumb') && m.primary);
    if (earlyGrids.length) { try { await injectKeyboardGrids(tabId, earlyGrids); } catch {} }
  }

  // ── At page-complete: re-inject U1 CSS/JS for manual-inject hostnames, and
  // auto-apply saved mappings once u1.fix is ready.
  if (info.status === 'complete') {
    const hostname = getHostnameFromTab(tab);
    if (!hostname) return;
    const stored = await U1Store.get([`manualInject_${hostname}`, `mappings_${hostname}`]);

    // Auto-apply mappings (independent of manual-inject — the site may load U1 itself).
    const all = stored[`mappings_${hostname}`] || [];
    const mappings = all.filter(m => m && typeof m === 'object' && m.type && (m.primary || m.firstArg) && !m.custom);
    if (mappings.length) { try { await injectMappings(tabId, mappings); } catch {} }

    // Custom keyboard-grid mappings run our own engine — apply them too.
    const grids = all.filter(m => m && typeof m === 'object' && (m.custom === 'keyboardGrid' || m.custom === 'keyboardClickable' || m.custom === 'keyboardTabs' || m.custom === 'breadcrumb') && m.primary);
    if (grids.length) { try { await injectKeyboardGrids(tabId, grids); } catch {} }

    const injectData = stored[`manualInject_${hostname}`];
    if (!injectData) return;
    // Defense in depth: never inject a non-http(s) URL even if one reached storage.
    if (!isSafeHttpUrl(injectData.cssLink) || !isSafeHttpUrl(injectData.jsLink)) return;

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (href) => {
          if (!document.getElementById('u1Css')) {
            const link = document.createElement('link');
            link.id = 'u1Css'; link.rel = 'stylesheet'; link.href = href;
            document.head.appendChild(link);
          }
        },
        args: [injectData.cssLink],
      });
    } catch {}

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (src) => {
          if (!document.getElementById('u1Js')) {
            const s = document.createElement('script');
            s.id = 'u1Js'; s.src = src; s.type = 'text/javascript';
            document.body.appendChild(s);
          }
        },
        args: [injectData.jsLink],
      });
    } catch {}
  }
});

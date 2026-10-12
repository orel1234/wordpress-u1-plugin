'use strict';

// The service worker reads the same saved data the panel does, so it goes
// through the same store. importScripts is how a classic MV3 worker loads a
// dependency — there is no <script> tag and no module graph here.
importScripts('store.js');

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// ── Debugger safety net ──────────────────────────────────────────────────
//
// panel.js attaches chrome.debugger (CDP) to the client's own tab for the
// duration of a background sweep, to photograph it without stealing focus —
// see beginBackgroundCapture/endBackgroundCapture there. It always detaches in
// a `finally`, but a `finally` only runs if the panel is still alive to run
// it: closing the side panel, or the panel context crashing, mid-sweep leaves
// that tab attached with no code left to detach it. An attached tab keeps
// Chrome's "U1 Studio is debugging this browser" banner up indefinitely and,
// more to the point, keeps a live CDP session — this backstop makes sure a
// tab that navigates away or closes cannot carry that attachment with it.
// Detaching an already-detached tab is a harmless no-op (caught below).
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.debugger.detach({ tabId }).catch(() => {});
});
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url) chrome.debugger.detach({ tabId }).catch(() => {});
});

// ── CSP-bypass safety net ────────────────────────────────────────────────
//
// panel.js's "the site's CSP is blocking U1" toggle removes the
// Content-Security-Policy header from a client's site for the browser session
// (declarativeNetRequest session rule — see setCspBypass in panel.js). It is
// meant to last only as long as the panel is open on that site: panel.js
// clears it on `pagehide` and when the specialist navigates away. `pagehide`
// does not fire on every teardown (the panel context can be discarded without
// it — a crash, the side panel being force-closed), and a rule that survives
// that is a client's production site running with no CSP for the rest of the
// browser session, silently.
//
// The panel opens a port to this worker the moment it loads (see
// panelKeepAlive below); onDisconnect fires whenever that context goes away,
// by whatever means, which `pagehide` cannot promise. Rule ids 10000..909999
// is the exact range panel.js hands out (cspRuleIdFor) — this mirrors
// clearAllCspBypasses so a lost connection cannot leave one standing.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panelKeepAlive') return;
  port.onDisconnect.addListener(async () => {
    try {
      const rules = await chrome.declarativeNetRequest.getSessionRules();
      const ours = rules.filter(r => r.id >= 10000 && r.id < 910000).map(r => r.id);
      if (ours.length) await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ours });
    } catch {}
  });
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

  // ── Cloud preview (panel.js: startCloudPreview) ─────────────────────────
  // The tab runs the bundle Publish WOULD make live, fetched from the CRM, in
  // place of this extension's own auto-apply — so what is on screen is what
  // visitors would get, not the extension's reconstruction of it.
  if (msg.action === 'startPreview') {
    setPreview(msg.tabId, { url: msg.url, hostname: msg.hostname })
      .then(() => chrome.tabs.reload(msg.tabId))
      .then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.action === 'stopPreview') {
    setPreview(msg.tabId, null)
      .then(() => chrome.tabs.reload(msg.tabId))
      .then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.action === 'previewState') {
    previewFor(msg.tabId).then((p) => sendResponse({ ok: true, preview: p }));
    return true;
  }

  if (msg.action === 'injectConfigOnReload') {
    const { tabId, config } = msg;
    pendingInjections.set(tabId, { config });
    chrome.tabs.reload(tabId);
    sendResponse({ ok: true });
  }

  // ── Print a report tab to a real PDF, with no dialog ────────────────────
  //
  // The ⬇ Download PDF button hands the job to Chrome's print dialog, which is
  // right when a person is reading the report and wants a copy. It is no use
  // for "finish the project": that has to produce a PDF as a FILE, to go into
  // a bundle, without anyone standing at a dialog choosing a destination.
  //
  // Page.printToPDF over CDP does exactly that, and the manifest already
  // carries the `debugger` permission it needs. No PDF library, nothing
  // fetched — the same engine that backs the dialog, driven directly.
  if (msg.action === 'printTabToPdf') {
    printTabToPdf(msg.tabId)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;                       // async responder
  }
  return false;
});

async function printTabToPdf(tabId) {
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  try {
    // A4 in inches, and printBackground because the report IS its colour
    // coding — without it the type badges print as white boxes.
    //
    // Zero margins for the same reason @page does it in the report's own print
    // CSS: Chrome paints its date/title/URL into the margin, and there is no
    // flag here that turns that off either. The 12mm of breathing room comes
    // from the report's body padding.
    const res = await chrome.debugger.sendCommand(target, 'Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      paperWidth: 8.27,
      paperHeight: 11.69,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    });
    if (!res || !res.data) throw new Error('Chrome returned no PDF data');
    return res.data;                   // base64
  } finally {
    // Always detached, including on failure — an attached debugger leaves the
    // "U1 Studio is debugging this browser" bar across the tab for good.
    try { await chrome.debugger.detach(target); } catch {}
  }
}

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

// Saved work for a hostname (config, mappings, the u1-patch corrections) is
// stored keyed by BARE HOSTNAME — no scheme, no port; see getHostnameFromTab's
// own comment on why (it has to match what panel.js writes). That means a
// plain-http load of the exact same hostname a client's real site runs on
// HTTPS — a network attacker on the same wifi doing a classic HTTP downgrade,
// no certificate needed since there is no TLS to fake — reads as the same
// site and would silently receive everything auto-injected below: the
// specialist's saved config, every mapping, the patch. Renaming every storage
// key to a full origin would be the complete fix, but that key shape is
// shared with the sync server (hostnames only, no scheme) and touches every
// site's history — a live-data migration, not a local code change. This is
// the local half that can be done safely: refuse to auto-inject saved data
// into anything that isn't actually HTTPS (or localhost, for testing against
// a demo site served locally) at all, regardless of what the storage lookup
// finds. A real client site is HTTPS in production without exception; the
// exposure this closes is specifically the spoofed-http case.
function isTrustedInjectionUrl(url) {
  try {
    const p = new URL(url);
    if (p.protocol === 'https:') return true;
    return p.protocol === 'http:' && (p.hostname === 'localhost' || p.hostname === '127.0.0.1');
  } catch { return false; }
}

async function injectConfig(tabId, config) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    injectImmediately: true,
    func: (cfg) => {
      const preExisted = window.u1 !== undefined;
      window.__u1StudioDebug && console.log('[U1 Studio] document_start: window.u1 already exists?', preExisted, preExisted ? window.u1 : '(not yet)');

      window.u1 = window.u1 || {};
      window.u1.config = cfg;
      // A copy the engine cannot wipe (setConfiguration replaces u1.config):
      // the patch renders the config's own skip links from here.
      window.__u1SkipLinks = Array.isArray(cfg.skipLinks) ? cfg.skipLinks : [];
      // "hide": the patch removes the skip links the engine adds by itself.
      window.__u1SkipLinksEngine = cfg.skipLinksEngine || '';
      window.__u1StudioDebug && console.log('[U1 Studio] preset window.u1.config =', cfg);

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
            window.__u1StudioDebug && console.log('[U1 Studio] synthetic-id pass complete:', done, 'of', total, 'targets resolved after', tries * 300, 'ms');
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
/**
 * The library corrections, on their own.
 *
 * This used to live inside injectMappings, which is only reached when the site
 * has at least one NON-custom mapping. So a site with no mappings — or with
 * only custom ones, which is what a link-list or a keyboard-grid is — never
 * got the patch at all. Two things followed from that, and both were reported:
 * the corrections silently did not apply, and u1-patch's recorder (which is
 * how the panel reads back a U1 deployment somebody else wrote) had nothing to
 * record. The feature was least available exactly where it is most useful — a
 * client site you have just arrived at, with nothing mapped yet.
 *
 * The patch is worth having whenever U1 is on the page, mappings or not. It
 * guards itself against a second install, so calling this more than once per
 * load is free.
 */
async function injectPatch(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN', injectImmediately: true, files: ['u1-patch.js'],
    });
  } catch {}
}

async function injectMappings(tabId, mappings) {
  // The corrections must be on the page BEFORE any u1.fix.* call, since part of
  // what they do is wrap those functions. Armed at document_start too, but
  // repeated here because a failure must not stop the mappings and the patch
  // guards itself against a second install.
  await injectPatch(tabId);
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
      // This-page-only mappings arrive for EVERY page of the site and run
      // only on theirs — now if this is it, and again each time the site
      // changes to it without a reload (Next.js: molinahealthcare.com). Same
      // rule as the exported u1-fixes.js (__u1OnPage); __u1CallPage tells
      // u1-patch.js which page each call belongs to.
      const here = () => { try { return decodeURIComponent(location.pathname).replace(/\/+$/, '') || '/'; } catch (e) { return location.pathname; } };
      const pageOf = (it) => (it && it.scope === 'page' && it.pagePath) ? it.pagePath : null;
      const callOne = (raw, it) => {
        const page = pageOf(it);
        const prev = window.__u1CallPage;
        window.__u1CallPage = page || undefined;
        try {
          if (typeof raw.fix[it.type] === 'function') {
            stripEmpty(it.config && it.config.selectors);
            raw.fix[it.type](it.firstArg || it.primary, it.config);
            return 1;
          }
        } catch (e) { /* keep going */ } finally { window.__u1CallPage = prev; }
        return 0;
      };
      const applyAll = () => {
        const raw = window.u1 !== undefined ? window.u1
                  : window.U1 !== undefined ? window.U1 : window.user1st;
        if (!raw || !raw.fix) return false;
        let applied = 0;
        const now = here();
        list.forEach(it => { const p = pageOf(it); if (!p || p === now) applied += callOne(raw, it); });
        let last = now;
        const onRoute = () => {
          const at = here(); if (at === last) return; last = at;
          const r = window.u1 !== undefined ? window.u1 : window.U1 !== undefined ? window.U1 : window.user1st;
          if (!r || !r.fix) return;
          list.forEach(it => { if (pageOf(it) === at) callOne(r, it); });
        };
        ['pushState', 'replaceState'].forEach((k) => {
          const orig = history[k]; if (typeof orig !== 'function') return;
          history[k] = function () { const res = orig.apply(this, arguments); setTimeout(onRoute, 0); return res; };
        });
        window.addEventListener('popstate', () => setTimeout(onRoute, 0));
        window.__u1StudioDebug && console.log('[U1 Studio] auto-applied', applied, 'of', list.length, 'mappings');
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
          !window.__u1InstallTabsFromMapping || !window.__u1InstallBreadcrumbFromMapping ||
          !window.__u1HideFromAll || !window.__u1FocusOrderFromMapping) {
        window.__u1StudioDebug && console.log('[U1 Studio] keyboard-grid: ENGINE NOT LOADED (grid-nav.js missing) for', list.length, 'mapping(s)');
        return;
      }
      let n = 0; const errs = [];
      list.forEach(m => {
        try {
          const r = (m.custom === 'hideElement')
            ? window.__u1HideFromAll({ selector: m.primary })
            : (m.custom === 'focusOrder')
            ? window.__u1FocusOrderFromMapping(m.primary, m.config)
            : (m.custom === 'keyboardClickable')
            ? window.__u1MakeClickable({ selector: m.primary,
                role: (m.config && m.config.role) || 'button',
                label: (m.config && m.config.label) || '' })
            : (m.custom === 'keyboardTabs')
            ? window.__u1InstallTabsFromMapping(m.primary, m.config)
            : (m.custom === 'linkList')
            ? window.__u1FixLinkListFromMapping(m.primary, m.config)
            : (m.custom === 'breadcrumb')
            ? window.__u1InstallBreadcrumbFromMapping(m.primary, m.config)
            : window.__u1InstallGridFromMapping(m.primary, m.config);
          if (r && r.ok) n++; else errs.push((r && r.err) || 'unknown');
        } catch (e) { errs.push(e.message); }
      });
      window.__u1StudioDebug && console.log('[U1 Studio] keyboard-grid: armed', n, 'of', list.length, errs.length ? errs : '');
    },
    args: [grids],
  });
}

// Converted URS patterns: the compatibility engine, then the whole set in one
// pass. It re-applies itself on DOM changes and dialogs from then on.
async function injectUrsCompat(tabId, list) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['urs-compat.js'] });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (items) => {
      if (!window.__u1UrsApplyMany) { window.__u1StudioDebug && console.log('[U1 Studio] urs-compat: ENGINE NOT LOADED'); return; }
      const r = window.__u1UrsApplyMany(items);
      window.__u1StudioDebug && console.log('[U1 Studio] urs-compat:', r);
    },
    args: [list],
  });
}

// Static fixes ("Fix all" on a scan rule) are saved as `custom: 'staticFix'`
// mappings and export fine — but nothing re-applied them on a normal page
// load: only the panel's own Fix-all press declared window.__u1Statics. So
// the 39 new-tab links read as fixed, and as broken again on the next reload.
// The patch (already injected for any site we have work on) holds the
// correctors; this only switches them on, the way the exported bundle does.
async function injectStatics(tabId, statics) {
  await injectPatch(tabId);
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    injectImmediately: true,
    func: (decl) => {
      window.__u1Statics = Object.assign(window.__u1Statics || {}, decl);
      if (window.__u1Patch && window.__u1Patch.schedule) window.__u1Patch.schedule();
    },
    args: [statics],
  });
}
// aria-label mappings (a typed name, or "<own text> about <card heading>")
// were applied by the panel when saved and by the exported bundle on the
// client's site — and by nothing on the next reload in this browser, so a
// named dropdown or link read as unnamed again the moment the page was
// refreshed. Same attribute the panel's applyAriaLabel writes, on load.
async function injectAriaLabels(tabId, list) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (items) => {
      var ABOUT = { en: 'about', he: 'על', ar: 'حول', vi: 'về', es: 'sobre', fr: 'sur', pt: 'sobre', ru: 'о', zh: '关于', ko: '관련', ja: 'について', hmn: 'txog', tl: 'tungkol sa', de: 'über', it: 'su', pl: 'o', uk: 'про', fa: 'درباره', hi: 'के बारे में', so: 'ku saabsan', am: 'ስለ', tr: 'hakkında' };
      var aboutFor = function (el, middle) {
        if ((middle || '').trim().toLowerCase() !== 'about') return (middle || '').trim();
        var n = el; var lang = '';
        while (n && n !== document && !lang) { lang = (n.getAttribute && n.getAttribute('lang')) || ''; n = n.parentNode; }
        lang = (lang || document.documentElement.lang || 'en').toLowerCase();
        return ABOUT[lang] || ABOUT[lang.split('-')[0]] || 'about';
      };
      var clean = function (s) { return (s || '').replace(/\s+/g, ' ').trim().replace(/[.。:：…]+$/, ''); };
      const here = () => { try { return decodeURIComponent(location.pathname).replace(/\/+$/, '') || '/'; } catch (e) { return location.pathname; } };
      const run = () => items.forEach(({ target, label, middleText, headingSel, page }) => {
        if (page && here() !== page) return;   // this-page-only, and the site changed page without a reload
        let els; try { els = document.querySelectorAll(target); } catch (e) { return; }
        els.forEach((el) => {
          if (label && label.trim()) { if (el.getAttribute('aria-label') !== label.trim()) el.setAttribute('aria-label', label.trim()); return; }
          const ownText = clean(el.textContent);
          let headingText = '';
          if (headingSel) {
            let h = null, node = el.parentElement;
            while (node && node !== document.body) { try { h = node.querySelector(headingSel); } catch (e) { h = null; } if (h) break; node = node.parentElement; }
            headingText = h ? clean(h.textContent) : '';
            if (!headingText) return;
          }
          const parts = [ownText, aboutFor(el, middleText), headingText].filter(Boolean);
          const want = parts.join(' ');
          if (parts.length && el.getAttribute('aria-label') !== want) el.setAttribute('aria-label', want);
        });
      });
      run();
      // Elements the site renders after load — and RE-renders: a paginated
      // card list (molinahealthcare.com/knowledge-center/blog) draws new
      // cards on every page and the names stayed on page 1 alone
      // (2026-10-08). Re-run on every change to the tree, debounced; the
      // writes are attributes, which this observer does not watch, so it
      // cannot loop. characterData too: a list keyed by index keeps its
      // elements and React rewrites only their text — a new heading under the
      // same "Learn more" link, which childList alone never reports.
      // One observer per tab, replaced on re-injection.
      if (window.__u1AriaLabelObs) { try { window.__u1AriaLabelObs.disconnect(); } catch (e) {} }
      let t = 0;
      window.__u1AriaLabelObs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 150); });
      window.__u1AriaLabelObs.observe(document, { childList: true, subtree: true, characterData: true });
    },
    args: [list],
  });
}
function ariaLabelsOf(list) {
  return list.filter(m => m && typeof m === 'object' && m.custom === 'ariaLabel' && m.primary).map(m => {
    const c = m.config || {}; const sel = c.selectors || {};
    return { target: m.primary, label: c.label || '', middleText: sel.middleText || c.middleText || '', headingSel: sel.headingSelector || c.headingSelector || '',
             page: (m.scope === 'page' && m.pagePath) ? m.pagePath : '' };
  });
}
function staticsOf(list) {
  const on = {};
  for (const m of list) {
    if (m && typeof m === 'object' && m.custom === 'staticFix' && m.primary) {
      const opts = Object.assign({}, m.config || {});
      delete opts.selectors;
      on[m.primary] = opts;
    }
  }
  return on;
}

// A mapping set to apply on its own page only (panel.js: isPageScoped) must
// not run anywhere else on the site. The exported u1-fixes.js guards it with
// __u1Here(); this is the same rule — decoded pathname, no trailing slash, no
// query — so what auto-apply shows while working is what the client's site
// (and a Cloud publish) will actually run. Without it, auto-apply ran every
// page-scoped mapping on every page of the host.
function pagePathOfUrl(url) {
  try { return decodeURIComponent(new URL(url).pathname).replace(/\/+$/, '') || '/'; } catch (e) { return ''; }
}
function forThisPage(list, url) {
  const here = pagePathOfUrl(url);
  return (list || []).filter((m) => !(m && typeof m === 'object' && m.scope === 'page' && m.pagePath && here && m.pagePath !== here));
}

// Which tabs are previewing, kept in storage.session so a service-worker
// restart mid-preview does not silently drop the tab back to auto-apply.
// Per tab, never per site: a preview is one person looking, not a mode the
// site is in.
const previewKey = (tabId) => '__preview_' + tabId;
async function previewFor(tabId) {
  try { return (await chrome.storage.session.get(previewKey(tabId)))[previewKey(tabId)] || null; } catch (e) { return null; }
}
async function setPreview(tabId, value) {
  if (value) await chrome.storage.session.set({ [previewKey(tabId)]: value });
  else await chrome.storage.session.remove(previewKey(tabId));
}
chrome.tabs.onRemoved.addListener((tabId) => { setPreview(tabId, null).catch(() => {}); });

/**
 * Load the preview bundle the way a client's page loads the live link: after
 * the U1 library, as a <script src>. Waits for window.u1.fix first because the
 * bundle's u1-config.js does `window.u1 = window.u1 || {}` — run before the
 * library, the library's own assignment would replace it. Gives up waiting
 * after 15s and loads anyway, so a page without U1 shows the bundle's own
 * "library never loaded" error rather than nothing.
 */
async function injectPreview(tabId, url, hostname) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (src, host) => {
      if (document.getElementById('u1PreviewScript')) return;
      const badge = document.createElement('div');
      badge.id = 'u1PreviewBadge';
      badge.setAttribute('role', 'status');
      badge.textContent = 'U1 preview: not live (' + host + ')';
      badge.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#4f46e5;color:#fff;font:600 12px/1.4 system-ui,sans-serif;padding:4px 10px;border-radius:999px;pointer-events:none;opacity:.92';
      document.documentElement.appendChild(badge);
      const started = Date.now();
      (function load() {
        if (!(window.u1 && window.u1.fix) && Date.now() - started < 15000) { setTimeout(load, 100); return; }
        const s = document.createElement('script');
        s.id = 'u1PreviewScript';
        s.src = src;
        s.async = false;
        s.onerror = () => { badge.textContent = 'U1 preview could not load. The site\'s Content-Security-Policy may block the CRM domain; the live link would be blocked the same way.'; badge.style.background = '#b91c1c'; };
        document.head.appendChild(s);
      })();
    },
    args: [url, hostname],
  });
}

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (isSystemUrl(tab?.url)) return;
  if (!isTrustedInjectionUrl(tab.url)) {
    // Silent otherwise, this is indistinguishable from "there's nothing saved
    // for this site" — which is the exact confusion CLAUDE.md warns about for
    // the dist/ build mismatch. One line, same convention as everywhere else
    // in this file, so it's findable if a specialist ever hits it for real.
    if (info.status === 'loading') {
      window.__u1StudioDebug && console.log('[U1 Studio] not injecting on', tab.url, '— not https (or localhost); saved config/mappings for this hostname were not sent.');
    }
    return;
  }

  // ── Preview tabs run the candidate bundle and nothing of ours ───────────
  // Leaving the previewed domain ends the preview — its bundle refuses to run
  // anywhere else anyway, and the next site deserves its normal auto-apply.
  if (info.status === 'loading' || info.status === 'complete') {
    const pv = await previewFor(tabId);
    if (pv) {
      if (getHostnameFromTab(tab) !== pv.hostname) {
        await setPreview(tabId, null);
      } else {
        if (info.status === 'complete') {
          const host = pv.hostname;
          const st = await U1Store.get([`manualInject_${host}`]);
          const inj = st[`manualInject_${host}`];
          if (inj && isSafeHttpUrl(inj.cssLink) && isSafeHttpUrl(inj.jsLink)) await injectEngineTags(tabId, inj);
          try { await injectPreview(tabId, pv.url, host); } catch {}
        }
        return;
      }
    }
  }

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

    // ── Only where this extension has work ────────────────────────────────
    //
    // This used to run before the storage read, on EVERY page load of every
    // site, so a browser with U1 Studio installed had a document-wide keyboard
    // interceptor on Gmail, on the bank, on everything. Reported as "I cannot
    // type spaces or Enter in Gmail until I disable the extension" — the patch
    // took those keys from any field sitting inside a collapsed container,
    // which Gmail's compose body does. The handlers themselves are fixed (see
    // caretOwns in u1-patch.js), but the blast radius was the real defect: a
    // tool for working on ONE site had put itself on all of them.
    //
    // Still ahead of injectConfig below, which does `window.u1 = window.u1 ||
    // {}` — with the patch in place first, the library's own assignment is the
    // one it intercepts, rather than a bare object we made ourselves. That was
    // the reason it moved to document_start, and it is preserved: the race only
    // ever mattered on a site we have data for.
    const hasWork = !!(stored[`config_${hostname}`] || stored[`manualInject_${hostname}`] ||
                       (stored[`mappings_${hostname}`] || []).length);
    if (hasWork) await injectPatch(tabId);
    // Auto-inject the saved config on EVERY load for this hostname — not just
    // ones where U1 was manually injected — so skip links / colors / language
    // persist across normal site navigation.
    if (stored[`config_${hostname}`]) {
      try { await injectConfig(tabId, stored[`config_${hostname}`]); } catch {}
    }
    // Arm the mappings poll as early as possible (document_start) so fix.* runs
    // the instant window.u1.fix appears — before U1's first scan when possible.
    const earlyAll = forThisPage(stored[`mappings_${hostname}`], tab.url);
    // Every u1.fix mapping, this-page-only ones included: injectMappings
    // runs each on its own page, also after an in-site page change.
    const early = (stored[`mappings_${hostname}`] || []).filter(m => m && typeof m === 'object' && m.type && (m.primary || m.firstArg) && !m.custom);
    if (early.length) { try { await injectMappings(tabId, early); } catch {} }
    // Arm the custom keyboard-grid engine early too (idempotent — it guards itself).
    const earlyGrids = earlyAll.filter(m => m && typeof m === 'object' && (m.custom === 'keyboardGrid' || m.custom === 'keyboardClickable' || m.custom === 'keyboardTabs' || m.custom === 'linkList' || m.custom === 'breadcrumb' || m.custom === 'hideElement' || m.custom === 'focusOrder') && m.primary);
    if (earlyGrids.length) { try { await injectKeyboardGrids(tabId, earlyGrids); } catch {} }
    const earlyStatics = staticsOf(earlyAll);
    if (Object.keys(earlyStatics).length) { try { await injectStatics(tabId, earlyStatics); } catch {} }
  }

  // ── At page-complete: re-inject U1 CSS/JS for manual-inject hostnames, and
  // auto-apply saved mappings once u1.fix is ready.
  if (info.status === 'complete') {
    const hostname = getHostnameFromTab(tab);
    if (!hostname) return;
    const stored = await U1Store.get([`manualInject_${hostname}`, `mappings_${hostname}`]);

    // Auto-apply mappings (independent of manual-inject — the site may load U1 itself).
    const all = forThisPage(stored[`mappings_${hostname}`], tab.url);
    const mappings = (stored[`mappings_${hostname}`] || []).filter(m => m && typeof m === 'object' && m.type && (m.primary || m.firstArg) && !m.custom);
    if (mappings.length) { try { await injectMappings(tabId, mappings); } catch {} }

    // Custom keyboard-grid mappings run our own engine — apply them too.
    const grids = all.filter(m => m && typeof m === 'object' && (m.custom === 'keyboardGrid' || m.custom === 'keyboardClickable' || m.custom === 'keyboardTabs' || m.custom === 'linkList' || m.custom === 'breadcrumb' || m.custom === 'hideElement' || m.custom === 'focusOrder') && m.primary);
    if (grids.length) { try { await injectKeyboardGrids(tabId, grids); } catch {} }
    const statics = staticsOf(all);
    if (Object.keys(statics).length) { try { await injectStatics(tabId, statics); } catch {} }
    // All of them: each carries its page, and the in-page runner skips the
    // ones that are not for the page currently showing.
    const names = ariaLabelsOf(stored[`mappings_${hostname}`] || []);
    if (names.length) { try { await injectAriaLabels(tabId, names); } catch {} }
    // A site converted from URS: its patterns run through the compatibility
    // engine, as one tree, on every load — the way the legacy snippet (which
    // rules.json keeps off the page) used to.
    const urs = all.filter(m => m && typeof m === 'object' && m.custom === 'ursCompat' && m.primary);
    if (urs.length) { try { await injectUrsCompat(tabId, urs); } catch {} }
    // Converted IDE scripts: run once per load in the page's own world (they
    // were written for it), through the same engine's IDE layer.
    const ide = all.filter(m => m && typeof m === 'object' && m.custom === 'ideCompat' && m.config);
    if (ide.length) {
      try {
        await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['urs-compat.js'] });
        await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: (its) => { if (!window.__u1IdeRegister) return; its.forEach((i) => window.__u1IdeRegister(i)); window.__u1IdeApply(); }, args: [ide.map(m => ({ id: m.id, config: m.config }))] });
      } catch {}
    }

    const injectData = stored[`manualInject_${hostname}`];
    if (!injectData) return;
    // Defense in depth: never inject a non-http(s) URL even if one reached storage.
    if (!isSafeHttpUrl(injectData.cssLink) || !isSafeHttpUrl(injectData.jsLink)) return;
    await injectEngineTags(tabId, injectData);
  }
});

// The U1 library's own two tags, for a site that does not load U1 itself.
async function injectEngineTags(tabId, injectData) {
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

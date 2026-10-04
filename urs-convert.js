/*
 * URS → U1 Studio conversion, in the panel.
 *
 * A site that still runs the uRemediate / URS snippet carries its whole
 * accessibility definition on fecdn (the legacy front-end CDN): the pattern
 * tree with every fix and script, the texts per language, and the site
 * scripts. The snippet reads them through public GET endpoints, so the panel
 * can read them too. This file turns that definition into `urs-compat`
 * mappings — one per URS pattern, carried over whole — which the compatibility
 * engine (urs-compat.js) applies on the client site with no server behind it.
 *
 * Runs in the panel (window.U1Urs) and in node (module.exports) from one
 * source, so the terminal converter in user1st-all/urs-migration and the
 * panel can never disagree about what a converted mapping looks like.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.U1Urs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── the snippet's own endpoints ──────────────────────────────────────────
  // All GET, all anonymous: this is exactly what the loader on the client's
  // page calls. The response is `window.<name>="<escaped json>";`.
  function endpoints(origin, domain, lang) {
    const d = encodeURIComponent(domain);
    return {
      sitedef: `${origin}/CommFrame/GetSiteDefinition?siteUrl=${d}&variableName=u1st_siteDefinition&langCode=${encodeURIComponent(lang || 'en')}`,
      texts: (l) => `${origin}/CommFrame/GetLangTexts?siteUrl=${d}&lang=${encodeURIComponent(l)}&variableName=u1st_texts`,
      scripts: `${origin}/CommFrame/GetSiteScripts?domain=${d}&variableName=u1st_siteScripts`,
    };
  }
  function unwrap(js) {
    const m = /^\s*window\.\w+\s*=\s*("(?:[^"\\]|\\.)*");\s*$/s.exec(js || '');
    if (!m) return null;
    try { return JSON.parse(JSON.parse(m[1])); } catch (e) { return null; }
  }

  // Languages worth asking fecdn for when the site does not say. An unknown
  // language answers with an empty dictionary, which costs one small request.
  const DEFAULT_LANGS = ['he', 'en', 'ar', 'ru', 'fr', 'es', 'de'];

  /**
   * Pull one site's definition. `fetchText(url) → Promise<string>` is injected
   * so the panel can use window.fetch and node can use whatever it likes.
   * Returns { sitedef, texts: {lang: {id: text}}, scripts, domain, origin } or
   * throws with a readable message.
   */
  async function fetchSite({ origin, domain, langs, fetchText, onProgress }) {
    const say = onProgress || (() => {});
    const tried = [];
    const candidates = [domain, domain.replace(/^www\./, ''), 'www.' + domain.replace(/^www\./, '')].filter((d, i, a) => a.indexOf(d) === i);
    let sitedef = null, usedDomain = null;
    for (const d of candidates) {
      say(`Reading the site definition for ${d}…`);
      const ep = endpoints(origin, d, (langs && langs[0]) || 'en');
      let raw;
      try { raw = await fetchText(ep.sitedef); } catch (e) { tried.push(`${d}: ${e.message}`); continue; }
      const parsed = unwrap(raw);
      const def = parsed && (parsed.siteDefinition || parsed.SiteDefinition);
      if (def && def.patterns && def.patterns.length && !(def.patterns.length === 1 && !def.patterns[0].patterns?.length && !def.patterns[0].elements?.some((e) => (e.metadata || []).length || (e.actions || []).length))) {
        sitedef = parsed; usedDomain = d; break;
      }
      tried.push(`${d}: no definition (or an empty one)`);
    }
    if (!sitedef) throw new Error('fecdn has no URS definition for this site. Tried ' + tried.join('; '));

    const texts = {};
    const want = (langs && langs.length ? langs : DEFAULT_LANGS).map((l) => String(l).toLowerCase().split(/[-_]/)[0]).filter((l, i, a) => a.indexOf(l) === i);
    for (const l of want) {
      say(`Reading texts (${l})…`);
      try {
        const t = unwrap(await fetchText(endpoints(origin, usedDomain).texts(l)));
        if (t && typeof t === 'object' && Object.values(t).some((v) => typeof v === 'string' && v.trim())) texts[l] = t;
      } catch (e) { /* a language fecdn does not have */ }
    }
    say('Reading site scripts…');
    let scripts = [];
    try { scripts = unwrap(await fetchText(endpoints(origin, usedDomain).scripts)) || []; } catch (e) { scripts = []; }
    return { sitedef, texts, scripts: Array.isArray(scripts) ? scripts : [], domain: usedDomain, origin };
  }

  // ── decoding ─────────────────────────────────────────────────────────────
  // URS stores selectors as escape()'d JSON: {"selector": ".x", "childrenLevel": 0}.
  function unesc(s) {
    if (typeof s !== 'string' || !/%[0-9A-Fa-f]{2}/.test(s)) return s;
    try { return decodeURIComponent(s); } catch (e) { /* escape() differs for some chars */ }
    try { return unescape(s); } catch (e) { return s; }
  }
  function decodeSelector(v) {
    const s = unesc(v);
    if (typeof s !== 'string') return null;
    const t = s.trim();
    if (t.startsWith('{')) {
      try { const o = JSON.parse(t); return { selector: String(o.selector == null ? '' : o.selector).trim(), childrenLevel: Number(o.childrenLevel) || 0 }; } catch (e) { /* plain */ }
    }
    return { selector: t, childrenLevel: 0 };
  }
  const SELECTOR_KEYS = /(^target$|^selector$|Selector$|^elementSelector$|^menuSelector$|^bindableSelector$)/;
  function decodeValues(values) {
    const out = {};
    for (const [k, v] of Object.entries(values || {})) {
      if (v == null) continue;
      if (k === 'script') out[k] = unesc(v);
      else if (SELECTOR_KEYS.test(k)) out[k] = decodeSelector(v);
      else out[k] = typeof v === 'string' ? v : String(v);
    }
    return out;
  }

  function canonical(v) {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }

  const KNOWN_META = new Set([
    'role', 'landmark', 'hideFromSR', 'description', 'tabIndexContainer', 'excludeTabIndex', 'reverseTabIndexDir',
    'replaceTagName', 'redundentAttr', 'haspopup', 'highContrast', 'inverseHighContrast', 'excludeColorContrast',
    'statable', 'stateChangingSection', 'scrollable', 'actionControl', 'expanded', 'checked', 'selected', 'disabled',
    'level', 'live', 'controls', 'owns', 'flowto', 'describedby', 'multiline', 'multiselectable', 'readonly', 'required',
    'noDescription', 'autocomplete', 'valueMax', 'valueMin', 'dataTable', 'lazyLoadingTimeout', 'confirmAction',
    'formValidation', 'datePicker', 'menuWidget', 'menuWidgetMenu', 'menuWidgetItem', 'headingToDiv',
  ]);
  const NATIVE_HINT = { menuWidget: 'menu', formValidation: 'form', datePicker: 'datepicker', dataTable: 'table' };
  const NATIVE_PATTERN_HINT = { dialog: 'dialog', dropdown: 'listbox / menu' };
  const GUID_RE = /^[0-9a-f-]{36}$/i;

  /**
   * Turn a fetched site into Studio mappings.
   *   { sitedef, texts: {lang: {id: text}}, scripts, host }  →
   *   { mappings: [...], worklist: {...}, markdown: 'worklist as markdown' }
   */
  function convert({ sitedef, texts, scripts, host, now }) {
    const raw = sitedef;
    const defn = raw.siteDefinition || raw.SiteDefinition;
    if (!defn || !Array.isArray(defn.patterns)) throw new Error('Not a URS site definition.');
    const siteKey = raw.siteKey;
    const ts = now || Date.now();

    // texts: id → {lang: text}, empty strings are "not translated"
    const byId = {};
    for (const [lang, dict] of Object.entries(texts || {})) {
      for (const [id, s] of Object.entries(dict || {})) {
        if (typeof s !== 'string' || !s.trim()) continue;
        (byId[id] = byId[id] || {})[lang] = s;
      }
    }
    const languages = Object.keys(texts || {});

    const mappings = [];
    const worklist = { patterns: [], metadataTypes: {}, scriptCount: 0, unknownMeta: new Set(), textIdsMissing: new Set(), nativeCandidates: [] };
    const usedTextIds = new Set();
    const idOf = (ursId) => 'm-urs' + String(ursId || '').replace(/-/g, '').slice(0, 8);
    let fixNo = 0;

    function walk(p, parentUrsId, depth) {
      const sel = decodeSelector(p.selector) || { selector: 'body', childrenLevel: 0 };
      if (sel.selector === '{BODY}') sel.selector = 'body';
      const metadata = [], scriptsOut = [], seen = new Set();
      for (const el of p.elements || []) {
        for (const m of el.metadata || []) {
          const row = { type: m.type, values: decodeValues(m.values) };
          if (m.desc) row.desc = m.desc;
          // fecdn repeats some rows (per language, and with keys in another
          // order); one copy is enough. canonical() sorts keys at every
          // level — a key-list replacer would also filter the nested target
          // object and make every row of a type look identical.
          const k = row.type + canonical(row.values);
          if (seen.has(k)) continue;
          seen.add(k);
          if (!KNOWN_META.has(m.type)) worklist.unknownMeta.add(m.type);
          worklist.metadataTypes[m.type] = (worklist.metadataTypes[m.type] || 0) + 1;
          for (const key of ['srcAbsValue', 'exp']) {
            const id = row.values[key];
            if (typeof id !== 'string' || !GUID_RE.test(id)) continue;
            usedTextIds.add(id);
            if (!byId[id]) worklist.textIdsMissing.add(id);
          }
          if (NATIVE_HINT[m.type]) worklist.nativeCandidates.push({ pattern: p.name, urs: m.type, studio: NATIVE_HINT[m.type] });
          metadata.push(row);
        }
        for (const a of el.actions || []) {
          if (a.type !== 'executeScript') { worklist.unknownMeta.add('action:' + a.type); continue; }
          const v = decodeValues(a.values);
          const k = 'script' + (v.name || '') + v.executionTime + (v.script || '');
          if (seen.has(k)) continue;
          seen.add(k);
          scriptsOut.push({ name: (v.name || '').trim(), when: Number(v.executionTime) || 1024, target: v.target || { selector: '.', childrenLevel: 0 }, code: v.script || '' });
          worklist.scriptCount++;
        }
      }
      // A pattern's display name is a TextID too (displayNameMethod "1"). URS
      // uses it for the skip link of a main pattern ("דלג לתוכן עמוד"), the
      // alt-navigation entry and dialog announcements.
      if (p.data && typeof p.data.displayName === 'string' && GUID_RE.test(p.data.displayName)) {
        usedTextIds.add(p.data.displayName);
        if (!byId[p.data.displayName]) worklist.textIdsMissing.add(p.data.displayName);
      }
      if (NATIVE_PATTERN_HINT[p.type]) worklist.nativeCandidates.push({ pattern: p.name, urs: 'pattern:' + p.type, studio: NATIVE_PATTERN_HINT[p.type] });

      fixNo++;
      const isRoot = depth === 0;
      const config = {
        selectors: { target: sel.selector },
        pattern: {
          ursId: p.id, name: p.name, patternType: p.type, childrenLevel: sel.childrenLevel,
          parentUrsId: parentUrsId || null, mediaQueries: p.mediaQueries || [], filters: p.filters || null, data: p.data || {},
        },
        metadata, scripts: scriptsOut,
      };
      if (isRoot) {
        config.site = {
          ursVersion: defn.version, siteKey, host, languages,
          siteScripts: (scripts || []).map((s) => ({ eventType: Number(s.eventType) || 0, urlPattern: s.urlPattern || null, code: s.content || '' })),
        };
        config.texts = {};
      }
      mappings.push({
        type: 'urs-compat', custom: 'ursCompat',
        primary: sel.selector, firstArg: sel.selector,
        config, code: null, overwriteRole: null,
        note: `URS pattern "${p.name}" (${p.type}${depth ? ', level ' + depth : ', root'}) — ${metadata.length} fixes, ${scriptsOut.length} scripts. Converted from URS v${defn.version}.`,
        parent: null, screenshot: null,
        pageUrl: 'https://' + host + '/', pageTitle: p.name,
        scope: 'site', pagePath: '',
        capturedAt: ts, fixNo, id: idOf(p.id),
      });
      worklist.patterns.push({ name: p.name, type: p.type, selector: sel.selector, depth, metadata: metadata.length, scripts: scriptsOut.length });
      for (const c of p.patterns || []) walk(c, p.id, depth + 1);
    }
    for (const p of defn.patterns) walk(p, null, 0);

    // Two URS patterns on one selector would share a Studio key (type::primary),
    // and the server keeps one row per key. firstArg is unused for this type,
    // so it carries the disambiguation.
    const seenPrimary = {};
    for (const m of mappings) {
      if (seenPrimary[m.primary]) m.firstArg = m.primary + ' /*' + m.id + '*/';
      seenPrimary[m.primary] = true;
    }

    const root = mappings[0];
    if (root) for (const id of usedTextIds) if (byId[id]) root.config.texts[id] = byId[id];

    // Skip links. URS gives every pattern whose type carries the addAccessKey
    // behaviour (main, on every site we have seen) a "skip to <display name>"
    // quick link. Studio has skip links of its own (config.skipLinks, rendered
    // by u1-patch.js only on pages where the target exists), so they become
    // those — one entry per pattern, in URS's own wording.
    const types = raw.patternTypes || {};
    const lang = (languages.indexOf('he') > -1 ? 'he' : languages[0]) || 'en';
    const SKIP = { he: 'דלג ל', ar: 'انتقل إلى ', ru: 'Перейти к ', fr: 'Aller à ', es: 'Saltar a ', de: 'Springe zu ', en: 'Skip to ' };
    const DEFAULT_MAIN = { he: 'תוכן עמוד', en: 'main content' };
    const skipLinks = [];
    (function walkSkip(p) {
      const t = types[p.type];
      if (t && (t.behaviors || []).some((b) => b && b.name === 'addAccessKey')) {
        const sel = decodeSelector(p.selector);
        if (sel && sel.selector && !sel.childrenLevel) {
          const dn = p.data && p.data.displayName;
          let name = dn && GUID_RE.test(dn) ? (byId[dn] && byId[dn][lang]) : dn; // the site's language only — never a sentence in two languages
          if (!name || GUID_RE.test(name)) name = DEFAULT_MAIN[lang] || DEFAULT_MAIN.en;
          if (!skipLinks.some((x) => x.selector === sel.selector)) {
            skipLinks.push({ label: (SKIP[lang] || SKIP.en) + name, kind: p.type === 'search' ? 'search' : 'main', target: sel.selector, selector: sel.selector });
          }
        }
      }
      for (const c of p.patterns || []) walkSkip(c);
    })({ patterns: defn.patterns });
    worklist.skipLinks = skipLinks;

    const totals = {
      patterns: mappings.length,
      fixes: Object.values(worklist.metadataTypes).reduce((n, c) => n + c, 0),
      scripts: worklist.scriptCount,
      siteScripts: (scripts || []).length,
      texts: root ? Object.keys(root.config.texts).length : 0,
      skipLinks: skipLinks.length,
      languages,
      ursVersion: defn.version,
    };
    return { mappings, skipLinks, lang, worklist, totals, markdown: worklistMarkdown(host, totals, worklist, siteKey) };
  }

  function worklistMarkdown(host, totals, worklist, siteKey) {
    const sortedMeta = Object.entries(worklist.metadataTypes).sort((a, b) => b[1] - a[1]);
    const md = [];
    md.push(`# URS → U1 Studio conversion worklist: ${host}`, '');
    md.push(`Source: URS SiteDefinition v${totals.ursVersion}, site key ${siteKey}. Generated ${new Date().toISOString()}.`, '');
    md.push('## Totals', '', '| | |', '|---|---|',
      `| URS patterns → Studio mappings | ${totals.patterns} |`,
      `| Declarative fixes carried over | ${totals.fixes} |`,
      `| Pattern scripts carried over | ${totals.scripts} |`,
      `| Site scripts carried over | ${totals.siteScripts} |`,
      `| Texts (TextIDs) carried over | ${totals.texts} in ${totals.languages.join(', ') || '(none)'} |`,
      `| Skip links (from main patterns) | ${totals.skipLinks} |`, '');
    if (worklist.skipLinks && worklist.skipLinks.length) {
      md.push('## Skip links', '', 'Become Studio skip links (Config). Each renders only on pages where its target exists.', '', '| label | target |', '|---|---|');
      for (const l of worklist.skipLinks) md.push(`| ${l.label} | \`${l.selector}\` |`);
      md.push('');
    }
    md.push('## Fix types in this site', '', '| count | URS type |', '|---|---|');
    for (const [k, v] of sortedMeta) md.push(`| ${v} | ${k} |`);
    md.push('');
    if (worklist.unknownMeta.size) {
      md.push('## ⚠ Types the engine does not know yet', '', 'Carried over, but urs-compat.js has no applier for them. They are reported in the console and skipped.', '');
      for (const t of worklist.unknownMeta) md.push(`- ${t}`);
      md.push('');
    }
    if (worklist.textIdsMissing.size) {
      md.push('## ⚠ Descriptions whose text is missing in every language', '');
      for (const t of worklist.textIdsMissing) md.push(`- ${t}`);
      md.push('');
    }
    md.push('## How the engine differs from the legacy snippet', '',
      '- Keyboard and screen-reader behaviours are always on (no profile menu).',
      '- High contrast / grayscale fixes apply only when the visitor\'s system asks for them (forced-colors, prefers-contrast, u1 toolbar state).',
      '- Dialogs: role=dialog + aria-modal, Esc clicks the close button, focus returns to the trigger.',
      '- Descriptions on links/buttons become aria-label (the legacy rewrote visible text for screen-reader users).',
      '- datePicker widgets are not re-implemented; menuWidget and formValidation are minimal. See the upgrades table below.', '');
    md.push('## Optional upgrades to native U1 components', '', 'Each of these runs faithfully under urs-compat. Re-mapping it with the native Studio type gives the U1 keyboard/ARIA behaviour instead of the legacy one. Not required for the conversion.', '', '| URS pattern | URS fix | Studio type |', '|---|---|---|');
    for (const c of worklist.nativeCandidates) md.push(`| ${c.pattern} | ${c.urs} | ${c.studio} |`);
    md.push('');
    md.push('## Patterns', '', '| # | depth | type | name | selector | fixes | scripts |', '|---|---|---|---|---|---|---|');
    worklist.patterns.forEach((p, i) => md.push(`| ${i + 1} | ${p.depth} | ${p.type} | ${String(p.name).replace(/\|/g, '\\|')} | \`${String(p.selector).replace(/\|/g, '\\|')}\` | ${p.metadata} | ${p.scripts} |`));
    md.push('');
    return md.join('\n');
  }

  // ── detection, run INSIDE the page ───────────────────────────────────────
  // Returned as a plain function so the panel can hand it to
  // chrome.scripting.executeScript. It reads script tags only.
  function detectInPage() {
    const out = { found: false, origin: null, siteUrl: null, src: null };
    const scripts = Array.from(document.scripts || []);
    for (const s of scripts) {
      const src = s.src || '';
      if (!/user1st\.info\//i.test(src)) continue;
      let u; try { u = new URL(src); } catch (e) { continue; }
      if (!/(^|\.)(fecdn|unfecdn|feinteg|feun|fe)\.user1st\.info$|user1st\.info$/i.test(u.hostname)) continue;
      out.found = true; out.origin = u.origin; out.src = src;
      const q = u.searchParams.get('siteUrl');
      if (q) { try { out.siteUrl = new URL(q).hostname; } catch (e) { out.siteUrl = q; } }
      if (out.siteUrl) break; // keep looking for the Loader call that names the site
    }
    if (!out.found && document.getElementById('User1st_Loader')) { out.found = true; out.src = (document.getElementById('User1st_Loader').src || ''); try { out.origin = new URL(out.src).origin; } catch (e) { /* noop */ } }
    return out;
  }

  return { fetchSite, convert, unwrap, endpoints, detectInPage, DEFAULT_LANGS, _decodeValues: decodeValues, _canonical: canonical };
});

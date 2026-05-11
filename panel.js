'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT SCHEMAS
//  Each schema describes how a fix.X(...) call is structured.
//  'PRIMARY' is replaced with the picked element's selector.
// ─────────────────────────────────────────────────────────────────────────────

const COMPONENT_SCHEMAS = {
  button:    { selectors:{element:'PRIMARY'}, fields:[] },
  link:      { selectors:{element:'PRIMARY'}, fields:[] },

  menu: {
    selectors:{menu:'PRIMARY', submenus:'', items:'', triggers:'', horizontalMenu:'PRIMARY'},
    fields:['submenus','items','triggers','horizontalMenu'],
    rootFields:{menuDescription:''},
  },

  accordion: {
    selectors:{headerSelector:'', contentSelector:''},
    fields:['headerSelector','contentSelector'],
  },

  carousel: {
    selectors:{carouselContainer:'PRIMARY', slide:'', prevButton:'', nextButton:''},
    fields:['slide','prevButton','nextButton'],
  },

  datepicker: {
    selectors:{
      container:'PRIMARY', trigger:'',
      year:{label:'',prevButton:'',nextButton:''},
      month:{label:'',prevButton:'',nextButton:''},
      days:{table:'',day:'',selected:'',disabled:''},
    },
    fields:['trigger','year.label','year.prevButton','year.nextButton',
            'month.label','month.prevButton','month.nextButton',
            'days.table','days.day','days.selected','days.disabled'],
  },

  dialog: {
    selectors:{dialog:'PRIMARY', trigger:'', closeBtn:'', heading:'', textContent:''},
    fields:['trigger','closeBtn','heading','textContent'],
    rootFields:{type:'modal'},
  },

  listbox: {
    selectors:{listbox:'PRIMARY', trigger:'', options:'', label:''},
    fields:['trigger','options','label'],
  },

  combobox: {
    selectors:{combobox:'PRIMARY', textbox:'', options:'', listbox:'', label:''},
    fields:['textbox','options','listbox','label'],
    rootFields:{isAutocompleteList:true},
  },

  checkbox: {
    selectors:{element:'PRIMARY', checkedState:'', uncheckedState:''},
    fields:['checkedState','uncheckedState'],
  },

  radio: {
    selectors:{radioGroup:'PRIMARY', radioButton:'', checkedState:'', uncheckedState:''},
    fields:['radioButton','checkedState','uncheckedState'],
  },

  tabs: {
    selectors:{tabList:'', tab:'', panel:''},
    fields:['tabList','tab','panel'],
  },

  form: {
    selectors:{form:'PRIMARY', formLabelAbsolute:'', invalidField:'', requiredField:'', errorMessageAbsolute:''},
    fields:['formLabelAbsolute','invalidField','requiredField','errorMessageAbsolute'],
  },

  table: {
    selectors:{table:'PRIMARY', row:'', cell:'', columnheader:''},
    fields:['row','cell','columnheader'],
  },

  grid: {
    selectors:{grid:'PRIMARY', row:'', cell:'', columnheader:''},
    fields:['row','cell','columnheader'],
  },

  tooltip: {
    selectors:{trigger:'', tooltip:'PRIMARY'},
    fields:['trigger'],
  },
};

// Helpers to set/read nested values via dotted keys ("year.label")
function setDeep(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function isValidIdent(s) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

// Serialize an object as JS source with unquoted identifier keys.
function formatJsObject(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  const padInner = '  '.repeat(indent + 1);
  if (obj === null) return 'null';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return '[\n' + obj.map(v => padInner + formatJsObject(v, indent + 1)).join(',\n') + '\n' + pad + ']';
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    return '{\n' + keys.map(k =>
      padInner + (isValidIdent(k) ? k : JSON.stringify(k)) + ': ' + formatJsObject(obj[k], indent + 1)
    ).join(',\n') + '\n' + pad + '}';
  }
  return String(obj);
}

// Builds a structured mapping AND the equivalent source code from a schema.
// Returns { type, primary, config, code }.
function buildTemplate(type, primary, fieldValues, rootValues) {
  const schema = COMPONENT_SCHEMAS[type];
  if (!schema) return null;

  // 1) selectors object with PRIMARY substituted
  const selectors = deepClone(schema.selectors);
  (function substitute(node) {
    for (const k of Object.keys(node)) {
      if (node[k] === 'PRIMARY') node[k] = primary;
      else if (typeof node[k] === 'object' && node[k] !== null) substitute(node[k]);
    }
  })(selectors);

  // 2) overlay user-provided field values
  for (const f of schema.fields) {
    const v = fieldValues[f];
    if (typeof v === 'string') setDeep(selectors, f, v);
  }

  // 3) root config object
  const config = { selectors };
  if (schema.rootFields) {
    for (const [k, defaultVal] of Object.entries(schema.rootFields)) {
      config[k] = (rootValues && k in rootValues) ? rootValues[k] : defaultVal;
    }
  }

  const code = `window.u1?.fix.${type}(${JSON.stringify(primary)}, ${formatJsObject(config)});`;
  return { type, primary, config, code };
}

// Auto-detect the most likely component type from the picked element's
// metadata. Returns one of the COMPONENT_SCHEMAS keys, or ''.
function detectComponentType(info) {
  if (!info) return '';
  const tag = (info.tag || '').toLowerCase();
  const role = (info.role || '').toLowerCase();
  const inputType = (info.inputType || '').toLowerCase();
  const classes = (info.classes || []).map(c => c.toLowerCase()).join(' ');
  const dataToggle = (info.dataToggle || '').toLowerCase();

  // High-confidence: ARIA roles
  if (role === 'menu' || role === 'menubar') return 'menu';
  if (role === 'dialog' || role === 'alertdialog') return 'dialog';
  if (role === 'tablist' || role === 'tab') return 'tabs';
  if (role === 'tooltip') return 'tooltip';
  if (role === 'combobox') return 'combobox';
  if (role === 'listbox') return 'listbox';
  if (role === 'grid') return 'grid';
  if (role === 'checkbox') return 'checkbox';
  if (role === 'radio' || role === 'radiogroup') return 'radio';
  if (role === 'button') return 'button';

  // Native semantic tags
  if (tag === 'dialog' || info.ariaModal === 'true') return 'dialog';
  if (tag === 'details') return 'accordion';
  if (tag === 'form') return 'form';
  if (tag === 'table') return 'table';
  if (tag === 'select') return 'listbox';
  if (tag === 'input') {
    if (inputType === 'checkbox') return 'checkbox';
    if (inputType === 'radio') return 'radio';
    if (inputType === 'date' || inputType === 'datetime-local') return 'datepicker';
    if (info.ariaHaspopup === 'listbox' || info.ariaHaspopup === 'true') return 'combobox';
  }
  if (tag === 'button') return 'button';
  if (tag === 'nav') return 'menu';

  // Bootstrap data-toggle hints
  if (dataToggle === 'modal') return 'dialog';
  if (dataToggle === 'collapse') return 'accordion';
  if (dataToggle === 'tooltip') return 'tooltip';
  if (dataToggle === 'dropdown') return 'menu';
  if (dataToggle === 'tab' || dataToggle === 'pill') return 'tabs';

  // Class-name keyword sniff
  if (/(^|\s)(accordion|collapsible|toggle-header|elementor-accordion|et_pb_accordion)/i.test(classes)) return 'accordion';
  if (/(carousel|slick|swiper|owl-carousel|flexslider|elementor-carousel)/i.test(classes)) return 'carousel';
  if (/(datepicker|flatpickr|pikaday|date-picker|air-datepicker)/i.test(classes)) return 'datepicker';
  if (/(modal|dialog|popup|lightbox|fancybox|mfp-content|remodal)/i.test(classes)) return 'dialog';
  if (/(menu|navigation|navbar|nav-menu|elementor-nav-menu)/i.test(classes)) return 'menu';
  if (/(\btabs\b|nav-tabs|ui-tabs|tab-list|elementor-tabs|et_pb_tabs)/i.test(classes)) return 'tabs';
  if (/(tooltip|tippy)/i.test(classes)) return 'tooltip';
  if (/(combobox|autocomplete|select2|chosen|selectize|typeahead)/i.test(classes)) return 'combobox';
  if (/(listbox)/i.test(classes)) return 'listbox';
  if (/(\bgrid\b|ag-grid|datatables|ag-root)/i.test(classes)) return 'grid';
  if (/(checkbox)/i.test(classes)) return 'checkbox';
  if (/(\bradio\b|radio-group)/i.test(classes)) return 'radio';
  if (/(\bbtn\b|button|elementor-button)/i.test(classes)) return 'button';

  // Generic anchor → link
  if (tag === 'a' && info.hasHref) return 'link';

  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function getHostname(tab) {
  try { return new URL(tab.url).hostname || 'unknown'; }
  catch { return 'unknown'; }
}

function storageKey(prefix, hostname) {
  return `${prefix}_${hostname}`;
}

function flashMessage(el, duration = 2200) {
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, duration);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isInjectable(tab) {
  return tab && tab.id && tab.url &&
         !tab.url.startsWith('chrome://') &&
         !tab.url.startsWith('chrome-extension://') &&
         !tab.url.startsWith('edge://') &&
         !tab.url.startsWith('about:');
}

// ── Apply functions (no eval — CSP-safe) ──────────────────────────────────
// These set window.u1.* directly via executeScript args, so they work even
// on pages with strict Content-Security-Policy that disallow eval/new Function.

async function applyConfig(config) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { ok: false, err: 'Cannot run on this page.' };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (cfg) => {
        const hadU1 = typeof window.u1 !== 'undefined' && window.u1 !== null;
        try {
          window.u1 = window.u1 || {};
          window.u1.config = cfg;
          return { ok: true, hasU1: hadU1 };
        } catch (e) {
          return { ok: false, err: String(e && e.message ? e.message : e), hasU1: hadU1 };
        }
      },
      args: [config],
    });
    const r = results && results[0] && results[0].result ? results[0].result : { ok: false, err: 'No result' };
    if (r.ok && !r.hasU1) r.u1Missing = true;
    return r;
  } catch (err) {
    return { ok: false, err: err.message };
  }
}

async function applyFix(type, primary, config) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { ok: false, err: 'Cannot run on this page.' };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t, p, c) => {
        const u1 = window.u1;
        if (!u1 || typeof u1 !== 'object') {
          return { ok: false, err: 'window.u1 is not loaded', u1Missing: true };
        }
        if (!u1.fix || typeof u1.fix[t] !== 'function') {
          return { ok: false, err: 'u1.fix.' + t + ' is not available' };
        }
        try {
          u1.fix[t](p, c);
          return { ok: true };
        } catch (e) {
          return { ok: false, err: String(e && e.message ? e.message : e) };
        }
      },
      args: [type, primary, config],
    });
    return results && results[0] && results[0].result ? results[0].result : { ok: false, err: 'No result' };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}

async function applyMappingsBatch(items) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { ok: false, err: 'Cannot run on this page.' };
  // Filter to only structured items (skip legacy strings)
  const structured = items.filter(x => x && typeof x === 'object' && x.type && x.primary);
  if (structured.length === 0) {
    return { ok: false, err: 'No applicable mappings (legacy string mappings cannot be auto-applied — re-add them).' };
  }
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (list) => {
        const u1 = window.u1;
        if (!u1 || typeof u1 !== 'object') {
          return { ok: false, err: 'window.u1 is not loaded', u1Missing: true };
        }
        let applied = 0, failed = 0, errs = [];
        for (const it of list) {
          try {
            if (u1.fix && typeof u1.fix[it.type] === 'function') {
              u1.fix[it.type](it.primary, it.config);
              applied++;
            } else {
              failed++;
              errs.push('u1.fix.' + it.type + ' missing');
            }
          } catch (e) {
            failed++;
            errs.push(String(e && e.message ? e.message : e));
          }
        }
        return { ok: true, applied, failed, errs };
      },
      args: [structured],
    });
    return results && results[0] && results[0].result ? results[0].result : { ok: false, err: 'No result' };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}

// ── Mapping helpers ───────────────────────────────────────────────────────
// Mappings may be old-format strings (legacy) or new-format objects {type, primary, config, code}.
function mappingToCode(m) {
  if (typeof m === 'string') return m;
  if (m && typeof m === 'object') {
    if (m.code) return m.code;
    if (m.type && m.primary && m.config) {
      return `window.u1?.fix.${m.type}(${JSON.stringify(m.primary)}, ${formatJsObject(m.config)});`;
    }
  }
  return '';
}

function mappingKey(m) {
  if (typeof m === 'string') return m;
  if (m && m.type && m.primary) return m.type + '::' + m.primary;
  return JSON.stringify(m);
}

function showNotice(el, text, kind = 'success', duration = 3500) {
  if (!el) return;
  el.className = `notice ${kind}`;
  el.textContent = text;
  el.style.display = 'block';
  if (duration > 0) setTimeout(() => { el.style.display = 'none'; }, duration);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab switching
// ─────────────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

    if (btn.dataset.tab === 'config') refreshConfigSkipList();
    if (btn.dataset.tab === 'export') refreshExportInfo();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Boot / per-tab init
// ─────────────────────────────────────────────────────────────────────────────

let currentHostname = 'unknown';

async function init() {
  const tab = await getTab();
  currentHostname = getHostname(tab);

  document.querySelectorAll('#mappingsHostname, #exportHostname').forEach(el => {
    el.textContent = currentHostname;
  });

  await refreshSetupTab(tab);
  await loadConfigForm();
  await refreshConfigSkipList();
  updateConfigPreview();
  await loadPickerState();
  await loadMappingsList();
  await refreshExportInfo();
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 1 — SETUP
// ─────────────────────────────────────────────────────────────────────────────

async function refreshSetupTab(tab) {
  // Load saved global links
  const { cssLink, jsLink } = await chrome.storage.local.get(['cssLink', 'jsLink']);
  if (cssLink) document.getElementById('cssLink').value = cssLink;
  if (jsLink)  document.getElementById('jsLink').value  = jsLink;

  // Detect U1 on page
  const detected = await detectU1(tab);
  const detectedSec = document.getElementById('u1Detected');
  const inputsSec   = document.getElementById('u1Inputs');

  if (detected && (detected.cssHref || detected.jsSrc)) {
    detectedSec.style.display = 'block';
    inputsSec.style.display   = 'none';
    document.getElementById('detectedCss').textContent = detected.cssHref || '(not found)';
    document.getElementById('detectedJs').textContent  = detected.jsSrc   || '(not found)';
  } else {
    detectedSec.style.display = 'none';
    inputsSec.style.display   = 'block';
  }

  // Detect skip links on page
  const skipDetected = await detectSkipLinks(tab);
  const skipDetSec   = document.getElementById('skipDetected');
  const skipInpSec   = document.getElementById('skipInputs');
  const skipKey      = storageKey('skipLinks', currentHostname);
  const stored       = await chrome.storage.local.get([skipKey]);
  const userSaved    = stored[skipKey];

  if (skipDetected && skipDetected.length > 0) {
    skipDetSec.style.display = 'block';
    skipInpSec.style.display = 'none';
    renderSkipDetectedList(skipDetected);
    // If user hasn't saved any, sync detected to storage so Config/Export see them
    if (!userSaved || !userSaved.length) {
      await chrome.storage.local.set({ [skipKey]: skipDetected.slice(0, 3) });
    }
  } else {
    skipDetSec.style.display = 'none';
    skipInpSec.style.display = 'block';
    // Pre-fill inputs from saved user values if exist
    if (userSaved && userSaved.length) {
      userSaved.slice(0, 3).forEach((s, i) => {
        const n = i + 1;
        const lbl = document.getElementById(`skip${n}Label`);
        const tgt = document.getElementById(`skip${n}Target`);
        if (lbl) lbl.value = s.label || '';
        if (tgt) tgt.value = s.target || '';
      });
    }
  }
}

async function detectU1(tab) {
  if (!isInjectable(tab)) return null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        cssHref: document.getElementById('u1Css')?.href || null,
        jsSrc:   document.getElementById('u1Js')?.src   || null,
        active:  typeof window.u1 !== 'undefined' && window.u1 !== null,
      }),
    });
    return results?.[0]?.result;
  } catch {
    return null;
  }
}

async function detectSkipLinks(tab) {
  if (!isInjectable(tab)) return [];
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const found = [];
        const add = (a) => {
          if (!a) return;
          if (found.some(x => x.el === a)) return;
          const label = (a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
          const target = a.getAttribute('href') || '';
          if (!label || !target.startsWith('#')) return;
          found.push({ el: a, label, target });
        };
        document.querySelectorAll(
          'a.skip-link, a.skip-to-content, a.screen-reader-text[href^="#"], a.visually-hidden[href^="#"]'
        ).forEach(add);
        Array.from(document.body?.children || []).slice(0, 6).forEach(child => {
          child.querySelectorAll && child.querySelectorAll('a[href^="#"]').forEach(a => {
            const txt = (a.textContent || a.getAttribute('aria-label') || '').toLowerCase();
            if (/skip|jump|to (main|nav|content|footer)/i.test(txt)) add(a);
          });
        });
        return found.slice(0, 5).map(f => ({ label: f.label, target: f.target }));
      },
    });
    return results?.[0]?.result || [];
  } catch {
    return [];
  }
}

function renderSkipDetectedList(items) {
  const ul = document.getElementById('skipDetectedList');
  ul.innerHTML = items.map(it => `
    <li>
      <span class="bullet">•</span>
      <span>"${escapeHtml(it.label)}"</span>
      <span class="arrow">→</span>
      <span class="target">${escapeHtml(it.target)}</span>
    </li>
  `).join('');
}

document.getElementById('injectBtn').addEventListener('click', async () => {
  const cssLink = document.getElementById('cssLink').value.trim();
  const jsLink  = document.getElementById('jsLink').value.trim();
  if (!cssLink || !jsLink) { alert('Please enter both CSS and JS links.'); return; }

  await chrome.storage.local.set({ cssLink, jsLink });
  const tab = await getTab();
  if (!isInjectable(tab)) { alert('Cannot inject on this page.'); return; }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (href) => {
      if (!document.getElementById('u1Css')) {
        const link = document.createElement('link');
        link.id = 'u1Css'; link.rel = 'stylesheet'; link.href = href;
        document.head.appendChild(link);
      }
    },
    args: [cssLink],
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (src) => {
      if (!document.getElementById('u1Js')) {
        const s = document.createElement('script');
        s.id = 'u1Js'; s.src = src; s.type = 'text/javascript';
        document.body.appendChild(s);
      }
    },
    args: [jsLink],
  });

  setTimeout(() => refreshSetupTab(tab), 2200);
});

document.getElementById('replaceU1Btn').addEventListener('click', () => {
  document.getElementById('u1Detected').style.display = 'none';
  document.getElementById('u1Inputs').style.display   = 'block';
});

document.getElementById('editSkipBtn').addEventListener('click', () => {
  document.getElementById('skipDetected').style.display = 'none';
  document.getElementById('skipInputs').style.display   = 'block';
});

document.getElementById('saveSkipBtn').addEventListener('click', async () => {
  const links = [];
  for (let i = 1; i <= 3; i++) {
    const label  = document.getElementById(`skip${i}Label`).value.trim();
    const target = document.getElementById(`skip${i}Target`).value.trim();
    if (label && target) links.push({ label, target });
  }
  const key = storageKey('skipLinks', currentHostname);
  await chrome.storage.local.set({ [key]: links });
  flashMessage(document.getElementById('skipSaved'));
  refreshConfigSkipList();
  updateConfigPreview();
});

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 2 — CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const $primaryColorPicker   = document.getElementById('colorPrimaryPicker');
const $primaryColorHex      = document.getElementById('colorPrimaryHex');
const $secondaryColorPicker = document.getElementById('colorSecondaryPicker');
const $secondaryColorHex    = document.getElementById('colorSecondaryHex');
const $doubleBorder         = document.getElementById('doubleBorder');
const $langSelect           = document.getElementById('langSelect');

function syncColorPair(picker, text) {
  picker.addEventListener('input', () => {
    text.value = picker.value.toUpperCase();
    saveConfig();
    updateConfigPreview();
  });
  text.addEventListener('input', () => {
    const v = text.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      picker.value = v;
      saveConfig();
      updateConfigPreview();
    }
  });
}
syncColorPair($primaryColorPicker, $primaryColorHex);
syncColorPair($secondaryColorPicker, $secondaryColorHex);

[$doubleBorder, $langSelect].forEach(el =>
  el.addEventListener('change', () => { saveConfig(); updateConfigPreview(); })
);
document.querySelectorAll('input[name="direction"]').forEach(r =>
  r.addEventListener('change', () => { saveConfig(); updateConfigPreview(); })
);

async function loadConfigForm() {
  const key = storageKey('config', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const cfg = stored[key];
  if (!cfg) { updateConfigPreview(); return; }

  if (cfg.visualFocus?.style) {
    const c1 = cfg.visualFocus.style.color || '#FFFFFF';
    const c2 = cfg.visualFocus.style.secondaryColor || '#000000';
    $primaryColorPicker.value   = c1; $primaryColorHex.value   = c1.toUpperCase();
    $secondaryColorPicker.value = c2; $secondaryColorHex.value = c2.toUpperCase();
    $doubleBorder.checked = !!cfg.visualFocus.style.doubleBorder;
  }
  if (cfg.language) $langSelect.value = cfg.language;
  if (cfg.direction) {
    document.querySelectorAll('input[name="direction"]').forEach(r => {
      r.checked = (r.value === cfg.direction);
    });
  }
}

async function refreshConfigSkipList() {
  const skipKey = storageKey('skipLinks', currentHostname);
  const stored = await chrome.storage.local.get([skipKey]);
  const links = stored[skipKey] || [];
  const ul = document.getElementById('configSkipList');
  if (!links.length) {
    ul.innerHTML = '<div class="empty-state">No skip links configured. Set them in Setup.</div>';
  } else {
    ul.innerHTML = '<ul class="detected-list">' + links.map(s => `
      <li>
        <span class="bullet">•</span>
        <span>"${escapeHtml(s.label)}"</span>
        <span class="arrow">→</span>
        <span class="target">${escapeHtml(s.target)}</span>
      </li>
    `).join('') + '</ul>';
  }
}

function buildConfigObject(includeSkipLinks = []) {
  return {
    visualFocus: {
      style: {
        color: $primaryColorHex.value.trim() || '#FFFFFF',
        secondaryColor: $secondaryColorHex.value.trim() || '#000000',
        doubleBorder: !!$doubleBorder.checked,
      },
    },
    skipLinks: includeSkipLinks,
    language: $langSelect.value || 'en',
    direction: document.querySelector('input[name="direction"]:checked')?.value || 'ltr',
  };
}

async function saveConfig() {
  const skipKey = storageKey('skipLinks', currentHostname);
  const stored = await chrome.storage.local.get([skipKey]);
  const cfg = buildConfigObject(stored[skipKey] || []);
  const key = storageKey('config', currentHostname);
  await chrome.storage.local.set({ [key]: cfg });
}

async function updateConfigPreview() {
  const skipKey = storageKey('skipLinks', currentHostname);
  const stored = await chrome.storage.local.get([skipKey]);
  const cfg = buildConfigObject(stored[skipKey] || []);
  const code = `window.u1 = window.u1 || {};\nwindow.u1.config = ${JSON.stringify(cfg, null, 2)};`;
  document.getElementById('configPreview').textContent = code;
}

document.getElementById('copyConfigBtn').addEventListener('click', () => {
  const text = document.getElementById('configPreview').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyConfigBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Code'; }, 1500);
  });
});

document.getElementById('runConfigBtn').addEventListener('click', async () => {
  const skipKey = storageKey('skipLinks', currentHostname);
  const stored = await chrome.storage.local.get([skipKey]);
  const cfg = buildConfigObject(stored[skipKey] || []);
  const status = document.getElementById('configRan');
  const result = await applyConfig(cfg);
  if (result.ok) {
    if (result.u1Missing) {
      showNotice(status, 'Config set, but U1 library is not loaded yet. Inject U1 in Setup first.', 'error', 4500);
    } else {
      showNotice(status, 'Config applied on page.', 'success');
    }
  } else {
    showNotice(status, 'Error: ' + result.err, 'error', 4500);
  }
});

document.getElementById('editSkipFromConfig').addEventListener('click', () => {
  document.querySelector('.tab-btn[data-tab="setup"]').click();
});

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 3 — PICKER
// ─────────────────────────────────────────────────────────────────────────────

const $pickBtn         = document.getElementById('pickBtn');
const $cancelPickBtn   = document.getElementById('cancelPickBtn');
const $pickerBanner    = document.getElementById('pickerBanner');
const $pickerResult    = document.getElementById('pickerResultArea');
const $selectorDisplay = document.getElementById('selectorDisplay');
const $componentType   = document.getElementById('componentType');
const $subSelSection   = document.getElementById('subSelectorsSection');
const $subSelArea      = document.getElementById('subSelectorsArea');
const $previewSection  = document.getElementById('previewSection');
const $templatePreview = document.getElementById('templatePreview');

// Currently built template (set by Generate, consumed by Apply / Add to Mapping)
let currentTemplate = null;

function setPickerBanner(text, type = 'info') {
  $pickerBanner.textContent = text;
  $pickerBanner.className = `picker-banner ${type}`;
  $pickerBanner.style.display = 'block';
}

function hidePickerBanner() { $pickerBanner.style.display = 'none'; }

function showPickerActive() {
  setPickerBanner('Picker active — click any element on the page.', 'info');
  $pickBtn.style.display       = 'none';
  $cancelPickBtn.style.display = 'inline-block';
}

function showPickerResult(selector, info) {
  $pickBtn.style.display       = 'inline-block';
  $cancelPickBtn.style.display = 'none';
  $pickerResult.style.display  = 'block';
  $selectorDisplay.textContent = selector;

  // Auto-detect type from element metadata
  const detected = detectComponentType(info);
  if (detected) {
    $componentType.value = detected;
    setPickerBanner(`Element captured. Detected type: ${detected} — adjust if needed.`, 'success');
    renderSubSelectorInputs(detected);
  } else {
    $componentType.value = '';
    setPickerBanner('Element captured. Choose a component type below.', 'success');
    $subSelSection.style.display = 'none';
  }
  $previewSection.style.display = 'none';
  currentTemplate = null;
}

async function loadPickerState() {
  const { pickedSelector, pickedInfo, pickerActive } = await chrome.storage.local.get(['pickedSelector', 'pickedInfo', 'pickerActive']);
  if (pickerActive) {
    showPickerActive();
  } else if (pickedSelector) {
    showPickerResult(pickedSelector, pickedInfo);
  }
}

// Direct message from content.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'elementPicked') {
    showPickerResult(msg.selector, msg.info);
  }
});

// Storage fallback
chrome.storage.onChanged.addListener((changes) => {
  if (changes.pickedSelector?.newValue) {
    showPickerResult(changes.pickedSelector.newValue, changes.pickedInfo?.newValue);
  }
});

$pickBtn.addEventListener('click', async () => {
  const tab = await getTab();
  if (!isInjectable(tab)) { alert('Cannot activate picker on this page.'); return; }
  await chrome.storage.local.set({ pickerActive: true, pickedSelector: null, pickedInfo: null });
  showPickerActive();
  try { await chrome.tabs.sendMessage(tab.id, { action: 'startPicker' }); } catch {}
});

$cancelPickBtn.addEventListener('click', async () => {
  const tab = await getTab();
  await chrome.storage.local.set({ pickerActive: false, pickedSelector: null, pickedInfo: null });
  try { await chrome.tabs.sendMessage(tab.id, { action: 'cancelPicker' }); } catch {}
  hidePickerBanner();
  $pickerResult.style.display = 'none';
  $subSelSection.style.display = 'none';
  $previewSection.style.display = 'none';
  $pickBtn.style.display       = 'inline-block';
  $cancelPickBtn.style.display = 'none';
  currentTemplate = null;
});

$componentType.addEventListener('change', () => {
  const type = $componentType.value;
  if (!type) {
    $subSelSection.style.display = 'none';
    $previewSection.style.display = 'none';
    return;
  }
  renderSubSelectorInputs(type);
});

function renderSubSelectorInputs(type) {
  const schema = COMPONENT_SCHEMAS[type];
  if (!schema) return;
  const primary = $selectorDisplay.textContent.trim();
  $subSelArea.innerHTML = '';

  // Primary auto-filled row (only shown when schema's selectors include a PRIMARY slot)
  let primaryKey = null;
  (function find(node, keypath) {
    for (const k of Object.keys(node)) {
      const kp = keypath ? `${keypath}.${k}` : k;
      if (node[k] === 'PRIMARY' && !primaryKey) primaryKey = kp;
      else if (typeof node[k] === 'object' && node[k] !== null) find(node[k], kp);
    }
  })(schema.selectors, '');

  if (primaryKey) {
    const row = document.createElement('div');
    row.className = 'sub-sel-row';
    row.innerHTML = `
      <div class="key">${escapeHtml(primaryKey)}</div>
      <input type="text" class="primary-input" value="${escapeHtml(primary)}" readonly>
      <span class="auto-tag">auto</span>
    `;
    $subSelArea.appendChild(row);
  }

  // Manual fields
  for (const f of schema.fields) {
    const row = document.createElement('div');
    row.className = 'sub-sel-row';
    row.innerHTML = `
      <div class="key">${escapeHtml(f)}</div>
      <input type="text" data-field="${escapeHtml(f)}" placeholder="">
      <span></span>
    `;
    $subSelArea.appendChild(row);
  }

  // Root fields
  if (schema.rootFields) {
    for (const [k, defaultVal] of Object.entries(schema.rootFields)) {
      if (typeof defaultVal === 'boolean') {
        const row = document.createElement('label');
        row.className = 'root-toggle';
        row.innerHTML = `
          <input type="checkbox" data-root="${escapeHtml(k)}" ${defaultVal ? 'checked' : ''}>
          <span><strong>${escapeHtml(k)}</strong> (root)</span>
        `;
        $subSelArea.appendChild(row);
      } else {
        const row = document.createElement('div');
        row.className = 'root-text';
        row.innerHTML = `
          <label>${escapeHtml(k)}</label>
          <input type="text" data-root="${escapeHtml(k)}" value="${escapeHtml(String(defaultVal || ''))}">
        `;
        $subSelArea.appendChild(row);
      }
    }
  }

  $subSelSection.style.display = 'block';
  $previewSection.style.display = 'none';
}

document.getElementById('generateBtn').addEventListener('click', () => {
  const type = $componentType.value;
  if (!type) return;
  const primary = $selectorDisplay.textContent.trim();
  if (!primary) return;

  const fieldValues = {};
  $subSelArea.querySelectorAll('input[type="text"][data-field]').forEach(inp => {
    fieldValues[inp.dataset.field] = inp.value.trim();
  });

  const rootValues = {};
  $subSelArea.querySelectorAll('[data-root]').forEach(inp => {
    if (inp.type === 'checkbox') rootValues[inp.dataset.root] = inp.checked;
    else rootValues[inp.dataset.root] = inp.value.trim();
  });

  currentTemplate = buildTemplate(type, primary, fieldValues, rootValues);
  if (!currentTemplate) return;
  $templatePreview.textContent = currentTemplate.code;
  $previewSection.style.display = 'block';
});

document.getElementById('copyTemplateBtn').addEventListener('click', () => {
  const text = $templatePreview.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyTemplateBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
});

document.getElementById('applyTemplateBtn').addEventListener('click', async () => {
  if (!currentTemplate) return;
  const status = document.getElementById('applyStatus');
  const result = await applyFix(currentTemplate.type, currentTemplate.primary, currentTemplate.config);
  if (result.ok) {
    showNotice(status, 'Applied on page.', 'success');
  } else if (result.u1Missing) {
    showNotice(status, 'U1 library is not loaded — inject U1 in Setup first.', 'error', 4500);
  } else {
    showNotice(status, 'Error: ' + result.err, 'error', 4500);
  }
});

document.getElementById('addMappingBtn').addEventListener('click', async () => {
  if (!currentTemplate) return;
  const key = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const list = stored[key] || [];
  const newKey = mappingKey(currentTemplate);
  const exists = list.some(m => mappingKey(m) === newKey);
  if (!exists) {
    list.push({
      type: currentTemplate.type,
      primary: currentTemplate.primary,
      config: currentTemplate.config,
      code: currentTemplate.code,
    });
    await chrome.storage.local.set({ [key]: list });
  }
  loadMappingsList();
  refreshExportInfo();
  const btn = document.getElementById('addMappingBtn');
  btn.textContent = 'Added ✓';
  setTimeout(() => { btn.textContent = 'Add to Mapping'; }, 1500);
});

document.getElementById('applyAllBtn').addEventListener('click', async () => {
  const key = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const list = stored[key] || [];
  const status = document.getElementById('applyAllStatus');
  if (list.length === 0) {
    showNotice(status, 'No mappings to apply.', 'error');
    return;
  }
  const result = await applyMappingsBatch(list);
  if (result.ok) {
    const msg = `Applied ${result.applied} mapping${result.applied !== 1 ? 's' : ''}` +
                (result.failed ? ` (${result.failed} failed)` : '') + '.';
    showNotice(status, msg, result.failed ? 'error' : 'success', 4000);
  } else if (result.u1Missing) {
    showNotice(status, 'U1 library is not loaded — inject U1 in Setup first.', 'error', 4500);
  } else {
    showNotice(status, 'Error: ' + result.err, 'error', 4500);
  }
});

async function loadMappingsList() {
  const key = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const list = stored[key] || [];
  const container = document.getElementById('mappingsList');
  const applyAllRow = document.getElementById('applyAllRow');

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">No mappings yet.</div>';
    if (applyAllRow) applyAllRow.style.display = 'none';
    return;
  }

  container.innerHTML = list.map((m, idx) => {
    const code = mappingToCode(m);
    const legacy = typeof m === 'string';
    return `
      <div class="mapping-item${legacy ? ' legacy' : ''}">
        <pre>${escapeHtml(code)}</pre>
        <div class="mapping-actions">
          <button class="apply-btn" data-idx="${idx}" title="${legacy ? 'Legacy string — cannot auto-apply, please re-add' : 'Apply on page'}"${legacy ? ' disabled' : ''}>▶</button>
          <button class="del-btn" data-idx="${idx}" title="Remove">✕</button>
        </div>
      </div>
    `;
  }).join('');

  if (applyAllRow) applyAllRow.style.display = 'flex';

  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.dataset.idx, 10);
      list.splice(i, 1);
      await chrome.storage.local.set({ [key]: list });
      loadMappingsList();
      refreshExportInfo();
    });
  });

  container.querySelectorAll('.apply-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.dataset.idx, 10);
      const m = list[i];
      if (!m || typeof m === 'string') return;
      const status = document.getElementById('applyAllStatus');
      const result = await applyFix(m.type, m.primary, m.config);
      if (result.ok) {
        showNotice(status, 'Applied on page.', 'success', 2200);
      } else if (result.u1Missing) {
        showNotice(status, 'U1 library is not loaded — inject U1 in Setup first.', 'error', 3500);
      } else {
        showNotice(status, 'Error: ' + result.err, 'error', 4000);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 4 — EXPORT
// ─────────────────────────────────────────────────────────────────────────────

async function refreshExportInfo() {
  const mKey   = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([mKey]);
  const count  = (stored[mKey] || []).length;
  document.getElementById('exportMappingsCount').textContent =
    `${count} mapping${count !== 1 ? 's' : ''}`;
}

document.getElementById('exportBtn').addEventListener('click', async () => {
  const { cssLink = '', jsLink = '' } = await chrome.storage.local.get(['cssLink', 'jsLink']);
  const skipKey = storageKey('skipLinks', currentHostname);
  const cfgKey  = storageKey('config', currentHostname);
  const mKey    = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([skipKey, cfgKey, mKey]);
  const skipLinks = stored[skipKey] || [];
  const config    = stored[cfgKey]  || buildConfigObject(skipLinks);
  // DocX expects an array of code strings — convert structured mappings.
  const mappings  = (stored[mKey] || []).map(mappingToCode).filter(Boolean);

  const statusEl = document.getElementById('exportStatus');

  if (!cssLink || !jsLink) {
    statusEl.className = 'notice error';
    statusEl.textContent = 'Warning: CSS/JS links are empty. Fill them in the Setup tab first.';
    flashMessage(statusEl, 4500);
    return;
  }

  try {
    generateAndDownloadDocx(currentHostname, cssLink, jsLink, mappings, skipLinks, config);
    statusEl.className = 'notice success';
    statusEl.textContent = 'Document generated and downloaded.';
    flashMessage(statusEl, 3000);
  } catch (err) {
    statusEl.className = 'notice error';
    statusEl.textContent = 'Error: ' + err.message;
    flashMessage(statusEl, 4500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────────────────────────────────────

init();

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

// Build u1.fix.<type>("PRIMARY", { ... }) source string from schema + values.
function buildTemplate(type, primary, fieldValues, rootValues) {
  const schema = COMPONENT_SCHEMAS[type];
  if (!schema) return '';

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

  // 4) serialize. Use a custom JSON serialization with double-quoted keys and
  //    2-space indentation, then prepend the call.
  const body = JSON.stringify(config, null, 2);
  return `window.u1?.fix.${type}(${JSON.stringify(primary)}, ${body});`;
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
  const tab = await getTab();
  if (!isInjectable(tab)) { alert('Cannot run on this page.'); return; }
  const code = document.getElementById('configPreview').textContent;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (c) => { (0, eval)(c); },
      args: [code],
    });
    flashMessage(document.getElementById('configRan'));
  } catch (err) {
    alert('Error: ' + err.message);
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

function showPickerResult(selector) {
  setPickerBanner('Element captured. Choose a component type.', 'success');
  $pickBtn.style.display       = 'inline-block';
  $cancelPickBtn.style.display = 'none';
  $pickerResult.style.display  = 'block';
  $selectorDisplay.textContent = selector;
  $componentType.value         = '';
  $subSelSection.style.display = 'none';
  $previewSection.style.display = 'none';
}

async function loadPickerState() {
  const { pickedSelector, pickerActive } = await chrome.storage.local.get(['pickedSelector', 'pickerActive']);
  if (pickerActive) {
    showPickerActive();
  } else if (pickedSelector) {
    showPickerResult(pickedSelector);
  }
}

// Direct message from content.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'elementPicked') {
    showPickerResult(msg.selector);
  }
});

// Storage fallback
chrome.storage.onChanged.addListener((changes) => {
  if (changes.pickedSelector?.newValue) {
    showPickerResult(changes.pickedSelector.newValue);
  }
});

$pickBtn.addEventListener('click', async () => {
  const tab = await getTab();
  if (!isInjectable(tab)) { alert('Cannot activate picker on this page.'); return; }
  await chrome.storage.local.set({ pickerActive: true, pickedSelector: null });
  showPickerActive();
  try { await chrome.tabs.sendMessage(tab.id, { action: 'startPicker' }); } catch {}
});

$cancelPickBtn.addEventListener('click', async () => {
  const tab = await getTab();
  await chrome.storage.local.set({ pickerActive: false, pickedSelector: null });
  try { await chrome.tabs.sendMessage(tab.id, { action: 'cancelPicker' }); } catch {}
  hidePickerBanner();
  $pickerResult.style.display = 'none';
  $subSelSection.style.display = 'none';
  $previewSection.style.display = 'none';
  $pickBtn.style.display       = 'inline-block';
  $cancelPickBtn.style.display = 'none';
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

  const code = buildTemplate(type, primary, fieldValues, rootValues);
  $templatePreview.textContent = code;
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

document.getElementById('addMappingBtn').addEventListener('click', async () => {
  const code = $templatePreview.textContent.trim();
  if (!code) return;
  const key = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const list = stored[key] || [];
  if (!list.includes(code)) {
    list.push(code);
    await chrome.storage.local.set({ [key]: list });
  }
  loadMappingsList();
  refreshExportInfo();
  const btn = document.getElementById('addMappingBtn');
  btn.textContent = 'Added ✓';
  setTimeout(() => { btn.textContent = 'Add to Mapping'; }, 1500);
});

async function loadMappingsList() {
  const key = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const list = stored[key] || [];
  const container = document.getElementById('mappingsList');

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">No mappings yet.</div>';
    return;
  }

  container.innerHTML = list.map((code, idx) => `
    <div class="mapping-item">
      <pre>${escapeHtml(code)}</pre>
      <button class="del-btn" data-idx="${idx}" title="Remove">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.dataset.idx, 10);
      list.splice(i, 1);
      await chrome.storage.local.set({ [key]: list });
      loadMappingsList();
      refreshExportInfo();
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
  const mappings  = stored[mKey]    || [];

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

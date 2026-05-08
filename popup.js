'use strict';

// ── Component templates ───────────────────────────────────────────────────────

const TEMPLATES = {
  button: (s) =>
`window.u1?.fix.button("${s}", {
  selectors: { element: "${s}" }
});`,

  link: (s) =>
`window.u1?.fix.link("${s}", {
  selectors: { element: "${s}" }
});`,

  menu: (s) =>
`window.u1?.fix.menu("${s}", {
  selectors: {
    menu: "${s}",
    submenus: "",
    items: "",
    triggers: "",
    horizontalMenu: "${s}",
  },
  menuDescription: ""
});`,

  accordion: (s) =>
`window.u1?.fix.accordion("${s}", {
  selectors: {
    headerSelector: "",
    contentSelector: "",
  }
});`,

  carousel: (s) =>
`window.u1?.fix.carousel("${s}", {
  selectors: {
    carouselContainer: "${s}",
    slide: "",
    prevButton: "",
    nextButton: "",
  }
});`,

  datepicker: (s) =>
`window.u1?.fix.datepicker("${s}", {
  selectors: {
    container: "${s}",
    trigger: "",
    year:  { label: "", prevButton: "", nextButton: "" },
    month: { label: "", prevButton: "", nextButton: "" },
    days:  { table: "", day: "", selected: "", disabled: "" },
  }
});`,

  dialog: (s) =>
`window.u1?.fix.dialog("${s}", {
  selectors: {
    dialog:      "${s}",
    trigger:     "",
    closeBtn:    "",
    heading:     "",
    textContent: "",
  },
  type: "modal"
});`,

  listbox: (s) =>
`window.u1?.fix.listbox("${s}", {
  selectors: {
    listbox: "${s}",
    trigger: "",
    options: "",
    label:   "",
  }
});`,

  combobox: (s) =>
`window.u1?.fix.combobox("${s}", {
  selectors: {
    combobox: "${s}",
    textbox:  "",
    options:  "",
    listbox:  "",
    label:    "",
  },
  isAutocompleteList: true
});`,

  checkbox: (s) =>
`window.u1?.fix.checkbox("${s}", {
  selectors: {
    element:        "${s}",
    checkedState:   "",
    uncheckedState: "",
  }
});`,

  radio: (s) =>
`window.u1?.fix.radio("${s}", {
  selectors: {
    radioGroup:     "${s}",
    radioButton:    "",
    checkedState:   "",
    uncheckedState: "",
  }
});`,

  tabs: (s) =>
`window.u1?.fix.tabs("${s}", {
  selectors: {
    tabList: "",
    tab:     "",
    panel:   "",
  }
});`,

  form: (s) =>
`window.u1?.fix.form("${s}", {
  selectors: {
    form:                  "${s}",
    formLabelAbsolute:     "",
    invalidField:          "",
    requiredField:         "",
    errorMessageAbsolute:  "",
  }
});`,

  table: (s) =>
`window.u1?.fix.table("${s}", {
  selectors: {
    table:        "${s}",
    row:          "",
    cell:         "",
    columnheader: "",
  }
});`,

  grid: (s) =>
`window.u1?.fix.grid("${s}", {
  selectors: {
    grid:         "${s}",
    row:          "",
    cell:         "",
    columnheader: "",
  }
});`,

  tooltip: (s) =>
`window.u1?.fix.tooltip("${s}", {
  selectors: {
    trigger: "",
    tooltip: "${s}",
  }
});`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function flashMessage(el, duration = 2000) {
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, duration);
}

// ── Tab switching ─────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Startup: load tab-aware data ──────────────────────────────────────────────

let currentHostname = 'unknown';

async function init() {
  const tab = await getTab();
  currentHostname = getHostname(tab);

  // Update hostname badges
  document.querySelectorAll('#mappingsHostname, #docsHostname, #exportHostname').forEach(el => {
    el.textContent = currentHostname;
  });

  // Setup: load saved links
  const { cssLink, jsLink } = await chrome.storage.local.get(['cssLink', 'jsLink']);
  if (cssLink) document.getElementById('cssLink').value = cssLink;
  if (jsLink)  document.getElementById('jsLink').value  = jsLink;

  // Check U1 status
  checkU1Status(tab);

  // Picker: check for a previously picked selector
  const { pickedSelector, pickerActive } = await chrome.storage.local.get(['pickedSelector', 'pickerActive']);
  if (pickerActive) {
    showPickerActive();
  } else if (pickedSelector) {
    showPickerResult(pickedSelector);
  }

  // Docs: load notes
  const notesKey = storageKey('notes', currentHostname);
  const stored = await chrome.storage.local.get([notesKey]);
  if (stored[notesKey]) document.getElementById('notesArea').value = stored[notesKey];

  // Picker: load mappings list
  loadMappingsList();

  // Export: mappings count
  updateExportInfo();
}

// ── SETUP TAB ─────────────────────────────────────────────────────────────────

async function checkU1Status(tab) {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  dot.className  = 'status-dot unknown';
  text.textContent = 'Checking…';

  if (!tab || !tab.id || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    dot.className  = 'status-dot inactive';
    text.textContent = 'Not Available';
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => typeof window.u1 !== 'undefined' && window.u1 !== null,
    });
    const active = results?.[0]?.result;
    dot.className    = active ? 'status-dot active'   : 'status-dot inactive';
    text.textContent = active ? 'U1 Active'           : 'Not Detected';
  } catch {
    dot.className    = 'status-dot inactive';
    text.textContent = 'Not Detected';
  }
}

document.getElementById('injectBtn').addEventListener('click', async () => {
  const cssLink = document.getElementById('cssLink').value.trim();
  const jsLink  = document.getElementById('jsLink').value.trim();

  if (!cssLink || !jsLink) {
    alert('Please enter both CSS and JS links.');
    return;
  }

  chrome.storage.local.set({ cssLink, jsLink });

  const tab = await getTab();

  if (!tab || tab.url.startsWith('chrome://')) {
    alert('Cannot inject on this page.');
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (href) => {
      if (!document.getElementById('u1Css')) {
        const link   = document.createElement('link');
        link.id      = 'u1Css';
        link.rel     = 'stylesheet';
        link.href    = href;
        document.head.appendChild(link);
      }
    },
    args: [cssLink],
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (src) => {
      if (!document.getElementById('u1Js')) {
        const script  = document.createElement('script');
        script.id     = 'u1Js';
        script.src    = src;
        script.type   = 'text/javascript';
        document.body.appendChild(script);
      }
    },
    args: [jsLink],
  });

  // Re-check status after JS loads
  setTimeout(() => checkU1Status(tab), 2500);
});

// ── CONFIG TAB ────────────────────────────────────────────────────────────────

document.getElementById('configCode').value =
`window.u1 = window.u1 || {};
window.u1.config = {
  visualFocus: {
    style: { color: 'white', secondaryColor: 'black', doubleBorder: true }
  }
};`;

document.getElementById('runConfigBtn').addEventListener('click', async () => {
  const tab  = await getTab();
  const code = document.getElementById('configCode').value;

  if (!tab || tab.url.startsWith('chrome://')) { alert('Cannot run on this page.'); return; }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (c) => { (0, eval)(c); },
      args: [code],
    });
    flashMessage(document.getElementById('configStatus'));
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

// ── PICKER TAB ────────────────────────────────────────────────────────────────

const pickBtn        = document.getElementById('pickBtn');
const cancelPickBtn  = document.getElementById('cancelPickBtn');
const pickerStatus   = document.getElementById('pickerStatus');
const pickerResult   = document.getElementById('pickerResult');
const selectorDisplay = document.getElementById('selectorDisplay');
const componentType  = document.getElementById('componentType');
const templateSection = document.getElementById('templateSection');
const templateCode   = document.getElementById('templateCode');

function showPickerActive() {
  pickerStatus.className    = 'picker-status info';
  pickerStatus.style.display = 'block';
  pickerStatus.textContent  = 'Picker is active — click an element on the page. The popup will close; reopen it to see the result.';
  pickBtn.style.display     = 'none';
  cancelPickBtn.style.display = 'inline-block';
}

function showPickerResult(selector) {
  pickerStatus.className    = 'picker-status success';
  pickerStatus.style.display = 'block';
  pickerStatus.textContent  = 'Element captured! Select a component type below.';
  pickerResult.style.display = 'block';
  selectorDisplay.textContent = selector;
  pickBtn.style.display     = 'inline-block';
  cancelPickBtn.style.display = 'none';
  componentType.value       = '';
  templateSection.style.display = 'none';
}

pickBtn.addEventListener('click', async () => {
  const tab = await getTab();
  if (!tab || tab.url.startsWith('chrome://')) { alert('Cannot activate picker on this page.'); return; }

  await chrome.storage.local.set({ pickerActive: true, pickedSelector: null });
  showPickerActive();

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'startPicker' });
  } catch {
    // Content script will receive via storage listener if messaging fails
  }
});

cancelPickBtn.addEventListener('click', async () => {
  const tab = await getTab();
  await chrome.storage.local.set({ pickerActive: false, pickedSelector: null });
  try { await chrome.tabs.sendMessage(tab.id, { action: 'cancelPicker' }); } catch {}
  pickerStatus.style.display  = 'none';
  pickerResult.style.display  = 'none';
  pickBtn.style.display       = 'inline-block';
  cancelPickBtn.style.display = 'none';
});

// When popup reopens, storage already has pickedSelector — handled in init().
// But also listen if picker fires while popup is still open:
chrome.storage.onChanged.addListener((changes) => {
  if (changes.pickedSelector && changes.pickedSelector.newValue) {
    showPickerResult(changes.pickedSelector.newValue);
  }
});

componentType.addEventListener('change', () => {
  const type     = componentType.value;
  const selector = selectorDisplay.textContent.trim();
  if (!type || !selector) { templateSection.style.display = 'none'; return; }

  const tplFn = TEMPLATES[type];
  if (!tplFn) return;

  templateCode.value            = tplFn(selector);
  templateSection.style.display = 'block';
});

document.getElementById('copyTemplateBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(templateCode.value).then(() => {
    document.getElementById('copyTemplateBtn').textContent = 'Copied!';
    setTimeout(() => { document.getElementById('copyTemplateBtn').textContent = 'Copy'; }, 1500);
  });
});

document.getElementById('addMappingBtn').addEventListener('click', async () => {
  const code = templateCode.value.trim();
  if (!code) return;

  const key = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const list = stored[key] || [];
  if (!list.includes(code)) {
    list.push(code);
    await chrome.storage.local.set({ [key]: list });
  }

  loadMappingsList();
  updateExportInfo();

  document.getElementById('addMappingBtn').textContent = 'Added!';
  setTimeout(() => { document.getElementById('addMappingBtn').textContent = 'Add to Mapping'; }, 1500);
});

async function loadMappingsList() {
  const key    = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const list   = stored[key] || [];
  const container = document.getElementById('mappingsList');

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">No mappings yet.</div>';
    return;
  }

  container.innerHTML = list.map((code, idx) => `
    <div class="mapping-item" data-idx="${idx}">
      <pre>${escapeHtml(code)}</pre>
      <button class="del-btn" data-idx="${idx}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.dataset.idx, 10);
      list.splice(i, 1);
      await chrome.storage.local.set({ [key]: list });
      loadMappingsList();
      updateExportInfo();
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── DOCS TAB ──────────────────────────────────────────────────────────────────

document.getElementById('saveNotesBtn').addEventListener('click', async () => {
  const key   = storageKey('notes', currentHostname);
  const notes = document.getElementById('notesArea').value;
  await chrome.storage.local.set({ [key]: notes });
  flashMessage(document.getElementById('notesSaved'));
});

// Auto-save on input
document.getElementById('notesArea').addEventListener('input', async () => {
  const key   = storageKey('notes', currentHostname);
  const notes = document.getElementById('notesArea').value;
  await chrome.storage.local.set({ [key]: notes });
});

// ── EXPORT TAB ────────────────────────────────────────────────────────────────

async function updateExportInfo() {
  const key    = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const count  = (stored[key] || []).length;
  document.getElementById('exportMappingsCount').textContent =
    `${count} mapping${count !== 1 ? 's' : ''} saved for this site.`;
}

document.getElementById('exportBtn').addEventListener('click', async () => {
  const { cssLink = '', jsLink = '' } = await chrome.storage.local.get(['cssLink', 'jsLink']);
  const mKey   = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([mKey]);
  const mappings = stored[mKey] || [];

  const statusEl = document.getElementById('exportStatus');

  if (!cssLink || !jsLink) {
    statusEl.style.color   = '#ef4444';
    statusEl.style.display = 'block';
    statusEl.textContent   = 'Warning: CSS/JS links are empty. Fill them in the Setup tab first.';
    setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
  }

  try {
    generateAndDownloadDocx(currentHostname, cssLink, jsLink, mappings);
    statusEl.style.color   = '#22c55e';
    statusEl.style.display = 'block';
    statusEl.textContent   = 'Document generated and downloaded.';
    setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
  } catch (err) {
    statusEl.style.color   = '#ef4444';
    statusEl.style.display = 'block';
    statusEl.textContent   = 'Error generating document: ' + err.message;
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

init();

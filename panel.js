'use strict';

// ── Manual Picker templates (type → selector → code string) ──────────────────

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
    form:                 "${s}",
    formLabelAbsolute:    "",
    invalidField:         "",
    requiredField:        "",
    errorMessageAbsolute: "",
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

// ── Scan heuristics (serializable — no functions) ─────────────────────────────

const HEURISTICS = [
  {
    type: 'menu',
    selectors: [
      '[role="menu"]', '[role="menubar"]',
      'nav#primary-navigation', 'nav.main-navigation', 'nav.site-navigation',
      '#primary-menu', '#main-menu', '#site-navigation', '#nav-menu',
      '.main-navigation', '.primary-navigation', '.ast-main-navigation',
      '.ocean-navigation', '.generate-navigation', '.elementor-nav-menu',
      '.et_pb_menu', '.fusion-menu', '.navbar-nav', '.nav-menu', '.menu', 'nav',
    ],
    subProbes: {
      submenus: ['.sub-menu', 'ul ul', '.dropdown-menu', '.children', '.submenu'],
      items:    ['.menu-item', 'li.menu-item', '.nav-item', 'li'],
      triggers: [
        '.menu-item-has-children > a', '.dropdown-toggle',
        '[aria-haspopup]', '.submenu-toggle', '.menu-link',
      ],
    },
  },
  {
    type: 'accordion',
    selectors: [
      '[role="tablist"]', '.accordion', '.accordion-container',
      '.elementor-accordion', '.elementor-toggle', '.ui-accordion',
      '.et_pb_accordion', '.vc_accordion', '.fusion-accordion', 'details',
    ],
    subProbes: {
      headerSelector: [
        '.accordion-button', '.accordion-header', 'summary',
        '.elementor-tab-title', '.ui-accordion-header',
        '[data-bs-toggle="collapse"]', '[data-toggle="collapse"]',
        '.accordion-title', '.accordion-trigger',
      ],
      contentSelector: [
        '.accordion-collapse', '.accordion-body',
        '.elementor-tab-content', '.ui-accordion-content',
        '.accordion-content', '.accordion-panel',
      ],
    },
  },
  {
    type: 'carousel',
    selectors: [
      '.carousel', '.slick-slider', '.swiper', '.swiper-container',
      '.owl-carousel', '.cycle-slideshow', '.flexslider',
      '.elementor-carousel', '.et_pb_slider', '[data-slick]', '[data-ride="carousel"]',
    ],
    subProbes: {
      slide:      ['.carousel-item', '.slick-slide', '.swiper-slide', '.owl-item', '.cycle-slide', '.elementor-slide'],
      prevButton: ['.carousel-control-prev', '.slick-prev', '.swiper-button-prev', '.owl-prev', '.cycle-prev', '.flex-prev'],
      nextButton: ['.carousel-control-next', '.slick-next', '.swiper-button-next', '.owl-next', '.cycle-next', '.flex-next'],
    },
  },
  {
    type: 'datepicker',
    selectors: [
      '.ui-datepicker', '.flatpickr-calendar', '.pikaday', '.air-datepicker',
      '.datepicker', '.date-picker', '[data-datepicker]',
    ],
    subProbes: {
      trigger:           ['input[type="date"]', '.datepicker-input', '.flatpickr-input', '.ui-datepicker-input'],
      'year.prevButton': ['.ui-datepicker-prev', '.flatpickr-prev-month', '.pika-prev'],
      'year.nextButton': ['.ui-datepicker-next', '.flatpickr-next-month', '.pika-next'],
      'days.table':      ['.ui-datepicker-calendar', '.flatpickr-days', '.pika-table', 'table'],
      'days.day':        ['.ui-state-default', '.flatpickr-day', '.pika-day', 'td'],
      'days.selected':   ['.ui-state-active', '.flatpickr-day.selected', '.is-selected'],
      'days.disabled':   ['.ui-state-disabled', '.flatpickr-day.disabled', '.is-disabled'],
    },
  },
  {
    type: 'dialog',
    selectors: [
      '[role="dialog"]', '[aria-modal="true"]',
      '.modal', '.dialog', '.popup', '.lightbox', '.modal-dialog',
      '.fancybox-container', '.mfp-content', '.remodal',
      '.elementor-popup-modal', '.et_pb_popup',
    ],
    subProbes: {
      trigger:     ['[data-bs-toggle="modal"]', '[data-toggle="modal"]', '[data-fancybox]', '.popup-trigger', '.modal-trigger'],
      closeBtn:    ['.btn-close', '.close', '[data-bs-dismiss="modal"]', '[data-dismiss="modal"]', '.modal-close', '.popup-close', '.mfp-close'],
      heading:     ['.modal-title', 'h1', 'h2', 'h3', '.popup-title'],
      textContent: ['.modal-body', '.popup-content', '.dialog-body'],
    },
  },
  {
    type: 'listbox',
    selectors: [
      '[role="listbox"]', '.select2-container',
      'select[size]', 'select[multiple]', '.chosen-container', '.selectize-control',
    ],
    subProbes: {
      trigger: ['.select2-selection', '.chosen-single', '[aria-haspopup="listbox"]', '.selectize-input'],
      options: ['[role="option"]', '.select2-results__option', '.chosen-result', '.selectize-option', 'li'],
      label:   ['label[for]', '.select-label', '.field-label'],
    },
  },
  {
    type: 'combobox',
    selectors: [
      '[role="combobox"]', '.select2', '.chosen-container',
      '.selectize-control', '.autocomplete-container', 'input[aria-autocomplete]',
    ],
    subProbes: {
      textbox: ['input[type="search"]', '.select2-search__field', '.chosen-search-input', '.selectize-input input'],
      options: ['[role="option"]', '.select2-results__option', '.chosen-result', 'li'],
      listbox: ['[role="listbox"]', '.select2-results__options', '.chosen-results', 'ul'],
      label:   ['label[for]', '.select-label'],
    },
  },
  {
    type: 'checkbox',
    selectors: [
      '[role="checkbox"]', '.custom-checkbox', '.mdc-checkbox', '.mdl-checkbox',
    ],
    subProbes: {
      checkedState:   ['.checked', '.is-checked', '[aria-checked="true"]', '.active'],
      uncheckedState: ['[aria-checked="false"]', '.unchecked'],
    },
  },
  {
    type: 'radio',
    selectors: [
      '[role="radiogroup"]', '[role="radio"]', '.radio-group',
      '.mdc-radio', '.mdl-radio',
    ],
    subProbes: {
      radioButton:    ['[role="radio"]', '.form-check-input[type="radio"]', '.radio-button', 'input[type="radio"]'],
      checkedState:   ['.checked', '[aria-checked="true"]', '.is-checked', '.active'],
      uncheckedState: ['[aria-checked="false"]', '.unchecked'],
    },
  },
  {
    type: 'tabs',
    selectors: [
      '[role="tablist"]', '.nav-tabs', '.ui-tabs', '.tabs', '.tab-list',
      '.elementor-tabs', '.et_pb_tabs', '.fusion-tabs', '.vc_tta-tabs', '[data-tabs]',
    ],
    subProbes: {
      tabList: ['[role="tablist"]', '.nav-tabs', '.ui-tabs-nav', '.tabs-list', '.elementor-tabs-wrapper'],
      tab:     ['[role="tab"]', '.nav-link', '.ui-tabs-anchor', '.tab-item', '.elementor-tab-title'],
      panel:   ['[role="tabpanel"]', '.tab-pane', '.ui-tabs-panel', '.elementor-tab-content'],
    },
  },
  {
    type: 'form',
    selectors: [
      'form:not([role="search"])', '.wpcf7-form', '.gform_wrapper form',
      '.ninja-forms-form', '.wpforms-form', '.frm-form', '.elementor-form',
    ],
    subProbes: {
      formLabelAbsolute:    ['.floating-label', '.form-floating label', 'label.floating'],
      invalidField:         ['.is-invalid', '.error', '[aria-invalid="true"]', '.has-error input'],
      requiredField:        ['[required]', '.required', '[aria-required="true"]'],
      errorMessageAbsolute: ['.invalid-feedback', '.error-message', '[role="alert"]', '.wpcf7-validation-errors'],
    },
  },
  {
    type: 'table',
    selectors: ['table', '.table', '.tablepress', '.tablesorter', '.dataTable', '.ninja-table'],
    subProbes: {
      row:          ['tr', '[role="row"]'],
      cell:         ['td', '[role="cell"]'],
      columnheader: ['th', '[role="columnheader"]', '[scope="col"]'],
    },
  },
  {
    type: 'grid',
    selectors: [
      '[role="grid"]', '.ag-root', '.ag-theme-alpine', '.ag-theme-material',
      '.dataTables_wrapper',
    ],
    subProbes: {
      row:          ['[role="row"]', '.ag-row', 'tr'],
      cell:         ['[role="gridcell"]', '.ag-cell', 'td'],
      columnheader: ['[role="columnheader"]', '.ag-header-cell', 'th'],
    },
  },
  {
    type: 'tooltip',
    selectors: [
      '[role="tooltip"]', '[data-tooltip]', '[data-tip]',
      '[data-bs-toggle="tooltip"]', '[data-toggle="tooltip"]',
    ],
    subProbes: {
      trigger: ['[data-tooltip]', '[data-bs-toggle="tooltip"]', '[data-toggle="tooltip"]', '[aria-describedby]', '.tooltip-trigger'],
      tooltip: ['[role="tooltip"]', '.tooltip-content', '.tooltip-inner', '[id^="tooltip-"]', '.tippy-box'],
    },
  },
  {
    type: 'button',
    selectors: [
      'div[role="button"]', 'span[role="button"]', 'a[role="button"]',
      '[aria-pressed]', '.mdc-button:not(button)',
    ],
    subProbes: {
      element: ['div[role="button"]', 'span[role="button"]', '.wp-block-button__link', '[aria-pressed]'],
    },
  },
  {
    type: 'link',
    selectors: [
      'a:has(svg):not([aria-label]):not([aria-labelledby])',
      'a:has(i):not([aria-label])',
      'a:has(img):not([aria-label]):not([aria-labelledby])',
    ],
    subProbes: {
      element: ['a:has(svg)', 'a:has(i.fa)', 'a:has(i.fas)', 'a:has(img)'],
    },
  },
];

// ── Scanner function — runs in page context via executeScript ─────────────────
// Must be self-contained (no closure references to outer scope)

function scannerFunc(heuristics) {
  const results = [];
  for (const h of heuristics) {
    let mainEl = null, mainSel = null;
    for (const sel of h.selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) { mainEl = el; mainSel = sel; break; }
      } catch {}
    }
    if (!mainEl) continue;

    let count = 0;
    try { count = document.querySelectorAll(mainSel).length; } catch {}

    const found = {};
    for (const [key, candidates] of Object.entries(h.subProbes || {})) {
      for (const cand of candidates) {
        try {
          if (mainEl.querySelector(cand) || document.querySelector(cand)) {
            found[key] = cand;
            break;
          }
        } catch {}
      }
    }
    results.push({ type: h.type, selector: mainSel, count, found });
  }
  return results;
}

// ── Smart template builder (uses detected sub-selectors) ──────────────────────

function buildSmartTemplate(type, selector, found) {
  const f = (key, def = '') => found[key] || def;
  const builders = {
    menu: () =>
`window.u1?.fix.menu("${selector}", {
  selectors: {
    menu: "${selector}",
    submenus: "${f('submenus')}",
    items: "${f('items')}",
    triggers: "${f('triggers')}",
    horizontalMenu: "${selector}",
  },
  menuDescription: ""
});`,
    accordion: () =>
`window.u1?.fix.accordion("${selector}", {
  selectors: {
    headerSelector: "${f('headerSelector')}",
    contentSelector: "${f('contentSelector')}",
  }
});`,
    carousel: () =>
`window.u1?.fix.carousel("${selector}", {
  selectors: {
    carouselContainer: "${selector}",
    slide: "${f('slide')}",
    prevButton: "${f('prevButton')}",
    nextButton: "${f('nextButton')}",
  }
});`,
    datepicker: () =>
`window.u1?.fix.datepicker("${selector}", {
  selectors: {
    container: "${selector}",
    trigger: "${f('trigger')}",
    year:  { label: "", prevButton: "${f('year.prevButton')}", nextButton: "${f('year.nextButton')}" },
    month: { label: "", prevButton: "", nextButton: "" },
    days:  { table: "${f('days.table')}", day: "${f('days.day')}", selected: "${f('days.selected')}", disabled: "${f('days.disabled')}" },
  }
});`,
    dialog: () =>
`window.u1?.fix.dialog("${selector}", {
  selectors: {
    dialog:      "${selector}",
    trigger:     "${f('trigger')}",
    closeBtn:    "${f('closeBtn')}",
    heading:     "${f('heading')}",
    textContent: "${f('textContent')}",
  },
  type: "modal"
});`,
    listbox: () =>
`window.u1?.fix.listbox("${selector}", {
  selectors: {
    listbox: "${selector}",
    trigger: "${f('trigger')}",
    options: "${f('options')}",
    label:   "${f('label')}",
  }
});`,
    combobox: () =>
`window.u1?.fix.combobox("${selector}", {
  selectors: {
    combobox: "${selector}",
    textbox:  "${f('textbox')}",
    options:  "${f('options')}",
    listbox:  "${f('listbox')}",
    label:    "${f('label')}",
  },
  isAutocompleteList: true
});`,
    checkbox: () =>
`window.u1?.fix.checkbox("${selector}", {
  selectors: {
    element:        "${selector}",
    checkedState:   "${f('checkedState')}",
    uncheckedState: "${f('uncheckedState')}",
  }
});`,
    radio: () =>
`window.u1?.fix.radio("${selector}", {
  selectors: {
    radioGroup:     "${selector}",
    radioButton:    "${f('radioButton')}",
    checkedState:   "${f('checkedState')}",
    uncheckedState: "${f('uncheckedState')}",
  }
});`,
    tabs: () =>
`window.u1?.fix.tabs("${selector}", {
  selectors: {
    tabList: "${f('tabList', selector)}",
    tab:     "${f('tab')}",
    panel:   "${f('panel')}",
  }
});`,
    form: () =>
`window.u1?.fix.form("${selector}", {
  selectors: {
    form:                 "${selector}",
    formLabelAbsolute:    "${f('formLabelAbsolute')}",
    invalidField:         "${f('invalidField')}",
    requiredField:        "${f('requiredField')}",
    errorMessageAbsolute: "${f('errorMessageAbsolute')}",
  }
});`,
    table: () =>
`window.u1?.fix.table("${selector}", {
  selectors: {
    table:        "${selector}",
    row:          "${f('row', 'tr')}",
    cell:         "${f('cell', 'td')}",
    columnheader: "${f('columnheader', 'th')}",
  }
});`,
    grid: () =>
`window.u1?.fix.grid("${selector}", {
  selectors: {
    grid:         "${selector}",
    row:          "${f('row')}",
    cell:         "${f('cell')}",
    columnheader: "${f('columnheader')}",
  }
});`,
    tooltip: () =>
`window.u1?.fix.tooltip("${selector}", {
  selectors: {
    trigger: "${f('trigger')}",
    tooltip: "${f('tooltip', selector)}",
  }
});`,
    button: () =>
`window.u1?.fix.button("${selector}", {
  selectors: { element: "${f('element', selector)}" }
});`,
    link: () =>
`window.u1?.fix.link("${selector}", {
  selectors: { element: "${f('element', selector)}" }
});`,
  };
  return builders[type] ? builders[type]() : (TEMPLATES[type] ? TEMPLATES[type](selector) : '');
}

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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

// ── Startup ───────────────────────────────────────────────────────────────────

let currentHostname = 'unknown';

async function init() {
  const tab = await getTab();
  currentHostname = getHostname(tab);

  document.querySelectorAll('#mappingsHostname, #docsHostname, #exportHostname').forEach(el => {
    el.textContent = currentHostname;
  });

  const { cssLink, jsLink } = await chrome.storage.local.get(['cssLink', 'jsLink']);
  if (cssLink) document.getElementById('cssLink').value = cssLink;
  if (jsLink)  document.getElementById('jsLink').value  = jsLink;

  checkU1Status(tab);

  // Picker: check for a previously stored selector (storage fallback)
  const { pickedSelector } = await chrome.storage.local.get(['pickedSelector']);
  if (pickedSelector) showPickerResult(pickedSelector);

  const notesKey = storageKey('notes', currentHostname);
  const stored = await chrome.storage.local.get([notesKey]);
  if (stored[notesKey]) document.getElementById('notesArea').value = stored[notesKey];

  loadMappingsList();
  updateExportInfo();
}

// ── SETUP TAB ─────────────────────────────────────────────────────────────────

async function checkU1Status(tab) {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  dot.className    = 'status-dot unknown';
  text.textContent = 'Checking…';

  if (!tab || !tab.id || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    dot.className    = 'status-dot inactive';
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
  if (!cssLink || !jsLink) { alert('Please enter both CSS and JS links.'); return; }

  chrome.storage.local.set({ cssLink, jsLink });
  const tab = await getTab();
  if (!tab || tab.url.startsWith('chrome://')) { alert('Cannot inject on this page.'); return; }

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
        const script = document.createElement('script');
        script.id = 'u1Js'; script.src = src; script.type = 'text/javascript';
        document.body.appendChild(script);
      }
    },
    args: [jsLink],
  });

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

// ── SCAN TAB ──────────────────────────────────────────────────────────────────

document.getElementById('scanBtn').addEventListener('click', async () => {
  const tab = await getTab();
  const spinner = document.getElementById('scanSpinner');
  const summary = document.getElementById('scanSummary');
  const resultsEl = document.getElementById('scanResults');

  if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    resultsEl.innerHTML = '<div class="empty-state">Cannot scan this page.</div>';
    return;
  }

  spinner.style.display = 'flex';
  summary.style.display = 'none';
  resultsEl.innerHTML = '';

  try {
    const execResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scannerFunc,
      args: [HEURISTICS],
    });

    const detected = execResults?.[0]?.result || [];
    spinner.style.display = 'none';

    if (detected.length === 0) {
      resultsEl.innerHTML = '<div class="empty-state">No recognizable components detected on this page.</div>';
      return;
    }

    summary.style.display = 'block';
    const total = detected.reduce((s, d) => s + d.count, 0);
    summary.textContent = `Found ${detected.length} component type${detected.length !== 1 ? 's' : ''} (${total} total instances)`;

    renderScanResults(detected);
  } catch (err) {
    spinner.style.display = 'none';
    resultsEl.innerHTML = `<div class="empty-state">Scan error: ${escapeHtml(err.message)}</div>`;
  }
});

function renderScanResults(detected) {
  const container = document.getElementById('scanResults');
  container.innerHTML = '';

  for (const item of detected) {
    const { type, selector, count, found } = item;
    const foundEntries = Object.entries(found).filter(([, v]) => v);

    const metaRows = foundEntries.map(([k, v]) =>
      `<div class="comp-meta-row">
         <span class="comp-meta-key">${escapeHtml(k)}:</span>
         <span class="comp-meta-val">${escapeHtml(v)}</span>
       </div>`
    ).join('');

    const card = document.createElement('div');
    card.className = 'scan-card';
    card.innerHTML = `
      <div class="scan-card-header">
        <span class="comp-badge">${escapeHtml(type)}</span>
        <span class="comp-count">${count} instance${count !== 1 ? 's' : ''}</span>
      </div>
      <div class="selector-box scan-selector">${escapeHtml(selector)}</div>
      ${foundEntries.length > 0 ? `<div class="comp-meta">${metaRows}</div>` : ''}
      <div class="scan-card-footer">
        <button class="btn-secondary btn-sm add-fix-btn">Add Fix</button>
      </div>
    `;

    card.querySelector('.add-fix-btn').addEventListener('click', async () => {
      const code = buildSmartTemplate(type, selector, found);
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

      const btn = card.querySelector('.add-fix-btn');
      btn.textContent = 'Added ✓';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = 'Add Fix'; btn.disabled = false; }, 2000);
    });

    container.appendChild(card);
  }
}

// ── PICKER TAB ────────────────────────────────────────────────────────────────

const pickBtn         = document.getElementById('pickBtn');
const cancelPickBtn   = document.getElementById('cancelPickBtn');
const pickerStatus    = document.getElementById('pickerStatus');
const pickerResult    = document.getElementById('pickerResult');
const selectorDisplay = document.getElementById('selectorDisplay');
const componentType   = document.getElementById('componentType');
const templateSection = document.getElementById('templateSection');
const templateCode    = document.getElementById('templateCode');

function showPickerActive() {
  pickerStatus.className     = 'picker-status info';
  pickerStatus.style.display = 'block';
  pickerStatus.textContent   = 'Picker active — click an element on the page.';
  pickBtn.style.display      = 'none';
  cancelPickBtn.style.display = 'inline-block';
}

function showPickerResult(selector) {
  pickerStatus.className     = 'picker-status success';
  pickerStatus.style.display = 'block';
  pickerStatus.textContent   = 'Element captured! Select a component type below.';
  pickerResult.style.display = 'block';
  selectorDisplay.textContent = selector;
  pickBtn.style.display       = 'inline-block';
  cancelPickBtn.style.display = 'none';
  componentType.value         = '';
  templateSection.style.display = 'none';
}

// Direct message from content.js (side panel stays open)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'elementPicked') {
    showPickerResult(msg.selector);
  }
});

// Storage fallback (in case message didn't arrive)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.pickedSelector?.newValue) {
    showPickerResult(changes.pickedSelector.newValue);
  }
});

pickBtn.addEventListener('click', async () => {
  const tab = await getTab();
  if (!tab || tab.url.startsWith('chrome://')) { alert('Cannot activate picker on this page.'); return; }

  await chrome.storage.local.set({ pickerActive: true, pickedSelector: null });
  showPickerActive();

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'startPicker' });
  } catch {}
});

cancelPickBtn.addEventListener('click', async () => {
  const tab = await getTab();
  await chrome.storage.local.set({ pickerActive: false, pickedSelector: null });
  try { await chrome.tabs.sendMessage(tab.id, { action: 'cancelPicker' }); } catch {}
  pickerStatus.style.display   = 'none';
  pickerResult.style.display   = 'none';
  pickBtn.style.display        = 'inline-block';
  cancelPickBtn.style.display  = 'none';
});

componentType.addEventListener('change', () => {
  const type     = componentType.value;
  const selector = selectorDisplay.textContent.trim();
  if (!type || !selector) { templateSection.style.display = 'none'; return; }
  const tplFn = TEMPLATES[type];
  if (!tplFn) return;
  templateCode.value             = tplFn(selector);
  templateSection.style.display  = 'block';
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
      list.splice(parseInt(btn.dataset.idx, 10), 1);
      await chrome.storage.local.set({ [key]: list });
      loadMappingsList();
      updateExportInfo();
    });
  });
}

// ── DOCS TAB ──────────────────────────────────────────────────────────────────

document.getElementById('saveNotesBtn').addEventListener('click', async () => {
  const key = storageKey('notes', currentHostname);
  await chrome.storage.local.set({ [key]: document.getElementById('notesArea').value });
  flashMessage(document.getElementById('notesSaved'));
});

document.getElementById('notesArea').addEventListener('input', async () => {
  const key = storageKey('notes', currentHostname);
  await chrome.storage.local.set({ [key]: document.getElementById('notesArea').value });
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
  const mKey     = storageKey('mappings', currentHostname);
  const stored   = await chrome.storage.local.get([mKey]);
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
    statusEl.textContent   = 'Error: ' + err.message;
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

init();

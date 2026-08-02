'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT SCHEMAS
//  Each schema describes how a fix.X(...) call is structured.
//  'PRIMARY' is replaced with the picked element's selector.
// ─────────────────────────────────────────────────────────────────────────────

// Each schema is a faithful transcription of the official User1st fix.* manual-
// selectors docs. Conventions:
//   selectors : the shape of the config.selectors object. 'PRIMARY' is replaced
//               by the main CSS selector the user types at the top.
//   fields    : dotted keys (besides the PRIMARY one) that get their own input.
//   rootFields: options that live on the config root (not inside selectors).
//               Booleans render as a checkbox, strings/numbers as a text input.
//   firstArgFrom: which selector becomes fix()'s FIRST argument (the "element to
//               wait for"). Chosen automatically per the docs; defaults to PRIMARY.
//   req       : selector keys the docs mark as required (shown with a * marker).
//   desc      : key -> the doc's description, shown as an on-focus hint bubble.
//               Covers the primary key, every field and every option.
const COMPONENT_SCHEMAS = {
  button: {
    selectors:{element:'PRIMARY', focusTo:''},
    fields:['focusTo'],
    req:['element'],
    desc:{
      element:'Selector of the button element that has the click event.',
      focusTo:'(Optional) Element to receive focus after clicking — good for scroll-to behavior.',
    },
  },

  link: {
    selectors:{element:'PRIMARY'},
    fields:[],
    req:['element'],
    desc:{ element:'Selector of the link element that has the click event.' },
  },

  menu: {
    selectors:{menu:'PRIMARY', items:'', submenus:'', triggers:'', horizontalMenu:'PRIMARY',
               openByMouseover:'', openByMouseenter:'', openByFocus:''},
    fields:['items','submenus','triggers','horizontalMenu',
            'openByMouseover','openByMouseenter','openByFocus'],
    // menubar:true makes every item a role="menuitem" (needed for horizontal
    // nav bars). Without it, only items matching `triggers` get role="button".
    rootFields:{menubar:true, menuDescription:''},
    req:['menu','items'],
    desc:{
      menu:'Selector of the main menu container.',
      items:'Selector of all items in the menu that are clickable.',
      submenus:'(Optional) Selector of all submenu containers.',
      triggers:'(Optional) Selector of all items that trigger a submenu opening.',
      horizontalMenu:'(Optional) Selector of horizontal menus. Usually the main menu.',
      openByMouseover:'(Optional) Selector of items triggered by the mouseover event.',
      openByMouseenter:'(Optional) Selector of items triggered by the mouseenter event.',
      openByFocus:'(Optional) Selector of items triggered by the focus event.',
      menubar:'Set true for an application menubar. Default false = navigation menu.',
      menuDescription:'Describe the menu (navigation menu, actions menu, etc.).',
    },
  },

  accordion: {
    selectors:{headerSelector:'PRIMARY', contentSelector:'', disabledElementsSelector:''},
    fields:['contentSelector','disabledElementsSelector'],
    rootFields:{headingLevel:2, collapsesOthers:false},
    req:['headerSelector','contentSelector'],
    desc:{
      headerSelector:'The header button of the accordion that has the click event.',
      contentSelector:'The content section of the accordion.',
      disabledElementsSelector:'(Optional) Selector of any disabled buttons, if they exist.',
      headingLevel:'Heading level of the header button. Default is 2.',
      collapsesOthers:'Set true if clicking one button collapses all others. Default false.',
    },
  },

  carousel: {
    selectors:{carouselContainer:'PRIMARY', slide:'', prevButton:'', nextButton:'',
               slidePickerButtons:'', absoluteCarouselContainerLabel:'', activeSlides:''},
    fields:['slide','prevButton','nextButton','slidePickerButtons',
            'absoluteCarouselContainerLabel','activeSlides'],
    firstArgFrom:'slide', // docs: fix.carousel('.slide', {...})
    req:['carouselContainer','slide'],
    desc:{
      carouselContainer:'Selector of the carousel container element.',
      slide:'Selector of the slide elements.',
      prevButton:'(Optional) Previous-slide button that has a click event.',
      nextButton:'(Optional) Next-slide button that has a click event.',
      slidePickerButtons:'(Optional) Slide-picker buttons with a click event, if they exist.',
      absoluteCarouselContainerLabel:'(Optional) Absolute selector of the label describing the carousel.',
      activeSlides:'(Optional) If multiple slides are in view at once, selector of all visible slides.',
    },
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
    rootFields:{isYearClickable:false, isMonthClickable:false, doubleDatepicker:false},
    firstArgFrom:'trigger',
    req:['container','trigger','days.table','days.day'],
    desc:{
      container:'Selector of the datepicker modal including all days and buttons.',
      trigger:'Selector of the datepicker trigger that has the click event.',
      'year.label':'Selector of the label of the currently shown year.',
      'year.prevButton':'(Optional) Selector of the previous-year button.',
      'year.nextButton':'(Optional) Selector of the next-year button.',
      'month.label':'Selector of the label of the currently shown month.',
      'month.prevButton':'(Optional) Selector of the previous-month button.',
      'month.nextButton':'(Optional) Selector of the next-month button.',
      'days.table':'Selector of the days container only.',
      'days.day':'Selector of all days.',
      'days.selected':'(Optional) Selector of the currently selected day.',
      'days.disabled':'(Optional) Selector of all disabled days (e.g. prev/next month days).',
      isYearClickable:'Set true if the year label is a clickable button. Default false.',
      isMonthClickable:'Set true if the month label is a clickable button. Default false.',
      doubleDatepicker:'Set true for a date-range (double) datepicker. Default false.',
    },
  },

  dialog: {
    // Primary = the dialog container (always required). trigger is optional.
    // Per U1 docs the first arg is "the element to wait for" — the TRIGGER when
    // there is one, else the dialog. buildTemplate picks that automatically.
    selectors:{dialog:'PRIMARY', trigger:'', closeBtn:'', heading:'', textContent:'', focusTo:''},
    fields:['trigger','closeBtn','heading','textContent','focusTo'],
    firstArgFrom:'trigger', // use trigger as fix() first arg when provided
    req:['dialog'],
    desc:{
      dialog:'Selector of the dialog element container that opens up.',
      trigger:'(Optional) Selector of your dialog trigger. Omit if there is no trigger.',
      closeBtn:'(Optional) Selector of the close button.',
      heading:'(Optional) Selector of the heading inside the dialog.',
      textContent:'(Optional) Selector of the text describing what is in the dialog.',
      focusTo:'(Optional) Element to focus back on instead of the original trigger.',
    },
  },

  listbox: {
    // Primary = the listbox container (gets role="listbox"). U1 waits for the
    // trigger, so it is the fix() first arg when provided.
    selectors:{listbox:'PRIMARY', trigger:'', options:'', label:''},
    fields:['trigger','options','label'],
    rootFields:{closeOnSelect:true},
    firstArgFrom:'trigger',
    req:['listbox','trigger','options'],
    desc:{
      listbox:'Selector of the options container (the list of options).',
      trigger:'Selector of the trigger element that contains the click event.',
      options:'Selector of all options in the list.',
      label:'(Optional) Selector of the label of the listbox, if it exists.',
      closeOnSelect:'Default true. Set false for a multi-selection listbox that stays open.',
    },
  },

  combobox: {
    selectors:{combobox:'PRIMARY', listbox:'', textbox:'', options:'', label:''},
    fields:['listbox','textbox','options','label'],
    req:['combobox','listbox','textbox','options'],
    desc:{
      combobox:'Selector of the input wrapper. If none, the selector of the input itself.',
      listbox:'Selector of the options container (the list of options).',
      textbox:'Selector of the input.',
      options:'Selector of all options in the list.',
      label:'(Optional) Selector of the label of the combobox, if it exists.',
    },
  },

  checkbox: {
    selectors:{element:'PRIMARY', checkedState:'', uncheckedState:'', disabled:'', exclude:'', label:''},
    fields:['checkedState','uncheckedState','disabled','exclude','label'],
    req:['element','checkedState','uncheckedState'],
    desc:{
      element:'Selector of the checkbox element containing the click event.',
      checkedState:'Selector of the checkbox when it is checked.',
      uncheckedState:'Selector of the checkbox when it is not checked.',
      disabled:'(Optional) Selector of the checkbox in a disabled state, if it exists.',
      exclude:'(Optional) Absolute selector of a hidden input so it will not receive focus.',
      label:'(Optional) Selector of the label element, if it is not inside the checkbox.',
    },
  },

  radio: {
    selectors:{radioGroup:'PRIMARY', radioButton:'', checkedState:'', uncheckedState:'', exclude:''},
    fields:['radioButton','checkedState','uncheckedState','exclude'],
    // uncheckedState is OPTIONAL: U1 still applies role=radiogroup/radio, the
    // roving tabindex and arrow-key navigation without it. Only the aria-checked
    // state handling is skipped — U1 guards it with
    //   checkedState && uncheckedState && toggleStateService.fix(...)
    req:['radioGroup','radioButton','checkedState'],
    desc:{
      radioGroup:'Selector of the container of the radio group.',
      radioButton:'Selector of each button in the radio group containing the click event.',
      checkedState:'Absolute selector of the checked state of the button.',
      uncheckedState:'(Optional) Absolute selector of the not-checked state. Without it the roles and keyboard navigation still work, but U1 will NOT maintain aria-checked — a screen reader won’t announce which option is selected.',
      exclude:'(Optional) Absolute selector of a hidden input so it will not receive focus.',
    },
  },

  tabs: {
    selectors:{tabList:'PRIMARY', tab:'', tabPanel:''},
    fields:['tab','tabPanel'],
    rootFields:{isVertical:false},
    req:['tab','tabList','tabPanel'],
    desc:{
      tabList:'Selector of the container of the tabs alone.',
      tab:'Selector of the tab elements with the click event.',
      tabPanel:'Selector of the panel(s) where the content changes.',
      isVertical:'Default is horizontal tabs. Set true if your tabs are vertical.',
    },
  },

  form: {
    selectors:{form:'PRIMARY', submitButton:'', inputField:'', invalidField:'',
               requiredField:'', errorMsg:'', successMsg:'', formLabelAbsolute:''},
    fields:['submitButton','inputField','invalidField','requiredField',
            'errorMsg','successMsg','formLabelAbsolute'],
    rootFields:{focusOnInvalidField:false},
    req:['form','submitButton','inputField','invalidField'],
    desc:{
      form:'Selector of the form element container.',
      submitButton:'Selector of the submit button that has the click event.',
      inputField:'Selector of all inputs inside the form. Can also be button, select, etc.',
      invalidField:'Selector of all invalid fields after the user clicks submit.',
      requiredField:'(Optional) Selector of required fields, if you have any.',
      errorMsg:'(Optional) Selector of the errors, if they exist.',
      successMsg:'(Optional) Selector of the success message after submission, if it exists.',
      formLabelAbsolute:'(Optional) Absolute selector of the form label/title (not relative).',
      focusOnInvalidField:'Set true to jump focus to the invalid field. Default false.',
    },
  },

  table: {
    selectors:{table:'PRIMARY', row:'', cell:'', columnheader:'', rowheader:''},
    fields:['row','cell','columnheader','rowheader'],
    req:['table','row','cell'],
    desc:{
      table:'Selector of the table container.',
      row:'Selector of all rows in the table.',
      cell:'Selector of all cells which are not header cells.',
      columnheader:'(Optional) Selector of column header cells (top horizontal row).',
      rowheader:'(Optional) Selector of row header cells (side vertical column).',
    },
  },

  grid: {
    selectors:{grid:'PRIMARY', row:'', cell:'', columnheader:'', rowheader:''},
    fields:['row','cell','columnheader','rowheader'],
    rootFields:{isColumnHeaderFocusable:false, isRowHeaderFocusable:false, isRowClickable:false},
    req:['grid','row','cell'],
    desc:{
      grid:'Selector of the grid container.',
      row:'Selector of all rows in the grid table.',
      cell:'Selector of all cells which are not header cells.',
      columnheader:'(Optional) Selector of column header cells (top horizontal row).',
      rowheader:'(Optional) Selector of row header cells (side vertical column).',
      isColumnHeaderFocusable:'Set true if the column header is clickable.',
      isRowHeaderFocusable:'Set true if the row header is clickable.',
      isRowClickable:'Set true if the entire row is clickable.',
    },
  },

  pagination: {
    selectors:{container:'PRIMARY', pageButtons:'', prevBtn:'', nextBtn:'',
               prevSkip:'', nextSkip:'', results:''},
    fields:['pageButtons','prevBtn','nextBtn','prevSkip','nextSkip','results'],
    rootFields:{skipAmount:0, autoFocus:false},
    firstArgFrom:'pageButtons', // docs: fix.pagination('.pagination-button', {...})
    req:['container','pageButtons'],
    desc:{
      container:'Selector of the pagination container including results.',
      pageButtons:'Selector of the numbered page buttons.',
      prevBtn:'(Optional) Selector of the previous-page button.',
      nextBtn:'(Optional) Selector of the next-page button.',
      prevSkip:'(Optional) Selector of the skip-previous-pages button. Set skipAmount too.',
      nextSkip:'(Optional) Selector of the skip-next-pages button. Set skipAmount too.',
      results:'(Optional) Selector of each shown result, if multiple results are shown.',
      skipAmount:'If you use prevSkip/nextSkip, the number of pages they skip.',
      autoFocus:'Set true to jump focus to the top of results after switching page. Default false.',
    },
  },

  loading: {
    selectors:{loadingBar:'PRIMARY'},
    fields:[],
    req:['loadingBar'],
    desc:{
      loadingBar:'Selector of the loading element. When it appears, the loading state is announced.',
    },
  },

  tooltip: {
    selectors:{tooltip:'PRIMARY', trigger:''},
    fields:['trigger'],
    req:['tooltip'],
    desc:{
      tooltip:'Selector of the tooltip content element.',
      trigger:'(Optional) Selector of the element that triggers the tooltip.',
    },
  },

  heading: {
    // fix.heading sets role="heading" + aria-level. `level` is required.
    selectors:{heading:'PRIMARY'},
    fields:[],
    rootFields:{level:2},
    req:['heading'],
    desc:{ heading:'Selector of the element to mark as a heading.' },
  },

  // Custom (NOT a u1.fix call) — give ambiguous buttons/links an accessible name
  // built from nearby context. E.g. every ".read-more" → aria-label
  // "Read more about " + the text of the card's heading.
  'aria-label': {
    custom:'ariaLabel',
    selectors:{target:'PRIMARY'},
    fields:[],
    rootFields:{middleText:'', headingSelector:''},
    selectorRoots:['headingSelector'], // option fields that are selectors → get 🔍
    req:['target'],
    labels:{
      target:'Button to describe (its current text is kept)',
      middleText:'Text to add in the middle',
      headingSelector:'Heading to add at the end (CSS selector)',
    },
    desc:{
      target:'The button or link to give a better name to. Its existing text is used as the start of the new label.',
      middleText:'Plain words inserted after the button’s text — e.g. " about " (include the spaces). Not a selector.',
      headingSelector:'CSS selector of the heading whose text is added at the end. Found in the same card as each button.',
    },
  },

  // Custom (NOT a u1.fix call) — the extension itself makes a grid of cells
  // keyboard-operable: role=gridcell + roving tabindex + Arrow/Home/End/Enter,
  // re-applied on DOM changes (survives Angular re-renders). For widgets U1
  // cannot reach (e.g. a portal-rendered datepicker).
  // Custom (NOT a u1.fix call) — make non-focusable elements keyboard-operable.
  // Unlike u1.fix.* (which only ever handles ONE element) this applies to EVERY
  // match, which is exactly what a pair of <a>-without-href links needs.
  'keyboard-clickable': {
    custom:'keyboardClickable',
    selectors:{target:'PRIMARY'},
    fields:[],
    rootFields:{role:'button', label:''},
    selectorRoots:[],
    req:['target'],
    labels:{
      target:'Element(s) to make keyboard-operable — ALL matches are handled',
      role:'Announce as: button or link',
      label:'Accessible name (optional — leave empty to keep the text)',
    },
    desc:{
      target:'Every element matching this becomes focusable (Tab) and activates on Enter (plus Space for buttons). Native <button>/<a href> are skipped — they already work.',
      role:'“button” for something that performs an action; “link” for something that navigates. Buttons also activate on Space, links on Enter only (ARIA spec).',
      label:'Sets aria-label on each match. Usually leave empty so each element keeps its own visible text as its name.',
    },
  },

  'keyboard-grid': {
    custom:'keyboardGrid',
    selectors:{container:'PRIMARY', trigger:'', day:'', selected:'', disabled:'', activate:'',
               monthLabel:'', monthPrev:'', monthNext:'', yearLabel:'', yearPrev:'', yearNext:'', controls:''},
    fields:['trigger','day','activate','selected','disabled',
            'monthLabel','monthPrev','monthNext','yearLabel','yearPrev','yearNext','controls'],
    rootFields:{columns:0, direction:'auto'},
    selectorRoots:[], // fields already get the 🔍 tester; columns/direction aren't selectors
    req:['container','day'],
    labels:{
      trigger:'① The input that OPENS the calendar',
      day:'② Each day box — arrows move between these',
      activate:'③ What ENTER clicks inside a day (empty = the day itself)',
      selected:'The already-chosen day (announced “selected”)',
      disabled:'Greyed-out days (arrows skip them)',
      monthLabel:'Month name text (read aloud when it changes)',
      monthPrev:'Button: previous month',
      monthNext:'Button: next month',
      yearLabel:'Year text (read aloud when it changes)',
      yearPrev:'Button: previous year',
      yearNext:'Button: next year',
      controls:'Other buttons to make keyboard-usable (tabs, Confirm)',
      columns:'Days per row (0 = auto, from the table rows)',
      direction:'Arrow direction: auto / ltr / rtl',
    },
    desc:{
      container:'The calendar wrapper that holds all the days + buttons.',
      trigger:'(Optional) The input that opens the calendar. Gets aria-haspopup + aria-expanded (announced as a date picker to screen readers).',
      day:'Every day cell to navigate between — e.g. .search-calendar__body>tr>td. Each gets role="gridcell", an aria-label with its date, and roving tabindex.',
      selected:'(Optional) The chosen day — gets aria-selected="true" so a screen reader announces "selected".',
      disabled:'(Optional) Greyed-out days — get aria-disabled="true" and are skipped by arrow keys / Tab.',
      activate:'(Optional) The element inside a day that has the click handler, fired on Enter/Space — e.g. search-ui-calendar-cell. Empty = click the day itself.',
      monthLabel:'(Optional) The month-name element. Wrapped in an aria-live region so month changes are announced.',
      monthPrev:'(Optional) Previous-month button → keyboard-operable + aria-label "Previous month".',
      monthNext:'(Optional) Next-month button → aria-label "Next month".',
      yearLabel:'(Optional) The year element (announced on change).',
      yearPrev:'(Optional) Previous-year button → aria-label "Previous year".',
      yearNext:'(Optional) Next-year button → aria-label "Next year".',
      controls:'(Optional) One selector for any OTHER controls (departure/return tabs, confirm, ±days). Comma-separate several. Each becomes focusable + Enter/Space activates.',
      columns:'(Optional) For non-table grids, cells per row so ↑/↓ move by a row. 0 = auto (uses <tr> rows for tables).',
      direction:'auto = detect the grid’s text direction and make → / ← follow what the user sees. Force ltr or rtl if auto guesses wrong.',
    },
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

function getDeep(obj, dottedKey) {
  return dottedKey.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

// Only ever emit a screenshot into an <img src> when it is a genuine data:image
// URL — never an attacker-controllable string that could break out of the
// attribute or beacon to an external host. Returns '' for anything else.
function safeImg(src) { return (typeof src === 'string' && /^data:image\//i.test(src)) ? src : ''; }

// A CSS/JS link that will be injected into a page must be a real http(s) URL —
// reject javascript:/data:/blob: which would be code execution.
function isSafeHttpUrl(u) {
  try { const p = new URL(String(u).trim()); return p.protocol === 'http:' || p.protocol === 'https:'; }
  catch { return false; }
}

// ── Import backup sanitiser (SECURITY) ──────────────────────────────────────
// An imported backup is UNTRUSTED input written straight into chrome.storage,
// from where values are later injected into pages (manualInject scripts) or
// rendered into reports. Allow-list keys by prefix and schema-check each value;
// silently drop anything unrecognised or unsafe.
const IMPORT_KEY_RE = /^(mappings|config|skipLinks|autoApply|platform|manualInject)_.+/;
const SAFE_URL = (v) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());
const SAFE_IMG = (v) => v == null || v === '' || (typeof v === 'string' && /^data:image\//i.test(v));
const VALID_MAPPING_TYPES = new Set([
  'button','link','menu','accordion','carousel','datepicker','dialog','listbox','combobox',
  'checkbox','radio','tabs','form','table','grid','pagination','loading','tooltip','heading',
  'aria-label','keyboard-grid','keyboard-clickable',
]);

function sanitizeImport(raw) {
  const data = {};
  let dropped = 0;
  for (const [key, val] of Object.entries(raw)) {
    // Only known key shapes; never transient/private keys (e.g. __closeOutReportHtml, __u1helper).
    if (key.startsWith('__') || !IMPORT_KEY_RE.test(key)) { dropped++; continue; }

    if (key.startsWith('manualInject_')) {
      // The dangerous one: these become <script src>/<link href> on every page load.
      if (!val || typeof val !== 'object' || !SAFE_URL(val.jsLink) || !SAFE_URL(val.cssLink)) { dropped++; continue; }
      data[key] = { jsLink: String(val.jsLink).trim(), cssLink: String(val.cssLink).trim() };
      continue;
    }
    if (key.startsWith('mappings_')) {
      if (!Array.isArray(val)) { dropped++; continue; }
      const clean = val.filter(m =>
        m && typeof m === 'object' && VALID_MAPPING_TYPES.has(m.type) && SAFE_IMG(m.screenshot));
      // Drop any stored `code` — it is regenerated from config at export/apply time.
      // Drop a malformed `id` too (must be "m-<alnum>"); a valid one is backfilled
      // on next render, so a hostile id string never reaches the export/report.
      data[key] = clean.map(m => {
        const c = { ...m };
        delete c.code;
        if (c.id != null && !/^m-[A-Za-z0-9]+$/.test(String(c.id))) delete c.id;
        return c;
      });
      if (clean.length !== val.length) dropped += (val.length - clean.length);
      continue;
    }
    if (key.startsWith('config_')) {
      if (val && typeof val === 'object' && !Array.isArray(val)) data[key] = val; else dropped++;
      continue;
    }
    if (key.startsWith('skipLinks_')) {
      if (Array.isArray(val)) data[key] = val; else dropped++;
      continue;
    }
    if (key.startsWith('autoApply_')) { data[key] = !!val; continue; }
    if (key.startsWith('platform_')) {
      data[key] = (typeof val === 'string') ? val.slice(0, 40) : String(val || '').slice(0, 40);
      continue;
    }
    dropped++;
  }
  return { data, dropped };
}

// U1 validates selectors with a strict regex: compound simple-selectors joined
// only by > + ~ combinators (NO spaces, NO descendant combinator), plus comma
// groups. A selector like ".mainNav > li" (with spaces) is REJECTED and the fix
// throws. We normalize away combinator spaces and can flag truly invalid ones.
const U1_SELECTOR_RE = /^([\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\])([>+~]?([\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\]))*(,([\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\])([>+~]?([\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\]))*)*$/;

function normalizeU1Selector(s) {
  return String(s == null ? '' : s).trim().replace(/\s*([>+~,])\s*/g, '$1');
}

function isU1ValidSelector(s) {
  const n = normalizeU1Selector(s);
  return n === '' || U1_SELECTOR_RE.test(n);
}

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
// Custom "aria-label" mapping — a plain script (not a u1.fix call). New label =
// the button's own text + middle text + the nearby heading's text.
function buildAriaLabelCode(target, middleText, headingSel) {
  const headBlock = headingSel
    ? `  var h = null, node = el;
  while (node && node !== document.body) { h = node.querySelector(${JSON.stringify(headingSel)}); if (h) break; node = node.parentElement; }
  if (!h) h = document.querySelector(${JSON.stringify(headingSel)});
  var headingText = h ? (h.textContent || '').trim().replace(/\\s+/g, ' ') : '';
`
    : `  var headingText = '';
`;
  return `document.querySelectorAll(${JSON.stringify(target)}).forEach(function (el) {
  var ownText = (el.textContent || '').trim().replace(/\\s+/g, ' ');
${headBlock}  var parts = [ownText, ${JSON.stringify(middleText.trim())}, headingText].filter(Boolean);
  el.setAttribute('aria-label', parts.join(' '));
});`;
}

function buildTemplate(type, primary, fieldValues, rootValues) {
  const schema = COMPONENT_SCHEMAS[type];
  if (!schema) return null;

  // Custom mappings (e.g. aria-label) build a script instead of a u1.fix call.
  if (schema.custom === 'ariaLabel') {
    const target = primary.trim();
    const middleText = (rootValues && rootValues.middleText) || '';
    const headingSelector = (rootValues && rootValues.headingSelector) || '';
    const config = { middleText, headingSelector };
    const code = buildAriaLabelCode(target, middleText, headingSelector);
    return { type, primary: target, firstArg: target, config, code, custom: 'ariaLabel' };
  }

  // Custom: make elements keyboard-operable (no U1).
  if (schema.custom === 'keyboardClickable') {
    const target = primary.trim();
    const role = ((rootValues && rootValues.role) || 'button').toLowerCase() === 'link' ? 'link' : 'button';
    const label = (rootValues && rootValues.label) || '';
    const config = { selectors: { target }, role, label };
    const code = `/* Make every match keyboard-operable (role="${role}" + tabindex + Enter${role === 'button' ? '/Space' : ''}).\n` +
      `   Standalone: needs neither U1 nor the extension. Engine is included in the export. */\n` +
      `window.__u1MakeClickable(${JSON.stringify({ selector: target, role, label })});`;
    return { type, primary: target, firstArg: target, config, code, custom: 'keyboardClickable' };
  }

  // Custom: extension-provided keyboard grid navigation (no U1).
  if (schema.custom === 'keyboardGrid') {
    const container = primary.trim();
    const g = (k) => (fieldValues[k] || '').trim();
    const selectors = {
      container, trigger: g('trigger'), day: g('day'), selected: g('selected'),
      disabled: g('disabled'), activate: g('activate'),
      monthLabel: g('monthLabel'), monthPrev: g('monthPrev'), monthNext: g('monthNext'),
      yearLabel: g('yearLabel'), yearPrev: g('yearPrev'), yearNext: g('yearNext'),
      controls: g('controls'),
    };
    const columns = parseInt(rootValues && rootValues.columns, 10) || 0;
    const direction = (rootValues && rootValues.direction) || 'auto';
    const config = { selectors, columns, direction };
    const code = buildKeyboardGridCode(selectors, columns, direction);
    return { type, primary: container, firstArg: container, config, code, custom: 'keyboardGrid' };
  }

  // Normalize to U1's accepted selector form (strip spaces around > + ~ ,).
  primary = normalizeU1Selector(primary);

  // 1) selectors object with PRIMARY substituted
  const selectors = deepClone(schema.selectors);
  (function substitute(node) {
    for (const k of Object.keys(node)) {
      if (node[k] === 'PRIMARY') node[k] = primary;
      else if (typeof node[k] === 'object' && node[k] !== null) substitute(node[k]);
    }
  })(selectors);

  // 2) overlay user-provided field values (normalized)
  for (const f of schema.fields) {
    const v = fieldValues[f];
    if (typeof v === 'string') setDeep(selectors, f, normalizeU1Selector(v));
  }

  // Drop empty selectors — U1 validates every value and rejects '' (the fix throws).
  (function stripEmpty(o) {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v === '' || v == null) delete o[k];
      else if (typeof v === 'object') { stripEmpty(v); if (!Object.keys(v).length) delete o[k]; }
    }
  })(selectors);

  // 3) root config object
  //
  // Root options get the same empty-string treatment as the selectors above:
  // U1 validates every value it is handed and rejects '', so shipping an
  // untouched `menuDescription: ""` is enough to make the whole fix do nothing.
  // Booleans and numbers are kept as-is — only blank strings are dropped.
  const config = { selectors };
  if (schema.rootFields) {
    for (const [k, defaultVal] of Object.entries(schema.rootFields)) {
      const v = (rootValues && k in rootValues) ? rootValues[k] : defaultVal;
      if (typeof v === 'string' && v.trim() === '') continue;
      config[k] = v;
    }
  }

  // Some components (dialog) pass a different element as the fix() first arg —
  // e.g. the trigger, per U1 docs — while `primary` stays the main selector for
  // the UI / mapping identity / edit round-trip.
  const firstArg = (schema.firstArgFrom && typeof selectors[schema.firstArgFrom] === 'string'
                    && selectors[schema.firstArgFrom])
                   ? selectors[schema.firstArgFrom] : primary;

  const code = `window.u1?.fix.${type}(${JSON.stringify(firstArg)}, ${formatJsObject(config)});`;
  return { type, primary, firstArg, config, code };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function getHostname(tab) {
  try { return (new URL(tab.url).hostname || 'unknown').replace(/^www\./i, ''); }
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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;'); // also safe inside "…" / '…' attributes
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
      world: 'MAIN', // MUST be MAIN — this reads/writes the page's real window.u1
      func: (cfg) => {
        // 1) Attach synthetic ids for skip links that were mapped from CSS selectors
        if (Array.isArray(cfg.skipLinks)) {
          cfg.skipLinks.forEach(sl => {
            if (sl.syntheticId && sl.selector) {
              try {
                const el = document.querySelector(sl.selector);
                if (el && !el.id) el.id = sl.syntheticId;
              } catch {}
            }
          });
        }

        // 2) Resolve the U1 global — accept object OR function, try common names
        const u1Raw = window.u1 !== undefined ? window.u1
                    : window.U1 !== undefined ? window.U1
                    : window.user1st;
        const hasU1 = u1Raw !== undefined && u1Raw !== null;
        // When u1 is a function we can't dot-assign config onto it directly;
        // write to window.u1 namespace object instead and try hooks on the raw value.
        const u1AsObj = (typeof u1Raw === 'object' && u1Raw !== null) ? u1Raw : null;

        if (!hasU1) {
          // U1 global not found yet — pre-set config so U1 reads it on init
          window.u1 = { config: cfg };
          return { ok: true, hasU1: false, calledHook: null };
        }

        // 3) Merge config (preserve any existing values U1 set on itself)
        if (u1AsObj) {
          u1AsObj.config = Object.assign({}, u1AsObj.config || {}, cfg);
        } else {
          window.u1 = window.u1 || {};
          window.u1.config = Object.assign({}, window.u1.config || {}, cfg);
        }
        const u1 = u1AsObj || window.u1;

        // 4) Try known refresh entry-points
        const hooks = ['applyConfig', 'refresh', 'init', 'run', 'start'];
        for (const name of hooks) {
          if (typeof u1[name] === 'function') {
            try {
              u1[name](cfg);
              return { ok: true, hasU1: true, calledHook: name };
            } catch (e) {
              return { ok: false, hasU1: true, calledHook: name, err: String(e && e.message ? e.message : e) };
            }
          }
        }

        // 5) No live hook — signal caller to use background reload
        try { window.dispatchEvent(new CustomEvent('u1:configchanged', { detail: cfg })); } catch {}
        return { ok: true, hasU1: true, calledHook: null, noRefreshHook: true };
      },
      args: [config],
    });
    return results?.[0]?.result || { ok: false, err: 'No result' };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}

function resolveU1() {
  const raw = window.u1 !== undefined ? window.u1
            : window.U1 !== undefined ? window.U1
            : window.user1st;
  if (raw == null) return null;
  // U1 may expose itself as a function with fix/config properties
  if (typeof raw === 'object' || typeof raw === 'function') return raw;
  return null;
}

// Applies a custom aria-label mapping: sets each target's aria-label from
// nearby context text. Runs in the page (default world — plain DOM access).
async function applyAriaLabel(target, config) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { ok: false, err: 'Cannot run on this page.' };
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (target, middleText, headingSel) => {
        let els;
        try { els = document.querySelectorAll(target); }
        catch (e) { return { ok: false, err: 'Invalid target selector: ' + e.message }; }
        let count = 0;
        els.forEach(el => {
          const ownText = (el.textContent || '').trim().replace(/\s+/g, ' ');
          let headingText = '';
          if (headingSel) {
            let h = null, node = el;
            while (node && node !== document.body) {
              try { h = node.querySelector(headingSel); } catch { h = null; }
              if (h) break;
              node = node.parentElement;
            }
            if (!h) { try { h = document.querySelector(headingSel); } catch {} }
            headingText = h ? (h.textContent || '').trim().replace(/\s+/g, ' ') : '';
          }
          const parts = [ownText, (middleText || '').trim(), headingText].filter(Boolean);
          el.setAttribute('aria-label', parts.join(' '));
          count++;
        });
        return { ok: true, count };
      },
      args: [target, config.middleText || '', config.headingSelector || ''],
    });
    return res?.[0]?.result || { ok: false, err: 'No result' };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}

// Routes a mapping/template to the right apply path (u1.fix vs custom script).
async function applyOne(type, primary, config, custom) {
  if (custom === 'ariaLabel') return applyAriaLabel(primary, config);
  if (custom === 'keyboardGrid') return applyKeyboardGrid(primary, config);
  if (custom === 'keyboardClickable') return applyKeyboardClickable(primary, config);
  return applyFix(type, primary, config);
}

// A readable preview of what the keyboard-grid datepicker mapping does.
// The RUNNABLE install call for a keyboard-grid mapping — identical to what
// mappingToCode and the deployable export emit, so the single "Copy" of a
// template gives code that actually runs (the engine is inlined by the export).
function buildKeyboardGridCode(s, columns, direction) {
  const config = { selectors: s, columns, direction };
  return `/* Accessible grid/datepicker — full ARIA + keyboard. Needs the grid engine\n` +
         `   (included at the top of the exported bundle). */\n` +
         `window.__u1InstallGridFromMapping(${JSON.stringify(s.container || '')}, ${formatJsObject(config)});`;
}

// Installs framework-independent grid keyboard navigation on the page. Self-
// contained: roving tabindex + Arrow/Home/End/Enter, re-applied via a
// MutationObserver so it survives Angular/React re-renders.
// Makes every match of a selector keyboard-operable (role + tabindex + Enter/
// Space). Uses the same shared engine file, so it is identical to what ships in
// the exported bundle.
async function applyKeyboardClickable(target, config) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { ok: false, err: 'Cannot run on this page.' };
  const opts = {
    selector: (config && config.selectors && config.selectors.target) || target,
    role: (config && config.role) || 'button',
    label: (config && config.label) || '',
  };
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['grid-nav.js'] });
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (a) => (window.__u1MakeClickable ? window.__u1MakeClickable(a) : { ok: false, err: 'grid-nav.js not loaded' }),
      args: [opts],
    });
    return res?.[0]?.result || { ok: false, err: 'No result' };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}

// Installs a framework-independent, screen-reader-accessible datepicker on the
// page (no U1): grid roles + aria labels/states + full keyboard, re-applied via
// observers so it survives Angular/React re-renders and every re-open.
async function applyKeyboardGrid(container, config) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { ok: false, err: 'Cannot run on this page.' };
  const s = (config && config.selectors) || {};
  const day = s.day || s.cell || '';
  // Guard against a common mis-fill: selected/disabled/activate accidentally set
  // to the SAME selector as `day` — that would mark EVERY day disabled/selected
  // and break Enter + navigation. Treat those as empty.
  const notDay = (v) => (v && v !== day) ? v : '';
  // Strip the day selector out of `controls` if it leaked in (all days becoming buttons).
  const cleanControls = (s.controls || '').split(',').map(x => x.trim()).filter(x => x && x !== day).join(',');
  const opts = {
    container,
    trigger: s.trigger || '', day, selected: notDay(s.selected), disabled: notDay(s.disabled),
    activate: notDay(s.activate),
    monthLabel: s.monthLabel || '', monthPrev: s.monthPrev || '', monthNext: s.monthNext || '',
    yearLabel: s.yearLabel || '', yearPrev: s.yearPrev || '', yearNext: s.yearNext || '',
    controls: cleanControls,
    columns: (config && config.columns) || 0, direction: (config && config.direction) || 'auto',
  };
  try {
    // Inject the shared engine, then invoke it (same file background.js uses).
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['grid-nav.js'] });
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (a) => (window.__u1InstallGrid ? window.__u1InstallGrid(a) : { ok: false, err: 'grid-nav.js not loaded' }),
      args: [opts],
    });
    return res?.[0]?.result || { ok: false, err: 'No result' };
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
      world: 'MAIN',
      func: (t, p, c) => {
        const raw = window.u1 !== undefined ? window.u1
                  : window.U1 !== undefined ? window.U1
                  : window.user1st;
        if (raw == null || (typeof raw !== 'object' && typeof raw !== 'function')) {
          return { ok: false, err: 'window.u1 is not loaded', u1Missing: true };
        }
        if (!raw.fix || typeof raw.fix[t] !== 'function') {
          return { ok: false, err: 'u1.fix.' + t + ' is not available' };
        }
        // U1 validates EVERY selector value and rejects empty strings — an empty
        // selector makes the whole fix throw and silently do nothing. Strip them.
        (function stripEmpty(o) {
          if (!o || typeof o !== 'object') return;
          for (const k of Object.keys(o)) {
            const v = o[k];
            if (v === '' || v == null) delete o[k];
            else if (typeof v === 'object') { stripEmpty(v); if (!Object.keys(v).length) delete o[k]; }
          }
        })(c && c.selectors);
        try {
          raw.fix[t](p, c);
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
  const structured = items.filter(x => x && typeof x === 'object' && x.type && x.primary);
  if (structured.length === 0) {
    return { ok: false, err: 'No applicable mappings (legacy string mappings cannot be auto-applied — re-add them).' };
  }
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: async (list) => {
        const raw = window.u1 !== undefined ? window.u1
                  : window.U1 !== undefined ? window.U1
                  : window.user1st;
        if (raw == null || (typeof raw !== 'object' && typeof raw !== 'function')) {
          return { ok: false, err: 'window.u1 is not loaded', u1Missing: true };
        }
        const stripEmpty = (o) => {
          if (!o || typeof o !== 'object') return;
          for (const k of Object.keys(o)) {
            const v = o[k];
            if (v === '' || v == null) delete o[k];
            else if (typeof v === 'object') { stripEmpty(v); if (!Object.keys(v).length) delete o[k]; }
          }
        };
        // A call that does not throw is NOT proof that anything happened.
        // u1.fix.* no-ops silently when the domain is not authorised, when the
        // selector fails U1's own validator, and — most often — when U1 has
        // already processed that container this page load (it keeps an internal
        // Set and stamps u1st-avoid-change-detection). So measure the DOM: snap
        // the attributes U1 writes before and after, and report what changed.
        const U1_ATTR = /^(role|tabindex)$|^aria-|^u1st-/;
        const snap = (root) => {
          const m = new Map();
          const els = [root].concat(Array.from(root.querySelectorAll('*')).slice(0, 800));
          for (const el of els) {
            let s = '';
            for (const a of el.attributes) if (U1_ATTR.test(a.name)) s += a.name + '=' + a.value + '|';
            m.set(el, s);
          }
          return m;
        };
        const changedCount = (before, after) => {
          let n = 0;
          for (const [el, v] of after) if (before.get(el) !== v) n++;
          return n;
        };
        // Poll rather than sample once: return the moment anything changes,
        // and only conclude "nothing happened" after the whole budget.
        // What changed, element by element — the receipt a later delete needs in
        // order to remove exactly what was added and nothing the site authored.
        const diffAdded = (before, after) => {
          const out = [];
          for (const [el, now] of after) {
            const was = before.get(el) || '';
            if (was === now) continue;
            const wasAttrs = new Set(was.split('|').filter(Boolean).map(s => s.split('=')[0]));
            const added = Array.from(el.attributes)
              .filter(a => U1_ATTR.test(a.name) && !wasAttrs.has(a.name))
              .map(a => a.name);
            if (added.length) out.push({ mark: el.getAttribute('data-u1-revert') || '', added, el });
          }
          return out;
        };
        const waitForChange = async (before, root, budgetMs) => {
          const step = 150;
          for (let waited = 0; waited < budgetMs; waited += step) {
            await new Promise(r => setTimeout(r, step));
            const n = changedCount(before, snap(root));
            if (n > 0) return n;
          }
          return 0;
        };

        let applied = 0, failed = 0, noEffect = 0, errs = [], details = [];
        for (const it of list) {
          const sel = it.firstArg || it.primary;
          try {
            if (!(raw.fix && typeof raw.fix[it.type] === 'function')) {
              failed++; errs.push('u1.fix.' + it.type + ' missing');
              continue;
            }
            let target = null;
            try { target = document.querySelector(sel); } catch {}
            if (!target) {
              failed++;
              errs.push(`${it.type}: nothing on the page matches ${sel}`);
              details.push({ type: it.type, sel, status: 'no-match' });
              continue;
            }
            // `u1st-avoid-change-detection` means "U1 must not touch this".
            // It gets there two very different ways, and the fix differs:
            //   · U1 stamped it after decorating  → a reload clears the slate.
            //   · it is in the SITE'S OWN HTML    → U1 skips the element for
            //     good, and no amount of reloading will help.
            // Tell them apart by whether U1 left its fingerprints: it assigns
            // generated u1st-<uuid> ids to what it decorates.
            const preStamped = target.hasAttribute('u1st-avoid-change-detection');
            const u1Touched = /^u1st-/.test(target.id || '') || !!target.querySelector('[id^="u1st-"]');
            const before = snap(target);

            // Snapshot each configured field's own elements too, so we can say
            // WHICH parts U1 decorated. A menu whose container gains attributes
            // while its items gain nothing is the common half-applied case, and
            // reporting only a total hides it completely.
            const fieldSnaps = {};
            const sels = (it.config && it.config.selectors) || {};
            for (const [field, fsel] of Object.entries(sels)) {
              if (typeof fsel !== 'string' || !fsel.trim()) continue;
              let els = [];
              try { els = Array.from(document.querySelectorAll(fsel)); } catch { continue; }
              if (!els.length) continue;
              const m = new Map();
              for (const el of els.slice(0, 300)) {
                let s = '';
                for (const a of el.attributes) if (U1_ATTR.test(a.name)) s += a.name + '=' + a.value + '|';
                m.set(el, s);
              }
              fieldSnaps[field] = m;
            }

            stripEmpty(it.config && it.config.selectors);
            raw.fix[it.type](sel, it.config);

            // U1 decorates asynchronously (RxJS + MutationObserver), and how
            // long it takes depends on the component and the page. A single
            // 400ms sample called a fix that was still in progress a failure —
            // reporting "nothing changed" about work that had plainly landed,
            // which is worse than saying nothing at all. So watch until it
            // changes, and only give up after a real budget.
            let changed = await waitForChange(before, target, 4000);

            // Which fields actually moved.
            const fieldsNoEffect = [];
            for (const [field, m] of Object.entries(fieldSnaps)) {
              let moved = 0;
              for (const [el, v] of m) {
                let s = '';
                for (const a of el.attributes) if (U1_ATTR.test(a.name)) s += a.name + '=' + a.value + '|';
                if (s !== v) moved++;
              }
              if (!moved) fieldsNoEffect.push(field);
            }

            // The attribute is the only thing standing between this mapping and
            // a working one, and it is in the site's markup where we cannot
            // edit it. We are already modifying this page — that is what apply
            // IS — so lift the opt-out, retry once, and say plainly that we did.
            // A reload restores the page's own markup, so nothing is destroyed.
            if (changed === 0 && preStamped && !u1Touched) {
              target.removeAttribute('u1st-avoid-change-detection');
              const before2 = snap(target);
              try { raw.fix[it.type](sel, it.config); } catch {}
              changed = await waitForChange(before2, target, 4000);
              if (changed > 0) {
                applied++;
                details.push({ type: it.type, sel, status: 'ok', changed, unblocked: true, fieldsNoEffect });
                continue;
              }
              target.setAttribute('u1st-avoid-change-detection', 'true'); // put it back
            }

            if (changed > 0) {
              applied++;
              // Stamp a revert token on everything that gained U1 attributes,
              // and hand back the list. Deleting the mapping can then undo
              // precisely this, instead of asking for a page reload.
              const receipt = [];
              let token = 0;
              for (const rec of diffAdded(before, snap(target))) {
                const t = `${it.type}-${++token}`;
                rec.el.setAttribute('data-u1-revert', t);
                receipt.push({ token: t, added: rec.added });
              }
              details.push({ type: it.type, sel, status: 'ok', changed, fieldsNoEffect, receipt });
            } else {
              noEffect++;
              details.push({
                type: it.type, sel, status: 'no-effect', changed: 0,
                reason: !preStamped ? 'silent'
                  : u1Touched ? 'already-processed'   // reload and re-apply
                  : 'source-opt-out',                 // the site's HTML says skip
              });
            }
          } catch (e) {
            failed++;
            errs.push(`${it.type}: ${String(e && e.message ? e.message : e)}`);
            details.push({ type: it.type, sel, status: 'error' });
          }
        }
        return { ok: true, applied, failed, noEffect, errs, details };
      },
      args: [structured],
    });
    return results && results[0] && results[0].result ? results[0].result : { ok: false, err: 'No result' };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}

// ── Selector tester ─────────────────────────────────────────────────────────
// Runs a selector on the page (like querySelectorAll in the console), returns a
// count + sample, and briefly highlights the matches so the user can see them.
async function testSelector(sel) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { err: 'Cannot run on this page.' };
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selector) => {
        let els;
        try { els = document.querySelectorAll(selector); }
        catch (e) { return { error: e.message }; }
        const sample = Array.from(els).slice(0, 8).map(el => {
          const id = el.id ? '#' + el.id : '';
          const cls = (el.className && typeof el.className === 'string')
            ? '.' + el.className.trim().split(/\s+/).filter(Boolean).join('.') : '';
          const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
          return { tag: el.tagName.toLowerCase(), id, cls, text };
        });
        els.forEach(el => {
          const prevOutline = el.style.outline;
          const prevOffset = el.style.outlineOffset;
          el.style.outline = '2px solid #6c4cf1';
          el.style.outlineOffset = '1px';
          setTimeout(() => { el.style.outline = prevOutline; el.style.outlineOffset = prevOffset; }, 2500);
        });
        if (els.length) els[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
        return { count: els.length, sample };
      },
      args: [sel],
    });
    return res?.[0]?.result || { err: 'No result' };
  } catch (err) {
    return { err: err.message };
  }
}

let lastTestedSelector = '';

// Highlight (or clear) the Nth match of a selector on the page — a DevTools-style
// inspect overlay (box + label with tag/class and pixel size). Uses a separate
// overlay element so the page's own CSS can't override it (unlike an outline).
async function highlightMatch(sel, idx, on) {
  const tab = await getTab();
  if (!isInjectable(tab)) return;
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selector, i, enable) => {
        const BOX = '__u1t_overlay__', LAB = '__u1t_overlay_label__';
        const clear = () => [BOX, LAB].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
        clear();
        if (!enable) return true;
        let el;
        try { el = document.querySelectorAll(selector)[i]; } catch { return false; }
        if (!el) return false;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const r = el.getBoundingClientRect();

        const box = document.createElement('div');
        box.id = BOX;
        Object.assign(box.style, {
          position: 'fixed', left: r.left + 'px', top: r.top + 'px',
          width: r.width + 'px', height: r.height + 'px',
          background: 'rgba(108,76,241,0.28)', border: '1px solid #6c4cf1',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.5)', boxSizing: 'border-box',
          zIndex: '2147483647', pointerEvents: 'none',
        });
        document.body.appendChild(box);

        const tag = el.tagName.toLowerCase();
        const id = el.id ? '#' + el.id : '';
        const cls = (el.className && typeof el.className === 'string')
          ? '.' + el.className.trim().split(/\s+/).filter(Boolean).join('.') : '';
        const lab = document.createElement('div');
        lab.id = LAB;
        lab.textContent = `${tag}${id}${cls}  ${Math.round(r.width)} × ${Math.round(r.height)}`;
        const labTop = r.top > 24 ? (r.top - 22) : (r.bottom + 4);
        Object.assign(lab.style, {
          position: 'fixed', left: r.left + 'px', top: labTop + 'px',
          background: '#6c4cf1', color: '#fff', font: '11px/1.4 monospace',
          padding: '2px 6px', borderRadius: '3px', zIndex: '2147483647',
          pointerEvents: 'none', whiteSpace: 'nowrap',
          maxWidth: '90vw', overflow: 'hidden', textOverflow: 'ellipsis',
        });
        document.body.appendChild(lab);
        return true;
      },
      args: [sel, idx, on],
    });
    return res && res[0] ? res[0].result : undefined;
  } catch { return undefined; }
}

function renderSelectorTest(result, sel) {
  const box = document.getElementById('selectorTestResult');
  box.style.display = 'block';
  if (result.err) {
    box.className = 'selector-test-result error';
    box.textContent = result.err;
    return;
  }
  if (result.error) {
    box.className = 'selector-test-result error';
    box.innerHTML = `Invalid selector <code>${escapeHtml(sel)}</code>: ${escapeHtml(result.error)}`;
    return;
  }
  lastTestedSelector = sel;
  const n = result.count;
  box.className = 'selector-test-result ' + (n > 0 ? 'ok' : 'warn');
  const list = (result.sample || []).map((s, i) =>
    `<li data-idx="${i}"><code>${escapeHtml(s.tag + s.id + (s.cls || ''))}</code>${s.text ? ` — "${escapeHtml(s.text)}"` : ''}</li>`
  ).join('');
  // Warn about U1 selector compatibility (U1 rejects spaces / descendant combinators).
  const norm = normalizeU1Selector(sel);
  let u1note = '';
  if (!isU1ValidSelector(sel)) {
    u1note = `<div class="u1-warn">⚠️ U1 can't use this selector — it only supports <code>&gt; + ~</code> combinators (no spaces / descendant). Use direct children with <code>&gt;</code>.</div>`;
  } else if (norm !== sel) {
    u1note = `<div class="u1-note">U1 will use: <code>${escapeHtml(norm)}</code> (spaces removed)</div>`;
  }

  box.innerHTML =
    `<div><strong>${n}</strong> match${n !== 1 ? 'es' : ''} for <code>${escapeHtml(sel)}</code>` +
    `${n > 0 ? ' — hover a row to locate it on the page' : ''}</div>` +
    u1note +
    `${list ? `<ul>${list}</ul>` : ''}`;

  // Wire hover-to-highlight on each result row.
  box.querySelectorAll('li[data-idx]').forEach(li => {
    const idx = parseInt(li.dataset.idx, 10);
    li.addEventListener('mouseenter', () => highlightMatch(lastTestedSelector, idx, true));
    li.addEventListener('mouseleave', () => highlightMatch(lastTestedSelector, idx, false));
  });
}

// Delegated: any 🔍 button tests its associated selector input.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.sel-test');
  if (!btn) return;
  const subRow = btn.closest('.sub-sel-row');
  const rootRow = btn.closest('.root-text');
  const input = subRow ? subRow.querySelector('input[data-field]')
              : rootRow ? rootRow.querySelector('input[data-root]')
              : document.getElementById('primarySelectorInput');
  const sel = (input?.value || '').trim();
  if (!sel) { renderSelectorTest({ err: 'Enter a selector first.' }, ''); return; }
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  const result = await testSelector(sel);
  btn.disabled = false; btn.textContent = original;
  renderSelectorTest(result, sel);
});

// ── Element screenshots (for the close-out report) ─────────────────────────
// Scrolls the element into view, grabs the visible tab, crops to the element.
// Works only on the currently open page, so we capture at mapping-add time.
async function captureElementScreenshot(primary) {
  const tab = await getTab();
  if (!isInjectable(tab)) return null;
  try {
    const rectRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sel) => {
        let el = null;
        try { el = document.querySelector(sel); } catch { return null; }
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        return {
          x: r.left, y: r.top, width: r.width, height: r.height,
          dpr: window.devicePixelRatio || 1,
        };
      },
      args: [primary],
    });
    const rect = rectRes?.[0]?.result;
    if (!rect || rect.width < 1 || rect.height < 1) return null;

    // Let the scroll settle before capturing
    await new Promise(res => setTimeout(res, 300));

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg', quality: 80,
    });
    return await cropDataUrl(dataUrl, rect);
  } catch {
    return null;
  }
}

// Downscale an uploaded image to keep stored data URLs small.
function downscaleImage(dataUrl, maxW) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width  = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function cropDataUrl(dataUrl, rect) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const dpr = rect.dpr || 1;
      const pad = 8;
      const sx = Math.max(0, (rect.x - pad) * dpr);
      const sy = Math.max(0, (rect.y - pad) * dpr);
      const sw = Math.min(img.width - sx, (rect.width + pad * 2) * dpr);
      const sh = Math.min(img.height - sy, (rect.height + pad * 2) * dpr);
      if (sw < 1 || sh < 1) { resolve(null); return; }
      // Cap width to keep stored data URLs reasonably small
      const maxW = 900;
      const scale = sw > maxW ? maxW / sw : 1;
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}


// ── Mapping helpers ───────────────────────────────────────────────────────
// Mappings may be old-format strings (legacy) or new-format objects {type, primary, config, code}.
// Always REGENERATE the code from the mapping's structured config — never trust
// a stored `m.code` string (an imported backup could carry arbitrary code that
// would then be shown/copied and pasted into a client's production site).
function mappingToCode(m) {
  if (typeof m === 'string') return m;
  if (!m || typeof m !== 'object') return '';
  const sel = (m.config && m.config.selectors) || {};
  if (m.custom === 'keyboardGrid') {
    return `/* Accessible grid/datepicker — uses the engine included above. */\n` +
           `window.__u1InstallGridFromMapping(${JSON.stringify(m.primary)}, ${formatJsObject(m.config)});`;
  }
  if (m.custom === 'keyboardClickable') {
    return `window.__u1MakeClickable(${formatJsObject({ selector: m.primary, role: (m.config && m.config.role) || 'button', label: (m.config && m.config.label) || '' })});`;
  }
  if (m.custom === 'ariaLabel') {
    return buildAriaLabelCode(m.primary, sel.middleText || (m.config && m.config.middleText) || '', sel.headingSelector || (m.config && m.config.headingSelector) || '');
  }
  if (m.type && m.primary && m.config) {
    return `window.u1?.fix.${m.type}(${JSON.stringify(m.firstArg || m.primary)}, ${formatJsObject(m.config)});`;
  }
  return '';
}

// Next free Fix # for this site (max existing + 1, so deletions never reuse a number).
function nextFixNo(list) {
  let max = 0;
  for (const m of list || []) {
    const n = (m && typeof m === 'object' && Number(m.fixNo)) || 0;
    if (n > max) max = n;
  }
  return max + 1;
}

// Stable per-mapping id, generated once and kept forever. Unlike fixNo (a
// human-friendly sequential label that can be renumbered) this is the durable
// key the daily monitor uses to say exactly WHICH mapping broke — it survives
// reordering/deleting other mappings and travels into the exported client code.
// Format matches the monitor's expectation: "m-" + 8 hex chars (e.g. m-3f9a21c7).
function genMappingId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'm-' + crypto.randomUUID().split('-')[0];
  return 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function mappingKey(m) {
  if (typeof m === 'string') return m;
  if (m && m.type && m.primary) {
    // Include the fix() first arg (e.g. the dialog trigger) so two mappings that
    // share a primary selector but differ (different trigger) don't collide.
    const fa = (m.firstArg && m.firstArg !== m.primary) ? '::' + m.firstArg : '';
    return m.type + '::' + m.primary + fa;
  }
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

// Skip links found in the page's own markup. Session-only: shown in Setup and
// offered as a starting point, never written to storage on its own.
let detectedSkipLinks = [];

// What each applied mapping actually added to the page, so deleting it can take
// that back rather than telling you to reload. Session-only: a reload clears the
// page anyway, which is the other way to the same place.
const applyReceipts = new Map();   // mappingKey -> [{token, added:[attr]}]

// Moves any per-site data stored under "www.<host>" to "<host>" (once), so the
// www-stripping change doesn't orphan previously saved mappings/config/etc.
// The U1 CSS/JS links used to live under bare `cssLink`/`jsLink` keys shared by
// every site. Give them back to the sites that actually used them — a site that
// was injected already holds its own copy in manualInject_<host> — and then
// remove the shared key so it cannot leak into another client again.
async function migrateGlobalU1Links() {
  const all = await U1Store.get(null);
  if (all.cssLink === undefined && all.jsLink === undefined) return;

  const updates = {};
  for (const key of Object.keys(all)) {
    const m = /^manualInject_(.+)$/.exec(key);
    if (!m) continue;
    const host = m[1];
    if (all[storageKey('u1Links', host)]) continue;      // already has its own
    const rec = all[key] || {};
    const cssLink = rec.cssLink || all.cssLink || '';
    const jsLink = rec.jsLink || all.jsLink || '';
    if (cssLink || jsLink) updates[storageKey('u1Links', host)] = { cssLink, jsLink };
  }
  if (Object.keys(updates).length) await U1Store.set(updates);
  await U1Store.remove(['cssLink', 'jsLink']);
}

async function migrateWwwHostname(host) {
  if (!host || host === 'unknown' || host.startsWith('www.')) return;
  const suffix = '_www.' + host;
  const all = await U1Store.get(null);
  const updates = {};
  for (const key of Object.keys(all)) {
    if (key.endsWith(suffix)) {
      const prefix = key.slice(0, key.length - suffix.length);
      const newKey = `${prefix}_${host}`;
      if (!(newKey in all) && !(newKey in updates)) updates[newKey] = all[key];
    }
  }
  if (Object.keys(updates).length) {
    await U1Store.set(updates);
  }
}

// True when the site we are reading and writing is NOT the tab in front of the
// user. Everything here is stored per site, so working on one site while
// looking at another is how a mapping ends up filed under the wrong host.
let borrowedHost = false;

// Say so, loudly, whenever that is the case — the small hostname badge is not
// enough to notice before you have saved something to the wrong site.
function renderHostWarning() {
  let bar = document.getElementById('hostWarning');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'hostWarning';
    bar.className = 'readonly-banner';
    bar.style.display = 'none';
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (!borrowedHost) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  bar.innerHTML = `<strong>Showing ${escapeHtml(currentHostname)}</strong> — the tab in front of you is not a web page, ` +
    `so this is another tab's site. Anything you save goes to <strong>${escapeHtml(currentHostname)}</strong>. ` +
    `Switch to that site's tab before making changes.`;
}

async function init() {
  let tab = await getTab();
  // If the active tab is a non-web page (e.g. the report tab we opened), fall
  // back to the most recent real web tab so the hostname isn't "unknown" — but
  // never silently: that fallback used to adopt an arbitrary tab's hostname,
  // and every mapping saved afterwards was filed under that site.
  if (!tab || !isInjectable(tab)) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const fallback = tabs.reverse().find(isInjectable);
    if (fallback) { tab = fallback; borrowedHost = true; }
  }
  const h = getHostname(tab);
  if (h !== 'unknown') currentHostname = h;
  renderHostWarning();
  try { await migrateGlobalU1Links(); } catch {}

  // Licence check happens before anything is loaded or applied. If it fails the
  // gate is on screen and we stop here — without deleting or altering a single
  // stored mapping.
  if (!(await enforceLicence(currentHostname))) return;

  // One-time migration: earlier versions stored per-site data under the "www."
  // hostname. Now that we strip "www.", move that data to the new key so saved
  // mappings / config / skip links aren't lost.
  await migrateWwwHostname(currentHostname);

  document.querySelectorAll('#mappingsHostname, #exportHostname, #closeOutHostname').forEach(el => {
    el.textContent = currentHostname;
  });

  await refreshSetupTab(tab);
  await loadConfigForm();
  await refreshConfigSkipList();
  updateConfigPreview();
  await loadMappingsList();
  await refreshExportInfo();

  // Auto-run: every time the panel opens, push the saved config + apply all
  // mappings on the page so the user never has to re-apply manually.
  autoRunOnOpen(tab);
}

// Applies saved config + all mappings on panel open, silently. Because U1 often
// isn't loaded the instant the panel opens, we retry a few times until window.u1
// appears (or we give up after ~6s).
async function autoRunOnOpen(tab) {
  if (!isInjectable(tab)) return;
  const status = document.getElementById('applyAllStatus');
  try {
    const cfgKey = storageKey('config', currentHostname);
    const skipKey = storageKey('skipLinks', currentHostname);
    const stored = await U1Store.get([cfgKey, skipKey]);
    if (stored[cfgKey]) {
      const cfg = buildConfigObject(stored[skipKey] || []);
      await applyConfig(cfg);
    }
    // Retry loop: wait for U1 to be ready before applying mappings.
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await applyAllMappings({ silent: true });
      if (!res) return;
      if (res.applied > 0 || !res.u1Missing) {
        if (status) showNotice(status,
          res.applied > 0 ? `Auto-applied ${res.applied} mapping${res.applied !== 1 ? 's' : ''}.`
                          : 'U1 is loaded but no mappings applied — check the selectors.',
          res.applied > 0 ? 'success' : 'warn', 3000);
        return;
      }
      await new Promise(r => setTimeout(r, 1000)); // U1 not ready yet — wait and retry
    }
    if (status) showNotice(status, 'Auto-apply skipped: U1 library not detected on this page (inject U1 in Setup, or reload the page).', 'warn', 5000);
  } catch (e) { /* best-effort */ }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 1 — SETUP
// ─────────────────────────────────────────────────────────────────────────────

async function refreshSetupTab(tab) {
  // Load saved global links
  const linkKey = storageKey('u1Links', currentHostname);
  const injKey = storageKey('manualInject', currentHostname);
  const got = await U1Store.get([linkKey, injKey]);
  const { cssLink = '', jsLink = '' } = got[linkKey] || got[injKey] || {};
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
    // Show auto-inject badge if this hostname has manual injection saved
    const miStored = await U1Store.get([`manualInject_${currentHostname}`]);
    const armed = miStored[`manualInject_${currentHostname}`];
    const badge = document.getElementById('autoInjectBadge');
    if (badge) badge.style.display = armed ? 'block' : 'none';
    // Which project's bundle is being re-injected on every page load here. A
    // bundle belongs to a project and brings that project's configuration with
    // it, so a mismatch is the difference between "my skip links" and
    // "somebody else's skip links I cannot delete".
    renderBundleOwner(armed || { cssLink: detected.cssHref, jsLink: detected.jsSrc });
    // Persist discovered URLs so Export/docx has them before anything is typed.
    //
    // PER SITE. This wrote the bare `cssLink`/`jsLink` keys — globally, for
    // every site — and it ran automatically on every panel open where U1 was
    // detected. So merely opening the panel on one client's site filed that
    // client's bundle as the default everywhere, and the next site's Setup
    // form, Export and handover DOCX picked it up. That is the leak, and it
    // needed no action from anyone to happen.
    // Only remember a bundle THIS SITE is set up to use. Filing whatever
    // happens to be on the page re-created the record the moment Stop cleared
    // it, because our own injected tag was still sitting there.
    const armedHere = !!miStored[`manualInject_${currentHostname}`];
    if (armedHere && (detected.cssHref || detected.jsSrc)) {
      const merged = {
        cssLink: cssLink || detected.cssHref || '',
        jsLink: jsLink || detected.jsSrc || '',
      };
      if (merged.cssLink !== cssLink || merged.jsLink !== jsLink) {
        await U1Store.set({ [storageKey('u1Links', currentHostname)]: merged });
      }
    }
    // The form always shows what is on the page, saved or not.
    if (detected.cssHref) document.getElementById('cssLink').value = cssLink || detected.cssHref;
    if (detected.jsSrc) document.getElementById('jsLink').value = jsLink || detected.jsSrc;
  } else {
    detectedSec.style.display = 'none';
    inputsSec.style.display   = 'block';
    const badge = document.getElementById('autoInjectBadge');
    if (badge) badge.style.display = 'none';
  }

  // Detect skip links on page
  const skipDetected = await detectSkipLinks(tab);
  const skipDetSec   = document.getElementById('skipDetected');
  const skipInpSec   = document.getElementById('skipInputs');
  const skipKey      = storageKey('skipLinks', currentHostname);
  const stored       = await U1Store.get([skipKey]);
  const userSaved    = stored[skipKey];

  if (skipDetected && skipDetected.length > 0) {
    skipDetSec.style.display = 'block';
    skipInpSec.style.display = 'none';
    renderSkipDetectedList(skipDetected);
    // Detected ≠ configured. This used to WRITE the detected links to storage,
    // which filed a per-site record for every site the panel was merely opened
    // on — sites with their own skip links in their own HTML showed up in the
    // saved-sites list having never been worked on. It also put links into
    // "your config" that nobody chose. Detection is for display; only an
    // explicit save persists anything.
    if (!userSaved || !userSaved.length) detectedSkipLinks = skipDetected.slice(0, 3);
  } else {
    skipDetSec.style.display = 'none';
    skipInpSec.style.display = 'block';
    // Pre-fill rows from saved user values if exist (else one empty row)
    populateSkipRows(userSaved);
  }
}

async function detectU1(tab) {
  if (!isInjectable(tab)) return null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 1) Globals — accept object or function, try common names
        let globalName = null;
        const isU1Val = v => v != null && (typeof v === 'object' || typeof v === 'function');
        if (isU1Val(window.u1)) globalName = 'u1';
        else if (isU1Val(window.U1)) globalName = 'U1';
        else if (isU1Val(window.user1st)) globalName = 'user1st';

        // 2) Stylesheet
        let cssHref = document.getElementById('u1Css')?.href || null;
        if (!cssHref) {
          const cssPatterns = [
            /user1st\.[a-z]+.*\.css/i,
            /\/u1[._-][^\/?#]*\.css/i,
            /u1_vanilla[^\/?#]*\.css/i,
            /\/u1\.css/i,
            /[/?]u1[_.-](?:a11y|accessibility|widget)[^\/?#]*\.css/i,
          ];
          const linkEls = document.querySelectorAll('link[rel="stylesheet"][href], link[rel~="stylesheet"][href]');
          for (const el of linkEls) {
            const href = el.href || '';
            if (cssPatterns.some(r => r.test(href)) || (el.id || '').toLowerCase().startsWith('u1')) {
              cssHref = href; break;
            }
          }
        }

        // 3) Script
        let jsSrc = document.getElementById('u1Js')?.src || null;
        if (!jsSrc) {
          const jsPatterns = [
            /user1st\.[a-z]+.*\.js/i,
            /u1[._-][^\/?#]*a11y[^\/?#]*\.js/i,
            /u1_vanilla[^\/?#]*\.js/i,
            /\/u1\.js/i,
            /[/?]u1[_.-](?:a11y|accessibility|widget)[^\/?#]*\.js/i,
          ];
          const scriptEls = document.querySelectorAll('script[src]');
          for (const el of scriptEls) {
            const src = el.src || '';
            if (jsPatterns.some(r => r.test(src)) || (el.id || '').toLowerCase().startsWith('u1')) {
              jsSrc = src; break;
            }
          }
        }

        return { cssHref, jsSrc, active: !!globalName, globalName };
      },
    });
    return results?.[0]?.result;
  } catch {
    return null;
  }
}

// Detects the site's platform so Export can produce the matching guide.
async function detectSiteType(tab) {
  if (!isInjectable(tab)) return 'js';
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => {
        const gen = document.querySelector('meta[name="generator"]');
        if ((gen && /wordpress/i.test(gen.content || '')) ||
            document.querySelector('link[href*="/wp-content/"],script[src*="/wp-content/"],link[href*="/wp-includes/"],script[src*="/wp-includes/"]')) {
          return 'wordpress';
        }
        if (document.querySelector('[ng-version]') || window.ng || window.getAllAngularRootElements) {
          return 'angular';
        }
        const root = document.getElementById('root') || document.querySelector('[data-reactroot]');
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (window.React ||
            (root && Object.keys(root).some(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'))) ||
            (hook && hook.renderers && hook.renderers.size > 0)) {
          return 'react';
        }
        return 'js';
      },
    });
    return res?.[0]?.result || 'js';
  } catch {
    return 'js';
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

// ── Dynamic skip-link rows ─────────────────────────────────────────────────
function createSkipRow(label = '', target = '') {
  const container = document.getElementById('skipLinksContainer');
  const row = document.createElement('div');
  row.className = 'skiplink-row';
  row.innerHTML = `
    <div class="row-head">
      <div class="row-title"></div>
      <button type="button" class="btn-ghost btn-xs skip-remove-btn" title="Remove">✕</button>
    </div>
    <div class="field-group">
      <label>Label</label>
      <input type="text" class="skip-label" placeholder="Skip to main content">
    </div>
    <div class="field-group">
      <label>Target</label>
      <input type="text" class="skip-target" placeholder="#main or main > .content">
      <div class="field-hint skip-hint"></div>
    </div>
  `;
  row.querySelector('.skip-label').value = label;
  row.querySelector('.skip-target').value = target;
  row.querySelector('.skip-remove-btn').addEventListener('click', () => {
    row.remove();
    renumberSkipRows();
    // Removing the last one leaves the empty state, not another blank row.
    if (!container.querySelector('.skiplink-row')) showSkipEmptyState();
  });
  // Adding a row clears the empty-state placeholder.
  const empty = container.querySelector('.empty-state');
  if (empty) empty.remove();
  container.appendChild(row);
  renumberSkipRows();
  return row;
}

function renumberSkipRows() {
  document.querySelectorAll('#skipLinksContainer .skiplink-row .row-title')
    .forEach((el, i) => { el.textContent = `Skip Link ${i + 1}`; });
}

// With nothing saved this used to render one blank row, numbered "Skip Link 1"
// and carrying a ✕ — indistinguishable from a saved entry. Deleting it worked,
// but reopening the form built it again, so it read as a skip link that would
// not delete. An empty list should look empty.
function showSkipEmptyState() {
  const container = document.getElementById('skipLinksContainer');
  container.innerHTML = '<div class="empty-state">No skip links for this site. Use “+ Add skip link” to create one.</div>';
}

function populateSkipRows(saved) {
  const container = document.getElementById('skipLinksContainer');
  container.innerHTML = '';
  if (saved && saved.length) {
    // Show the original selector the user typed (falls back to the resolved id)
    saved.forEach(s => createSkipRow(s.label || '', s.selector || s.target || ''));
  } else {
    showSkipEmptyState();
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

// Which U1 project a bundle URL belongs to. Bundles are served per project at
// prd.<project>.user1st.com, and the project's own configuration — skip links
// included — comes with it.
function u1ProjectOf(url) {
  try { return new URL(url).hostname.match(/^prd\.([^.]+)\.user1st\.com$/i)?.[1] || ''; }
  catch { return ''; }
}

// Say whose bundle is loaded here, and flag it when it is not this site's.
function renderBundleOwner(links) {
  let el = document.getElementById('bundleOwner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bundleOwner';
    const host = document.getElementById('u1Detected');
    if (!host) return;
    host.appendChild(el);
  }
  const proj = u1ProjectOf((links && links.jsLink) || '') || u1ProjectOf((links && links.cssLink) || '');
  if (!proj) { el.style.display = 'none'; return; }
  const mine = currentHostname && currentHostname.toLowerCase().includes(proj.toLowerCase());
  el.style.display = 'block';
  el.className = mine ? 'advisor-note ok' : 'advisor-note warn';
  el.innerHTML = mine
    ? `Bundle belongs to the <strong>${escapeHtml(proj)}</strong> project.`
    : `<strong>This is the ${escapeHtml(proj)} project's bundle, on ${escapeHtml(currentHostname)}.</strong> ` +
      `It brings that project's configuration with it — its skip links and settings appear here and cannot be removed from this panel. ` +
      `Use <em>Stop</em> above, then <em>Replace</em> with this site's own bundle.`;
}

document.getElementById('injectBtn').addEventListener('click', async () => {
  const cssLink = document.getElementById('cssLink').value.trim();
  const jsLink  = document.getElementById('jsLink').value.trim();
  if (!cssLink || !jsLink) { alert('Please enter both CSS and JS links.'); return; }
  // SECURITY: these become <script src>/<link href> on the page — only allow
  // http(s), never javascript:/data: which would be arbitrary code execution.
  if (!isSafeHttpUrl(cssLink) || !isSafeHttpUrl(jsLink)) {
    alert('The CSS and JS links must be full http(s):// URLs.');
    return;
  }

  // Per site. These used to be stored under bare `cssLink`/`jsLink` keys with
  // no hostname, so one client's U1 bundle was handed to every other site —
  // which also means U1 loaded that client's PROJECT config there, skip links
  // and all. That is the leak; the links belong to the site they were entered
  // for.
  await U1Store.set({ [storageKey('u1Links', currentHostname)]: { cssLink, jsLink } });
  const tab = await getTab();
  if (!isInjectable(tab)) { alert('Cannot inject on this page.'); return; }

  // Inject sends ONLY these two URLs — no config, no skip links, nothing else.
  // So anything that appears on the page afterwards came with the bundle, and
  // the bundle is per PROJECT: prd.<project>.user1st.com. Loading one project's
  // bundle on another client's site brings that project's configuration with
  // it, which is how skip links nobody set turn up and cannot be removed.
  const project = (u) => { try { return new URL(u).hostname.match(/^prd\.([^.]+)\.user1st\.com$/i)?.[1] || ''; } catch { return ''; } };
  const proj = project(jsLink) || project(cssLink);
  if (proj && currentHostname && !currentHostname.toLowerCase().includes(proj.toLowerCase())) {
    const go = confirm(
      `This is the U1 bundle for the "${proj}" project, and you are on ${currentHostname}.\n\n` +
      `The bundle carries that project's own configuration — its skip links and settings will appear on this page ` +
      `and cannot be removed from here.\n\nInject it anyway?`);
    if (!go) {
      const st = document.getElementById('statusText');
      if (st) st.textContent = 'Not injected';
      return;
    }
  }

  const statusText = document.getElementById('statusText');
  const statusDot  = document.getElementById('statusDot');
  if (statusText) statusText.textContent = 'Injecting…';

  // Arm a CSP violation detector before injecting
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: (jsUrl) => {
      window.__u1CspBlocked = false;
      const handler = (e) => {
        if (e.blockedURI && jsUrl.includes(e.blockedURI.split('/').pop().split('?')[0])) {
          window.__u1CspBlocked = true;
        }
      };
      document.addEventListener('securitypolicyviolation', handler);
      setTimeout(() => document.removeEventListener('securitypolicyviolation', handler), 5000);
    },
    args: [jsLink],
  });

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
    world: 'MAIN',
    func: (src) => {
      if (!document.getElementById('u1Js')) {
        const s = document.createElement('script');
        s.id = 'u1Js'; s.src = src; s.type = 'text/javascript';
        document.body.appendChild(s);
      }
    },
    args: [jsLink],
  });

  setTimeout(async () => {
    const freshTab = await getTab();
    if (!freshTab || freshTab.id !== tab.id) return;

    const checkRes = await chrome.scripting.executeScript({
      target: { tabId: freshTab.id },
      world: 'MAIN',
      func: () => ({
        u1Loaded: typeof window.u1 === 'object' && window.u1 !== null,
        cspBlocked: window.__u1CspBlocked === true,
      }),
    }).catch(() => null);

    const check = checkRes?.[0]?.result;

    if (check?.cspBlocked || (!check?.u1Loaded && check !== null)) {
      if (statusText) statusText.textContent = 'Blocked by CSP';
      if (statusDot) statusDot.className = 'status-dot inactive';
      const notice = document.getElementById('injectNotice');
      if (notice) {
        notice.textContent = 'The page\'s Content Security Policy blocks loading external scripts. Add the U1 script domain to the site\'s CSP, or ask your developer to embed the U1 links directly in the page HTML.';
        notice.style.display = 'block';
      }
    } else {
      const notice = document.getElementById('injectNotice');
      if (notice) notice.style.display = 'none';
      // Persist injection so background.js re-injects on every navigation for this hostname
      await U1Store.set({ [`manualInject_${currentHostname}`]: { cssLink, jsLink } });
      await refreshSetupTab(freshTab);
    }
  }, 2500);
});

document.getElementById('replaceU1Btn').addEventListener('click', () => {
  document.getElementById('u1Detected').style.display = 'none';
  document.getElementById('u1Inputs').style.display   = 'block';
});

document.getElementById('stopAutoInjectBtn').addEventListener('click', async () => {
  // Stop has to actually stop. Clearing storage alone left the injected
  // <script id="u1Js"> running on the page, so U1 kept doing what it was
  // doing, and the panel's own detection then saw that tag and filed the same
  // URLs straight back — the form refilled and nothing appeared to change.
  //
  // So: forget the bundle, take the tags off the page, and reload, which is
  // the only way to unwind what an already-running U1 has done.
  await U1Store.remove([`manualInject_${currentHostname}`, storageKey('u1Links', currentHostname)]);
  document.getElementById('autoInjectBadge').style.display = 'none';
  const owner = document.getElementById('bundleOwner');
  if (owner) owner.style.display = 'none';
  document.getElementById('cssLink').value = '';
  document.getElementById('jsLink').value = '';

  const tab = await getTab();
  if (isInjectable(tab)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { ['u1Js', 'u1Css'].forEach(id => document.getElementById(id)?.remove()); },
      });
      chrome.tabs.reload(tab.id);
    } catch {}
  }
});

document.getElementById('addSkipLinkBtn').addEventListener('click', () => {
  createSkipRow();
});

document.getElementById('editSkipBtn').addEventListener('click', async () => {
  const skipKey = storageKey('skipLinks', currentHostname);
  const stored  = await U1Store.get([skipKey]);
  populateSkipRows(stored[skipKey]);
  document.getElementById('skipDetected').style.display = 'none';
  document.getElementById('skipInputs').style.display   = 'block';
});

document.getElementById('saveSkipBtn').addEventListener('click', async () => {
  const tab = await getTab();
  const links = [];
  let hasError = false;
  let synthCounter = 0;
  // Per-save token so synthetic ids never collide with anchors left in the DOM
  // by a previous run (e.g. an element already carrying "u1-anchor-1").
  const synthToken = Math.random().toString(36).slice(2, 7);

  const rows = Array.from(document.querySelectorAll('#skipLinksContainer .skiplink-row'));
  for (const row of rows) {
    const label  = row.querySelector('.skip-label').value.trim();
    const target = row.querySelector('.skip-target').value.trim();
    const hintEl = row.querySelector('.skip-hint');
    if (hintEl) { hintEl.textContent = ''; hintEl.className = 'field-hint'; }
    if (!label || !target) continue;

    // NOTE: plain #id targets are NOT accepted blindly — they flow through the
    // same live-page validation below so a non-existent #id (e.g. #main-content
    // that isn't on the page) is reported instead of silently producing a dead
    // skip link. A #id that exists resolves via the existingId path unchanged.

    // Looks like `:first` (jQuery, not CSS) — explain and reject
    if (/:\bfirst\b(?![-_a-zA-Z])/.test(target)) {
      if (hintEl) {
        hintEl.textContent = '":first" is jQuery-only, not valid CSS. Use :first-of-type or :first-child instead.';
        hintEl.className = 'field-hint error';
      }
      hasError = true;
      continue;
    }

    // Try it as a CSS selector on the live page
    if (!isInjectable(tab)) {
      links.push({ label, target, selector: target }); // can't validate, pass through
      continue;
    }

    let queryResult = null;
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => {
          try {
            const matches = document.querySelectorAll(sel);
            if (matches.length === 0) return { count: 0 };
            const el = matches[0];
            return { count: matches.length, existingId: el.id || null };
          } catch (e) {
            return { error: e.message };
          }
        },
        args: [target],
      });
      queryResult = res?.[0]?.result;
    } catch {}

    if (!queryResult || queryResult.error) {
      if (hintEl) {
        hintEl.textContent = `Invalid selector: ${queryResult?.error || 'unknown error'}`;
        hintEl.className = 'field-hint error';
      }
      hasError = true;
      continue;
    }
    if (queryResult.count === 0) {
      // Not on THIS page — but skip links are site-wide, so the target may exist
      // on other pages. Save it anyway (with a synthetic id for CSS selectors so
      // background.js can attach it wherever it does match) and only WARN, never
      // block the whole save on it.
      const isPlainId = /^#[A-Za-z][\w:-]*$/.test(target);
      if (isPlainId) {
        links.push({ label, target, selector: target });
      } else {
        synthCounter++;
        const synthId = `u1-anchor-${synthToken}-${synthCounter}`;
        links.push({ label, target: `#${synthId}`, selector: target, syntheticId: synthId });
      }
      if (hintEl) {
        hintEl.textContent = 'Not found on this page — saved anyway (skip links are site-wide; it will attach on pages where it exists).';
        hintEl.className = 'field-hint warn';
      }
      continue;
    }
    if (queryResult.count > 1 && hintEl) {
      hintEl.textContent = `${queryResult.count} elements match — using the first one.`;
      hintEl.className = 'field-hint warn';
    }

    // Element found — use its id or create a synthetic one.
    // Always keep the original selector so the UI shows what the user typed.
    if (queryResult.existingId) {
      links.push({ label, target: '#' + queryResult.existingId, selector: target });
      if (hintEl && queryResult.count === 1) {
        hintEl.textContent = `Element found — using its id: #${queryResult.existingId}`;
        hintEl.className = 'field-hint ok';
      }
    } else {
      synthCounter++;
      const synthId = `u1-anchor-${synthToken}-${synthCounter}`;
      links.push({ label, target: `#${synthId}`, selector: target, syntheticId: synthId });
      if (hintEl) {
        hintEl.textContent = `Will assign id="${synthId}" to the matched element at runtime.`;
        hintEl.className = 'field-hint ok';
      }
    }
  }

  if (hasError) {
    showNotice(document.getElementById('skipError'), 'Fix the errors above before saving.', 'error', 4000);
    return;
  }

  const key = storageKey('skipLinks', currentHostname);
  await U1Store.set({ [key]: links });
  // Keep config_<hostname> in sync too — background.js's persistent per-load
  // injection reads that key, so without this a skip link saved here would
  // never actually reach the page on subsequent navigations.
  await saveConfig();
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

const $autoApplyConfig = document.getElementById('autoApplyConfig');

// Debounced auto-apply: when the toggle is on, push config to the page on change.
// Always makes the change take effect — live if U1 exposes a refresh hook,
// otherwise by reloading the page with the config injected at document_start.
let autoApplyTimer = null;
async function maybeAutoApply() {
  if (!$autoApplyConfig || !$autoApplyConfig.checked) return;
  clearTimeout(autoApplyTimer);
  autoApplyTimer = setTimeout(async () => {
    const skipKey = storageKey('skipLinks', currentHostname);
    const stored = await U1Store.get([skipKey]);
    const cfg = buildConfigObject(stored[skipKey] || []);
    const result = await applyConfig(cfg);
    // No live refresh hook — reload the page so the change still takes effect.
    if (result && result.ok && !result.calledHook) {
      const tab = await getTab();
      if (tab) chrome.runtime.sendMessage({ action: 'injectConfigOnReload', tabId: tab.id, config: cfg });
    }
  }, 900);
}

function onConfigChange() {
  saveConfig();
  updateConfigPreview();
  maybeAutoApply();
}

function syncColorPair(picker, text) {
  picker.addEventListener('input', () => {
    text.value = picker.value.toUpperCase();
    onConfigChange();
  });
  text.addEventListener('input', () => {
    const v = text.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      picker.value = v;
      onConfigChange();
    }
  });
}
syncColorPair($primaryColorPicker, $primaryColorHex);
syncColorPair($secondaryColorPicker, $secondaryColorHex);

[$doubleBorder, $langSelect].forEach(el =>
  el.addEventListener('change', onConfigChange)
);
document.querySelectorAll('input[name="direction"]').forEach(r =>
  r.addEventListener('change', onConfigChange)
);

// Persist the auto-apply preference per hostname; apply immediately when enabled.
$autoApplyConfig.addEventListener('change', async () => {
  await U1Store.set({
    [storageKey('autoApply', currentHostname)]: $autoApplyConfig.checked,
  });
  if ($autoApplyConfig.checked) maybeAutoApply();
});

async function loadConfigForm() {
  const key = storageKey('config', currentHostname);
  const autoKey = storageKey('autoApply', currentHostname);
  const stored = await U1Store.get([key, autoKey]);
  if ($autoApplyConfig) $autoApplyConfig.checked = !!stored[autoKey];
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
  const stored = await U1Store.get([skipKey]);
  const links = stored[skipKey] || [];
  const ul = document.getElementById('configSkipList');
  if (!links.length) {
    ul.innerHTML = '<div class="empty-state">No skip links configured. Set them in Setup.</div>';
  } else {
    ul.innerHTML = '<ul class="detected-list">' + links.map((s, i) => `
      <li data-skip-idx="${i}">
        <span class="bullet">•</span>
        <span>"${escapeHtml(s.label)}"</span>
        <span class="arrow">→</span>
        <span class="target">${escapeHtml(s.selector || s.target)}</span>
        <span class="skip-verify-status"></span>
      </li>
    `).join('') + '</ul>';
  }
}

// Check each configured skip link against the LIVE page: does its target
// element still exist, and did U1 actually render an anchor for it? This
// answers "why am I not getting all the skip links I asked for" concretely,
// per link, instead of guessing.
async function verifySkipLinksOnPage() {
  const skipKey = storageKey('skipLinks', currentHostname);
  const stored = await U1Store.get([skipKey]);
  const links = stored[skipKey] || [];
  const tab = await getTab();
  if (!links.length || !isInjectable(tab)) return;

  let results;
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (items) => items.map(s => {
        const href = s.target; // e.g. "#main-content"
        let targetExists = false;
        try { targetExists = !!document.querySelector(href); } catch { targetExists = false; }
        // U1 renders skip links as real anchors with a matching href — find one
        // regardless of internal class names, matched by href + rough label text.
        const anchors = Array.from(document.querySelectorAll(`a[href="${CSS.escape(href)}"], a[href$="${CSS.escape(href)}"]`));
        const rendered = anchors.length > 0;
        return { targetExists, rendered };
      }),
      args: [links],
    });
    results = res?.[0]?.result;
  } catch { return; }
  if (!results) return;

  results.forEach((r, i) => {
    const el = document.querySelector(`#configSkipList [data-skip-idx="${i}"] .skip-verify-status`);
    if (!el) return;
    if (r.rendered) {
      el.textContent = '✅ on page';
      el.className = 'skip-verify-status ok';
    } else if (!r.targetExists) {
      el.textContent = '⛔ target not found';
      el.className = 'skip-verify-status err';
    } else {
      el.textContent = '⚠️ target exists but link not rendered';
      el.className = 'skip-verify-status warn';
    }
  });
}

document.getElementById('verifySkipBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('verifySkipBtn');
  btn.textContent = 'Checking…';
  await verifySkipLinksOnPage();
  btn.textContent = '🔍 Verify on page';
});

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
  const stored = await U1Store.get([skipKey]);
  const cfg = buildConfigObject(stored[skipKey] || []);
  const key = storageKey('config', currentHostname);
  await U1Store.set({ [key]: cfg });
}

async function updateConfigPreview() {
  const skipKey = storageKey('skipLinks', currentHostname);
  const stored = await U1Store.get([skipKey]);
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
  const stored = await U1Store.get([skipKey]);
  const cfg = buildConfigObject(stored[skipKey] || []);
  const status = document.getElementById('configRan');
  const reloadBtn = document.getElementById('reloadPageBtn');

  if (reloadBtn) reloadBtn.style.display = 'none';

  const result = await applyConfig(cfg);

  if (result.ok) {
    if (result.calledHook) {
      showNotice(status, `Config applied via u1.${result.calledHook}().`, 'success');
    } else {
      // No live refresh possible (CSP, no hook, or U1 not yet initialized) —
      // ask background.js to inject config at document_start on next load.
      const tab = await getTab();
      showNotice(status, 'Reloading page with config…', 'warn', 0);
      if (reloadBtn) reloadBtn.style.display = 'none';
      chrome.runtime.sendMessage({ action: 'injectConfigOnReload', tabId: tab.id, config: cfg },
        () => { showNotice(status, 'Page reloading — config will be applied when U1 initializes.', 'success', 5000); }
      );
    }
  } else {
    showNotice(status, 'Error: ' + result.err, 'error', 4500);
  }
});

document.getElementById('editSkipFromConfig').addEventListener('click', () => {
  document.querySelector('.tab-btn[data-tab="setup"]').click();
});

document.getElementById('reloadPageBtn').addEventListener('click', async () => {
  const tab = await getTab();
  if (tab) chrome.tabs.reload(tab.id);
});

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 3 — TEMPLATES (manual component builder)
// ─────────────────────────────────────────────────────────────────────────────

const $primarySelectorInput = document.getElementById('primarySelectorInput');
const $componentType   = document.getElementById('componentType');
const $subSelSection   = document.getElementById('subSelectorsSection');
const $subSelArea      = document.getElementById('subSelectorsArea');
const $previewSection  = document.getElementById('previewSection');
const $templatePreview = document.getElementById('templatePreview');

// ─────────────────────────────────────────────────────────────────────────────
//  Component guide — shown the moment a type is picked, so whoever operates the
//  extension understands WHAT the element is, WHICH WCAG criteria it satisfies,
//  and HOW the user is expected to drive it with a keyboard.
//  `apg` links to the W3C ARIA Authoring Practices pattern (the authoritative
//  "how this component should behave" reference).
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_GUIDE = {
  button:     { what:'A control that performs an action on the page.', keys:'Tab to reach · Enter or Space to activate.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'button' },
  link:       { what:'A control that navigates somewhere else.', keys:'Tab to reach · Enter to follow.', wcag:[['4.1.2','Name, Role, Value'],['2.4.4','Link Purpose in Context']], apg:'link' },
  menu:       { what:'A navigation / actions menu, usually with drop-down submenus.', keys:'Tab to the trigger · Enter or Arrow to open · Arrows between items · Esc closes.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'menubar',
    variants:[
      ['Site navigation (links) — menubar: false', 'Default. Items stay links; only the triggers become buttons. role="menuitem" is NOT expected.'],
      ['Application menubar (commands) — menubar: true', 'Every item becomes role="menuitem". Do not combine with nested submenus — U1 throws “Submenu must have a trigger element”.'],
    ] },
  accordion:  { what:'Headers that expand and collapse panels of content.', keys:'Tab between headers · Enter or Space toggles.', wcag:[['4.1.2','Name, Role, Value'],['1.3.1','Info and Relationships']], apg:'accordion' },
  carousel:   { what:'A rotating set of slides with previous/next controls.', keys:'Tab to the controls · Enter activates · a pause control is required if it auto-plays.', wcag:[['4.1.2','Name, Role, Value'],['2.2.2','Pause, Stop, Hide']], apg:'carousel' },
  datepicker: { what:'A calendar popup for choosing a date.', keys:'Enter on the trigger opens · Arrows move between days · Enter picks · Esc closes.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'dialog-modal' },
  dialog:     { what:'A modal window that takes over the page until dismissed.', keys:'Focus moves in on open · Tab is trapped inside · Esc closes · focus returns to the trigger.', wcag:[['4.1.2','Name, Role, Value'],['2.4.3','Focus Order'],['2.1.2','No Keyboard Trap']], apg:'dialog-modal' },
  listbox:    { what:'A list the user picks one option from.', keys:'Tab to the list · Arrows move the option · Enter selects · Esc closes.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'listbox' },
  combobox:   { what:'A text field with a popup list of suggestions.', keys:'Type to filter · Arrows into the list · Enter selects · Esc closes.', wcag:[['4.1.2','Name, Role, Value'],['4.1.3','Status Messages']], apg:'combobox' },
  checkbox:   { what:'An on/off (or mixed) choice.', keys:'Tab to reach · Space toggles.', wcag:[['4.1.2','Name, Role, Value']], apg:'checkbox',
    variants:[
      ['Native <input type="checkbox">', 'Already accessible — no mapping needed.'],
      ['Custom checkbox (div/span)', 'The main case. U1 manages aria-checked.'],
      ['Two or more mutually exclusive options', 'Only one may be chosen → use “radio”.'],
    ] },
  radio:      { what:'A group of mutually exclusive options — only one can be chosen.', keys:'Tab enters the group once (landing on the checked option) · Arrows move between options · Tab leaves.', wcag:[['4.1.2','Name, Role, Value'],['1.3.1','Info and Relationships']], apg:'radio',
    variants:[
      ['Native <input type="radio">', 'Already accessible — do NOT map it. Only map when the visible control is a styled div/button.'],
      ['Custom radio group (div/button per option)', 'The main case for this type. Fill checkedState so U1 can track the selection.'],
      ['Segmented / toggle buttons (e.g. “Round trip | One way”)', 'Still a radio group — it sets a value. Use this type.'],
      ['Looks like a radio but SWAPS a panel below', 'That is a tab strip → use “tabs”, not radio.'],
      ['A single on/off toggle', 'Not a radio (radio needs 2+ options) → use “checkbox”.'],
    ] },
  tabs:       { what:'A tab strip that swaps the panel shown below it.', keys:'Tab to the active tab · Arrows switch tabs · Tab moves into the panel.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'tabs',
    variants:[
      ['Switches a visible panel', 'Correct — this is “tabs”.'],
      ['Only sets a value, no panel swap', 'That is a radio group → use “radio”.'],
      ['Navigates to another page/URL', 'Those are links → use “menu” or “link”.'],
    ] },
  form:       { what:'A form — links each field to its label and announces errors.', keys:'Tab between fields · errors must be announced and tied to their field.', wcag:[['3.3.2','Labels or Instructions'],['3.3.1','Error Identification'],['1.3.1','Info and Relationships']], apg:'' },
  table:      { what:'A data table — ties each cell to its row/column header.', keys:'Read-only; screen readers announce the header for each cell.', wcag:[['1.3.1','Info and Relationships']], apg:'table' },
  grid:       { what:'An interactive table whose cells receive focus.', keys:'Arrows move between cells · Enter activates.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'grid' },
  pagination: { what:'Numbered page controls for a result list.', keys:'Tab between page buttons · Enter activates · the current page is announced.', wcag:[['4.1.2','Name, Role, Value'],['2.4.4','Link Purpose in Context']], apg:'' },
  loading:    { what:'A loading indicator that must be announced, not silent.', keys:'No focus — announced via a live region.', wcag:[['4.1.3','Status Messages']], apg:'' },
  tooltip:    { what:'Extra text shown next to a control.', keys:'Must appear on FOCUS, not only on hover · Esc dismisses.', wcag:[['1.4.13','Content on Hover or Focus'],['4.1.2','Name, Role, Value']], apg:'tooltip' },
  heading:    { what:'Marks text as a heading so the page can be navigated by structure.', keys:'No focus — screen readers jump between headings.', wcag:[['1.3.1','Info and Relationships'],['2.4.6','Headings and Labels']], apg:'' },
  'aria-label': { what:'Gives a vague control a meaningful name (its text + context).', keys:'No behaviour change — only what is announced.', wcag:[['4.1.2','Name, Role, Value'],['2.4.4','Link Purpose in Context']], apg:'' },
  'keyboard-grid': { what:'Extension engine (no U1): makes a calendar/grid keyboard-operable.', keys:'Arrows between cells · Enter/Space chooses · visible focus ring.', wcag:[['2.1.1','Keyboard'],['4.1.2','Name, Role, Value'],['2.4.7','Focus Visible']], apg:'grid' },
  'keyboard-clickable': { what:'Extension engine (no U1): makes non-focusable elements real controls. Applies to EVERY match.', keys:'Tab to reach · Enter (and Space for buttons) activates.', wcag:[['2.1.1','Keyboard'],['4.1.2','Name, Role, Value']], apg:'button' },
};

// Renders the guide for the chosen type (or hides it when nothing is selected).
function renderTypeGuide(type) {
  const box = document.getElementById('typeGuide');
  if (!box) return;
  const g = TYPE_GUIDE[type];
  if (!g) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const chips = g.wcag.map(([num, name]) =>
    `<a class="wcag-link" target="_blank" rel="noopener"
        href="https://www.w3.org/WAI/WCAG22/Understanding/${encodeURIComponent(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}.html"
        title="Open the WCAG explanation for ${escapeHtml(name)}">WCAG ${escapeHtml(num)} ${escapeHtml(name)}</a>`).join('');
  const apg = g.apg
    ? `<a class="wcag-link apg" target="_blank" rel="noopener"
         href="https://www.w3.org/WAI/ARIA/apg/patterns/${g.apg}/"
         title="The official W3C keyboard/ARIA pattern for this component">📖 ARIA pattern</a>` : '';
  box.style.display = 'block';
  const variants = (g.variants || []).map(([kind, note]) =>
    `<li><span class="tg-v-kind">${escapeHtml(kind)}</span><span class="tg-v-note">${escapeHtml(note)}</span></li>`).join('');
  box.innerHTML =
    `<div class="tg-what">${escapeHtml(g.what)}</div>` +
    `<div class="tg-keys"><strong>Keyboard:</strong> ${escapeHtml(g.keys)}</div>` +
    (variants ? `<details class="tg-variants"><summary>Which kind is it? (${g.variants.length})</summary><ul>${variants}</ul></details>` : '') +
    `<div class="tg-links">${chips}${apg}</div>`;
}

// Currently built template (set by Generate, consumed by Apply / Add to Mapping)
let currentTemplate = null;
let mappingsFilter = 'onpage'; // 'onpage' | 'all' — MAPPINGS list filter toggle
(function wireMappingsFilter() {
  const onPageBtn = document.getElementById('filterOnPage');
  const allBtn = document.getElementById('filterAll');
  if (!onPageBtn || !allBtn) return;
  const set = (mode) => {
    mappingsFilter = mode;
    const isOn = mode === 'onpage';
    onPageBtn.classList.toggle('active', isOn); onPageBtn.setAttribute('aria-selected', String(isOn));
    allBtn.classList.toggle('active', !isOn); allBtn.setAttribute('aria-selected', String(!isOn));
    loadMappingsList();
  };
  onPageBtn.addEventListener('click', () => set('onpage'));
  allBtn.addEventListener('click', () => set('all'));
})();
// When editing an existing mapping, its key — so "Add to Mapping" replaces it.
let editingMappingKey = null;

$componentType.addEventListener('change', () => {
  const type = $componentType.value;
  renderTypeGuide(type); // explain the component + its WCAG criteria straight away
  if (!type) {
    $subSelSection.style.display = 'none';
    $previewSection.style.display = 'none';
    return;
  }
  renderSubSelectorInputs(type);
});

// Plain-language guidance for the TOP "CSS Selector" field, per component. The
// terse doc wording ("the container") isn't enough on its own, so each entry
// explains what element to point at and gives a concrete example selector that
// also becomes the input placeholder.
const PRIMARY_HELP = {
  button:     { help:'The clickable button element itself (the thing that has the click event).', ex:'.test-btn' },
  link:       { help:'The element that behaves like a link (has the click/navigation event).', ex:'.accessibility-link' },
  menu:       { help:'The outermost <ul>/<nav> that wraps the whole menu (not a single item).', ex:'#main-menu' },
  accordion:  { help:'The clickable section header/button that expands & collapses the panel.', ex:'.accordion-btn' },
  carousel:   { help:'Each slide element (U1 waits for a slide to appear). The wrapper goes in "carouselContainer".', ex:'.slide' },
  datepicker: { help:'The calendar popup that holds the days grid and the prev/next buttons — NOT the input or the 📅 icon (that is the "trigger").', ex:'.datepicker-container' },
  dialog:     { help:'The modal/pop-up box that opens up (the panel that appears). The button that opens it goes in "trigger".', ex:'#login-modal' },
  listbox:    { help:'The options list container — the <ul> that holds the options (this gets role="listbox"). The button that opens it goes in "trigger".', ex:'#listbox-list' },
  combobox:   { help:'The wrapper around the input. If there is none, use the input itself.', ex:'.combobox-container' },
  checkbox:   { help:'The checkbox element that carries the click event.', ex:'.checkbox' },
  radio:      { help:'The container that wraps the whole radio group.', ex:'.radio-group' },
  tabs:       { help:'The <ul>/row that holds the tab buttons (the tab list).', ex:'.tabs-list' },
  form:       { help:'The <form> (or the element wrapping all the fields & the submit button).', ex:'.form-container' },
  table:      { help:'The table container (the element wrapping all rows & cells).', ex:'.data-table' },
  grid:       { help:'The interactive grid container (wrapping all rows & cells).', ex:'.grid-table' },
  pagination: { help:'The container that wraps the results AND the page buttons.', ex:'.pagination-container' },
  loading:    { help:'The loading indicator element — when it appears, the loading state is announced.', ex:'.loading' },
  tooltip:    { help:'The tooltip text/content element that appears.', ex:'.tooltip' },
};

// The selector key that carries the PRIMARY placeholder (i.e. the main CSS
// selector the user types at the top). Used to show its doc hint on that input.
function primaryKeyOf(schema) {
  for (const k of Object.keys(schema.selectors)) {
    if (schema.selectors[k] === 'PRIMARY') return k;
  }
  return null;
}

// Renders the selector rows for a component type.
//
// `into` lets an AI mapping card host its own copy of the exact same form, so
// the two modes cannot drift apart: same markup, same hints, same required
// markers, same 🔍 testers, same strength badges. With `append` the container's
// existing content is kept (the card puts its primary row in first), and the
// shared primary label/hint at the top of the tab is left alone.
function renderSubSelectorInputs(type, into, opts) {
  const schema = COMPONENT_SCHEMAS[type];
  if (!schema) return;
  const $subSelArea = into || document.getElementById('subSelectorsArea');
  const scoped = !!into;
  if (!(opts && opts.append)) $subSelArea.innerHTML = '';

  const req = schema.req || [];
  const desc = schema.desc || {};
  const labels = schema.labels || {};
  const labelOf = (k) => labels[k] || k;

  // Primary selector hint: show the doc description for the PRIMARY key, plus
  // whether the main selector is required.
  const pKey = primaryKeyOf(schema);

  // Rename the top label to the actual selector this field maps to, so it's
  // obvious the CSS Selector is e.g. the "listbox" (the <ul>), not the trigger.
  // Scoped renders (an AI card) own no shared header, so they skip all of this.
  const primaryLabel = scoped ? null : document.getElementById('primaryLabel');
  if (primaryLabel) {
    primaryLabel.textContent = pKey ? `CSS Selector — ${labelOf(pKey)}` : 'CSS Selector';
  }

  // Friendly, plain-language help + example for the primary field.
  const helpInfo = PRIMARY_HELP[type];
  if (!scoped && helpInfo && helpInfo.ex && $primarySelectorInput) {
    $primarySelectorInput.placeholder = 'e.g. ' + helpInfo.ex;
  }

  const primaryHint = scoped ? null : document.getElementById('primaryHint');
  if (primaryHint) {
    // Prefer the plain-language explanation; fall back to the terse doc text.
    const body = (helpInfo && helpInfo.help) || (pKey && desc[pKey]) || '';
    if (body) {
      const reqTag = (pKey && req.includes(pKey)) ? '★ required — ' : '';
      const exTag = (helpInfo && helpInfo.ex) ? `\nExample: ${helpInfo.ex}` : '';
      primaryHint.textContent = reqTag + body + exTag;
      primaryHint.style.whiteSpace = 'pre-line';
      primaryHint.style.display = '';
    } else {
      primaryHint.textContent = '';
      primaryHint.style.display = 'none';
    }
  }

  // Manual fields — each with a required marker and an on-focus description bubble.
  for (const f of schema.fields) {
    const isReq = req.includes(f);
    const hint = desc[f] || '';
    const row = document.createElement('div');
    row.className = 'sub-sel-row';
    row.innerHTML = `
      <div class="key">${escapeHtml(labelOf(f))}${isReq ? ' <span class="req-star" title="required">*</span>' : ''}</div>
      <span class="sel-strength-wrap">
        <input type="text" data-field="${escapeHtml(f)}" placeholder="${isReq ? 'required' : 'optional'}">
        <span class="sel-strength" data-level="empty" aria-hidden="true"></span>
      </span>
      <button class="btn-ghost btn-xs sel-test" title="Test selector on page">🔍</button>
      ${hint ? `<div class="input-hint">${escapeHtml(hint)}</div>` : ''}
    `;
    $subSelArea.appendChild(row);
  }

  // Root fields (options)
  if (schema.rootFields) {
    for (const [k, defaultVal] of Object.entries(schema.rootFields)) {
      const hint = desc[k] || '';
      if (typeof defaultVal === 'boolean') {
        const row = document.createElement('label');
        row.className = 'root-toggle';
        row.innerHTML = `
          <input type="checkbox" data-root="${escapeHtml(k)}" ${defaultVal ? 'checked' : ''}>
          <span><strong>${escapeHtml(labelOf(k))}</strong> (option)</span>
          ${hint ? `<div class="input-hint">${escapeHtml(hint)}</div>` : ''}
        `;
        $subSelArea.appendChild(row);
      } else {
        const row = document.createElement('div');
        row.className = 'root-text';
        const isSelRoot = (schema.selectorRoots || []).includes(k);
        const inputHtml = `<input type="text" data-root="${escapeHtml(k)}" value="${escapeHtml(String(defaultVal || ''))}">`;
        row.innerHTML = `
          <label>${escapeHtml(labelOf(k))} <span class="root-tag">(option)</span></label>
          ${isSelRoot
            ? `<div class="selector-test-row"><span class="sel-strength-wrap">${inputHtml}<span class="sel-strength" data-level="empty" aria-hidden="true"></span></span><button class="btn-ghost btn-xs sel-test" title="Test selector on page">🔍</button></div>`
            : inputHtml}
          ${hint ? `<div class="input-hint">${escapeHtml(hint)}</div>` : ''}
        `;
        $subSelArea.appendChild(row);
      }
    }
  }

  if (scoped) return;   // an AI card manages its own visibility and grading
  $subSelSection.style.display = 'block';
  $previewSection.style.display = 'none';
  refreshStrength();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Selector strength meter
//  Every selector input carries a live Weak / Medium / Strong badge so a fragile
//  mapping (bare tag, utility class, generated id, 0 or many matches) is obvious
//  while it is being typed — not after it breaks in production.
// ─────────────────────────────────────────────────────────────────────────────

// Some components are built ONLY when the widget opens (the datepicker popup,
// the dialog body), so 0 matches on those inner selectors is expected, not a
// fault. Keyed by type → the selector keys that MUST match even while closed.
const DYNAMIC_OPEN = {
  datepicker: ['trigger'],
  dialog: ['trigger'],
  combobox: ['trigger', 'input'],
  'keyboard-grid': [], // container + cell are created only when the widget opens
};

// Fields that point at exactly ONE element. u1.fix.* resolves a selector rather
// than looping, and applies to the LAST match — so several matches here is a
// real defect, not a style note. (Plural fields like `items` are meant to match
// many, and must not be penalised for it.)
const SINGULAR_FIELDS = new Set([
  'element', 'container', 'menu', 'horizontalMenu', 'listbox', 'combobox', 'trigger',
  'input', 'dialog', 'closeBtn', 'heading', 'form', 'table', 'grid', 'carouselContainer',
  'headerSelector', 'contentSelector', 'loading', 'tooltip', 'paginationContainer',
]);

// Batched match counts — ONE executeScript for every visible selector input, so
// typing does not fire a round-trip per field per keystroke.
async function countSelectors(sels) {
  const tab = await getTab();
  if (!isInjectable(tab)) return sels.map(() => null);
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (list) => list.map(s => {
        if (!s) return null;
        try { return document.querySelectorAll(s).length; } catch { return -1; }
      }),
      args: [sels],
    });
    return (res && res[0] && res[0].result) || sels.map(() => null);
  } catch { return sels.map(() => null); }
}

function strengthOf(sel, opts) {
  const intel = globalThis.__u1SelectorIntel;
  if (!intel) return { level: 'empty', label: '', reasons: [] };
  return intel.selectorStrength(sel, opts);
}

// Paint one badge and fold its reasons into the row's on-focus hint bubble.
function paintStrength(badge, s) {
  if (!badge) return;
  badge.dataset.level = s.level;
  badge.textContent = s.label || '';
  badge.title = (s.reasons || []).join('\n');
  const row = badge.closest('.sub-sel-row, .root-text, .field-group');
  const hint = row && row.querySelector('.input-hint');
  if (!hint) return;
  let why = hint.querySelector('.strength-why');
  if (s.level === 'empty') { if (why) why.remove(); return; }
  if (!why) {
    why = document.createElement('div');
    why.className = 'strength-why';
    hint.appendChild(why);
  }
  why.dataset.level = s.level;
  why.textContent = (s.label ? s.label + ' selector — ' : '') + (s.reasons || []).join(' ');
}

let strengthTimer = null;

// Re-grade every selector input on the builder form. Debounced by its callers.
async function refreshStrength() {
  const type = $componentType.value;
  const schema = COMPONENT_SCHEMAS[type];
  const pKey = schema ? primaryKeyOf(schema) : null;
  const alwaysPresent = DYNAMIC_OPEN[type];

  // Collect every (input, badge, field-key) triple currently on screen.
  const rows = [];
  if ($primarySelectorInput) {
    const badge = $primarySelectorInput.parentElement?.querySelector('.sel-strength');
    if (badge) rows.push({ input: $primarySelectorInput, badge, key: pKey || 'element', unique: true });
  }
  $subSelArea.querySelectorAll('.sel-strength-wrap').forEach(wrap => {
    const input = wrap.querySelector('input[type="text"]');
    const badge = wrap.querySelector('.sel-strength');
    if (!input || !badge) return;
    const key = input.dataset.field || input.dataset.root || '';
    rows.push({ input, badge, key, unique: SINGULAR_FIELDS.has(key) });
  });
  if (!rows.length) return;

  // Grade statically first so the badge responds instantly, then refine with
  // live match counts when the page answers.
  const opts = rows.map(r => ({
    allowZero: !!(alwaysPresent && !alwaysPresent.includes(r.key)),
    unique: r.unique,
  }));
  rows.forEach((r, i) => paintStrength(r.badge, strengthOf(r.input.value.trim(), opts[i])));

  const sels = rows.map(r => r.input.value.trim());
  if (!sels.some(Boolean)) return;
  const counts = await countSelectors(sels);
  rows.forEach((r, i) => {
    if (r.input.value.trim() !== sels[i]) return; // typed on since — skip stale paint
    const o = opts[i];
    if (typeof counts[i] === 'number') o.count = counts[i];
    paintStrength(r.badge, strengthOf(sels[i], o));
  });
}

function scheduleStrength() {
  clearTimeout(strengthTimer);
  strengthTimer = setTimeout(refreshStrength, 400);
}

// One delegated listener covers the primary input and every generated sub-row.
document.getElementById('tab-picker')?.addEventListener('input', (e) => {
  if (e.target.matches('input[type="text"]')) scheduleStrength();
});

// ─────────────────────────────────────────────────────────────────────────────
//  AUTO MAPPING MODE
//  Manual mode is unchanged. In Auto mode the specialist supplies only the
//  PARENT selector; the analyzer reads that element on the page and proposes
//  each sub-selector as a plain-English question. Nothing is written into the
//  form until the suggestions are confirmed.
// ─────────────────────────────────────────────────────────────────────────────

// Plain-English questions, keyed `type.field`. Deliberately short and free of
// U1 jargon — the schema's `desc` text is the doc wording and reads as a spec,
// which is not what you want to be answering one question at a time.
const AUTO_QUESTIONS = {
  'menu.items': 'Which things should the arrow keys move between?',
  'menu.triggers': 'Which items open a drop-down when clicked?',
  'menu.submenus': 'Which boxes open up when you click a top-level item?',
  'menu.horizontalMenu': 'Do the top-level items sit side by side (left/right arrows)?',
  'menu.menubar': 'Is this a bar of commands, or site navigation with drop-downs?',
  'menu.openByMouseenter': 'Does just hovering over an item open its drop-down?',
  'menu.openByMouseover': 'Does just hovering over an item open its drop-down?',
  'listbox.options': 'Which rows are the options you pick from?',
  'listbox.trigger': 'Which button opens this list?',
  'dialog.trigger': 'Which button opens this pop-up?',
  'dialog.closeBtn': 'Which button closes it? (Esc will do the same)',
  'dialog.heading': 'Which text is the title of the pop-up?',
  'accordion.contentSelector': 'Which panel opens and closes underneath?',
  'tabs.tab': 'Which elements are the tabs themselves?',
  'table.row': 'Which elements are the rows?',
  'table.cell': 'Which elements are the cells?',
  'grid.row': 'Which elements are the rows?',
  'grid.cell': 'Which elements are the cells the arrows move between?',
  'carousel.carouselContainer': 'Which element wraps all the slides?',
};

// The last analysis, so Apply can read the specialist's choices back.
let autoResult = null;

const $modeManualBtn = document.getElementById('modeManualBtn');
const $modeAutoBtn = document.getElementById('modeAutoBtn');
const $modeHint = document.getElementById('modeHint');
const $autoAnalyzeRow = document.getElementById('autoAnalyzeRow');
const $autoReviewSection = document.getElementById('autoReviewSection');
const $autoReviewList = document.getElementById('autoReviewList');
const $preciseEventsRow = document.getElementById('preciseEventsRow');
const $preciseEventsToggle = document.getElementById('preciseEventsToggle');

let mapMode = 'manual';

function setMapMode(mode) {
  mapMode = mode;
  const isAuto = mode === 'auto';
  $modeManualBtn?.classList.toggle('active', !isAuto);
  $modeAutoBtn?.classList.toggle('active', isAuto);
  $modeManualBtn?.setAttribute('aria-selected', String(!isAuto));
  $modeAutoBtn?.setAttribute('aria-selected', String(isAuto));
  if ($modeHint) {
    $modeHint.textContent = isAuto
      ? 'Enter the selector of the parent element only — the rest is worked out for you and shown for approval.'
      : 'Fill each selector yourself.';
  }
  // Show one route at a time. In Automatic mode the type picker, the CSS
  // Selector field, the sub-selector form and the preview are all things you
  // never touch — the AI cards carry their own copies — so hiding them is what
  // actually makes this tab readable, rather than shrinking everything.
  const manualOnly = document.getElementById('manualOnly');
  if (manualOnly) manualOnly.style.display = isAuto ? 'none' : '';
  const advanced = document.getElementById('autoAdvanced');
  if (advanced) {
    advanced.style.display = isAuto ? '' : 'none';
    if (!isAuto) advanced.open = false;
  }
  // The AI teacher lives in Automatic mode alongside the rule-based analyzer.
  // Everything AI, hidden together. Moving the scan button out of the box left
  // it visible in Manual mode, where it means nothing.
  for (const id of ['aiBox', 'aiRunRow']) {
    const el = document.getElementById(id);
    if (el) el.style.display = isAuto ? '' : 'none';
  }
  // Show a results panel only when it holds actual results. #aiResults has a
  // fixed shell (summary, list, buttons), so testing its own innerHTML would
  // always be truthy and leave an empty box with a dead button sitting there.
  // Count the CARDS, not the container. Both panels now hold a static carousel
  // shell, so testing the wrapper's children is always truthy and would leave
  // an empty carousel with dead arrows on screen.
  // ONE stage on screen. Restoring both — which is what happened when each had
  // content and they were toggled independently — puts the found list and the
  // mapping cards up together: two carousels with two positions again.
  // Whichever stage still has work to do is the one that comes back.
  const found = document.getElementById('aiResults');
  const maps = document.getElementById('aiMappings');
  const approved = document.getElementById('aiApproved');
  const pendingCards = document.querySelectorAll('#aiSlideTrack .ai-map-card:not([data-done])').length;
  const pendingFound = document.querySelectorAll('#aiCompTrack .ai-comp:not([data-done])').length;
  if (found) found.style.display = (isAuto && !pendingCards && pendingFound) ? 'block' : 'none';
  if (maps) maps.style.display = (isAuto && pendingCards) ? 'block' : 'none';
  if (approved) approved.style.display = (isAuto && approved.children.length) ? 'block' : 'none';
  if (!isAuto) hideAutoReview();
}

$modeManualBtn?.addEventListener('click', () => setMapMode('manual'));
$modeAutoBtn?.addEventListener('click', () => setMapMode('auto'));

// "Work the selectors out without AI" fills the manual form, so opening it has
// to bring that form back — otherwise Analyze & fill writes into a hidden box.
document.getElementById('autoAdvanced')?.addEventListener('toggle', (e) => {
  const manualOnly = document.getElementById('manualOnly');
  if (!manualOnly || mapMode !== 'auto') return;
  manualOnly.style.display = e.target.open ? '' : 'none';
});

function hideAutoReview() {
  autoResult = null;
  if ($autoReviewSection) $autoReviewSection.style.display = 'none';
  if ($autoReviewList) $autoReviewList.innerHTML = '';
}

document.getElementById('autoDismissBtn')?.addEventListener('click', hideAutoReview);

// ── The analyzer bridge ─────────────────────────────────────────────────────
// Pass 1 (isolated world): selector-intel.js walks the container's subtree,
// proposes candidates, and stamps the matched elements with data-u1-idx.
// Pass 2 (MAIN world): if the opt-in recorder is installed it reports the REAL
// listener types per stamped element; without it we keep the heuristic silently.
// Pass 3: clear the stamps so the page is left exactly as it was.
async function autoAnalyze(type, primary) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { err: 'Cannot run on this page.' };
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['selector-intel.js'] });
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t, p) => window.__u1SelectorIntel.analyze(t, p),
      args: [type, primary],
    });
    const out = (res && res[0] && res[0].result) || { err: 'No result' };

    if (out && out.stampCount) {
      let verified = null;
      try {
        const vr = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: () => {
            if (!window.__u1EventMap) return null; // recorder not installed
            const map = {};
            document.querySelectorAll('[data-u1-idx]').forEach(el => {
              const types = window.__u1EventMap.types(el);
              if (types.length) map[el.getAttribute('data-u1-idx')] = types;
            });
            return map;
          },
        });
        verified = (vr && vr[0]) ? vr[0].result : null;
      } catch { verified = null; }
      out.verified = verified;   // null = recorder absent → heuristic stands
    }

    // Always clear the stamps, even if the MAIN pass threw.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__u1SelectorIntel && window.__u1SelectorIntel.clearStamps(),
      });
    } catch {}
    return out;
  } catch (err) { return { err: err.message }; }
}

document.getElementById('autoAnalyzeBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('applyStatus');
  const type = $componentType.value;
  const primary = $primarySelectorInput.value.trim();
  if (!type) { showNotice(status, 'Pick a component type first.', 'error', 3000); return; }
  if (!primary) { showNotice(status, 'Enter the parent element’s selector first.', 'error', 3000); return; }

  const btn = document.getElementById('autoAnalyzeBtn');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Analyzing…';
  const res = await autoAnalyze(type, primary);
  btn.disabled = false; btn.textContent = original;

  if (!res || res.err) { showNotice(status, res?.err || 'Analysis failed.', 'error', 4000); return; }
  if (res.error) { showNotice(status, 'That selector is not valid CSS: ' + res.error, 'error', 4000); return; }
  if (res.notFound) { showNotice(status, 'Nothing on this page matches that selector.', 'error', 4000); return; }

  // Step 0 — does this even look like the component that was chosen? The
  // listbox-vs-menu distinction in particular is easy to get wrong, and U1
  // throws "Submenu must have a trigger element" when it is.
  let typeNote = null;
  try {
    const profile = await analyzeElement(primary);
    const rec = recommendComponent(profile);
    if (rec && rec.type !== type) {
      typeNote = `This looks more like a “${rec.type}” than a “${type}”. ` +
        (rec.notes && rec.notes[0] ? rec.notes[0].msg : '') +
        ' Change the Component Type above if you agree — the suggestions below assume ' + type + '.';
    }
  } catch {}

  autoResult = res;
  renderAutoReview(type, res, typeNote);
});

// One review row per field. A field with several plausible readings becomes a
// question with radio options instead of a pre-ticked answer.
function renderAutoReview(type, res, typeNote) {
  if (!$autoReviewList || !$autoReviewSection) return;
  const schema = COMPONENT_SCHEMAS[type] || {};
  const desc = schema.desc || {};
  const req = schema.req || [];
  const fields = res.fields || {};
  const keys = Object.keys(fields);

  let html = '';
  if (typeNote) html += `<div class="advisor-note warn" style="margin-bottom:10px;">⚠️ ${escapeHtml(typeNote)}</div>`;

  if (!res.hasRules) {
    html += `<div class="advisor-note warn">⚠️ There is no auto-fill recipe for “${escapeHtml(type)}” yet — fill the selectors by hand below.</div>`;
  } else if (!keys.length) {
    html += `<div class="advisor-note warn">⚠️ Nothing could be worked out inside that element. Check the parent selector points at the whole component, then fill the selectors by hand.</div>`;
  }

  for (const f of keys) {
    const list = fields[f];
    const ask = list.length > 1;
    const question = AUTO_QUESTIONS[type + '.' + f] || desc[f] || `Selector for “${f}”`;
    const isReq = req.includes(f);

    const cands = list.map((c, i) => {
      // A boolean option (e.g. menu's `menubar`) has no selector to grade or
      // highlight — show the value it should be set to and why.
      if (typeof c.bool === 'boolean') {
        return `
          <div class="auto-cand">
            <input type="checkbox" data-field="${escapeHtml(f)}" data-cand="${i}" checked>
            <code>${escapeHtml(f)} = ${c.bool ? 'on' : 'off'}</code>
          </div>
          <div class="auto-why">${escapeHtml(c.why || '')}</div>`;
      }
      const s = strengthOf(c.selector, { count: c.count, unique: SINGULAR_FIELDS.has(f) });
      const sig = signalLabel(c, res.verified);
      // `optIn` candidates are guesses the markup cannot settle (does hovering
      // open this menu?), so they start UNticked — a wrong guess there rewires
      // the widget to the wrong event.
      const control = ask
        ? `<input type="radio" name="auto-${escapeHtml(f)}" data-field="${escapeHtml(f)}" data-cand="${i}" ${i === 0 && !c.optIn ? 'checked' : ''}>`
        : `<input type="checkbox" data-field="${escapeHtml(f)}" data-cand="${i}" ${c.optIn ? '' : 'checked'}>`;
      return `
        <div class="auto-cand">
          ${control}
          <code>${escapeHtml(c.selector)}</code>
          <span class="auto-count">${c.count} match${c.count === 1 ? '' : 'es'}</span>
          <span class="sel-strength" data-level="${s.level}" style="position:static;transform:none;">${escapeHtml(s.label)}</span>
          <button class="btn-ghost auto-eye" data-eye="${escapeHtml(c.selector)}" title="Show on the page">👁</button>
        </div>
        <div class="auto-why">${escapeHtml(c.why || '')}${sig}</div>`;
    }).join('');

    html += `
      <div class="auto-row ${ask ? 'ask' : ''}" data-row="${escapeHtml(f)}">
        <div class="auto-q">
          <span>${ask ? '❓ ' : ''}${escapeHtml(question)}${isReq ? ' <span class="req-star">*</span>' : ''}</span>
          <span class="auto-field">${escapeHtml(f)}</span>
        </div>
        ${cands}
        ${ask ? `<div class="auto-why">Two readings fit — pick the one that matches what you see on the page (use 👁).</div>` : ''}
      </div>`;
  }

  // Fields with no suggestion at all: say so, rather than leaving them silent.
  const missing = (schema.fields || []).filter(f => !fields[f] && req.includes(f));
  for (const f of missing) {
    html += `
      <div class="auto-row skipped">
        <div class="auto-q"><span>${escapeHtml(AUTO_QUESTIONS[type + '.' + f] || f)}</span><span class="auto-field">${escapeHtml(f)}</span></div>
        <div class="auto-why">Could not be worked out automatically — this one is required, so fill it in by hand below.</div>
      </div>`;
  }

  $autoReviewList.innerHTML = html;
  $autoReviewSection.style.display = keys.length || typeNote || !res.hasRules ? 'block' : 'none';
  $autoReviewSection.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// "has a click event" badge: `verified` only when the opt-in recorder saw the
// real addEventListener call; otherwise the heuristic signals, labelled as such.
function signalLabel(c, verified) {
  if (verified) {
    const types = [];
    for (const i of (c.idxs || [])) {
      const t = verified[String(i)];
      if (t) for (const x of t) if (!types.includes(x)) types.push(x);
    }
    const clickish = types.filter(t => /^(click|mousedown|mouseup|mouseenter|mouseover|keydown|touchstart|pointerdown)$/.test(t));
    if (clickish.length) return `<span class="auto-sig verified" title="Recorded as the page loaded">✓ real handler: ${escapeHtml(clickish.join(', '))}</span>`;
  }
  const sigs = (c.signals || []).filter(Boolean);
  if (!sigs.length) return '';
  const first = sigs[0].split(' ').slice(0, 3).join(' ');
  return `<span class="auto-sig" title="Worked out from the markup, not measured">looks clickable: ${escapeHtml(first)}</span>`;
}

// Highlight a proposed selector on the page (reuses the inspect overlay).
$autoReviewList?.addEventListener('click', async (e) => {
  const eye = e.target.closest('.auto-eye');
  if (!eye) return;
  const sel = eye.dataset.eye;
  const on = eye.dataset.on !== '1';
  // Toggle: a second click clears the overlay.
  $autoReviewList.querySelectorAll('.auto-eye').forEach(b => { b.dataset.on = '0'; });
  eye.dataset.on = on ? '1' : '0';
  await highlightMatch(sel, 0, on);
  const result = await testSelector(sel);
  renderSelectorTest(result, sel);
});

// Write the ticked suggestions into the real form inputs, then run the existing
// Generate path so validation + preview behave exactly as in Manual mode.
document.getElementById('autoApplyBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('applyStatus');
  if (!autoResult || !autoResult.fields) { hideAutoReview(); return; }

  let filled = 0;
  $autoReviewList.querySelectorAll('input[data-field]').forEach(ctrl => {
    if (!ctrl.checked) return;
    const f = ctrl.dataset.field;
    const cand = (autoResult.fields[f] || [])[parseInt(ctrl.dataset.cand, 10)];
    if (!cand) return;
    const input = $subSelArea.querySelector(`input[data-field="${CSS.escape(f)}"]`) ||
                  $subSelArea.querySelector(`[data-root="${CSS.escape(f)}"]`);
    if (!input) return;
    if (typeof cand.bool === 'boolean') {
      if (input.type !== 'checkbox') return;
      input.checked = cand.bool;
    } else {
      input.value = cand.selector;
    }
    filled++;
  });

  await highlightMatch('', 0, false);
  hideAutoReview();
  await refreshStrength();
  showNotice(status, filled ? `Filled ${filled} selector${filled === 1 ? '' : 's'} — check them, then Generate.` : 'Nothing was ticked, so nothing changed.', filled ? 'success' : 'error', 4000);
  if (filled) document.getElementById('generateBtn')?.click();
});

// ─────────────────────────────────────────────────────────────────────────────
//  AI MODE — two stages, and the specialist decides at both.
//
//  Stage 1  "Find what's on this screen": screenshot with a number drawn on
//           every candidate element + the matching element list → an inventory
//           of components. Each row's TYPE and CONTAINER are editable inputs,
//           because a wrong guess must be correctable before it costs anything.
//  Stage 2  "Make these accessible": for each ticked row, the container's real
//           markup and its click-handler data go to Claude, which decides which
//           selector belongs in which field. The answer is rendered in THE SAME
//           form Manual mode uses — the AI replaces the typing, not the review.
//
//  Nothing is written to the mappings list until Save is pressed on a card, and
//  every selector still goes through the same U1 validation and strength meter.
// ─────────────────────────────────────────────────────────────────────────────

const $aiBox = document.getElementById('aiBox');
const $aiResults = document.getElementById('aiResults');
const $aiStatus = document.getElementById('aiStatus');
const $aiInstruction = document.getElementById('aiInstruction');
const $aiKeyRow = document.getElementById('aiKeyRow');
const $aiKeyInput = document.getElementById('aiKeyInput');

let aiFound = null;     // stage 1 result + the element context it was based on
let aiMapped = [];      // stage 2 cards, index-aligned with the DOM cards
let aiCost = 0;         // running spend for this panel session, in USD
let aiRowTimer = null;
let aiCardTimer = null;

// Nothing may reach a mapping that we did not observe on the page. A selector
// we produced is accepted outright; anything else only if every one of its
// simple tokens (.class / #id / [attr] / tag) came from one we produced. That
// allows the legitimate case — regrouping known classes into a comma group —
// while an invented name has nowhere to have come from and is rejected.
function checkAiSelector(value, context) {
  const intel = globalThis.__u1SelectorIntel;
  const norm = intel ? intel.normalize(value) : String(value || '').trim();
  if (!norm) return { ok: false, why: 'empty' };
  if (intel && !intel.isU1Valid(norm)) return { ok: false, why: 'U1 cannot use this selector (spaces or a pseudo-class)' };

  const known = new Set((context.candidates || []).map(c => c.selector).filter(Boolean));
  const TOKEN = /#[\w-]+|\.[\w-]+|\[[^\]]+\]|[a-z][\w-]*/gi;
  const knownTokens = new Set();
  for (const s of known) for (const t of (s.match(TOKEN) || [])) knownTokens.add(t);

  const invented = [];
  for (const branch of norm.split(',')) {
    if (known.has(branch)) continue;
    for (const t of (branch.match(TOKEN) || [])) if (!knownTokens.has(t)) invented.push(t);
  }
  if (invented.length) {
    const list = [...new Set(invented)].join(', ');
    return { ok: false, why: `invented — ${list} is on no element we found on the page` };
  }
  return { ok: true, value: norm };
}

document.getElementById('aiKeyToggle')?.addEventListener('click', async () => {
  const showing = $aiKeyRow.style.display !== 'none';
  $aiKeyRow.style.display = showing ? 'none' : '';
  if (!showing) await markKeyState();
});

// Reflect whether a key is saved, without ever rendering the key back.
async function markKeyState() {
  if (!$aiKeyInput || !globalThis.U1AI) return false;
  const saved = await U1AI.getKey();
  $aiKeyInput.placeholder = saved ? '•••••••• saved — type to replace' : 'sk-ant-…';
  const toggle = document.getElementById('aiKeyToggle');
  if (toggle) toggle.title = saved ? 'API key saved' : 'No API key yet — click to add one';
  return !!saved;
}

// Open the key field on first use rather than hiding it behind an icon: with it
// collapsed, the instruction box is the only thing that looks like an input,
// which is exactly how a key ends up pasted into the prompt.
// Runs at panel load, so it must not take the rest of panel.js down with it if
// ai-advisor.js is missing — Manual mode does not depend on the AI layer.
(async () => {
  try {
    if (!$aiKeyRow || !globalThis.U1AI) return;
    const hasKey = await markKeyState();
    if (!hasKey) $aiKeyRow.style.display = '';
    // Open the assistant only when there is something to do in it — a first
    // run needs the key and the prompt; afterwards the button is one click
    // away inside a closed accordion and the screen belongs to the results.
    if ($aiBox) $aiBox.open = !hasKey;
  } catch {}
})();

// An API key pasted into the instruction box would be sent to Claude as prompt
// text — a real leak, and an easy mistake to make when both fields sit in the
// same panel. Catch it on the way in: move it to the key field and say so,
// rather than letting it sit there looking accepted.
const LOOKS_LIKE_KEY = /\bsk-ant-[A-Za-z0-9_-]{10,}/;

$aiInstruction?.addEventListener('input', () => {
  const val = $aiInstruction.value;
  if (!LOOKS_LIKE_KEY.test(val)) return;
  const key = (val.match(LOOKS_LIKE_KEY) || [])[0];
  $aiInstruction.value = val.replace(LOOKS_LIKE_KEY, '').trim();
  $aiKeyRow.style.display = '';
  if ($aiKeyInput) { $aiKeyInput.value = key; $aiKeyInput.focus(); }
  showNotice($aiStatus, 'That looked like your API key — moved it to the key field above. Press “Save key”.', 'error', 7000);
});

document.getElementById('aiKeySave')?.addEventListener('click', async () => {
  const val = ($aiKeyInput.value || '').trim();
  if (!val) { showNotice($aiStatus, 'Paste a key first.', 'error', 3000); return; }
  await U1AI.setKey(val);
  $aiKeyInput.value = '';
  $aiKeyInput.placeholder = '•••••••• (saved — type to replace)';
  $aiKeyRow.style.display = 'none';
  showNotice($aiStatus, 'Key saved on this machine.', 'success', 3000);
});

// Run selector-intel in the page (injecting it first, idempotently).
async function inPage(tabId, fn, args) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['selector-intel.js'] });
  const res = await chrome.scripting.executeScript({ target: { tabId }, func: fn, args: args || [] });
  return res && res[0] ? res[0].result : null;
}

// Screenshot the visible tab and scale it down. The long edge is capped at
// 1568px: Claude accepts up to 2576px, but a full-resolution image costs up to
// ~3x the image tokens and this review does not need that fidelity.
function scaleShot(dataUrl, maxEdge) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const long = Math.max(img.width, img.height);
      const scale = long > maxEdge ? maxEdge / long : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// ── Stage 1: discover what is on the screen ─────────────────────────────────
document.getElementById('aiDiscoverBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('aiDiscoverBtn');
  const tab = await getTab();
  if (!isInjectable(tab)) { showNotice($aiStatus, 'Cannot read this page.', 'error', 4000); return; }
  if (!(await U1AI.getKey())) {
    $aiKeyRow.style.display = '';
    showNotice($aiStatus, 'Paste your Anthropic API key first.', 'error', 4000);
    return;
  }

  const original = btn.textContent;
  btn.disabled = true;
  try {
    showAiBusy('Reading the page…', 'Looking at what is on screen.');
    btn.textContent = 'Reading the page…';
    const context = await inPage(tab.id, () => window.__u1SelectorIntel.collectCandidates(60));
    if (!context || !context.candidates || !context.candidates.length) {
      showNotice($aiStatus, 'Nothing reviewable in the viewport — scroll to the part you want.', 'error', 5000);
      return;
    }

    // Draw the numbers, capture, then clear them again immediately so the page
    // is left as it was even if the request fails.
    showAiBusy('Capturing the screen…', 'Numbering every element so the answer can point at real ones.');
    btn.textContent = 'Capturing…';
    await inPage(tab.id, () => window.__u1SelectorIntel.drawMarks());
    await new Promise(r => setTimeout(r, 250)); // let the overlay paint
    let shot = null;
    try {
      const raw = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 85 });
      shot = await scaleShot(raw, 1568);
    } finally {
      await inPage(tab.id, () => window.__u1SelectorIntel.clearMarks());
    }
    if (!shot) { showNotice($aiStatus, 'Could not capture the screen.', 'error', 4000); return; }

    showAiBusy('Claude is looking…', 'Usually 10–30 seconds.');
    btn.textContent = 'Looking…';
    $aiStatus.textContent = 'Usually 10–30 seconds.';
    $aiStatus.className = 'map-mode-hint';
    $aiStatus.style.display = '';

    // Belt and braces: never let a credential reach the prompt, whatever route
    // it took into the box.
    const scope = $aiInstruction.value.replace(LOOKS_LIKE_KEY, '[removed]').trim();
    const out = await U1AI.discover({ screenshot: shot, context, scope });
    if (out.err) { showNotice($aiStatus, out.err, 'error', 8000); return; }

    // Deliberately NOT re-marking here. The 👁 buttons work off each row's
    // container selector, so they need nothing on the page — and re-marking
    // left data-u1-mark attributes scattered across the site's DOM, which both
    // pollutes what the specialist is inspecting and lands in any markup they
    // copy out of DevTools.
    aiFound = { ...out, context };
    aiCost += U1AI.estimateCost(out.usage) || 0;
    renderAiComponents(aiFound);
    $aiStatus.style.display = 'none';
    if ($aiBox) $aiBox.open = false;   // the results are the screen now
  } catch (err) {
    showNotice($aiStatus, 'Failed: ' + err.message, 'error', 6000);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
    // Belt and braces: never leave our own attributes on the site's DOM, even
    // if something threw between stamping and the capture's own cleanup.
    try {
      const t = await getTab();
      if (isInjectable(t)) await inPage(t.id, () => window.__u1SelectorIntel.clearMarks());
    } catch {}
  }
});

// Something to look at while it works. A panel that sits still for thirty
// seconds reads as broken, and the two slow steps here are a screenshot and a
// model call — neither of which can report progress, so the least we can do is
// say which one is running.
function showAiBusy(title, sub) {
  const results = document.getElementById('aiResults');
  const track = document.getElementById('aiCompTrack');
  if (!results || !track) return;
  results.style.display = 'block';
  const head = track.previousElementSibling;
  if (head) head.style.display = 'none';
  document.getElementById('aiSummary').innerHTML = '';
  track.innerHTML = `
    <div class="ai-busy">
      <div class="ai-busy-bar"><span></span></div>
      <div class="ai-busy-title">${escapeHtml(title)}</div>
      <div class="ai-busy-sub">${escapeHtml(sub || '')}</div>
      ${[0, 1, 2].map(() => '<div class="ai-skel"></div>').join('')}
    </div>`;
}

function showMapBusy(label, n, total) {
  const track = document.getElementById('aiSlideTrack');
  if (!track || track.querySelector('.ai-map-card')) return;   // real cards already in
  track.innerHTML = `
    <div class="ai-busy" id="aiMapBusy">
      <div class="ai-busy-bar"><span></span></div>
      <div class="ai-busy-title">Working out ${escapeHtml(label)} (${n} of ${total})</div>
      <div class="ai-busy-sub">Reading its markup and its click handlers.</div>
      ${[0, 1, 2, 3].map(() => '<div class="ai-skel"></div>').join('')}
    </div>`;
}

const clearMapBusy = () => document.getElementById('aiMapBusy')?.remove();

// The inventory. Every row's component type and container selector are inputs,
// not labels — a wrong guess is corrected here rather than worked around later.
function renderAiComponents(found) {
  const list = document.getElementById('aiComponentList');
  const comps = found.components || [];
  document.getElementById('aiSummary').innerHTML =
    escapeHtml(found.summary || '') +
    `<div class="ai-meta">${comps.length} component${comps.length === 1 ? '' : 's'} found` +
    ` · ${escapeHtml(found.model || '')} · ~$${aiCost.toFixed(3)} this session</div>`;

  const typeOptions = (sel) => U1AI.U1_TYPES
    .map(t => `<option value="${t}"${t === sel ? ' selected' : ''}>${t}</option>`).join('');

  const track = document.getElementById('aiCompTrack');

  track.innerHTML = comps.map((c, i) => {
    const chk = checkAiSelector(c.containerSelector, found.context);
    const bad = !chk.ok ? `<div class="ai-sel-bad">⛔ ${escapeHtml(chk.why)} — put another selector above, or handle this one by hand.</div>` : '';
    return `
      <div class="ai-comp" data-i="${i}">
        <div class="ai-comp-head">
          <span class="ai-comp-label">${escapeHtml(c.label || '')}</span>
          ${c.needsWork ? '<span class="ai-sev" data-need="1">needs work</span>'
                        : '<span class="ai-sev" data-need="0">looks ok</span>'}
        </div>

        <!-- The element is the thing being decided about, so it leads the card
             at full width — and stays editable, because a wrong container is
             the most common thing to correct. -->
        <label class="ai-comp-eltag" for="aiCompSel${i}">Element</label>
        <div class="ai-comp-elrow">
          <span class="sel-strength-wrap">
            <input type="text" class="ai-comp-sel" id="aiCompSel${i}"
                   value="${escapeHtml(c.containerSelector || '')}" spellcheck="false">
            <span class="sel-strength" data-level="empty" aria-hidden="true"></span>
          </span>
          <button class="btn-ghost auto-eye ai-comp-eye" title="Show it on the page">👁</button>
        </div>
        <div class="ai-comp-hit" id="aiCompHit${i}"></div>
        ${bad}

        <div class="ai-comp-why">${escapeHtml(c.why || '')}</div>

        <div class="ai-comp-fields">
          <label for="aiCompType${i}">Component type</label>
          <select class="ai-comp-type" id="aiCompType${i}">${typeOptions(c.u1Type)}</select>
        </div>

        <!-- One element, one action. A global tick plus a batch button counted
             selections across the whole list, so pressing it from the card in
             front of you started work on a different component entirely. -->
        <div class="ai-comp-actions">
          <button class="btn-primary" data-mapone="${i}" ${chk.ok ? '' : 'disabled'}>✨ Make this accessible</button>
        </div>
      </div>`;
  }).join('') || '<div class="advisor-note ok">✅ Nothing found that needs a mapping.</div>';

  document.getElementById('aiResults').style.display = 'block';
  document.getElementById('aiMappings').style.display = 'none';
  // Clear the CARDS, not the container: the carousel head and track are static
  // markup now, and wiping innerHTML took them out with the cards.
  document.getElementById('aiSlideTrack').innerHTML = '';
  document.getElementById('aiApproved').style.display = 'none';
  document.getElementById('aiApproved').innerHTML = '';
  showCompSlide(0);
  paintAiRowStrength();
}

const showCompSlide = (i) => slideTo('aiComp', i, '.ai-comp', () => paintAiRowStrength());

// Remove a conflicting older mapping, on request, from the approved list.
document.getElementById('aiApproved')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-dropkey]');
  if (!btn) return;
  const key = storageKey('mappings', currentHostname);
  const list = (await U1Store.get([key]))[key] || [];
  const next = list.filter(m => mappingKey(m) !== btn.dataset.dropkey);
  if (next.length === list.length) { btn.textContent = 'Already gone'; btn.disabled = true; return; }
  await U1Store.set({ [key]: next });
  loadMappingsList();
  refreshExportInfo();
  btn.textContent = 'Removed ✓';
  btn.disabled = true;
});

// Keep the "Make these accessible" button honest about how many are ticked —
// with one card on screen at a time, the count is the only way to know.
async function paintAiRowStrength() {
  const rows = [...document.querySelectorAll('#aiComponentList .ai-comp')];
  if (!rows.length) return;
  const sels = rows.map(r => r.querySelector('.ai-comp-sel').value.trim());
  rows.forEach((r, i) => paintStrength(r.querySelector('.sel-strength'), strengthOf(sels[i], { unique: true })));
  const counts = await countSelectors(sels);
  rows.forEach((r, i) => {
    if (r.querySelector('.ai-comp-sel').value.trim() !== sels[i]) return;
    const o = { unique: true };
    if (typeof counts[i] === 'number') o.count = counts[i];
    paintStrength(r.querySelector('.sel-strength'), strengthOf(sels[i], o));
  });
}

// 👁 — highlight the container on the page and say how many it matches. The
// handler for this was lost when the tick counter was removed, so the button
// rendered and did nothing; and its result used to go to the shared test panel
// in the manual area, which is not on screen in this mode.
document.getElementById('aiCompTrack')?.addEventListener('click', async (e) => {
  const eye = e.target.closest('.ai-comp-eye');
  if (!eye) return;
  const comp = eye.closest('.ai-comp');
  const sel = comp.querySelector('.ai-comp-sel').value.trim();
  const hit = document.getElementById('aiCompHit' + comp.dataset.i);
  if (!sel) return;
  eye.disabled = true;
  try {
    const res = await testSelector(sel);
    if (hit) {
      const n = res && typeof res.count === 'number' ? res.count : null;
      hit.className = 'ai-comp-hit ' + (n === 1 ? 'ok' : n ? 'warn' : 'bad');
      hit.textContent = res && res.err ? res.err
        : n === null ? ''
        : n === 0 ? 'Matches nothing on this page.'
        : n === 1 ? '1 match — highlighted on the page.'
        : `${n} matches — highlighted. u1.fix decorates only one of them.`;
    }
    if (res && res.count) {
      await highlightMatch(sel, 0, true);
      setTimeout(() => highlightMatch(sel, 0, false), 2500);
    }
  } finally {
    eye.disabled = false;
  }
});

// Re-grade a container selector as it is edited — the badge is the fastest way
// to see that a hand-typed selector matches nothing.
document.getElementById('aiComponentList')?.addEventListener('input', (e) => {
  if (!e.target.classList.contains('ai-comp-sel')) return;
  clearTimeout(aiRowTimer);
  aiRowTimer = setTimeout(paintAiRowStrength, 400);
});

// Map ONE component, on demand, from its own card. No ticking, no batch: the
// button you press is about the element you are looking at.
document.getElementById('aiCompTrack')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-mapone]');
  if (!btn) return;
  const status = document.getElementById('aiMapStatus');
  if (isReadonly()) {
    showNotice(status, 'Licence expired — existing mappings still work and export, but new ones are paused.', 'error', 6000);
    return;
  }

  const comp = btn.closest('.ai-comp');
  const row = {
    type: comp.querySelector('.ai-comp-type').value,
    sel: comp.querySelector('.ai-comp-sel').value.trim(),
    label: comp.querySelector('.ai-comp-label').textContent,
    compIndex: comp.dataset.i,
  };
  if (!row.sel || !COMPONENT_SCHEMAS[row.type]) {
    showNotice(status, 'Give this one a container selector and a component type first.', 'error', 4000);
    return;
  }

  const tab = await getTab();
  if (!isInjectable(tab)) { showNotice(status, 'Cannot read this page.', 'error', 4000); return; }

  const host = document.getElementById('aiMappings');
  const track = document.getElementById('aiSlideTrack');
  host.style.display = 'block';
  document.getElementById('aiResults').style.display = 'none';

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Working…';
  comp.classList.add('is-working');
  showMapBusy(row.label, 1, 1);

  try {
    const markup = await inPage(tab.id, (s) => window.__u1SelectorIntel.extractComponent(s), [row.sel]);
    if (!markup || markup.error || markup.notFound) {
      clearMapBusy();
      track.insertAdjacentHTML('beforeend', aiMapCardError(row, markup?.error || 'that selector matches nothing on the page'));
      showSlide(0);
      return;
    }

    const schema = COMPONENT_SCHEMAS[row.type];
    const out = await U1AI.mapComponent({
      u1Type: row.type,
      containerSel: row.sel,
      markup,
      fields: schema.fields || [],
      fieldDocs: schema.desc || {},
      options: Object.keys(schema.rootFields || {}),
    });
    aiCost += U1AI.estimateCost(out.usage) || 0;
    clearMapBusy();
    if (out.err) { track.insertAdjacentHTML('beforeend', aiMapCardError(row, out.err)); showSlide(0); return; }

    const idx = aiMapped.length;
    aiMapped.push({ row, result: out, markup });
    track.insertAdjacentHTML('beforeend', renderAiMapCard(idx, row, out, markup.recorderActive));
    fillAiMapCard(idx, row, out);
    showSlide(slideIndex('aiSlide'));
    document.querySelector(`#aiSlideTrack .ai-map-card[data-card="${idx}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (err) {
    clearMapBusy();
    showNotice(status, 'Failed: ' + err.message, 'error', 6000);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
    comp.classList.remove('is-working');
  }
});

const aiMapCardError = (row, why) => `
  <div class="ai-map-card">
    <div class="ai-map-head"><strong>${escapeHtml(row.label)}</strong>
      <span class="ai-conf" data-c="low">failed</span></div>
    <div class="ai-comp-why">${escapeHtml(why)}</div>
  </div>`;

function renderAiMapCard(idx, row, out, recorderActive) {
  const conf = ['high', 'medium', 'low'].includes(out.confidence) ? out.confidence : 'medium';
  return `
    <div class="ai-map-card" data-card="${idx}">
      <div class="ai-map-head">
        <strong>${escapeHtml(row.label)}</strong>
        <code>u1.fix.${escapeHtml(row.type)}</code>
        <span class="ai-conf" data-c="${conf}">${conf} confidence</span>
      </div>
      ${out.notes ? `<div class="ai-comp-why">⚠️ ${escapeHtml(out.notes)}</div>` : ''}

      <!-- Neither the code nor the form is what you came for: you came to
           approve this element. Both are here when you want them, folded. -->
      <details class="ai-map-code">
        <summary>Show the code</summary>
        <div class="code-preview" id="aiMapCode${idx}"></div>
      </details>

      <details class="ai-map-edit">
        <summary>✍️ Edit the selectors</summary>
        <div class="ai-comp-why">${recorderActive
          ? '✓ Triggers identified from the real click handlers recorded on this page.'
          : 'Triggers were worked out from tags and attributes. For measured handlers, switch on precise event detection and reload the page.'}</div>
        <div class="ai-map-form" id="aiMapForm${idx}"></div>
      </details>

      <!-- Talk to it about THIS mapping. It still has the markup this was built
           from and the config it produced, so "map submenus to the parent div,
           not the button" is an edit it can make rather than a fresh guess. -->
      <div class="ai-ask">
        <input type="text" class="ai-ask-input" data-askinput="${idx}"
               placeholder="Tell it what to change — e.g. “submenus should be the parent div, not the button”">
        <button class="btn-outline btn-sm" data-askfix="${idx}">Ask</button>
      </div>

      <div class="ai-find-actions">
        <button class="btn-primary btn-sm" data-savecard="${idx}">✓ Approve &amp; apply</button>
        <button class="btn-ghost btn-sm" data-skipcard="${idx}">Skip</button>
        <button class="btn-ghost btn-sm" data-editcard="${idx}">Open in builder</button>
        <button class="btn-ghost btn-sm" data-askwhy="${idx}">🤔 It isn't working — why?</button>
      </div>
      <div class="ai-why" id="aiWhy${idx}" style="display:none;"></div>
    </div>`;
}

// What to do after approving: carry on with what is left, or start a new scan.
// Rendered under the approved list and kept in step with what remains.
function renderApprovedNext() {
  const box = document.getElementById('aiApproved');
  if (!box || !box.children.length) return;
  const left = document.querySelectorAll('#aiCompTrack .ai-comp:not([data-done])').length;
  const cards = document.querySelectorAll('#aiSlideTrack .ai-map-card:not([data-done])').length;

  let el = document.getElementById('aiNextRow');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aiNextRow';
    el.className = 'ai-next-row';
    box.appendChild(el);
  }
  el.innerHTML = cards
    ? `<button class="btn-primary btn-sm" data-ainext="cards">Next mapping →<span class="ai-next-count">${cards} left</span></button>`
    : left
      ? `<button class="btn-primary btn-sm" data-ainext="list">Next → back to what was found<span class="ai-next-count">${left} left</span></button>`
      : `<button class="btn-primary btn-sm" data-ainext="scan">🔎 Scan this screen again</button>` +
        `<span class="ai-next-hint">Everything found here has been handled. Scroll the page or open another one, then scan again.</span>`;
}

document.getElementById('aiApproved')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-ainext]');
  if (!btn) return;
  const what = btn.dataset.ainext;
  if (what === 'cards') {
    document.getElementById('aiMappings').style.display = 'block';
    showSlide(slideIndex('aiSlide'));
    document.querySelector('#aiSlideTrack .ai-map-card:not([data-done])')
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } else if (what === 'list') {
    document.getElementById('aiResults').style.display = 'block';
    document.getElementById('aiMappings').style.display = 'none';
    showCompSlide(slideIndex('aiComp'));
    document.getElementById('aiResults').scrollIntoView({ block: 'start', behavior: 'smooth' });
  } else {
    document.getElementById('aiDiscoverBtn')?.click();
  }
});

// Replace a pending row's verdict once the page has actually been measured.
function updateApproved(rowId, verdict) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const tick = row.querySelector('.ai-approved-tick');
  if (tick) { tick.className = 'ai-approved-tick ' + (verdict.ok ? 'ok' : 'warn'); tick.textContent = verdict.ok ? '✓' : '!'; }
  const why = row.querySelector('.ai-approved-why');
  if (why) why.textContent = verdict.msg;
  if (verdict.clashes && verdict.clashes.length) {
    why?.insertAdjacentHTML('afterend', `<div class="ai-approved-why">${verdict.clashes.map(c =>
      `<button class="btn-outline btn-xs" data-dropkey="${escapeHtml(c.key)}">Remove u1.fix.${escapeHtml(c.type)} on ${escapeHtml(c.sel)}</button>`).join(' ')}</div>`);
  }
}

// ── Carousels ───────────────────────────────────────────────────────────────
// One card at a time, for both stages. At side-panel width a stack of cards is
// the wall of controls that made this unreadable; a card that gets the full
// width gets read. Cards marked data-done="1" (approved, skipped) drop out.
const carouselAt = {};   // id -> current index

// `id` is the track prefix; `sel` matches the cards inside it.
function slideTo(id, i, sel, onShow) {
  const track = document.getElementById(id + 'Track');
  if (!track) return;
  const all = [...track.querySelectorAll(sel)];
  all.forEach(c => { c.style.display = 'none'; });
  const cards = all.filter(c => c.dataset.done !== '1');

  const head = track.previousElementSibling;
  if (!cards.length) {
    if (head) head.style.display = 'none';
    const host = track.closest('.ai-results');
    if (host && !all.some(c => c.dataset.done !== '1')) host.style.display = 'none';
    return;
  }
  if (head) head.style.display = '';

  const at = Math.max(0, Math.min(i, cards.length - 1));
  carouselAt[id] = at;
  cards[at].style.display = '';

  const count = document.getElementById(id + 'Count');
  if (count) count.textContent = `${at + 1} / ${cards.length}`;
  const [prev, next] = [`[data-slide="${id}:prev"]`, `[data-slide="${id}:next"]`]
    .map(s => document.querySelector(s));
  if (prev) prev.disabled = at === 0;
  if (next) next.disabled = at >= cards.length - 1;
  if (onShow) onShow(cards[at]);
}

// Stage 2 keeps its own thin wrapper so the call sites stay readable.
const showSlide = (i) => {
  slideTo('aiSlide', i, '.ai-map-card', (card) => refreshAiCard(Number(card.dataset.card)));
  renderApprovedNext();
};
const slideIndex = (id) => carouselAt[id] || 0;

// Delegated prev/next for every carousel on the tab.
document.getElementById('tab-picker')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-slide]');
  if (!btn) return;
  const [id, dir] = btn.dataset.slide.split(':');
  const at = carouselAt[id] || 0;
  if (id === 'aiSlide') showSlide(dir === 'next' ? at + 1 : at - 1);
  else showCompSlide(dir === 'next' ? at + 1 : at - 1);
});

// Approved mappings collect here, each carrying whether it actually took effect
// on the page — the same measured verdict the Apply button reports.
let approvedSeq = 0;

function addApproved(row, verdict, code) {
  const box = document.getElementById('aiApproved');
  if (!box) return null;
  // The stage caption comes from CSS (#aiApproved::before), so this only needs
  // the list container.
  if (!box.children.length) box.innerHTML = '<div id="aiApprovedList"></div>';
  box.style.display = 'block';
  const cls = verdict.ok ? 'ok' : 'warn';
  // A conflicting older mapping is actionable, so offer the action rather than
  // just naming the problem — but never delete anything without being asked.
  const clashBtns = (verdict.clashes || []).map(c =>
    `<button class="btn-outline btn-xs" data-dropkey="${escapeHtml(c.key)}">Remove u1.fix.${escapeHtml(c.type)} on ${escapeHtml(c.sel)}</button>`).join(' ');

  const rowId = 'aiApproved' + (++approvedSeq);
  // Approving the last card leaves this list on screen with nothing to do
  // next, which reads as being stuck. Give the run somewhere to go.
  queueMicrotask(renderApprovedNext);
  document.getElementById('aiApprovedList').insertAdjacentHTML('beforeend', `
    <div class="ai-approved-row" id="${rowId}">
      <span class="ai-approved-tick ${cls}">${verdict.ok ? '✓' : '!'}</span>
      <span class="ai-approved-label">${escapeHtml(row.label)}</span>
      <code>u1.fix.${escapeHtml(row.type)}</code>
      <div class="ai-approved-why">${escapeHtml(verdict.msg)}</div>
      ${code ? `<details class="ai-approved-code"><summary>Show the code that was applied</summary><div class="code-preview">${escapeHtml(code)}</div></details>` : ''}
      ${clashBtns ? `<div class="ai-approved-why">${clashBtns}</div>` : ''}
    </div>`);
  return rowId;
}

// Renders the standard sub-selector rows into a card and fills them with the
// AI's answer. Reuses renderSubSelectorInputs by pointing it at this card's
// container, so the markup, hints, 🔍 testers and strength badges are identical
// to Manual mode — the AI only replaces the typing.
function fillAiMapCard(idx, row, out) {
  const form = document.getElementById('aiMapForm' + idx);
  if (!form) return;
  const schema = COMPONENT_SCHEMAS[row.type];
  const pKey = primaryKeyOf(schema);

  form.innerHTML =
    `<div class="sub-sel-row">
       <div class="key">${escapeHtml(pKey || 'selector')} <span class="req-star">*</span></div>
       <span class="sel-strength-wrap">
         <input type="text" data-field="__primary" value="${escapeHtml(out.primary || row.sel)}">
         <span class="sel-strength" data-level="empty" aria-hidden="true"></span>
       </span>
       <button class="btn-ghost btn-xs sel-test" title="Test selector on page">🔍</button>
     </div>`;
  renderSubSelectorInputs(row.type, form, { append: true });

  const byKey = {};
  for (const f of (out.fields || [])) byKey[f.key] = f;
  for (const f of (schema.fields || [])) {
    const inp = form.querySelector(`input[data-field="${CSS.escape(f)}"]`);
    if (inp && byKey[f]) {
      inp.value = byKey[f].value;
      if (byKey[f].why) {
        const hint = inp.closest('.sub-sel-row')?.querySelector('.input-hint');
        if (hint) hint.insertAdjacentHTML('beforeend', `<div class="strength-why">AI: ${escapeHtml(byKey[f].why)}</div>`);
      }
    }
  }
  for (const o of (out.options || [])) {
    const inp = form.querySelector(`[data-root="${CSS.escape(o.key)}"]`);
    if (!inp) continue;
    if (inp.type === 'checkbox') inp.checked = !/^(false|no|off|0)$/i.test(String(o.value).trim());
    else inp.value = o.value;
  }
  // A menu with submenus MUST have menubar off, or u1 throws
  // "Submenu must have a trigger element".
  if (row.type === 'menu' && byKey.submenus && !(out.options || []).some(o => o.key === 'menubar')) {
    const mb = form.querySelector('[data-root="menubar"]');
    if (mb && mb.type === 'checkbox') mb.checked = false;
  }

  refreshAiCard(idx);
}

// Build the template from one card's inputs (the card-scoped twin of
// buildTemplateFromForm), refresh its code preview and its strength badges.
function aiCardTemplate(idx) {
  const form = document.getElementById('aiMapForm' + idx);
  const entry = aiMapped[idx];
  if (!form || !entry) return null;
  const primary = form.querySelector('input[data-field="__primary"]').value.trim();
  if (!primary) return null;
  const fieldValues = {};
  form.querySelectorAll('input[type="text"][data-field]').forEach(inp => {
    if (inp.dataset.field !== '__primary') fieldValues[inp.dataset.field] = inp.value.trim();
  });
  const rootValues = {};
  form.querySelectorAll('[data-root]').forEach(inp => {
    rootValues[inp.dataset.root] = inp.type === 'checkbox' ? inp.checked : inp.value.trim();
  });
  return buildTemplate(entry.row.type, primary, fieldValues, rootValues);
}

async function refreshAiCard(idx) {
  const tpl = aiCardTemplate(idx);
  const pre = document.getElementById('aiMapCode' + idx);
  if (pre) pre.textContent = tpl ? tpl.code : '';
  const form = document.getElementById('aiMapForm' + idx);
  if (!form) return;
  const wraps = [...form.querySelectorAll('.sel-strength-wrap')];
  const sels = wraps.map(w => w.querySelector('input').value.trim());
  wraps.forEach((w, i) => {
    const key = w.querySelector('input').dataset.field || '';
    paintStrength(w.querySelector('.sel-strength'), strengthOf(sels[i], { unique: key === '__primary' || SINGULAR_FIELDS.has(key) }));
  });
  const counts = await countSelectors(sels);
  wraps.forEach((w, i) => {
    const inp = w.querySelector('input');
    if (inp.value.trim() !== sels[i]) return;
    const key = inp.dataset.field || '';
    const o = { unique: key === '__primary' || SINGULAR_FIELDS.has(key) };
    if (typeof counts[i] === 'number') o.count = counts[i];
    paintStrength(w.querySelector('.sel-strength'), strengthOf(sels[i], o));
  });
}

document.getElementById('aiMappings')?.addEventListener('input', (e) => {
  const card = e.target.closest('[data-card]');
  if (!card) return;
  clearTimeout(aiCardTimer);
  aiCardTimer = setTimeout(() => refreshAiCard(Number(card.dataset.card)), 400);
});
document.getElementById('aiMappings')?.addEventListener('change', (e) => {
  const card = e.target.closest('[data-card]');
  if (card && e.target.matches('[data-root]')) refreshAiCard(Number(card.dataset.card));
});

document.getElementById('aiMappings')?.addEventListener('click', async (e) => {
  const skip = e.target.closest('[data-skipcard]');
  if (skip) {
    skip.closest('.ai-map-card').dataset.done = '1';
    showSlide(slideIndex('aiSlide'));
    return;
  }

  const save = e.target.closest('[data-savecard]');
  if (save) {
    const idx = Number(save.dataset.savecard);
    const tpl = aiCardTemplate(idx);
    const status = document.getElementById('aiMapStatus');
    if (isReadonly()) {
      showNotice(status, 'Licence expired — existing mappings still work and export, but new ones are paused.', 'error', 6000);
      return;
    }
    if (!tpl) { showNotice(status, 'Nothing to save — the selector is empty.', 'error', 3500); return; }

    save.disabled = true; save.textContent = 'Saving…';

    try {
      await saveMappingEntry(tpl);
    } catch (e) {
      save.disabled = false; save.textContent = '✓ Approve & apply';
      showNotice(status, e.message, 'error', 12000);
      return;
    }

    // Move on NOW. Verifying what U1 did means waiting for U1, and that wait
    // belongs to the report, not to you — blocking the carousel on it made
    // approving feel like it took a minute.
    const card = save.closest('.ai-map-card');
    card.dataset.done = '1';
    const row = aiMapped[idx].row;
    if (row.compIndex != null) {
      const comp = document.querySelector(`#aiCompTrack .ai-comp[data-i="${CSS.escape(row.compIndex)}"]`);
      if (comp) { comp.dataset.done = '1'; showCompSlide(slideIndex('aiComp')); }
    }
    const rowId = addApproved(row, { ok: true, msg: 'Saved. Applying…' }, tpl.code);
    showSlide(slideIndex('aiSlide'));
    const next = document.querySelector('#aiSlideTrack .ai-map-card:not([data-done])');
    if (next) next.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else document.getElementById('aiApproved')?.scrollIntoView({ block: 'start', behavior: 'smooth' });

    // ── everything below runs in the background ──
    (async () => {
      const mkey = storageKey('mappings', currentHostname);
      const existing = (await U1Store.get([mkey]))[mkey] || [];
      const clashes = await overlappingMappings(tpl.primary, existing);

      const res = await applyMappingsBatch([{
        type: tpl.type, primary: tpl.primary, firstArg: tpl.firstArg, config: tpl.config,
      }]);
      const d = (res.details || [])[0];
      let verdict;
      if (!res.ok) {
        verdict = { ok: false, msg: res.u1Missing ? 'Saved. U1 is not loaded on this page, so nothing was applied.' : 'Saved, but applying failed: ' + (res.err || 'unknown') };
      } else if (res.applied) {
        verdict = { ok: true, msg: `Applied — ${d.changed} element${d.changed === 1 ? '' : 's'} changed on the page.` };
        if (d.fieldsNoEffect && d.fieldsNoEffect.length) {
          verdict.ok = false;
          verdict.msg += ` But ${d.fieldsNoEffect.map(f => `"${f}"`).join(', ')} changed nothing — U1 decorated the container and left ${d.fieldsNoEffect.length === 1 ? 'that field' : 'those fields'} alone. Check the selector, or whether this component supports it.`;
        }
        if (d.unblocked) {
          verdict.ok = false;
          verdict.msg += ` Note: ${d.sel} carries u1st-avoid-change-detection in the site's HTML. It was lifted here so the fix could run — remove it from the markup or this will not work in production.`;
        }
      } else if (d && d.status === 'error') {
        verdict = { ok: false, msg: `Saved, but u1.fix.${d.type} threw: ${(res.errs && res.errs[0]) || 'unknown error'}` };
      } else if (d && d.status === 'no-match') {
        verdict = { ok: false, msg: `Saved, but nothing on the page matches ${d.sel}.` };
      } else if (d && d.reason === 'source-opt-out') {
        verdict = { ok: false, msg: `Saved, but ${d.sel} carries u1st-avoid-change-detection in the site's own HTML — U1 skips it.` };
      } else if (d && d.reason === 'already-processed') {
        verdict = { ok: false, msg: 'Saved, but U1 had already processed this element this page load. Reload the page and press Apply All.' };
      } else {
        verdict = { ok: false, msg: 'Saved, but nothing changed on the page — u1.fix ran without error and wrote no attributes.' };
      }
      if (clashes.length) {
        verdict.clashes = clashes;
        verdict.ok = false;
        verdict.msg += ` Also: ${clashes.map(c => `u1.fix.${c.type} on ${c.sel}`).join(', ')} already targets these elements — two components on the same DOM fight, and the second wins.`;
      }
      updateApproved(rowId, verdict);
    })();
    return;
  }

  const askFix = e.target.closest('[data-askfix]');
  if (askFix) {
    const idx = Number(askFix.dataset.askfix);
    const entry = aiMapped[idx];
    const input = document.querySelector(`[data-askinput="${idx}"]`);
    const instruction = (input?.value || '').trim();
    if (!entry || !instruction) { input?.focus(); return; }

    const card = askFix.closest('.ai-map-card');
    askFix.disabled = true;
    const label = askFix.textContent;
    askFix.textContent = 'Asking…';
    card.classList.add('is-working');

    const tpl = aiCardTemplate(idx);
    const schema = COMPONENT_SCHEMAS[entry.row.type];
    const out = await U1AI.mapComponent({
      u1Type: entry.row.type,
      containerSel: entry.row.sel,
      markup: entry.markup,
      fields: schema.fields || [],
      fieldDocs: schema.desc || {},
      options: Object.keys(schema.rootFields || {}),
      instruction,
      current: tpl ? tpl.config : entry.result,
    });
    aiCost += U1AI.estimateCost(out.usage) || 0;
    askFix.disabled = false;
    askFix.textContent = label;
    card.classList.remove('is-working');

    const status = document.getElementById('aiMapStatus');
    if (out.err) { showNotice(status, out.err, 'error', 8000); return; }

    // Rebuild the card's form from the revised answer, and say what moved.
    const beforeFields = {};
    for (const f of (entry.result.fields || [])) beforeFields[f.key] = f.value;
    aiMapped[idx].result = out;
    fillAiMapCard(idx, entry.row, out);
    if (input) input.value = '';
    const moved = (out.fields || []).filter(f => beforeFields[f.key] !== f.value).map(f => f.key);
    showNotice(status, moved.length ? `Updated: ${moved.join(', ')}.` : 'It kept the same selectors.', 'success', 5000);
    document.querySelector(`#aiSlideTrack .ai-map-card[data-card="${idx}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }

  const why = e.target.closest('[data-askwhy]');
  if (why) {
    const idx = Number(why.dataset.askwhy);
    const entry = aiMapped[idx];
    const box = document.getElementById('aiWhy' + idx);
    if (!entry || !box) return;
    const tpl = aiCardTemplate(idx);
    why.disabled = true;
    const label = why.textContent;
    why.textContent = 'Asking…';
    box.style.display = 'block';
    box.innerHTML = '<div class="ai-busy"><div class="ai-busy-bar"><span></span></div>' +
      '<div class="ai-busy-sub">Reading the markup this mapping was built from, and what actually changed.</div></div>';

    // Measure first, so the question carries evidence instead of a complaint.
    const res = tpl ? await applyMappingsBatch([{
      type: tpl.type, primary: tpl.primary, firstArg: tpl.firstArg, config: tpl.config,
    }]) : null;
    const d = (res && res.details || [])[0];
    const outcome = !res ? 'The mapping could not be rebuilt from the form.'
      : !res.ok ? (res.u1Missing ? 'window.u1 is not loaded on the page at all.' : 'Applying failed: ' + res.err)
      : d && d.status === 'error' ? `u1.fix.${d.type} threw: ${(res.errs || [])[0] || 'unknown'}`
      : d && d.status === 'no-match' ? `Nothing on the page matches ${d.sel}.`
      : res.applied
        ? `${d.changed} element(s) gained U1 attributes.` +
          (d.fieldsNoEffect && d.fieldsNoEffect.length
            ? ` These fields changed nothing at all: ${d.fieldsNoEffect.join(', ')}.`
            : ' Every configured field changed something.')
        : `Nothing changed at all. u1.fix ran without throwing and wrote no attributes.${d && d.reason ? ' Reason recorded: ' + d.reason + '.' : ''}`;

    const out = await U1AI.diagnose({
      u1Type: entry.row.type,
      containerSel: entry.row.sel,
      config: tpl ? tpl.config : entry.result,
      markup: entry.markup,
      outcome,
    });
    aiCost += U1AI.estimateCost(out.usage) || 0;
    why.disabled = false;
    why.textContent = label;

    if (out.err) { box.innerHTML = `<div class="ai-sel-bad">${escapeHtml(out.err)}</div>`; return; }
    const fixSel = (out.fix && out.fix.selectors) || [];
    box.innerHTML =
      `<div class="ai-why-head"><strong>${escapeHtml(out.verdict || '')}</strong>` +
      `<span class="ai-conf" data-c="${escapeHtml(out.confidence || 'medium')}">${escapeHtml(out.confidence || '')}</span></div>` +
      `<div class="ai-comp-why">${escapeHtml(out.cause || '')}</div>` +
      (out.fix && out.fix.what ? `<div class="ai-why-fix"><strong>Fix:</strong> ${escapeHtml(out.fix.what)}</div>` : '') +
      fixSel.map(s => `<div class="ai-fix-sel"><strong>${escapeHtml(s.key)}</strong>: ${escapeHtml(s.value)}</div>`).join('') +
      (fixSel.length ? `<div class="ai-find-actions"><button class="btn-outline btn-xs" data-applywhy="${idx}">Use these selectors</button></div>` : '');
    return;
  }

  const useFix = e.target.closest('[data-applywhy]');
  if (useFix) {
    const idx = Number(useFix.dataset.applywhy);
    const form = document.getElementById('aiMapForm' + idx);
    const box = document.getElementById('aiWhy' + idx);
    if (!form || !box) return;
    for (const row of box.querySelectorAll('.ai-fix-sel')) {
      const key = row.querySelector('strong')?.textContent;
      const val = row.textContent.replace(/^[^:]*:\s*/, '');
      const inp = form.querySelector(`input[data-field="${CSS.escape(key)}"]`)
        || (key === 'primary' ? form.querySelector('input[data-field="__primary"]') : null);
      if (inp) inp.value = val;
    }
    await refreshAiCard(idx);
    useFix.textContent = 'Applied to the form ✓';
    useFix.disabled = true;
    return;
  }

  const edit = e.target.closest('[data-editcard]');
  if (edit) {
    // Hand this card off to the Manual builder, unchanged.
    const idx = Number(edit.dataset.editcard);
    const tpl = aiCardTemplate(idx);
    if (!tpl) return;
    loadMappingIntoForm({ type: tpl.type, primary: tpl.primary, config: tpl.config });
  }
});

// ── Precise event detection (opt-in) ────────────────────────────────────────
// Registered dynamically rather than in manifest.json so the recorder only runs
// on pages when the specialist has asked for it. `scripting` + <all_urls> are
// already granted, so no manifest change is needed.
const RECORDER_ID = 'u1-event-recorder';
// A device-local preference, not project data: the `__` prefix keeps it out of
// exported backups (U1Store.getExportable strips private keys).
const PRECISE_EVENTS_KEY = U1Store.PRIVATE_PREFIX + 'preciseEvents';

async function setPreciseEvents(on) {
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [RECORDER_ID] });
    if (on && !existing.length) {
      await chrome.scripting.registerContentScripts([{
        id: RECORDER_ID,
        matches: ['<all_urls>'],
        js: ['event-recorder.js'],
        runAt: 'document_start',
        world: 'MAIN',
        allFrames: false,
      }]);
    } else if (!on && existing.length) {
      await chrome.scripting.unregisterContentScripts({ ids: [RECORDER_ID] });
    }
    await U1Store.set({ [PRECISE_EVENTS_KEY]: !!on });
    return true;
  } catch (err) {
    showNotice(document.getElementById('applyStatus'), 'Could not change event detection: ' + err.message, 'error', 4000);
    return false;
  }
}

$preciseEventsToggle?.addEventListener('change', async () => {
  const on = $preciseEventsToggle.checked;
  const ok = await setPreciseEvents(on);
  if (!ok) { $preciseEventsToggle.checked = !on; return; }
  showNotice(document.getElementById('applyStatus'),
    on ? 'Event recording is on — reload the page once, then Analyze again.' : 'Back to working it out from the markup.',
    'success', 4000);
});

// Restore the toggle's state on load (and re-register, since dynamic scripts do
// persist but the checkbox has to agree with reality either way).
(async () => {
  if (!$preciseEventsToggle) return;
  try {
    const stored = await U1Store.get(PRECISE_EVENTS_KEY);
    const wanted = !!stored[PRECISE_EVENTS_KEY];
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [RECORDER_ID] });
    $preciseEventsToggle.checked = !!existing.length || wanted;
    if (wanted && !existing.length) await setPreciseEvents(true);
  } catch {}
})();

// ─────────────────────────────────────────────────────────────────────────────
//  Smart Advisor — inspect the selected element on the live page and recommend
//  the right component type + sub-selectors, and warn about common mistakes.
// ─────────────────────────────────────────────────────────────────────────────

// Inspect the element matched by `sel` and return a serializable profile of it
// and its subtree (no DOM nodes). Child selectors are built U1-valid (single
// simple selector, joined with '>', never a descendant space).
async function analyzeElement(sel) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { err: 'Cannot run on this page.' };
  try {
    // Provides window.__u1SelectorIntel.robustSelector, used below.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['selector-intel.js'] });
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selector) => {
        let el;
        try { el = document.querySelector(selector); }
        catch (e) { return { error: e.message }; }
        if (!el) return { notFound: true };

        // Robust, U1-valid, UNIQUE selector builder: identity ladder + class
        // noise filter + uniqueness gate + id-anchored '>' chain. No spaces, no
        // :nth. One implementation, in selector-intel.js — this function's
        // caller injects it first. The fallback is the degraded identity ladder,
        // so a missing module is obvious rather than a silent second opinion.
        const simple = (node) => {
          if (window.__u1SelectorIntel) return window.__u1SelectorIntel.robustSelector(node);
          if (!node || node.nodeType !== 1) return '';
          if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) return '#' + node.id;
          const cls = (node.className && typeof node.className === 'string')
            ? node.className.trim().split(/\s+/).filter(Boolean) : [];
          return cls.length ? node.tagName.toLowerCase() + '.' + cls[0] : node.tagName.toLowerCase();
        };

        const classList = (el.className && typeof el.className === 'string')
          ? el.className.trim().split(/\s+/).filter(Boolean) : [];
        const role = el.getAttribute('role') || '';
        const ariaHaspopup = el.getAttribute('aria-haspopup') || '';

        const ul = /^(ul|ol)$/i.test(el.tagName) ? el : el.querySelector('ul,ol');
        const lis = ul ? ul.querySelectorAll(':scope > li') : [];
        const links = el.querySelectorAll('a[href]');
        const checkboxes = el.querySelectorAll('input[type="checkbox"]');
        const radios = el.querySelectorAll('input[type="radio"]');
        const buttons = el.querySelectorAll('button');
        const trs = el.querySelectorAll('tr');
        const tds = el.querySelectorAll('td');
        const imgs = el.querySelectorAll('img');
        const headings = Array.from(el.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => h.tagName.toLowerCase());

        // Close-button candidate (dialogs).
        let closeBtn = el.querySelector('[aria-label*="close" i],[title*="close" i],.close,.close-btn,.modal-close,.ssm-close-btn');
        if (!closeBtn) closeBtn = Array.from(buttons).find(b => {
          const t = (b.textContent || '').trim().toLowerCase(); return t === '×' || t === 'x';
        }) || null;

        // Trigger candidate: an opener button that sits just before the element or
        // shares its parent (common menu-button / listbox pattern).
        let triggerEl = null;
        const prev = el.previousElementSibling;
        if (prev && /^(button|a)$/i.test(prev.tagName)) triggerEl = prev;
        if (!triggerEl && el.parentElement) {
          triggerEl = el.parentElement.querySelector('[aria-haspopup],button');
          if (triggerEl === el) triggerEl = null;
        }

        // First heading inside, for dialog heading suggestion.
        const heading = el.querySelector('h1,h2,h3,h4,h5,h6');

        const isClickable = !!(el.onclick || role === 'button' ||
          el.getAttribute('tabindex') != null || el.tagName === 'BUTTON' || el.tagName === 'A');

        const ulSel = ul ? simple(ul) : '';
        return {
          tag: el.tagName.toLowerCase(),
          role, ariaHaspopup,
          id: el.id || '', classList, childCount: el.childElementCount, isClickable,
          hasUl: !!ul, ulSel,
          liCount: lis.length,
          liSel: ul ? ulSel + '>li' : '',
          linkCount: links.length,
          linkSel: ul ? ulSel + '>li>a' : (links.length ? 'a' : ''),
          checkboxCount: checkboxes.length,
          radioCount: radios.length,
          buttonCount: buttons.length,
          trCount: trs.length, tdCount: tds.length, imgCount: imgs.length,
          headings,
          headingSel: heading ? simple(heading) : '',
          closeBtnSel: closeBtn ? simple(closeBtn) : '',
          triggerSel: triggerEl ? simple(triggerEl) : '',
        };
      },
      args: [sel],
    });
    return res?.[0]?.result || { err: 'No result' };
  } catch (err) { return { err: err.message }; }
}

// Heuristic ruleset → { type, fields:{key:sel}, notes:[{level,msg}] } or null.
// `fields` are SUB-selector suggestions only (the primary stays what the user typed).
function recommendComponent(p) {
  if (!p || p.err || p.error || p.notFound) return null;
  const cls = (p.classList || []).join(' ').toLowerCase();
  const role = (p.role || '').toLowerCase();
  const hp = (p.ariaHaspopup || '').toLowerCase();
  const notes = [];

  // Dialog / modal
  if (role === 'dialog' || hp === 'dialog' || /(^|[^a-z])(modal|dialog|popup|lightbox)([^a-z]|$)/.test(cls)) {
    const fields = {};
    if (p.closeBtnSel) fields.closeBtn = p.closeBtnSel;
    if (p.headingSel) fields.heading = p.headingSel;
    if (p.triggerSel) fields.trigger = p.triggerSel;
    notes.push({ level: 'ok', msg: 'Looks like a dialog / modal. If it has a trigger button that opens it, put that in "trigger".' });
    return { type: 'dialog', fields, notes };
  }

  // ul/list-based dropdowns
  if (p.hasUl && (p.liCount > 0 || p.linkCount > 0)) {
    // A pop-up list opened by a trigger button → listbox. Per U1's code the
    // listbox closes on ESC (case ESC → closeListbox) as long as `options`
    // points at the individual <li> items (not the container). This holds even
    // when the items are navigation links. Use `menu` only for a standing nav
    // bar with NO single trigger / real nested submenus — otherwise U1 throws
    // "Submenu must have a trigger element".
    if (p.triggerSel) {
      notes.push({ level: 'ok', msg: 'A dropdown opened by a trigger → listbox. It closes on ESC once “options” points at the <li> items (below). If the items navigate to other pages that is fine — listbox still works.' });
      const fields = { options: p.liSel, trigger: p.triggerSel };
      return { type: 'listbox', fields, notes };
    }
    // No trigger button → a persistent navigation menu.
    notes.push({ level: 'ok', msg: 'A standing navigation list (no single trigger) → menu.' });
    const fields = { items: p.linkCount > 0 ? p.linkSel : p.liSel };
    return { type: 'menu', fields, notes };
  }

  if (role === 'tablist' || /(^|[^a-z])tabs?([^a-z]|$)/.test(cls)) {
    notes.push({ level: 'ok', msg: 'Tab strip detected → tabs. Point "tab" at each tab button and "tabPanel" at the content panel.' });
    return { type: 'tabs', fields: {}, notes };
  }
  if (role === 'radiogroup' || p.radioCount > 0) {
    notes.push({ level: 'ok', msg: 'Radio buttons detected → radio.' });
    return { type: 'radio', fields: {}, notes };
  }
  if (p.checkboxCount > 0 || role === 'checkbox') {
    notes.push({ level: 'ok', msg: 'Checkbox detected → checkbox. Fill checkedState / uncheckedState with the on/off selectors.' });
    return { type: 'checkbox', fields: {}, notes };
  }
  if (p.trCount > 0 && p.tdCount > 0) {
    notes.push({ level: 'ok', msg: 'Rows & cells detected → table. Use "grid" instead if cells are interactive.' });
    return { type: 'table', fields: { row: 'tr', cell: 'td' }, notes };
  }
  if (p.tag === 'a') {
    notes.push({ level: 'ok', msg: 'An <a> element → link.' });
    return { type: 'link', fields: {}, notes };
  }
  if (p.isClickable && p.imgCount > 0) {
    notes.push({ level: 'ok', msg: 'A clickable element wrapping an image → button.' });
    return { type: 'button', fields: {}, notes };
  }
  return null;
}

// Validate the current field values against the page + rules. Returns notes.
// ── In-page test engine bridge ──────────────────────────────────────────────
// Injects test-engine.js into the page (idempotent) then calls one of its
// exported functions. Runs in the isolated content-script world (shared DOM).
async function callTestEngine(fnName, args) {
  const tab = await getTab();
  if (!isInjectable(tab)) return null;
  try {
    // selector-intel.js first: test-engine.js delegates robustSelector to it.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['selector-intel.js', 'test-engine.js'],
    });
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (fn, a) => (window.__u1TestEngine && window.__u1TestEngine[fn]) ? window.__u1TestEngine[fn].apply(null, a) : null,
      args: [fnName, args || []],
    });
    return res && res[0] ? res[0].result : null;
  } catch { return null; }
}

async function recommendSelector(type, primary) {
  return callTestEngine('recommendSelector', [type, primary]);
}

// Returns a Set of the selectors (from `sels`) that currently match ≥1 element on
// the open page — used by the "On this page" mappings filter.
async function selectorsPresentOnPage(sels) {
  const tab = await getTab();
  if (!isInjectable(tab)) return null; // null = can't tell (don't filter)
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      // "Present" means an element that actually MATCHES *and is visible* — not
      // merely in the DOM. Header/menu duplicates, mobile variants and leftover
      // nodes are often display:none / zero-box; counting those made mappings
      // wrongly show as "on this page" after navigating. Mirrors the Scan tab's
      // visible() test. Widgets that exist only while open (dialog/datepicker)
      // still surface via the captured-on-this-URL fallback in onPage().
      func: (list) => list.filter(s => {
        try {
          const el = document.querySelector(s);
          if (!el || !el.getBoundingClientRect) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return false;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
          if (el.offsetParent === null && cs.position !== 'fixed') return false;
          return true;
        } catch { return false; }
      }),
      args: [sels],
    });
    return new Set((res && res[0] && res[0].result) || []);
  } catch { return null; }
}

async function validateMapping(type, primary, fieldValues) {
  const schema = COMPONENT_SCHEMAS[type];
  if (!schema) return [];
  const pKey = primaryKeyOf(schema);
  const req = schema.req || [];
  const notes = [];

  // Build key → selector map (primary + non-empty fields).
  const map = {};
  if (pKey) map[pKey] = primary;
  for (const f of schema.fields) if (fieldValues[f]) map[f] = fieldValues[f];

  // Required-field presence (no page needed).
  for (const r of req) {
    const val = (r === pKey) ? primary : fieldValues[r];
    if (!val || !String(val).trim()) notes.push({ level: 'err', msg: `Required field “${r}” is empty.` });
  }

  // Descendant-space check (U1 rejects spaces; only > + ~ combinators allowed).
  // Custom mappings (aria-label) run our own querySelector — descendant spaces
  // are fine there, so skip this warning.
  if (!schema.custom) {
    for (const [k, v] of Object.entries(map)) {
      if (/[\w\]\)]\s+[.#\[\w]/.test(v)) {
        notes.push({ level: 'warn', msg: `“${k}” has a descendant space — U1 only allows > + ~ combinators, so it may be rejected.` });
      }
    }
  }

  // options/items pointing at the container itself.
  if (type === 'listbox' && fieldValues.options && fieldValues.options === primary) {
    notes.push({ level: 'warn', msg: `“options” points at the container itself. Use the individual items, e.g. ${primary}>li.` });
  }
  // Radio without uncheckedState: U1 skips aria-checked entirely (it guards with
  // `checkedState && uncheckedState`), so the group is operable but its selected
  // option is never announced. Allowed, but the user must know.
  if (type === 'radio' && fieldValues.checkedState && !fieldValues.uncheckedState) {
    notes.push({ level: 'warn', msg: 'No “uncheckedState”: roles + arrow-key navigation will work, but U1 will not maintain aria-checked — a screen reader won’t announce which option is selected (WCAG 4.1.2).' });
  }
  if (type === 'menu' && fieldValues.items && fieldValues.items === primary) {
    notes.push({ level: 'warn', msg: `“items” points at the container itself. Use the individual items, e.g. ${primary}>li>a.` });
  }

  // Page checks: match counts + listbox-options-are-links.
  const tab = await getTab();
  if (isInjectable(tab)) {
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (pairs, t) => {
          const out = { counts: {}, optionsAreLinks: false };
          for (const [k, sel] of pairs) {
            try { out.counts[k] = document.querySelectorAll(sel).length; }
            catch { out.counts[k] = -1; }
          }
          if (t === 'listbox') {
            const opt = pairs.find(pp => pp[0] === 'options');
            if (opt) {
              try {
                const els = document.querySelectorAll(opt[1]);
                out.optionsAreLinks = els.length > 0 &&
                  Array.from(els).every(e => e.matches('a[href]') || e.querySelector('a[href]'));
              } catch {}
            }
          }
          return out;
        },
        args: [Object.entries(map), type],
      });
      const r = res?.[0]?.result;
      if (r) {
        // Components built ONLY when the widget opens: only the always-present
        // key (the trigger) must match now — see DYNAMIC_OPEN at module scope.
        const alwaysPresent = DYNAMIC_OPEN[type];
        for (const [k, c] of Object.entries(r.counts)) {
          if (c === -1) { notes.push({ level: 'err', msg: `“${k}” is not a valid CSS selector.` }); continue; }
          if (c !== 0) continue;
          if (alwaysPresent && !alwaysPresent.includes(k)) {
            notes.push({ level: 'ok', msg: `“${k}” matches 0 now — that’s fine for a ${type}: it’s created only when the widget opens. Open it, then click 🔍 to verify this selector.` });
          } else {
            notes.push({ level: 'warn', msg: `“${k}” matches 0 elements on the page right now.` });
          }
        }
        // Note: listbox options that are links are fine — U1 still closes the
        // listbox on ESC. (No menu recommendation here; menu needs submenu
        // triggers and throws on a plain button+list dropdown.)
      }
    } catch {}
  }
  return notes;
}

function renderAdvisorNotes(notes) {
  const box = document.getElementById('advisorBox');
  if (!box) return;
  if (!notes || !notes.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  box.innerHTML = notes.map(n => {
    const lvl = n.level === 'err' ? 'err' : n.level === 'warn' ? 'warn' : 'ok';
    const icon = lvl === 'err' ? '⛔' : lvl === 'warn' ? '⚠️' : '✅';
    return `<div class="advisor-note ${lvl}">${icon} ${escapeHtml(n.msg)}</div>`;
  }).join('');
}

// Read the current builder form (type + primary + sub-selectors + options) and
// return a fresh template, or null if type/primary are missing. Shared by
// "Generate Template" and "Add to Mapping" so Add never silently no-ops on a
// stale/absent Generate.
function buildTemplateFromForm() {
  const type = $componentType.value;
  const primary = $primarySelectorInput.value.trim();
  if (!type || !primary) return null;

  const fieldValues = {};
  $subSelArea.querySelectorAll('input[type="text"][data-field]').forEach(inp => {
    fieldValues[inp.dataset.field] = inp.value.trim();
  });
  const rootValues = {};
  $subSelArea.querySelectorAll('[data-root]').forEach(inp => {
    if (inp.type === 'checkbox') rootValues[inp.dataset.root] = inp.checked;
    else rootValues[inp.dataset.root] = inp.value.trim();
  });
  return buildTemplate(type, primary, fieldValues, rootValues);
}

document.getElementById('generateBtn').addEventListener('click', async () => {
  const type = $componentType.value;
  const status = document.getElementById('applyStatus');
  if (!type) { showNotice(status, 'Pick a component type first.', 'error', 3000); return; }
  const primary = $primarySelectorInput.value.trim();
  if (!primary) {
    showNotice(status, 'Enter a CSS selector for the element first.', 'error', 3000);
    return;
  }

  const fieldValues = {};
  $subSelArea.querySelectorAll('input[type="text"][data-field]').forEach(inp => {
    fieldValues[inp.dataset.field] = inp.value.trim();
  });

  currentTemplate = buildTemplateFromForm();
  if (!currentTemplate) return;
  $templatePreview.textContent = currentTemplate.code;
  $previewSection.style.display = 'block';

  // Non-blocking advice: surface any problems with the mapping + selector
  // recommendation (is the primary selector the best element for this type?).
  try {
    const notes = await validateMapping(type, primary, fieldValues);
    const rec = await recommendSelector(type, currentTemplate.firstArg || primary);
    if (rec && Array.isArray(rec.notes)) {
      for (const n of rec.notes) {
        notes.push({ level: n.level, msg: n.msg + (n.suggestion ? ` → try: ${n.suggestion}` : '') });
      }
    }
    renderAdvisorNotes(notes);
  } catch {}
});

// Loads an existing mapping back into the builder for editing. "Add to Mapping"
// will then replace the original (tracked via editingMappingKey).
function loadMappingIntoForm(m) {
  if (!m || typeof m !== 'object' || !m.type || !COMPONENT_SCHEMAS[m.type]) return;
  $primarySelectorInput.value = m.primary || '';
  $componentType.value = m.type;
  renderTypeGuide(m.type);
  renderSubSelectorInputs(m.type);

  const schema = COMPONENT_SCHEMAS[m.type];
  const selectors = (m.config && m.config.selectors) || {};
  for (const f of schema.fields) {
    const val = getDeep(selectors, f);
    const inp = $subSelArea.querySelector('input[data-field="' + f + '"]');
    if (inp && typeof val === 'string') inp.value = val;
  }
  if (schema.rootFields) {
    for (const k of Object.keys(schema.rootFields)) {
      const inp = $subSelArea.querySelector('[data-root="' + k + '"]');
      if (!inp) continue;
      if (inp.type === 'checkbox') inp.checked = !!(m.config && m.config[k]);
      else inp.value = (m.config && m.config[k] != null) ? String(m.config[k]) : '';
    }
  }

  // Build preview + currentTemplate from the filled inputs, mark edit mode.
  refreshStrength();
  document.getElementById('generateBtn').click();
  editingMappingKey = mappingKey(m);
  const addBtn = document.getElementById('addMappingBtn');
  if (addBtn) addBtn.textContent = 'Update Mapping';

  // Bring the builder into view and switch to the Templates tab.
  document.querySelector('.tab-btn[data-tab="picker"]').click();
  $primarySelectorInput.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// Clears the builder so the user can start a fresh element.
function resetPicker() {
  $primarySelectorInput.value = '';
  $primarySelectorInput.placeholder = 'e.g. #login-modal';
  $componentType.value = '';
  renderTypeGuide('');
  $subSelArea.innerHTML = '';
  $subSelSection.style.display = 'none';
  $previewSection.style.display = 'none';
  $templatePreview.textContent = '';
  const primaryLabel = document.getElementById('primaryLabel');
  if (primaryLabel) primaryLabel.textContent = 'CSS Selector';
  const primaryHint = document.getElementById('primaryHint');
  if (primaryHint) { primaryHint.textContent = ''; primaryHint.style.display = 'none'; }
  const advisorBox = document.getElementById('advisorBox');
  if (advisorBox) { advisorBox.innerHTML = ''; advisorBox.style.display = 'none'; }
  currentTemplate = null;
  editingMappingKey = null;
  const addBtn = document.getElementById('addMappingBtn');
  if (addBtn) addBtn.textContent = 'Add to Mapping';
  const testBox = document.getElementById('selectorTestResult');
  if (testBox) { testBox.style.display = 'none'; testBox.innerHTML = ''; }
  const applyStatus = document.getElementById('applyStatus');
  if (applyStatus) applyStatus.style.display = 'none';
  hideAutoReview();
  const primaryBadge = $primarySelectorInput.parentElement?.querySelector('.sel-strength');
  if (primaryBadge) paintStrength(primaryBadge, { level: 'empty', label: '', reasons: [] });
  $primarySelectorInput.focus();
}

document.getElementById('resetPickerBtn').addEventListener('click', resetPicker);

// ─────────────────────────────────────────────────────────────────────────────
//  TAB — SCAN (static content audit: headings, descriptions, alts, labels…)
// ─────────────────────────────────────────────────────────────────────────────

let scanResults = [];      // enriched findings [{ruleId, cat, severity, wcag, why, fix, issue, text, selector, detail}]
let scanActiveCat = '*';   // current category filter
let scanActiveSev = '*';   // current severity filter

// ── Rules catalog (auto-detectable subset of the WCAG issue catalog) ─────────
// Each finding the scanner emits references a ruleId here; the panel enriches it
// with the client-friendly title/explanation/fix + WCAG + severity + category.
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const SCAN_RULES = {
  'title-missing':        { title: 'Missing or unclear page title', wcag: '2.4.2', severity: 'High', category: 'Page Title', why: 'The browser tab title is missing or does not describe the page.', fix: 'Set a unique, clear page title for each page.' },
  'lang-missing':         { title: 'Missing page language', wcag: '3.1.1', severity: 'High', category: 'Screen Reader Support', why: 'Screen readers use the wrong pronunciation.', fix: 'Set the correct language on <html lang="…">.' },
  'h1-missing':           { title: 'Missing level 1 heading (H1)', wcag: '1.3.1', severity: 'High', category: 'Headings', why: 'The page lacks a main H1, making it hard to understand the primary topic and structure.', fix: 'Add a single descriptive <h1> at the top of the main content.' },
  'h1-multiple':          { title: 'Multiple H1', wcag: '1.3.1', severity: 'Medium', category: 'Headings', why: 'More than one H1 on the page.', fix: 'A web page should have only one H1.' },
  'heading-skip':         { title: 'Heading levels are skipped', wcag: '1.3.1', severity: 'Medium', category: 'Headings', why: 'Headings jump levels (e.g. H1 then H3), which confuses navigation.', fix: 'Use a logical order: H1 → H2 → H3 (avoid jumps).' },
  'heading-empty':        { title: 'Empty heading', wcag: '1.3.1', severity: 'Medium', category: 'Headings', why: 'A heading element has no text.', fix: 'Add text, or remove the heading tag.' },
  'landmarks-missing':    { title: 'No landmarks for main areas', wcag: '1.3.1', severity: 'High', category: 'Page Navigation', why: 'Screen reader users cannot jump quickly to main sections.', fix: 'Use <header>, <nav>, <main>, <footer> or ARIA landmarks.' },
  'skip-link-missing':    { title: 'No skip link', wcag: '2.4.1', severity: 'High', category: 'skip link', why: 'Keyboard users must tab through the whole menu on every page.', fix: "Add a 'Skip to main content' link at the top (visible on focus)." },
  'img-alt-missing':      { title: 'Image missing alt text', wcag: '1.1.1', severity: 'High', category: 'Images', why: 'Screen reader users do not know what the image shows.', fix: "Add meaningful alt text, or alt='' if decorative." },
  'link-empty':           { title: 'Link has no accessible text', wcag: '2.4.4', severity: 'Critical', category: 'Link and Button Labels', why: 'Screen reader users hear a link with no meaning.', fix: 'Add visible text or an aria-label that describes the destination.' },
  'link-generic':         { title: 'Link text is vague', wcag: '2.4.4', severity: 'High', category: 'Link and Button Labels', why: 'Users cannot tell where a link goes.', fix: "Use descriptive link text (avoid 'Click here')." },
  'button-noname':        { title: 'Button has no accessible name', wcag: '4.1.2', severity: 'High', category: 'Link and Button Labels', why: 'Icon-only or empty buttons are not announced clearly.', fix: 'Add visible text or an aria-label / screen-reader-only text.' },
  'input-nolabel':        { title: 'Input has no label', wcag: '3.3.2', severity: 'High', category: 'Form Labels and Instructions', why: 'Users do not know what to enter.', fix: 'Add a visible label linked to the input (label/for/id).' },
  'input-placeholder':    { title: 'Placeholder used as label', wcag: '3.3.2', severity: 'Medium', category: 'Form Labels and Instructions', why: 'The label disappears when typing.', fix: 'Use a real label; keep the placeholder for examples only.' },
  'group-nolabel':        { title: 'Option group has no group label', wcag: '1.3.1', severity: 'Medium', category: 'Form Labels and Instructions', why: 'Radio/checkbox groups are unclear without a group label.', fix: 'Use fieldset/legend or aria-labelledby for the group.' },
  'iframe-notitle':       { title: 'Iframe has no title', wcag: '4.1.2', severity: 'Medium', category: 'Iframes', why: 'Screen reader users cannot identify embedded content.', fix: "Add a clear iframe title (e.g. title='Payment form')." },
  'table-noheaders':      { title: 'Data table missing headers', wcag: '1.3.1', severity: 'High', category: 'Tables', why: 'Screen reader users cannot understand rows/columns.', fix: 'Use <th> header cells and set scope correctly.' },
  'tabindex-positive':    { title: 'Positive tabindex breaks focus order', wcag: '2.4.3', severity: 'High', category: 'Reading and Focus Order', why: 'A positive tabindex makes keyboard focus jump in a confusing order.', fix: 'Match the HTML order to the visual order; avoid positive tabindex.' },
  'aria-hidden-focusable':{ title: 'Keyboard-focusable but hidden from screen readers', wcag: '4.1.2', severity: 'Medium', category: 'Focus access', why: 'Element receives Tab focus but is ignored by screen readers (aria-hidden).', fix: "Remove aria-hidden='true', or add tabindex='-1' to take it out of the tab order." },
  'dup-ids':              { title: 'Duplicate id attribute', wcag: '4.1.1', severity: 'Medium', category: 'Screen Reader Support', why: 'Duplicate IDs break label and ARIA associations.', fix: 'Make every id on the page unique.' },
  'zoom-disabled':        { title: 'Zoom is disabled', wcag: '1.4.4', severity: 'High', category: 'Text Resize and Magnification', why: 'Users cannot enlarge content enough to read.', fix: 'Do not disable zoom; avoid user-scalable=no / maximum-scale.' },
  'autoplay-audio':       { title: 'Autoplay media cannot be stopped', wcag: '1.4.2', severity: 'High', category: 'Media Animation Motion', why: 'Autoplay audio interrupts users and screen readers.', fix: 'Do not autoplay, or provide pause/stop/mute controls.' },
  'video-nocaptions':     { title: 'Video has no captions', wcag: '1.2.2', severity: 'High', category: 'Media Animation Motion', why: 'Users who cannot hear the audio miss the content.', fix: 'Add a captions track (<track kind="captions">).' },
  'switch-nostate':       { title: 'Switch has no state', wcag: '4.1.2', severity: 'High', category: 'Semantic Mapping', why: 'Users cannot tell if a role="switch" is On or Off.', fix: 'Add aria-checked="true/false" to the switch.' },
  'checkbox-nostate':     { title: 'Custom checkbox has no state', wcag: '4.1.2', severity: 'High', category: 'Semantic Mapping', why: 'Users cannot perceive selected / unselected / mixed.', fix: 'Add aria-checked="true/false/mixed" to role="checkbox".' },
  'slider-novalue':       { title: 'Slider has no value', wcag: '4.1.2', severity: 'High', category: 'Semantic Mapping', why: 'The current value of a role="slider" is not announced.', fix: 'Add aria-valuenow / aria-valuemin / aria-valuemax.' },
  'meter-novalue':        { title: 'Meter / progressbar has no value', wcag: '1.1.1', severity: 'Medium', category: 'Semantic Mapping', why: 'A visual gauge’s value is not announced.', fix: 'Add aria-valuenow / aria-valuemin / aria-valuemax.' },
  'combobox-noexpanded':  { title: 'Combobox missing aria-expanded', wcag: '4.1.2', severity: 'Critical', category: 'Semantic Mapping', why: 'User is unaware a suggestions list has appeared.', fix: 'Add role="combobox" with aria-expanded and aria-controls.' },
  'misleading-role':      { title: 'Interactive role but not keyboard-focusable', wcag: '4.1.2', severity: 'Critical', category: 'Focus access', why: 'Element is announced as clickable but cannot receive keyboard focus.', fix: 'Use a native <button>/<a>, or add tabindex="0"; otherwise remove the role.' },
  'clickable-div':        { title: 'Clickable element not identified as interactive', wcag: '4.1.2', severity: 'High', category: 'Screen Reader Support', why: 'A div/span with a click handler lacks an interactive role, so it is not announced as activatable.', fix: 'Use <button>/<a>, or add role="button" and tabindex="0".' },
  'aria-ref-broken':      { title: 'ARIA reference points to a missing id', wcag: '1.3.1', severity: 'Medium', category: 'Screen Reader Support', why: 'aria-labelledby / describedby / controls references an element that does not exist.', fix: 'Point the reference at a real element id.' },
  'target-size-small':    { title: 'Touch target too small', wcag: '2.5.8', severity: 'Medium', category: 'Custom Components', why: 'Users miss taps and hit the wrong item.', fix: 'Increase target size (~24px) or add spacing around targets.' },
};

async function scanPageStatic() {
  const tab = await getTab();
  if (!isInjectable(tab)) return { err: 'Cannot scan this page.' };
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const identOk = (s) => /^[A-Za-z][\w-]*$/.test(s);
        const selOf = (el) => {
          if (!el || el.nodeType !== 1) return '';
          if (el.id && identOk(el.id)) return '#' + el.id;
          const cls = (el.className && typeof el.className === 'string')
            ? el.className.trim().split(/\s+/).filter(identOk) : [];
          if (cls.length) return el.tagName.toLowerCase() + '.' + cls.slice(0, 2).join('.');
          return el.tagName.toLowerCase();
        };
        const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ');
        const accName = (el) => {
          const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
          const lb = el.getAttribute('aria-labelledby');
          if (lb) { const t = lb.split(/\s+/).map(id => { const e = document.getElementById(id); return e ? txt(e) : ''; }).join(' ').trim(); if (t) return t; }
          const t = txt(el); if (t) return t;
          // Accessible-name roll-up: an icon/image inside the control lends its
          // name to it — <a><img alt="Home"></a> IS named "Home", and a logo link
          // <a><img alt="ACME"></a> is named "ACME". textContent misses this, so
          // gather a descendant's alt / aria-label / <svg><title>. (alt="" is
          // decorative and contributes nothing, so a truly nameless link still flags.)
          for (const d of el.querySelectorAll('[aria-label],img[alt],svg')) {
            const n = (d.getAttribute('aria-label') || d.getAttribute('alt') || '').trim()
              || (d.tagName.toLowerCase() === 'svg' ? ((d.querySelector('title') && d.querySelector('title').textContent) || '').trim() : '');
            if (n) return n;
          }
          return (el.getAttribute('title') || el.value || '').trim();
        };
        // "Really visible": rendered, non-zero box, not display:none/visibility:hidden/
        // opacity:0, not inside a display:none subtree (offsetParent null unless fixed).
        const visible = (el) => {
          if (!el || !el.getBoundingClientRect) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return false;
          const s = getComputedStyle(el);
          if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false;
          if (el.offsetParent === null && s.position !== 'fixed') return false;
          return true;
        };
        const nativelyFocusable = (el) => /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName) && !el.disabled;
        const out = [];
        const seen = new Set(); // avoid duplicate (ruleId+selector) spam
        // Element-based findings are only relevant if the element is actually
        // visible on the page — skip hidden dropdowns, closed modals, templates.
        // `force:true` keeps document-level or intentionally-hidden checks.
        const add = (ruleId, el, text, detail, force) => {
          if (el && !force && !visible(el)) return;
          const selector = el ? selOf(el) : '';
          const key = ruleId + '|' + selector + '|' + (text || '').slice(0, 30);
          if (seen.has(key)) return; seen.add(key);
          out.push({ ruleId, selector, text: (text || '').slice(0, 120), detail: detail || '' });
        };

        // ── Page title / language ──────────────────────────────────────
        if (!(document.title || '').trim()) add('title-missing', null, '(no <title>)');
        if (!document.documentElement.getAttribute('lang')) add('lang-missing', null, '<html> has no lang');

        // ── Headings ───────────────────────────────────────────────────
        const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading][aria-level]'));
        let prev = 0, h1count = 0;
        heads.forEach(h => {
          const lvl = h.getAttribute('aria-level') ? +h.getAttribute('aria-level') : +h.tagName.charAt(1);
          if (lvl === 1) h1count++;
          const t = txt(h);
          if (!t) add('heading-empty', h, '(empty ' + (h.tagName.toLowerCase()) + ')', 'H' + lvl);
          else if (prev && lvl > prev + 1) add('heading-skip', h, t, `H${prev} → H${lvl}`);
          prev = lvl;
        });
        if (h1count === 0) add('h1-missing', null, 'Page has no H1');
        else if (h1count > 1) add('h1-multiple', null, `${h1count} H1 elements on the page`);

        // ── Landmarks / skip link ──────────────────────────────────────
        if (!document.querySelector('main,[role=main]') && !document.querySelector('nav,[role=navigation]'))
          add('landmarks-missing', null, 'No <main>/<nav> landmarks found');
        const firstLinks = Array.from(document.querySelectorAll('a[href^="#"]')).slice(0, 5);
        const hasSkip = firstLinks.some(a => /skip|main|content|navigation/i.test(txt(a) + ' ' + (a.getAttribute('href') || '')));
        if (!hasSkip) add('skip-link-missing', null, 'No “skip to content” link at the top');

        // ── Images ─────────────────────────────────────────────────────
        Array.from(document.querySelectorAll('img')).slice(0, 200).forEach(el => {
          const decorative = el.getAttribute('role') === 'presentation' || el.getAttribute('aria-hidden') === 'true' || el.getAttribute('alt') === '';
          if (el.getAttribute('alt') === null && !decorative)
            add('img-alt-missing', el, (el.getAttribute('src') || '').split('/').pop() || '(image)');
        });

        // ── Links ──────────────────────────────────────────────────────
        const generic = /^(click here|read more|here|link|more|learn more|details|›|»|>)$/i;
        Array.from(document.querySelectorAll('a[href]')).slice(0, 300).forEach(el => {
          if (!visible(el)) return;
          const name = accName(el);
          if (!name) add('link-empty', el, (el.getAttribute('href') || '').slice(0, 50));
          else if (generic.test(name)) add('link-generic', el, name, (el.getAttribute('href') || '').slice(0, 40));
        });

        // ── Buttons ────────────────────────────────────────────────────
        Array.from(document.querySelectorAll('button,[role=button],input[type=submit],input[type=button]')).slice(0, 300).forEach(el => {
          if (!visible(el)) return;
          if (!accName(el)) add('button-noname', el, '(unnamed button)');
        });

        // ── Form fields ────────────────────────────────────────────────
        Array.from(document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=radio]):not([type=checkbox]),select,textarea')).slice(0, 200).forEach(el => {
          let label = '';
          if (el.id) { try { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) label = txt(l); } catch {} }
          if (!label && el.closest('label')) label = txt(el.closest('label'));
          if (!label) label = el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') ? 'x' : '');
          const ph = el.getAttribute('placeholder') || '';
          if (!label && ph) add('input-placeholder', el, ph, el.getAttribute('type') || el.tagName.toLowerCase());
          else if (!label) add('input-nolabel', el, '(unlabelled ' + el.tagName.toLowerCase() + ')', el.getAttribute('type') || '');
        });

        // ── Radio/checkbox groups without a group label ────────────────
        const groups = {};
        Array.from(document.querySelectorAll('input[type=radio][name],input[type=checkbox][name]')).forEach(el => {
          (groups[el.name] = groups[el.name] || []).push(el);
        });
        Object.keys(groups).forEach(name => {
          const els = groups[name];
          if (els.length < 2) return;
          const grouped = els[0].closest('fieldset') || els[0].closest('[role=group],[role=radiogroup]');
          const labelled = grouped && (grouped.querySelector('legend') || grouped.getAttribute('aria-label') || grouped.getAttribute('aria-labelledby'));
          if (!labelled) add('group-nolabel', els[0], `Group "${name}" (${els.length} options)`);
        });

        // ── Iframes ────────────────────────────────────────────────────
        Array.from(document.querySelectorAll('iframe')).slice(0, 40).forEach(el => {
          if (!el.getAttribute('title') && !el.getAttribute('aria-label')) add('iframe-notitle', el, (el.getAttribute('src') || '(iframe)').slice(0, 50));
        });

        // ── Tables without headers ─────────────────────────────────────
        Array.from(document.querySelectorAll('table')).slice(0, 40).forEach(el => {
          if (el.getAttribute('role') === 'presentation' || el.getAttribute('role') === 'none') return;
          const rows = el.querySelectorAll('tr').length;
          if (rows >= 2 && !el.querySelector('th')) add('table-noheaders', el, `Table with ${rows} rows and no <th>`);
        });

        // ── Positive tabindex ──────────────────────────────────────────
        Array.from(document.querySelectorAll('[tabindex]')).slice(0, 200).forEach(el => {
          const ti = parseInt(el.getAttribute('tabindex'), 10);
          if (ti > 0) add('tabindex-positive', el, `${el.tagName.toLowerCase()} tabindex="${ti}"`);
        });

        // ── aria-hidden on focusable ───────────────────────────────────
        Array.from(document.querySelectorAll('[aria-hidden="true"]')).slice(0, 100).forEach(el => {
          const foc = (nativelyFocusable(el) && el.tagName !== 'A') || (el.tagName === 'A' && el.hasAttribute('href')) || (el.getAttribute('tabindex') && +el.getAttribute('tabindex') >= 0)
            || el.querySelector('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
          if (foc) add('aria-hidden-focusable', el, '(focusable content inside aria-hidden)');
        });

        // ── Duplicate ids ──────────────────────────────────────────────
        const idMap = {};
        Array.from(document.querySelectorAll('[id]')).forEach(el => { const id = el.id; if (id) (idMap[id] = idMap[id] || []).push(el); });
        Object.keys(idMap).forEach(id => { if (idMap[id].length > 1) add('dup-ids', idMap[id][0], `id="${id}" used ${idMap[id].length}×`); });

        // ── Zoom disabled ──────────────────────────────────────────────
        const vp = document.querySelector('meta[name=viewport]');
        if (vp && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp.getAttribute('content') || '')) add('zoom-disabled', null, vp.getAttribute('content') || '');

        // ── Autoplay media / captions ──────────────────────────────────
        Array.from(document.querySelectorAll('audio[autoplay],video[autoplay]')).forEach(el => {
          if (!el.muted && !el.controls) add('autoplay-audio', el, el.tagName.toLowerCase() + ' autoplay');
        });
        Array.from(document.querySelectorAll('video')).slice(0, 20).forEach(el => {
          if (!el.querySelector('track[kind=captions],track[kind=subtitles]')) add('video-nocaptions', el, '(video without captions track)');
        });

        // ── Custom widget roles missing required state/value ───────────
        Array.from(document.querySelectorAll('[role=switch]')).forEach(el => { if (el.getAttribute('aria-checked') == null) add('switch-nostate', el, accName(el) || '(switch)'); });
        Array.from(document.querySelectorAll('[role=checkbox]')).forEach(el => { if (el.getAttribute('aria-checked') == null) add('checkbox-nostate', el, accName(el) || '(checkbox)'); });
        Array.from(document.querySelectorAll('[role=slider]')).forEach(el => { if (el.getAttribute('aria-valuenow') == null) add('slider-novalue', el, accName(el) || '(slider)'); });
        Array.from(document.querySelectorAll('[role=meter],[role=progressbar]')).forEach(el => { if (el.getAttribute('aria-valuenow') == null) add('meter-novalue', el, accName(el) || '(meter)'); });
        Array.from(document.querySelectorAll('[role=combobox]')).forEach(el => { if (el.getAttribute('aria-expanded') == null) add('combobox-noexpanded', el, accName(el) || '(combobox)'); });

        // ── Misleading role but not focusable ──────────────────────────
        Array.from(document.querySelectorAll('[role=button],[role=link],[role=menuitem],[role=tab]')).slice(0, 200).forEach(el => {
          if (nativelyFocusable(el)) return;
          const ti = el.getAttribute('tabindex');
          if (ti == null || +ti < 0) add('misleading-role', el, `${el.tagName.toLowerCase()} role="${el.getAttribute('role')}"`);
        });

        // ── Clickable div/span with no interactive role ────────────────
        Array.from(document.querySelectorAll('div[onclick],span[onclick]')).slice(0, 100).forEach(el => {
          const role = el.getAttribute('role');
          if (!role || !/button|link|menuitem|tab|checkbox|switch/.test(role)) add('clickable-div', el, txt(el).slice(0, 60) || '(clickable ' + el.tagName.toLowerCase() + ')');
        });

        // ── Broken ARIA references ─────────────────────────────────────
        ['aria-labelledby', 'aria-describedby', 'aria-controls'].forEach(attr => {
          Array.from(document.querySelectorAll('[' + attr + ']')).slice(0, 200).forEach(el => {
            const ids = (el.getAttribute(attr) || '').split(/\s+/).filter(Boolean);
            const missing = ids.filter(id => !document.getElementById(id));
            if (missing.length) add('aria-ref-broken', el, `${attr}="${missing.join(' ')}" → not found`);
          });
        });

        // ── Touch target too small ─────────────────────────────────────
        let smallCount = 0;
        Array.from(document.querySelectorAll('a[href],button,[role=button],input:not([type=hidden])')).forEach(el => {
          if (smallCount >= 20 || !visible(el)) return;
          const r = el.getBoundingClientRect();
          if (r.width < 24 && r.height < 24) { add('target-size-small', el, `${Math.round(r.width)}×${Math.round(r.height)}px`); smallCount++; }
        });

        return { results: out, total: out.length };
      },
    });
    return res?.[0]?.result || { err: 'No result' };
  } catch (err) {
    return { err: err.message };
  }
}

// Which findings pass the active severity + category filters.
function scanFiltered() {
  return scanResults.filter(r =>
    (scanActiveSev === '*' || r.severity === scanActiveSev) &&
    (scanActiveCat === '*' || r.cat === scanActiveCat));
}

function renderScanFilters() {
  const el = document.getElementById('scanFilters');
  if (!el) return;
  // Severity row (ordered Critical→Low) + category row.
  const sevCounts = {};
  for (const r of scanResults) sevCounts[r.severity] = (sevCounts[r.severity] || 0) + 1;
  const sevChip = (s, label) => {
    const n = s === '*' ? scanResults.length : (sevCounts[s] || 0);
    if (s !== '*' && !n) return '';
    return `<button class="scan-chip sev-${(s || '').toLowerCase()} ${scanActiveSev === s ? 'active' : ''}" data-scan-sev="${escapeHtml(s)}">${escapeHtml(label)} <span class="n">${n}</span></button>`;
  };
  const catCounts = {};
  for (const r of scanResults) catCounts[r.cat] = (catCounts[r.cat] || 0) + 1;
  const cats = Object.keys(catCounts).sort();
  const catChip = (c, label, n) =>
    `<button class="scan-chip ${scanActiveCat === c ? 'active' : ''}" data-scan-cat="${escapeHtml(c)}">${escapeHtml(label)} <span class="n">${n}</span></button>`;
  el.innerHTML =
    `<div class="scan-filter-row">${sevChip('*', 'All')}${['Critical', 'High', 'Medium', 'Low'].map(s => sevChip(s, s)).join('')}</div>` +
    `<div class="scan-filter-row">${catChip('*', 'All categories', scanResults.length)}${cats.map(c => catChip(c, c, catCounts[c])).join('')}</div>`;
}

function renderScanResults() {
  const wrap = document.getElementById('scanResults');
  if (!wrap) return;
  const list = scanFiltered();
  if (!list.length) { wrap.innerHTML = '<div class="empty-state">No issues match this filter. 🎉</div>'; return; }
  wrap.innerHTML = list.map(r => {
    const gi = scanResults.indexOf(r);
    return `
    <div class="scan-item sev-${(r.severity || '').toLowerCase()}" data-scan-idx="${gi}">
      <div class="scan-item-main">
        <span class="scan-sev-badge sev-${(r.severity || '').toLowerCase()}">${escapeHtml(r.severity || '')}</span>
        <span class="scan-issue-title">${escapeHtml(r.issue || '')}</span>
        ${r.wcag ? `<span class="wcag-chip">WCAG ${escapeHtml(r.wcag)}</span>` : ''}
        ${r.selector ? `<button class="btn-ghost btn-xs scan-hl" title="Highlight on page">🔍</button>` : ''}
      </div>
      <div class="scan-context">${escapeHtml(r.cat)}${r.text ? ` · ${escapeHtml(r.text)}` : ''}${r.detail ? ` <span class="scan-detail">(${escapeHtml(r.detail)})</span>` : ''}</div>
      <details class="scan-why">
        <summary>Why &amp; how to fix</summary>
        <div class="scan-why-body">
          <div class="scan-why-line"><strong>Why:</strong> ${escapeHtml(r.why || '')}</div>
          <div class="scan-why-line"><strong>Fix:</strong> ${escapeHtml(r.fix || '')}</div>
          ${r.selector ? `<div class="scan-why-line scan-sel"><strong>Selector:</strong> <code>${escapeHtml(r.selector)}</code></div>` : ''}
        </div>
      </details>
    </div>`;
  }).join('');
}

document.getElementById('scanBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('scanStatus');
  const btn = document.getElementById('scanBtn');
  btn.textContent = 'Scanning…';
  showNotice(status, 'Analyzing the page for accessibility faults…', 'info', 0);
  const res = await scanPageStatic();
  btn.textContent = '🔎 Scan this page';
  if (res.err) { showNotice(status, res.err, 'error', 4000); return; }
  // Enrich each raw finding with its catalog rule (title/why/fix/severity/wcag/category).
  scanResults = (res.results || []).map(f => {
    const rule = SCAN_RULES[f.ruleId] || {};
    return {
      ruleId: f.ruleId, selector: f.selector, text: f.text, detail: f.detail,
      issue: rule.title || f.ruleId, why: rule.why || '', fix: rule.fix || '',
      severity: rule.severity || 'Medium', wcag: rule.wcag || '', cat: rule.category || 'Other',
    };
  }).sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  scanActiveCat = '*'; scanActiveSev = '*';
  status.style.display = 'none';
  document.getElementById('scanResultsSection').style.display = scanResults.length ? 'block' : 'none';
  document.getElementById('scanClearBtn').style.display = scanResults.length ? '' : 'none';
  const crit = scanResults.filter(r => r.severity === 'Critical').length;
  const high = scanResults.filter(r => r.severity === 'High').length;
  document.getElementById('scanCount').textContent =
    scanResults.length ? `${scanResults.length} issues${crit ? ` · ${crit} critical` : ''}${high ? ` · ${high} high` : ''}` : '';
  document.getElementById('scanReportRow').style.display = scanResults.length ? 'flex' : 'none';
  if (!scanResults.length) showNotice(status, 'No automatic faults found on this page. 🎉', 'success', 4000);
  renderScanFilters();
  renderScanResults();
});

// Export a report of every flagged static issue, each with a screenshot of the
// element (captured now, one by one) and a plain-language fix.
document.getElementById('scanReportBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('scanReportStatus');
  const btn = document.getElementById('scanReportBtn');
  const issues = scanResults.slice(0, 40); // every scan finding is an issue now; cap capture time
  if (!issues.length) { showNotice(status, 'No issues to report.', 'warn', 3000); return; }

  const items = [];
  for (let i = 0; i < issues.length; i++) {
    const r = issues[i];
    btn.textContent = `Capturing ${i + 1}/${issues.length}…`;
    let screenshot = null;
    if (r.selector) { try { screenshot = await captureElementScreenshot(r.selector); } catch {} }
    // Include the richer catalog fields; report-gen shows issue + fix (severity/wcag/why extra).
    items.push({ cat: r.cat, text: r.text, selector: r.selector, detail: r.detail,
      issue: r.issue, severity: r.severity, wcag: r.wcag, why: r.why, fix: r.fix, screenshot });
  }
  btn.textContent = '📄 Export issues report (with screenshots)';

  const tab = await getTab();
  try {
    const out = await generateStaticIssuesReport(currentHostname, items, tab?.url || '', tab?.title || '');
    showNotice(status, `Report opened with ${out.issues} issue${out.issues !== 1 ? 's' : ''} (also downloaded).`, 'success', 4000);
  } catch (e) {
    showNotice(status, 'Error building report: ' + (e && e.message ? e.message : e), 'error', 4500);
  }
});

document.getElementById('scanClearBtn')?.addEventListener('click', () => {
  scanResults = [];
  document.getElementById('scanResultsSection').style.display = 'none';
  document.getElementById('scanClearBtn').style.display = 'none';
});

document.getElementById('scanFilters')?.addEventListener('click', (e) => {
  const sevChip = e.target.closest('[data-scan-sev]');
  const catChip = e.target.closest('[data-scan-cat]');
  if (sevChip) scanActiveSev = sevChip.dataset.scanSev;
  else if (catChip) scanActiveCat = catChip.dataset.scanCat;
  else return;
  renderScanFilters();
  renderScanResults();
});

document.getElementById('scanResults')?.addEventListener('click', async (e) => {
  // Clicking the "Why & how to fix" accordion should just toggle it.
  if (e.target.closest('.scan-why')) return;
  const item = e.target.closest('.scan-item');
  if (!item) return;
  const r = scanResults[Number(item.dataset.scanIdx)];
  if (!r || !r.selector) return;
  // Highlight + scroll the element into view on the page; if it no longer matches
  // (e.g. it was inside something now removed), tell the user instead of silence.
  const found = await highlightMatch(r.selector, 0, true);
  if (found === false) { showNotice(document.getElementById('scanStatus'), `Couldn't find "${r.selector}" on the page right now.`, 'warn', 3000); return; }
  setTimeout(() => highlightMatch(r.selector, 0, false), 3000);
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
  const result = await applyOne(currentTemplate.type, currentTemplate.firstArg || currentTemplate.primary, currentTemplate.config, currentTemplate.custom);
  if (result.ok) {
    showNotice(status, 'Applied on page.', 'success');
  } else if (result.u1Missing) {
    showNotice(status, 'U1 library is not loaded — inject U1 in Setup first.', 'error', 4500);
  } else {
    showNotice(status, 'Error: ' + result.err, 'error', 4500);
  }
});

// Take back exactly what an apply added. Uses the receipt recorded at apply
// time, so only the attributes U1 wrote are removed — the site's own role,
// tabindex and aria-* are left alone, which is why this cannot be done by
// pattern-matching after the fact.
async function revertApplied(receipt) {
  const tab = await getTab();
  if (!isInjectable(tab) || !receipt || !receipt.length) return 0;
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (list) => {
        let n = 0;
        for (const { token, added } of list) {
          const el = document.querySelector(`[data-u1-revert="${token}"]`);
          if (!el) continue;
          for (const attr of added) { el.removeAttribute(attr); n++; }
          el.removeAttribute('data-u1-revert');
        }
        return n;
      },
      args: [receipt],
    });
    return (res && res[0] && res[0].result) || 0;
  } catch { return 0; }
}

// A one-click way to act on that, since the fix is always the same.
function offerReload(status) {
  if (!status) return;
  if (status.querySelector('[data-reload-tab]')) return;
  status.insertAdjacentHTML('beforeend',
    ' <button class="btn-outline btn-xs" data-reload-tab>↻ Reload the page</button>');
}

document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-reload-tab]')) return;
  const tab = await getTab();
  if (tab) chrome.tabs.reload(tab.id);
});

// Which saved mappings target the same DOM as `primary`?
//
// mappingKey is type::primary, so a listbox on `button.main-nav__trigger` and a
// menu on `#mainNav` are different keys and both survive — then Apply All hands
// U1 two components claiming the same elements, and the second undoes the
// first. That is invisible in a flat list of mappings, so ask the page.
async function overlappingMappings(primary, list) {
  const tab = await getTab();
  if (!isInjectable(tab)) return [];
  const others = (list || [])
    .map((m, i) => ({ i, key: mappingKey(m), type: m.type, sel: m.firstArg || m.primary }))
    .filter(o => o.sel && o.sel !== primary);
  if (!others.length) return [];
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (mine, list2) => {
        const q = (s) => { try { return Array.from(document.querySelectorAll(s)); } catch { return []; } };
        const a = q(mine);
        if (!a.length) return [];
        return list2.filter(o => q(o.sel).some(el =>
          a.some(x => x === el || x.contains(el) || el.contains(x))));
      },
      args: [primary, others],
    });
    return (res && res[0] && res[0].result) || [];
  } catch { return []; }
}

// Persist one built template as a mapping for the current host, replacing an
// existing entry with the same key (or the one being edited). Shared by the
// manual "Add to Mapping" button and the AI mapping cards, so a mapping made
// either way is byte-for-byte the same record.
async function saveMappingEntry(template, { editingKey = null } = {}) {
  const key = storageKey('mappings', currentHostname);
  const stored = await U1Store.get([key]);
  const list = stored[key] || [];
  const newKey = mappingKey(template);
  let existingIdx = editingKey ? list.findIndex(m => mappingKey(m) === editingKey) : -1;
  if (existingIdx < 0) existingIdx = list.findIndex(m => mappingKey(m) === newKey);

  const tab = await getTab();
  const screenshot = await captureElementScreenshot(template.primary);
  const prev = existingIdx >= 0 ? list[existingIdx] : null;
  const entry = {
    type: template.type,
    primary: template.primary,
    firstArg: template.firstArg,
    custom: template.custom || null,
    config: template.config,
    code: template.code,
    // Keep the previous screenshot if a fresh capture wasn't possible.
    screenshot: screenshot || (prev && prev.screenshot) || null,
    pageUrl: tab?.url || (prev && prev.pageUrl) || '',
    pageTitle: tab?.title || (prev && prev.pageTitle) || '',
    capturedAt: Date.now(),
    // Stable chronological "Fix #N" shown in the UI, the exported script and the
    // close-out report. Assigned once and kept across edits so the number a
    // client sees in the report always points at the same fix.
    fixNo: (prev && prev.fixNo) || nextFixNo(list),
    // Durable id kept across edits (see genMappingId) — the key the monitor
    // reports as `id=…` when this mapping's selector breaks on a live site.
    id: (prev && prev.id) || genMappingId(),
  };
  if (existingIdx >= 0) list[existingIdx] = entry;
  else list.push(entry);
  await U1Store.set({ [key]: list });

  loadMappingsList();
  refreshExportInfo();
  return { updated: existingIdx >= 0 };
}

document.getElementById('addMappingBtn').addEventListener('click', async () => {
  const status = document.getElementById('applyStatus');
  // Always rebuild from the current form so an edited-but-not-regenerated form
  // still saves (previously this silently returned when currentTemplate was stale).
  const fresh = buildTemplateFromForm();
  if (fresh) currentTemplate = fresh;
  if (!currentTemplate) {
    showNotice(status, 'Enter a CSS selector and pick a component type first.', 'error', 3500);
    return;
  }
  const btn = document.getElementById('addMappingBtn');
  btn.textContent = 'Capturing…';
  let updated;
  try {
    ({ updated } = await saveMappingEntry(currentTemplate, { editingKey: editingMappingKey }));
  } catch (e) {
    // A failed write used to travel up as an unhandled rejection: the button
    // sat on "Capturing…" and the mapping was simply never saved.
    btn.textContent = 'Add to Mapping';
    showNotice(status, e.message, 'error', 12000);
    return;
  }
  const wasEditing = editingMappingKey != null || updated;
  editingMappingKey = null;
  btn.textContent = wasEditing ? 'Updated ✓' : 'Added ✓';
  setTimeout(() => { btn.textContent = 'Add to Mapping'; }, 1500);
});

// Apply every saved mapping for the current host. `silent` suppresses the
// "no mappings" / success notices (used by the auto-run on panel open).
async function applyAllMappings({ silent = false } = {}) {
  const key = storageKey('mappings', currentHostname);
  const stored = await U1Store.get([key]);
  const list = stored[key] || [];
  const status = document.getElementById('applyAllStatus');
  if (list.length === 0) {
    if (!silent) showNotice(status, 'No mappings to apply.', 'error');
    return { applied: 0, failed: 0 };
  }
  // Custom mappings (aria-label) run as scripts; u1.fix ones go through the batch.
  const custom = list.filter(m => m && typeof m === 'object' && m.custom);
  const fixes = list.filter(m => !(m && typeof m === 'object' && m.custom));

  let applied = 0, failed = 0, noEffect = 0, u1Missing = false, err = null;
  let details = [], engineErrs = [];
  if (fixes.length) {
    const result = await applyMappingsBatch(fixes);
    if (result.ok) {
      applied += result.applied;
      failed += result.failed;
      noEffect += result.noEffect || 0;
      details = result.details || [];
      engineErrs = result.errs || [];
      for (const d of details) {
        if (d.receipt && d.receipt.length) applyReceipts.set(d.type + '::' + d.sel, d.receipt);
      }
    } else if (result.u1Missing) { u1Missing = true; }
    else { err = result.err; }
  }
  for (const m of custom) {
    const r = await applyOne(m.type, m.firstArg || m.primary, m.config, m.custom);
    if (r.ok) applied++; else failed++;
  }

  if (!silent) {
    if (u1Missing && applied === 0) {
      showNotice(status, 'U1 library is not loaded — inject U1 in Setup first.', 'error', 4500);
    } else if (err && applied === 0) {
      showNotice(status, 'Error: ' + err, 'error', 4500);
    } else if (noEffect && !applied) {
      // The case that used to read "Applied N" while the page was untouched.
      const optOut = details.filter(d => d.reason === 'source-opt-out');
      const stale = details.some(d => d.reason === 'already-processed');
      let msg;
      if (optOut.length) {
        msg = `Nothing changed: ${optOut.map(d => d.sel).join(', ')} carries u1st-avoid-change-detection in the page's own HTML, which tells U1 to skip that element entirely. Reloading will not help — the attribute has to come out of the site's markup.`;
      } else if (stale) {
        msg = `Nothing changed: U1 had already processed ${noEffect === 1 ? 'this element' : 'these elements'} on this page load. Reload the page, then apply again.`;
      } else {
        msg = 'Nothing changed on the page. u1.fix ran without error but wrote no attributes — usually the domain is not authorised for U1, or the selector is one U1\'s validator rejects.';
      }
      if (engineErrs.length) msg += ' ' + engineErrs.join(' · ');
      showNotice(status, msg, 'error', 12000);
    } else {
      const parts = [`Applied ${applied} mapping${applied !== 1 ? 's' : ''}`];
      if (noEffect) parts.push(`${noEffect} changed nothing`);
      if (failed) parts.push(`${failed} failed`);
      const unblocked = details.filter(d => d.unblocked);
      let msg = parts.join(' · ') + '.';
      // Whatever U1 itself said is the most useful sentence here — never drop it.
      if (engineErrs.length) msg += ' ' + engineErrs.join(' · ');
      if (unblocked.length) {
        msg += ` ${unblocked.map(d => d.sel).join(', ')} had u1st-avoid-change-detection in the page markup — it was lifted here so the fix could run, but it must come out of the site's HTML for this to work in production.`;
      }
      showNotice(status, msg, (failed || noEffect) ? 'error' : (unblocked.length ? 'error' : 'success'),
        (noEffect || failed || unblocked.length) ? 9000 : 4000);
    }
    // Per-mapping detail. console.debug, not warn: these are expected outcomes
    // of a normal run, and at warn level an error collector files each one as a
    // fault report.
    for (const d of details) {
      if (d.status === 'ok' && !d.unblocked) continue;
      console.debug('[U1 Studio] apply:', d.type, d.sel, '→', d.status, d.reason || (d.unblocked ? 'opt-out lifted' : ''));
    }
  }
  return { applied, failed, noEffect, u1Missing, details };
}

document.getElementById('applyAllBtn').addEventListener('click', () => applyAllMappings());

// ── Same client, different URL ──────────────────────────────────────────────
//
// Everything is filed under the bare hostname, so molina.com and
// member.molina.com are two different sites as far as storage is concerned.
// That is why mappings "disappear": they are filed under a hostname you are
// not currently looking at. Rather than merging hostnames automatically —
// which would fuse unrelated tenants on shared domains like *.railway.app —
// find the likely siblings and offer to move the work.
function hostRelation(a, b) {
  if (!a || !b || a === b) return null;
  // One is a subdomain of the other: member.molina.com ↔ molina.com.
  if (a.endsWith('.' + b) || b.endsWith('.' + a)) return 'subdomain';
  // Or they share a DISTINCTIVE label: molina.com ↔ molina.co.il.
  //
  // Shared hosting domains are not distinctive — two tenants on
  // *.up.railway.app both contain "railway" and are completely unrelated
  // clients, so those labels cannot count as evidence.
  const GENERIC = new Set([
    'com', 'net', 'org', 'co', 'www', 'app', 'dev', 'site', 'online', 'store', 'cloud',
    'railway', 'vercel', 'netlify', 'herokuapp', 'github', 'gitlab', 'pages', 'azurewebsites',
    'amazonaws', 'cloudfront', 'firebaseapp', 'myshopify', 'wixsite', 'squarespace',
    'wordpress', 'webflow', 'onrender', 'surge', 'glitch', 'ngrok', 'localhost', 'local',
    'staging', 'production', 'preview', 'test', 'demo',
  ]);
  const labels = (h) => h.split('.').filter(l => l.length >= 4 && !GENERIC.has(l));
  const shared = labels(a).filter(l => labels(b).includes(l));
  return shared.length ? 'sibling' : null;
}

// Move (or copy) every per-site key from one hostname to another. Used to
// recover work filed under an old URL.
async function moveSiteData(from, to, { copy = false } = {}) {
  const prefixes = U1Store.SITE_PREFIXES || ['mappings', 'config', 'skipLinks', 'autoApply', 'platform', 'manualInject'];
  const fromKeys = prefixes.map(p => storageKey(p, from));
  const src = await U1Store.get(fromKeys);
  const writes = {};
  let moved = 0;
  for (const p of prefixes) {
    const v = src[storageKey(p, from)];
    if (v === undefined) continue;
    // Never clobber work that already exists at the destination: mappings are
    // concatenated (deduped by key), everything else only fills a gap.
    if (p === 'mappings') {
      const destKey = storageKey('mappings', to);
      const dest = (await U1Store.get([destKey]))[destKey] || [];
      const seen = new Set(dest.map(m => mappingKey(m)));
      const add = (v || []).filter(m => !seen.has(mappingKey(m)));
      if (!add.length && !dest.length) continue;
      writes[destKey] = dest.concat(add);
      moved += add.length;
    } else {
      const destKey = storageKey(p, to);
      const dest = (await U1Store.get([destKey]))[destKey];
      if (dest === undefined) writes[destKey] = v;
    }
  }
  if (Object.keys(writes).length) await U1Store.set(writes);
  if (!copy) await U1Store.remove(fromKeys);
  return { moved };
}

// The saved-mapping agent's two actions: take its corrected selectors, or ask
// it for a change in words. Both write back to the saved mapping, so the fix
// lands where the problem was noticed instead of in a fresh draft.
document.getElementById('mappingsList')?.addEventListener('click', async (e) => {
  const key = storageKey('mappings', currentHostname);

  const useFix = e.target.closest('[data-savedfix]');
  if (useFix) {
    const list = (await U1Store.get([key]))[key] || [];
    const m = list[parseInt(useFix.dataset.savedfix, 10)];
    if (!m) return;
    const box = useFix.closest('.ai-why');
    for (const row of box.querySelectorAll('.ai-fix-sel')) {
      const k = row.querySelector('strong')?.textContent;
      const v = row.textContent.replace(/^[^:]*:\s*/, '').trim();
      if (!k) continue;
      if (k === 'primary') m.primary = v;
      else { m.config = m.config || {}; m.config.selectors = m.config.selectors || {}; m.config.selectors[k] = v; }
    }
    const rebuilt = buildTemplate(m.type, m.primary, m.config.selectors || {}, m.config);
    if (rebuilt) { m.code = rebuilt.code; m.firstArg = rebuilt.firstArg; m.config = rebuilt.config; }
    await U1Store.set({ [key]: list });
    await loadMappingsList();
    refreshExportInfo();
    showNotice(document.getElementById('applyAllStatus'), 'Mapping updated. Apply it to see the difference.', 'success', 5000);
    return;
  }

  const go = e.target.closest('[data-savedaskgo]');
  if (!go) return;
  const idx = parseInt(go.dataset.savedaskgo, 10);
  const input = document.querySelector(`[data-savedask="${idx}"]`);
  const instruction = (input?.value || '').trim();
  if (!instruction) { input?.focus(); return; }

  const list = (await U1Store.get([key]))[key] || [];
  const m = list[idx];
  const schema = m && COMPONENT_SCHEMAS[m.type];
  if (!schema) return;

  const box = go.closest('.ai-why');
  go.disabled = true; go.textContent = 'Asking…';
  const tab = await getTab();
  const sel = m.firstArg || m.primary;
  const markup = isInjectable(tab)
    ? await inPage(tab.id, (s) => window.__u1SelectorIntel.extractComponent(s), [sel])
    : null;
  if (!markup || markup.error || markup.notFound) {
    go.disabled = false; go.textContent = 'Ask';
    box.insertAdjacentHTML('beforeend', `<div class="ai-sel-bad">Cannot read ${escapeHtml(sel)} on this page.</div>`);
    return;
  }

  const out = await U1AI.mapComponent({
    u1Type: m.type, containerSel: sel, markup,
    fields: schema.fields || [], fieldDocs: schema.desc || {},
    options: Object.keys(schema.rootFields || {}),
    instruction, current: m.config,
  });
  aiCost += U1AI.estimateCost(out.usage) || 0;
  go.disabled = false; go.textContent = 'Ask';
  if (out.err) { box.insertAdjacentHTML('beforeend', `<div class="ai-sel-bad">${escapeHtml(out.err)}</div>`); return; }

  const selectors = {};
  for (const f of (out.fields || [])) selectors[f.key] = f.value;
  const roots = {};
  for (const o of (out.options || [])) roots[o.key] = /^(false|no|off|0)$/i.test(String(o.value).trim()) ? false : (o.value === 'true' ? true : o.value);
  const rebuilt = buildTemplate(m.type, out.primary || m.primary, selectors, roots);
  if (!rebuilt) { box.insertAdjacentHTML('beforeend', '<div class="ai-sel-bad">It did not return a usable config.</div>'); return; }

  const before = JSON.stringify(m.config);
  Object.assign(m, { primary: rebuilt.primary, firstArg: rebuilt.firstArg, config: rebuilt.config, code: rebuilt.code });
  await U1Store.set({ [key]: list });
  await loadMappingsList();
  refreshExportInfo();
  showNotice(document.getElementById('applyAllStatus'),
    before === JSON.stringify(rebuilt.config) ? 'It kept the same selectors.' : 'Mapping updated. Apply it to see the difference.',
    'success', 5000);
});

// Recovering work filed under another hostname for the same client.
document.getElementById('mappingsList')?.addEventListener('click', async (e) => {
  const move = e.target.closest('[data-adopt]');
  const copy = e.target.closest('[data-adopt-copy]');
  if (!move && !copy) return;
  const from = (move || copy).dataset.adopt || (move || copy).dataset.adoptCopy;
  const btn = move || copy;
  btn.disabled = true;
  btn.textContent = 'Working…';
  const { moved } = await moveSiteData(from, currentHostname, { copy: !!copy });
  await loadMappingsList();
  refreshExportInfo();
  showNotice(document.getElementById('applyAllStatus'),
    `${copy ? 'Copied' : 'Moved'} ${moved} mapping${moved === 1 ? '' : 's'} from ${from} to ${currentHostname}.`,
    'success', 6000);
});

// The keyboard-grid engine lives in grid-nav.js. For DEPLOYMENT we inline its
// source so the produced snippet runs on the live site with no extension.
async function getGridEngineSource() {
  try {
    const res = await fetch(chrome.runtime.getURL('grid-nav.js'));
    return stripComments(await res.text());
  } catch { return ''; }
}

// Remove ALL comments from the engine before it ships. The delivered script
// should read as ordinary accessibility code — internal notes about how the
// authoring tool works have no place in a client deliverable. Doing it by
// stripping (rather than editing each comment) means future comments can never
// leak either. String/regex literals are respected so code is never corrupted.
function stripComments(src) {
  let out = '', i = 0;
  const n = src.length;
  let inS = null;      // ' " ` when inside a string
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (inS) {
      out += c;
      if (c === '\\') { out += (src[i + 1] || ''); i += 2; continue; }
      if (c === inS) inS = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { inS = c; out += c; i++; continue; }
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  // Collapse the blank lines the stripped comments leave behind.
  return out.split('\n').filter((l, idx, a) => l.trim() !== '' || (a[idx - 1] || '').trim() !== '').join('\n').trim();
}

// For the QA monitoring hook: the ONE selector field per type that is reliably
// present on a normal (unopened) page load. For widgets whose main element only
// exists once opened (dialog/datepicker/combobox), the durable anchor is the
// trigger — checking the popup container itself would false-report as broken on
// every static monitor visit. Mirrors u1-runtime.js's MAIN_FIELD_BY_TYPE.
const QA_MAIN_FIELD = {
  dialog: 'trigger', datepicker: 'trigger', 'keyboard-grid': 'trigger',
  combobox: 'textbox', tooltip: 'trigger',
};

// Build the single {id,type,field,selector,page} the monitor should validate for
// a mapping: its reliable anchor selector plus the page path it was created on.
function qaCheckFor(m) {
  if (!m || typeof m !== 'object' || !m.id) return null;
  const schema = COMPONENT_SCHEMAS[m.type];
  const pKey = schema ? primaryKeyOf(schema) : null;
  const mainField = QA_MAIN_FIELD[m.type] || pKey || 'primary';
  let selector = '';
  if (mainField !== pKey && m.config && typeof m.config[mainField] === 'string') selector = m.config[mainField].trim();
  if (!selector) selector = (m.primary || m.firstArg || '').trim(); // fall back to the primary
  if (!selector) return null;
  let page = '';
  try { page = new URL(m.pageUrl).pathname.replace(/\/+$/, '') || '/'; } catch (e) { page = ''; }
  return { id: m.id, type: m.type || 'mapping', field: mainField, selector, page };
}

// Builds the full, self-contained script the implementer pastes into the site
// (after the U1 library tag). Everything here must run WITHOUT the extension.
async function buildDeployableCode(list, hostname) {
  const fixes = [], customs = [], grids = [], clickables = [];
  // Every emitted block is preceded by its "Fix #N" header so the script can be
  // read against the close-out report line by line.
  const header = (m) => {
    // Lead each block with the durable id (the key the monitor reports on breakage).
    // Coerce to the id charset so a malformed/hostile id (e.g. an imported "*/…")
    // can't break out of the /* */ comment and inject code into the client bundle.
    const safeId = m && m.id ? String(m.id).replace(/[^A-Za-z0-9_-]/g, '') : '';
    const label = safeId || 'Fix';
    const what = [m && m.type, m && (m.primary || m.firstArg)].filter(Boolean).join('  ');
    return `/* ---- ${label} — ${what} ---- */`;
  };
  const sorted = list.slice().sort((a, b) => {
    const an = (a && a.fixNo) || 1e9, bn = (b && b.fixNo) || 1e9;
    return an - bn;
  });
  for (const m of sorted) {
    if (typeof m === 'string') { fixes.push(m); continue; }
    if (!m || typeof m !== 'object') continue;
    if (m.custom === 'keyboardGrid') grids.push(m);
    else if (m.custom === 'keyboardClickable') clickables.push(m);
    else if (m.custom) { const c = mappingToCode(m); if (c) customs.push(header(m) + '\n' + c); } // regenerated, never stored m.code
    else { const c = mappingToCode(m); if (c) fixes.push(header(m) + '\n' + c); }
  }

  const parts = [];
  parts.push(`/* ============================================================\n` +
    ` * U1 accessibility mappings — ${hostname}\n` +
    ` * Generated by U1 Studio on ${new Date().toLocaleString()}\n` +
    ` * Paste AFTER the U1 library <script> tag.\n` +
    ` * ============================================================ */`);

  if (fixes.length) {
    parts.push(`/* ---- 1. Component mappings ---- */\n` + fixes.join('\n\n'));
  }
  if (customs.length) {
    parts.push(`/* ---- 2. Accessible names ---- */\n` + customs.join('\n\n'));
  }
  if (grids.length || clickables.length) {
    const engine = await getGridEngineSource();
    const calls = grids.map(g =>
      header(g) + `\nwindow.__u1InstallGridFromMapping(${JSON.stringify(g.primary)}, ${JSON.stringify(g.config, null, 2)});`
    ).concat(clickables.map(c =>
      header(c) + `\nwindow.__u1MakeClickable(${JSON.stringify({ selector: c.primary, role: (c.config && c.config.role) || 'button', label: (c.config && c.config.label) || '' }, null, 2)});`
    )).join('\n\n');
    parts.push(
      `/* ---- 3. Accessible grid / datepicker ----\n` +
      ` * Adds role=grid/gridcell, aria-label/selected/disabled, roving tabindex,\n` +
      ` * arrow/Home/End/Enter/Space, a visible focus ring, and re-applies itself\n` +
      ` * on every re-render and each time the widget opens. */\n` +
      (engine ? `(function () {\n${engine}\n})();\n\n${calls}`
              : `/* !! Engine source unavailable — re-copy this script. */\n${calls}`)
    );
  }

  // ── 4. Monitoring hook — inert unless the page is loaded with ?u1qa=1 ──────
  // Lets the external daily monitor detect a mapping whose selector no longer
  // resolves. On such a page it logs ONE greppable console.error per broken
  // mapping, carrying the durable id, the type, the exact field that broke, the
  // selector and the page — the monitor parses these lines straight into its
  // dashboard. Completely silent for real visitors (no ?u1qa=1 → returns early).
  const checks = [];
  for (const m of sorted) { const c = qaCheckFor(m); if (c) checks.push(c); }
  if (checks.length) {
    parts.push(
      `/* ---- 4. Monitoring hook (only runs with ?u1qa=1) ---- */\n` +
      `(function () {\n` +
      `  try {\n` +
      `    if (new URLSearchParams(location.search).get('u1qa') !== '1') return;\n` +
      `    var CHECKS = ${JSON.stringify(checks)};\n` +
      `    var here = (location.pathname || '/').replace(/\\/+$/, '') || '/';\n` +
      `    function run() {\n` +
      `      CHECKS.forEach(function (c) {\n` +
      `        try {\n` +
      `          if (c.page && c.page !== here) return; // page-specific mapping — only validate on its own page\n` +
      `          var ok = false; try { ok = !!document.querySelector(c.selector); } catch (e) { ok = false; }\n` +
      `          if (!ok) console.error('U1-VALIDATION-ERROR | domain=' + location.hostname + ' | type=' + c.type + ' | id=' + c.id + ' | field=' + c.field + ' | selector=' + c.selector + ' | page=' + location.pathname);\n` +
      `        } catch (e) {}\n` +
      `      });\n` +
      `    }\n` +
      `    if (document.readyState === 'complete') setTimeout(run, 800);\n` +
      `    else window.addEventListener('load', function () { setTimeout(run, 800); });\n` +
      `  } catch (e) {}\n` +
      `})();`
    );
  }

  return parts.join('\n\n');
}

document.getElementById('copyAllBtn').addEventListener('click', async () => {
  const key = storageKey('mappings', currentHostname);
  const stored = await U1Store.get([key]);
  const list = stored[key] || [];
  if (!list.length) return;
  const btn = document.getElementById('copyAllBtn');
  btn.textContent = 'Building…';
  const text = await buildDeployableCode(list, currentHostname);
  await navigator.clipboard.writeText(text);
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = 'Copy All'; }, 1500);
});

// ── Test a mapping (Dimension A static checks; Dimension B added in runTest) ──
async function runMappingTest(m, btn) {
  // Test the MAIN element (m.primary — e.g. the dialog), not firstArg (the trigger).
  const primary = m.primary || m.firstArg || '';
  const type = m.type;
  const config = (m.config && typeof m.config === 'object') ? m.config : { selectors: {} };
  const status = document.getElementById('applyAllStatus');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  showNotice(status, 'Running test — watch the page for the keyboard navigation…', 'warn', 0);
  const res = await callTestEngine('runTest', [type, primary, config]);
  if (btn) { btn.disabled = false; btn.textContent = '🧪'; }
  status.style.display = 'none';
  if (!res || !res.static) {
    showNotice(status, 'Could not run the test on this page — is the element present?', 'error', 4000);
    return;
  }
  renderTestResults(m, res);
}

// ── Live keyboard-test streaming ────────────────────────────────────────────
// test-engine.js posts u1-test-start / u1-test-step as it drives the page. Show
// each step the moment it happens (the final tally still replaces this when
// runTest resolves via renderTestResults).
function testStepRowHtml(step) {
  const st = step.status;
  const icon = st === 'pass' ? '✓' : st === 'fail' ? '✗' : '⚠';
  return `<li class="test-step ${st}"><span class="ti">${icon}</span>` +
    `<span class="tl">${escapeHtml(step.label || '')}</span>` +
    `${step.message ? `<div class="tm">${escapeHtml(step.message)}</div>` : ''}</li>`;
}
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== 'object') return;
  const box = document.getElementById('testResults');
  if (!box) return;
  if (msg.type === 'u1-test-start') {
    box.style.display = 'block';
    box.innerHTML =
      `<div class="test-head"><strong>Test</strong> <code>${escapeHtml(msg.primary || '')}</code>` +
      `<span class="test-live-tag">running…</span></div>` +
      `<div class="test-section-title">⌨️ Keyboard navigation</div>` +
      `<ul class="test-steps" id="testLiveSteps"></ul>`;
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else if (msg.type === 'u1-test-step' && msg.step) {
    const ul = document.getElementById('testLiveSteps');
    if (ul) { ul.insertAdjacentHTML('beforeend', testStepRowHtml(msg.step)); ul.lastElementChild?.scrollIntoView({ block: 'nearest' }); }
  }
});

function codeSection(inspect) {
  if (!inspect || inspect.notFound) return '';
  const tags = (inspect.tags || []).map(t =>
    `<div class="test-code-tag"><span class="test-code-label">${escapeHtml(t.label)}</span><code>${escapeHtml(t.tag)}</code></div>`).join('');
  const html = inspect.outerHTML ? `<pre class="test-code-html">${escapeHtml(inspect.outerHTML)}</pre>` : '';
  return `
    <button class="test-code-toggle" id="testCodeToggle">▸ Applied code (what actually landed)</button>
    <div id="testCodePre" class="test-code-pre" style="display:none">
      ${tags}
      ${html}
    </div>`;
}

function renderTestResults(m, res) {
  const box = document.getElementById('testResults');
  if (!box) return;
  const icon = (s) => s === 'pass' ? '✓' : s === 'fail' ? '✗' : '⚠';
  const stepRows = (steps) => (steps || []).map(s => {
    const isIssue = s.status === 'fail' || s.status === 'warn';
    const why = s.why || s.message || '';
    // For a pass we just show the (optional) short message; for a warn/fail we
    // put the explanation behind a collapsible "Why?" accordion.
    const detail = isIssue && why
      ? `<details class="test-why"><summary>Why ${s.status === 'fail' ? 'this failed' : 'this warns'}?</summary><div class="tm">${escapeHtml(why)}</div></details>`
      : (s.message ? `<div class="tm">${escapeHtml(s.message)}</div>` : '');
    return `
    <li class="test-step ${s.status}">
      <span class="ti">${icon(s.status)}</span>
      <span class="tl">${escapeHtml(s.label)}${s.wcag ? ` <span class="wcag-chip">WCAG ${escapeHtml(s.wcag)}</span>` : ''}</span>
      ${detail}
    </li>`;
  }).join('');
  const staticSteps = (res.static && res.static.steps) || [];
  const kbSteps = (res.keyboard && res.keyboard.steps) || [];
  const count = (steps, st) => steps.filter(s => s.status === st).length;
  const pills = (steps) => {
    const f = count(steps, 'fail'), w = count(steps, 'warn'), p = steps.length - f - w;
    return `<span class="pill pass">${p}✓</span><span class="pill fail${f ? '' : ' zero'}">${f}✗</span><span class="pill warn${w ? '' : ' zero'}">${w}⚠</span>`;
  };
  box.style.display = 'block';
  box.innerHTML = `
    <div class="test-head">
      <strong>Test</strong>
      <code>${escapeHtml(m.primary || m.firstArg || '')}</code>
      <button class="btn-ghost btn-xs" id="testEdit" title="Fix this element — open it in the editor">✎ Edit</button>
      <button class="btn-ghost btn-xs" id="testClose" title="Close">✕</button>
    </div>
    <div class="test-section-title">🏷️ Accessibility (code) <span class="pills">${pills(staticSteps)}</span></div>
    <ul class="test-steps">${stepRows(staticSteps)}</ul>
    <div class="test-section-title">⌨️ Keyboard navigation <span class="pills">${pills(kbSteps)}</span></div>
    <ul class="test-steps">${stepRows(kbSteps)}</ul>
    ${codeSection(res.inspect)}`;
  const codeToggle = document.getElementById('testCodeToggle');
  if (codeToggle) codeToggle.addEventListener('click', () => {
    const pre = document.getElementById('testCodePre');
    if (!pre) return;
    const open = pre.style.display !== 'none';
    pre.style.display = open ? 'none' : 'block';
    codeToggle.textContent = (open ? '▸' : '▾') + ' Applied code (what actually landed)';
  });
  const ed = document.getElementById('testEdit');
  if (ed) ed.addEventListener('click', () => {
    callTestEngine('removeHud', []);
    box.style.display = 'none'; box.innerHTML = '';
    if (typeof m === 'object') loadMappingIntoForm(m); // jump straight to edit mode for this element
  });
  const c = document.getElementById('testClose');
  if (c) c.addEventListener('click', () => {
    box.style.display = 'none'; box.innerHTML = '';
    callTestEngine('removeHud', []); // clear the on-page HUD too
  });
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Full-image viewer dialog (for the element screenshot in a mapping row).
function openImageDialog(src) {
  document.getElementById('imgDialogOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'imgDialogOverlay';
  overlay.className = 'img-dialog-overlay';
  overlay.innerHTML = `
    <div class="img-dialog" role="dialog" aria-label="Element image">
      <button class="img-dialog-close" title="Close">✕</button>
      <img src="${safeImg(src)}" alt="Element image">
    </div>`;
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.img-dialog-close').addEventListener('click', close);
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  document.body.appendChild(overlay);
}

async function loadMappingsList() {
  const key = storageKey('mappings', currentHostname);
  const stored = await U1Store.get([key]);
  const list = stored[key] || [];
  const container = document.getElementById('mappingsList');
  const applyAllRow = document.getElementById('applyAllRow');
  const toolbar = document.getElementById('mappingsToolbar');

  if (list.length === 0) {
    // "The mappings disappeared" is almost always this: the work is filed
    // under another hostname for the same client. Say so here, where the
    // absence is noticed, instead of leaving an empty list to be believed.
    container.innerHTML = '<div class="empty-state">No mappings yet.</div>';
    if (applyAllRow) applyAllRow.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    try {
      const sites = (await U1Store.listSites()).filter(h => h !== currentHostname);
      const others = await U1Store.get(sites.map(h => storageKey('mappings', h)));
      const kin = sites
        .map(h => ({ h, n: (others[storageKey('mappings', h)] || []).length, rel: hostRelation(currentHostname, h) }))
        .filter(r => r.n > 0 && r.rel)
        .sort((a, b) => b.n - a.n);
      if (kin.length) {
        container.innerHTML =
          `<div class="advisor-note warn"><strong>Nothing is saved for ${escapeHtml(currentHostname)}</strong> — ` +
          `but the same client looks to be saved under another address. Storage is keyed by hostname, so a different URL for the same site is a different file.` +
          `<ul>${kin.map(r =>
            `<li><code>${escapeHtml(r.h)}</code> — ${r.n} mapping${r.n === 1 ? '' : 's'} ` +
            `<button class="btn-primary btn-xs" data-adopt="${escapeHtml(r.h)}">Move here</button> ` +
            `<button class="btn-outline btn-xs" data-adopt-copy="${escapeHtml(r.h)}">Copy here</button></li>`).join('')}</ul>` +
          `<div class="ai-comp-why">Move re-files that site's work under ${escapeHtml(currentHostname)} and leaves nothing behind. Copy keeps both.</div></div>`;
      }
    } catch {}
    return;
  }
  if (toolbar) toolbar.style.display = 'flex';

  // Backfill / repair Fix # — chronological by capture time so the numbers match
  // the order the work was actually done. Collision-safe: a mapping keeps its own
  // number only if it's unique; missing OR duplicate numbers are reassigned the
  // next free integer. This heals data where an old (unnumbered) mapping and a
  // freshly added one both ended up as #1.
  {
    const ordered = list.filter(m => m && typeof m === 'object')
      .slice().sort((a, b) => (a.capturedAt || 0) - (b.capturedAt || 0));
    const used = new Set();
    let n = 0, changed = false;
    const nextFree = () => { do { n++; } while (used.has(n)); return n; };
    ordered.forEach(m => {
      let no = Number(m.fixNo);
      if (!no || used.has(no)) { no = nextFree(); }
      if (no !== m.fixNo) { m.fixNo = no; changed = true; }
      used.add(no);
      // Backfill the durable monitor id onto any mapping saved before ids existed.
      if (!m.id) { m.id = genMappingId(); changed = true; }
    });
    if (changed) await U1Store.set({ [key]: list });
  }

  // "On this page": a mapping belongs to this page if its selector matches RIGHT
  // NOW, or if it was captured on this URL. The second test matters because
  // dialogs/datepickers only exist in the DOM while open — without it they
  // wrongly vanished from the list even though they belong to this page.
  const primaries = list.map(m => (m && typeof m === 'object') ? (m.primary || m.firstArg || '') : '').filter(Boolean);
  const present = await selectorsPresentOnPage(primaries);
  const tab = await getTab();
  const cleanUrl = (u) => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/+$/, ''); } catch { return (u || '').split('#')[0].split('?')[0].replace(/\/+$/, ''); } };
  const hereUrl = cleanUrl(tab && tab.url);
  const onPage = (m) => {
    if (!m || typeof m !== 'object') return true;
    const p = m.primary || m.firstArg || '';
    if (present && p && present.has(p)) return true;      // visible right now
    if (m.pageUrl && hereUrl && cleanUrl(m.pageUrl) === hereUrl) return true; // captured here
    return present ? false : true;                        // couldn't check → don't hide
  };
  const onPageCount = list.filter(onPage).length;
  // Show how many mappings each tab holds, so it's obvious when something is hidden.
  const onPageBtn = document.getElementById('filterOnPage');
  const allBtn    = document.getElementById('filterAll');
  if (onPageBtn) onPageBtn.textContent = `On this page (${onPageCount})`;
  if (allBtn)    allBtn.textContent    = `All (${list.length})`;

  const itemHtml = (m, idx) => {
    const code = mappingToCode(m);
    const legacy = typeof m === 'string';
    const shot = m && typeof m === 'object' ? safeImg(m.screenshot) : '';
    const hasShot = !!shot;
    const type = (m && typeof m === 'object' && m.type) ? m.type : 'mapping';
    const primary = (m && typeof m === 'object') ? (m.primary || m.firstArg || '') : String(m).slice(0, 40);
    // Collapsed accordion: header shows type + selector; body holds code + actions.
    return `
      <div class="mapping-item${legacy ? ' legacy' : ''}" data-idx="${idx}">
        <button class="mapping-head" aria-expanded="false" data-idx="${idx}">
          <span class="mh-caret">▸</span>
          ${m && m.id ? `<span class="mh-id" title="Stable id — how the daily monitor reports this mapping if its selector breaks">${escapeHtml(m.id)}</span>` : ''}
          <span class="mh-type">${escapeHtml(type)}</span>
          <span class="mh-sel">${escapeHtml(primary)}</span>
          ${hasShot ? `<span class="mh-thumb" data-idx="${idx}" title="Click to view full image">
            <img class="mh-img" src="${shot}" alt="Element preview">
            <img class="mh-preview" src="${shot}" alt="">
          </span>` : ''}
        </button>
        <div class="mapping-body" style="display:none">
          <pre>${escapeHtml(code)}</pre>
          <div class="mapping-actions">
            <button class="apply-btn" data-idx="${idx}" data-tip="${legacy ? 'Legacy — re-add' : 'Apply on page'}" title="${legacy ? 'Legacy string — cannot auto-apply, please re-add' : 'Apply on page'}"${legacy ? ' disabled' : ''}>▶</button>
            <button class="test-btn" data-idx="${idx}" data-tip="Test" title="Test accessibility + keyboard navigation"${legacy ? ' disabled' : ''}>🧪</button>
            <button class="edit-btn" data-idx="${idx}" data-tip="Edit" title="Edit this mapping"${legacy ? ' disabled' : ''}>✎</button>
            <button class="shot-btn" data-idx="${idx}" data-tip="Screenshot" title="Capture/refresh screenshot (open the element's page first)"${legacy ? ' disabled' : ''}>📷</button>
            <button class="img-btn" data-idx="${idx}" data-tip="Upload image" title="Upload your own image"${legacy ? ' disabled' : ''}>🖼️</button>
            <button class="ask-btn" data-idx="${idx}" data-tip="Ask AI" title="Ask about this mapping — why it isn't working, or change it"${legacy ? ' disabled' : ''}>🤔</button>
            <button class="del-btn" data-idx="${idx}" data-tip="Remove" title="Remove">✕</button>
          </div>
        </div>
      </div>
    `;
  };

  // Flat list (domain/page grouping lives only in the close-out report now).
  // Display in Fix # order so the list reads 1,2,3… — the storage/insertion order
  // can differ from the chronological numbering, which made numbers look shuffled.
  // idx stays the original storage index so the row buttons still target the right one.
  const entries = [];
  list.forEach((m, idx) => { if (mappingsFilter === 'all' || onPage(m)) entries.push({ m, idx }); });
  entries.sort((a, b) => (((a.m && a.m.fixNo) || 1e9) - ((b.m && b.m.fixNo) || 1e9)));

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state">No mappings match an element on this page. Switch to “All” to see the rest.</div>';
    if (applyAllRow) applyAllRow.style.display = 'flex';
    return;
  }

  container.innerHTML = entries.map(e => itemHtml(e.m, e.idx)).join('');

  if (applyAllRow) applyAllRow.style.display = 'flex';

  // Accordion: each mapping collapsed by default; click the header to toggle.
  container.querySelectorAll('.mapping-head').forEach(head => {
    head.addEventListener('click', () => {
      const body = head.parentElement.querySelector('.mapping-body');
      const open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', String(!open));
      const caret = head.querySelector('.mh-caret');
      if (caret) caret.textContent = open ? '▸' : '▾';
      // Use '' (not 'block') so the stylesheet's display:grid layout applies —
      // an inline display:block would override it and stack the buttons below.
      if (body) body.style.display = open ? 'none' : '';
    });
  });

  // Clicking the header thumbnail opens the full image (doesn't toggle the row).
  container.querySelectorAll('.mh-thumb').forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      e.stopPropagation();
      const img = thumb.querySelector('.mh-img');
      if (img) openImageDialog(img.src);
    });
  });

  // The agent, on a mapping that is already saved — which is where you find out
  // it is not doing what you wanted. It re-reads the component's markup from
  // the page, measures what the mapping actually does, and answers about THIS
  // mapping: why it is not working, or a change you ask for in words.
  container.querySelectorAll('.ask-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = list[parseInt(btn.dataset.idx, 10)];
      if (!m || !m.type) return;
      const item = btn.closest('.mapping-item');
      let box = item.querySelector('.ai-why');
      if (!box) {
        box = document.createElement('div');
        box.className = 'ai-why';
        item.appendChild(box);
      }
      box.style.display = 'block';
      box.innerHTML = '<div class="ai-busy"><div class="ai-busy-bar"><span></span></div>' +
        '<div class="ai-busy-sub">Reading this component on the page and measuring what the mapping does.</div></div>';

      const sel = m.firstArg || m.primary;
      const tab = await getTab();
      if (!isInjectable(tab)) { box.innerHTML = '<div class="ai-sel-bad">Cannot read this page.</div>'; return; }

      const markup = await inPage(tab.id, (s) => window.__u1SelectorIntel.extractComponent(s), [sel]);
      if (!markup || markup.error || markup.notFound) {
        box.innerHTML = `<div class="ai-sel-bad">Nothing on this page matches ${escapeHtml(sel)}, so there is nothing to look at.</div>`;
        return;
      }

      const res = await applyMappingsBatch([{ type: m.type, primary: m.primary, firstArg: m.firstArg, config: m.config }]);
      const d = (res.details || [])[0];
      const outcome = !res.ok
        ? (res.u1Missing ? 'window.u1 is not loaded on the page at all.' : 'Applying failed: ' + res.err)
        : d && d.status === 'error' ? `u1.fix.${d.type} threw: ${(res.errs || [])[0] || 'unknown'}`
        : d && d.status === 'no-match' ? `Nothing on the page matches ${d.sel}.`
        : res.applied
          ? `${d.changed} element(s) gained U1 attributes.` +
            (d.fieldsNoEffect && d.fieldsNoEffect.length
              ? ` These fields changed nothing at all: ${d.fieldsNoEffect.join(', ')}.`
              : ' Every configured field changed something.')
          : `Nothing changed at all. u1.fix ran without throwing and wrote no attributes.${d && d.reason ? ' Reason recorded: ' + d.reason + '.' : ''}`;

      const out = await U1AI.diagnose({ u1Type: m.type, containerSel: sel, config: m.config, markup, outcome });
      aiCost += U1AI.estimateCost(out.usage) || 0;
      if (out.err) { box.innerHTML = `<div class="ai-sel-bad">${escapeHtml(out.err)}</div>`; return; }

      const fixSel = (out.fix && out.fix.selectors) || [];
      box.innerHTML =
        `<div class="ai-why-head"><strong>${escapeHtml(out.verdict || '')}</strong>` +
        `<span class="ai-conf" data-c="${escapeHtml(out.confidence || 'medium')}">${escapeHtml(out.confidence || '')}</span></div>` +
        `<div class="ai-comp-why">${escapeHtml(out.cause || '')}</div>` +
        (out.fix && out.fix.what ? `<div class="ai-why-fix"><strong>Fix:</strong> ${escapeHtml(out.fix.what)}</div>` : '') +
        fixSel.map(s => `<div class="ai-fix-sel"><strong>${escapeHtml(s.key)}</strong>: ${escapeHtml(s.value)}</div>`).join('') +
        (fixSel.length ? `<div class="ai-find-actions"><button class="btn-outline btn-xs" data-savedfix="${btn.dataset.idx}">Apply these to the mapping</button></div>` : '') +
        `<div class="ai-ask">
           <input type="text" class="ai-ask-input" data-savedask="${btn.dataset.idx}"
                  placeholder="Or tell it what to change — e.g. “submenus should be the parent div”">
           <button class="btn-outline btn-sm" data-savedaskgo="${btn.dataset.idx}">Ask</button>
         </div>`;
    });
  });

  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.dataset.idx, 10);
      const gone = list[i];
      list.splice(i, 1);
      await U1Store.set({ [key]: list });
      loadMappingsList();
      refreshExportInfo();

      // Deleting the mapping deletes the INSTRUCTION. It does not undo what U1
      // already wrote into the live DOM — roles, aria-*, tabindex, plus key
      // handlers that cannot be detached from outside. A reload is the only
      // clean way back.
      //
      // Said unconditionally rather than detected: U1's roles are
      // indistinguishable from the site's own, so any detector here is either
      // silent when it matters or crying wolf. This is always true anyway.
      if (!gone) return;
      const status = document.getElementById('applyAllStatus') || document.getElementById('applyStatus');
      const rk = mappingKey(gone);
      const receipt = applyReceipts.get(gone.type + '::' + (gone.firstArg || gone.primary));
      const undone = await revertApplied(receipt);
      applyReceipts.delete(gone.type + '::' + (gone.firstArg || gone.primary));
      if (undone) {
        showNotice(status, `Removed — and ${undone} attribute${undone === 1 ? '' : 's'} U1 had written were taken back off the page.`, 'success', 6000);
      } else {
        showNotice(status,
          'Removed from the list. Anything U1 already wrote to the page in an earlier session is still there — reload to clear it.',
          'error', 10000);
        offerReload(status);
      }
    });
  });

  container.querySelectorAll('.test-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.dataset.idx, 10);
      const m = list[i];
      if (m && typeof m === 'object') await runMappingTest(m, btn);
    });
  });

  container.querySelectorAll('.edit-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.idx, 10);
      const m = list[i];
      if (m && typeof m === 'object') loadMappingIntoForm(m);
    });
  });

  container.querySelectorAll('.img-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.idx, 10);
      const m = list[i];
      if (!m || typeof m === 'string') return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const scaled = await downscaleImage(reader.result, 900);
          m.screenshot = scaled || reader.result;
          m.capturedAt = Date.now();
          await U1Store.set({ [key]: list });
          loadMappingsList();
          showNotice(document.getElementById('applyAllStatus'), 'Image added to mapping.', 'success', 2000);
        };
        reader.readAsDataURL(file);
      });
      input.click();
    });
  });

  container.querySelectorAll('.shot-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.dataset.idx, 10);
      const m = list[i];
      if (!m || typeof m === 'string') return;
      const status = document.getElementById('applyAllStatus');
      const original = btn.textContent;
      btn.textContent = '…';
      const shot = await captureElementScreenshot(m.primary);
      btn.textContent = original;
      if (!shot) {
        showNotice(status, 'Could not capture — open the page with this element first.', 'error', 4000);
        return;
      }
      const tab = await getTab();
      m.screenshot = shot;
      m.pageUrl = tab?.url || m.pageUrl || '';
      m.pageTitle = tab?.title || m.pageTitle || '';
      m.capturedAt = Date.now();
      await U1Store.set({ [key]: list });
      loadMappingsList();
      showNotice(status, 'Screenshot captured.', 'success', 2000);
    });
  });

  container.querySelectorAll('.apply-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.dataset.idx, 10);
      const m = list[i];
      if (!m || typeof m === 'string') return;
      const status = document.getElementById('applyAllStatus');
      const result = await applyOne(m.type, m.firstArg || m.primary, m.config, m.custom);
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
  const platKey = storageKey('platform', currentHostname);
  const stored = await U1Store.get([mKey, platKey]);
  const count  = (stored[mKey] || []).length;
  document.getElementById('exportMappingsCount').textContent =
    `${count} mapping${count !== 1 ? 's' : ''}`;

  const sel = document.getElementById('platformSelect');
  const detectedLabel = document.getElementById('platformDetected');
  // Prefer a saved override; otherwise auto-detect the platform.
  if (stored[platKey]) {
    sel.value = stored[platKey];
    if (detectedLabel) detectedLabel.textContent = '';
  } else {
    const tab = await getTab();
    const detected = await detectSiteType(tab);
    sel.value = detected;
    if (detectedLabel) detectedLabel.textContent = ` — detected: ${detected}`;
  }
}

// Persist a manual platform override per site.
document.getElementById('platformSelect').addEventListener('change', async (e) => {
  await U1Store.set({ [storageKey('platform', currentHostname)]: e.target.value });
  const detectedLabel = document.getElementById('platformDetected');
  if (detectedLabel) detectedLabel.textContent = ' — manual';
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  // This goes to the client. Reading a global key here put another client's
  // bundle URLs into the handover document.
  const lk = storageKey('u1Links', currentHostname);
  const ik = storageKey('manualInject', currentHostname);
  const linkRec = await U1Store.get([lk, ik]);
  const { cssLink = '', jsLink = '' } = linkRec[lk] || linkRec[ik] || {};
  const skipKey = storageKey('skipLinks', currentHostname);
  const cfgKey  = storageKey('config', currentHostname);
  const mKey    = storageKey('mappings', currentHostname);
  const stored = await U1Store.get([skipKey, cfgKey, mKey]);
  const skipLinks = stored[skipKey] || [];
  const config    = stored[cfgKey]  || buildConfigObject(skipLinks);
  // The guide must contain code that ACTUALLY RUNS on the live site with no
  // extension — u1.fix calls + custom JS + the inlined keyboard-grid engine.
  const deployable = await buildDeployableCode(stored[mKey] || [], currentHostname);
  const mappings  = deployable ? [deployable] : [];

  const statusEl = document.getElementById('exportStatus');

  if (!cssLink || !jsLink) {
    statusEl.className = 'notice error';
    statusEl.textContent = 'Warning: CSS/JS links are empty. Fill them in the Setup tab first.';
    flashMessage(statusEl, 4500);
    return;
  }

  const platform = document.getElementById('platformSelect').value || 'wordpress';
  try {
    generateAndDownloadDocx(currentHostname, cssLink, jsLink, mappings, skipLinks, config, platform);
    statusEl.className = 'notice success';
    statusEl.textContent = `Document generated (${platform}) and downloaded.`;
    flashMessage(statusEl, 3000);
  } catch (err) {
    statusEl.className = 'notice error';
    statusEl.textContent = 'Error: ' + err.message;
    flashMessage(statusEl, 4500);
  }
});

document.getElementById('closeOutBtn').addEventListener('click', async () => {
  const status = document.getElementById('closeOutStatus');
  showNotice(status, 'Building report…', 'warn', 0);
  try {
    const res = await generateCloseOutReport(currentHostname);
    if (res.fixes === 0) {
      showNotice(status, `No mappings saved for ${currentHostname} yet — add some in the Templates tab first.`, 'error', 4500);
    } else {
      showNotice(status, `Report generated — ${res.fixes} fix(es) across ${res.pages} page(s).`, 'success', 4000);
    }
  } catch (err) {
    showNotice(status, 'Error: ' + err.message, 'error', 4500);
  }
});

// ── Backup / transfer (Export & Import all data) ────────────────────────────
document.getElementById('exportDataBtn').addEventListener('click', async () => {
  const status = document.getElementById('backupStatus');
  try {
    // The store decides what may leave the machine. It drops every private
    // ("__") key — the close-out render cache, and the signed-in session, which
    // holds a refresh token. A backup file gets emailed and carried between
    // machines, so a credential must never be able to ride along inside one.
    // sanitizeImport() rejects the same prefix on the way back in.
    const all = await U1Store.getExportable();
    const payload = {
      __u1helper: true,
      version: 1,
      exportedAt: new Date().toISOString(),
      data: all,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `u1-helper-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    const sites = Object.keys(all).filter(k => k.startsWith('mappings_')).length;
    showNotice(status, `Exported all data (${sites} site${sites !== 1 ? 's' : ''}).`, 'success', 3500);
  } catch (err) {
    showNotice(status, 'Export failed: ' + err.message, 'error', 4500);
  }
});

document.getElementById('importDataBtn').addEventListener('click', () => {
  const status = document.getElementById('backupStatus');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const raw = (parsed && parsed.data && typeof parsed.data === 'object') ? parsed.data : parsed;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          throw new Error('Not a valid U1 Studio backup file.');
        }
        // SECURITY: never trust an imported backup — it can silently arm script
        // injection into any site (manualInject_*.jsLink) or store HTML/code that
        // is later rendered or handed to a client. Allow-list keys and schema-check
        // every value; drop anything unrecognised.
        const { data, dropped } = sanitizeImport(raw);
        if (!Object.keys(data).length) throw new Error('Nothing valid to import (all entries were rejected).');
        // Merge into storage (imported keys overwrite matching ones, others kept).
        await U1Store.set(data);
        // Refresh the whole UI for the current tab.
        await loadConfigForm();
        await refreshConfigSkipList();
        updateConfigPreview();
        await loadMappingsList();
        await refreshExportInfo();
        const tab = await getTab();
        if (tab) await refreshSetupTab(tab);
        const sites = Object.keys(data).filter(k => k.startsWith('mappings_')).length;
        showNotice(status, `Imported ${sites} site${sites !== 1 ? 's' : ''}.` + (dropped ? ` (${dropped} unsafe/unknown entr${dropped !== 1 ? 'ies' : 'y'} skipped.)` : ' All data merged.'), 'success', 4500);
      } catch (err) {
        showNotice(status, 'Import failed: ' + err.message, 'error', 5000);
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

// ─────────────────────────────────────────────────────────────────────────────
//  Navigation listeners — re-detect U1 whenever the active tab changes
// ─────────────────────────────────────────────────────────────────────────────

async function onTabChanged(tab) {
  // Moving to a non-web tab used to leave currentHostname pointing at the site
  // you were last on, with nothing on screen saying so — save now and it lands
  // on the previous site.
  if (!tab || !isInjectable(tab)) { borrowedHost = true; renderHostWarning(); return; }
  borrowedHost = false;
  renderHostWarning();
  const newHostname = getHostname(tab);
  // Session-only detection must not follow you to the next site.
  if (newHostname !== currentHostname) detectedSkipLinks = [];
  const hostnameChanged = newHostname !== currentHostname;

  currentHostname = newHostname;
  document.querySelectorAll('#mappingsHostname, #exportHostname, #closeOutHostname').forEach(el => {
    el.textContent = currentHostname;
  });

  // Assignment is per site, so moving to a different host has to be re-checked
  // — otherwise one assigned site would unlock every tab in the window.
  if (hostnameChanged && !(await enforceLicence(currentHostname))) return;

  if (hostnameChanged) {
    await loadConfigForm();
    await refreshConfigSkipList();
    updateConfigPreview();
    await loadMappingsList();
    await refreshExportInfo();
  }

  // Run detection immediately and again after a short delay to catch async U1 init
  await refreshSetupTab(tab);
  setTimeout(async () => {
    const freshTab = await getTab();
    if (freshTab && freshTab.id === tab.id) await refreshSetupTab(freshTab);
  }, 1800);
}

// Full page navigation (including regular links and form submissions)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const activeTab = await getTab();
  if (!activeTab || activeTab.id !== tabId) return;
  await onTabChanged(tab);
});

// User switches to a different tab
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) await onTabChanged(tab);
});

// ─────────────────────────────────────────────────────────────────────────────
//  LICENCE GATE
//
//  Decides whether the tool may be used on the current site, and in what mode.
//  Nothing here ever touches stored mappings — a worker who is signed out,
//  unassigned or expired keeps every byte of their work on this machine.
// ─────────────────────────────────────────────────────────────────────────────

// Controls that create or persist NEW work. Read, report and export controls are
// deliberately absent: an expired licence must still be able to hand over
// finished work and take a backup out.
const READONLY_DISABLED_IDS = [
  'addMappingBtn',      // add a mapping
  'applyTemplateBtn',   // apply a generated fix as a new mapping
  'addSkipLinkBtn',     // add a skip link
  'saveSkipBtn',        // persist skip links
  'importDataBtn',      // overwrite local data from a backup
  // AI mode creates and persists mappings too, and it also spends money on the
  // specialist's API key — both are exactly what an expired licence pauses.
  'aiDiscoverBtn',      // start a paid review
];

// The per-card Approve buttons are built at runtime, so an id list cannot reach
// them — the handler checks this instead.
const isReadonly = () => licenceState.accessLevel === 'readonly';

let licenceState = { accessLevel: 'full', stale: false };

function showGateScreen(id) {
  const gate = document.getElementById('gate');
  gate.style.display = 'flex';
  ['gateLogin', 'gateBlocked', 'gateOffline'].forEach(s => {
    document.getElementById(s).style.display = s === id ? 'block' : 'none';
  });
}

function hideGate() {
  document.getElementById('gate').style.display = 'none';
}

function applyLicenceMode(state) {
  licenceState = state;

  const readonly = state.accessLevel === 'readonly';
  document.getElementById('readonlyBanner').style.display = readonly ? 'block' : 'none';
  document.getElementById('offlineBanner').style.display = state.stale ? 'block' : 'none';

  READONLY_DISABLED_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('u1-readonly-off', readonly);
    el.disabled = readonly;
    if (readonly) el.title = 'Licence expired — existing work stays available to view and export.';
  });
}

async function showAccountRow() {
  const client = await U1Auth.getStoredClient();
  const el = document.getElementById('accountEmail');
  if (!el) return;
  const email = client?.email || '';
  el.textContent = email;
  // The header truncates long addresses to fit beside the wordmark, so the full
  // value has to stay recoverable on hover.
  if (email) el.title = email; else el.removeAttribute('title');
}

/**
 * Returns true when the tool may boot. When it returns false the gate is
 * already on screen and the caller must stop.
 */
async function enforceLicence(hostname) {
  const result = await U1Auth.checkSiteAccess(hostname);

  if (result.allowed) {
    hideGate();
    applyLicenceMode(result);
    await showAccountRow();
    return true;
  }

  if (result.reason === 'not_logged_in') {
    showGateScreen('gateLogin');
    return false;
  }
  if (result.reason === 'offline') {
    showGateScreen('gateOffline');
    return false;
  }
  if (result.reason === 'no_site') {
    // Opened on a browser page rather than a real site — nothing to check yet.
    hideGate();
    return true;
  }

  document.getElementById('gateBlockedHost').textContent = hostname;
  document.getElementById('gateRequestWrap').style.display = 'block';
  document.getElementById('gateRequestDone').style.display = 'none';
  showGateScreen('gateBlocked');
  return false;
}

document.getElementById('gateLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('gateLoginBtn');
  const err = document.getElementById('gateLoginError');
  err.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    await U1Auth.login(
      document.getElementById('gateEmail').value.trim(),
      document.getElementById('gatePassword').value,
    );
    document.getElementById('gatePassword').value = '';
    await init(); // re-runs the gate, now with credentials
  } catch (e2) {
    err.textContent = e2.message;
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});

document.getElementById('gateRequestBtn').addEventListener('click', async () => {
  const btn = document.getElementById('gateRequestBtn');
  const err = document.getElementById('gateBlockedError');
  err.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    await U1Auth.requestAccess(currentHostname, document.getElementById('gateRequestNote').value.trim());
    document.getElementById('gateRequestWrap').style.display = 'none';
    document.getElementById('gateRequestDone').style.display = 'block';
  } catch (e) {
    err.textContent = e.offline
      ? 'Could not reach the server. Try again when you are back online.'
      : 'Could not send the request. Try again.';
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Request access';
  }
});

document.getElementById('gateRetryBtn').addEventListener('click', () => init());

// Signing out clears credentials only. Local mappings are the worker's work and
// are never removed — that promise is the whole reason this is a two-line
// handler and not a "clean up" routine.
async function signOut() {
  await U1Auth.logout();
  await init();
}
document.getElementById('gateSignOutBlocked').addEventListener('click', signOut);
document.getElementById('signOutBtn').addEventListener('click', signOut);

// The session closes after a spell of inactivity, and the server only learns
// the worker is still here when the panel calls it. Mapping fixes on one page
// makes no calls at all, so without this a session could lapse while someone is
// visibly working. U1Auth.touch() throttles itself, so this is cheap.
['click', 'keydown'].forEach((evt) => {
  document.addEventListener(evt, () => { U1Auth.touch().catch(() => {}); }, { passive: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────────────────────────────────────

init();

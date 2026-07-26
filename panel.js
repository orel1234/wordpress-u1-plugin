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
  const config = { selectors };
  if (schema.rootFields) {
    for (const [k, defaultVal] of Object.entries(schema.rootFields)) {
      config[k] = (rootValues && k in rootValues) ? rootValues[k] : defaultVal;
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
      func: (list) => {
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
        let applied = 0, failed = 0, errs = [];
        for (const it of list) {
          try {
            if (raw.fix && typeof raw.fix[it.type] === 'function') {
              stripEmpty(it.config && it.config.selectors);
              raw.fix[it.type](it.firstArg || it.primary, it.config);
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

// Moves any per-site data stored under "www.<host>" to "<host>" (once), so the
// www-stripping change doesn't orphan previously saved mappings/config/etc.
async function migrateWwwHostname(host) {
  if (!host || host === 'unknown' || host.startsWith('www.')) return;
  const suffix = '_www.' + host;
  const all = await chrome.storage.local.get(null);
  const updates = {};
  for (const key of Object.keys(all)) {
    if (key.endsWith(suffix)) {
      const prefix = key.slice(0, key.length - suffix.length);
      const newKey = `${prefix}_${host}`;
      if (!(newKey in all) && !(newKey in updates)) updates[newKey] = all[key];
    }
  }
  if (Object.keys(updates).length) {
    await chrome.storage.local.set(updates);
  }
}

async function init() {
  let tab = await getTab();
  // If the active tab is a non-web page (e.g. the report tab we opened), fall
  // back to the most recent real web tab so the hostname isn't "unknown".
  if (!tab || !isInjectable(tab)) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    tab = tabs.reverse().find(isInjectable) || tab;
  }
  const h = getHostname(tab);
  if (h !== 'unknown') currentHostname = h;

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
    const stored = await chrome.storage.local.get([cfgKey, skipKey]);
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
    // Show auto-inject badge if this hostname has manual injection saved
    const miStored = await chrome.storage.local.get([`manualInject_${currentHostname}`]);
    const badge = document.getElementById('autoInjectBadge');
    if (badge) badge.style.display = miStored[`manualInject_${currentHostname}`] ? 'block' : 'none';
    // Persist discovered URLs so Export/docx always has them even before user types anything
    const updates = {};
    if (detected.cssHref && !cssLink) updates.cssLink = detected.cssHref;
    if (detected.jsSrc   && !jsLink)  updates.jsLink  = detected.jsSrc;
    if (Object.keys(updates).length) {
      await chrome.storage.local.set(updates);
      if (updates.cssLink) document.getElementById('cssLink').value = updates.cssLink;
      if (updates.jsLink)  document.getElementById('jsLink').value  = updates.jsLink;
    }
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
  });
  container.appendChild(row);
  renumberSkipRows();
  return row;
}

function renumberSkipRows() {
  document.querySelectorAll('#skipLinksContainer .skiplink-row .row-title')
    .forEach((el, i) => { el.textContent = `Skip Link ${i + 1}`; });
}

function populateSkipRows(saved) {
  const container = document.getElementById('skipLinksContainer');
  container.innerHTML = '';
  if (saved && saved.length) {
    // Show the original selector the user typed (falls back to the resolved id)
    saved.forEach(s => createSkipRow(s.label || '', s.selector || s.target || ''));
  } else {
    createSkipRow();
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
  // SECURITY: these become <script src>/<link href> on the page — only allow
  // http(s), never javascript:/data: which would be arbitrary code execution.
  if (!isSafeHttpUrl(cssLink) || !isSafeHttpUrl(jsLink)) {
    alert('The CSS and JS links must be full http(s):// URLs.');
    return;
  }

  await chrome.storage.local.set({ cssLink, jsLink });
  const tab = await getTab();
  if (!isInjectable(tab)) { alert('Cannot inject on this page.'); return; }

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
      await chrome.storage.local.set({ [`manualInject_${currentHostname}`]: { cssLink, jsLink } });
      await refreshSetupTab(freshTab);
    }
  }, 2500);
});

document.getElementById('replaceU1Btn').addEventListener('click', () => {
  document.getElementById('u1Detected').style.display = 'none';
  document.getElementById('u1Inputs').style.display   = 'block';
});

document.getElementById('stopAutoInjectBtn').addEventListener('click', async () => {
  await chrome.storage.local.remove([`manualInject_${currentHostname}`]);
  document.getElementById('autoInjectBadge').style.display = 'none';
});

document.getElementById('addSkipLinkBtn').addEventListener('click', () => {
  createSkipRow();
});

document.getElementById('editSkipBtn').addEventListener('click', async () => {
  const skipKey = storageKey('skipLinks', currentHostname);
  const stored  = await chrome.storage.local.get([skipKey]);
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
  await chrome.storage.local.set({ [key]: links });
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
    const stored = await chrome.storage.local.get([skipKey]);
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
  await chrome.storage.local.set({
    [storageKey('autoApply', currentHostname)]: $autoApplyConfig.checked,
  });
  if ($autoApplyConfig.checked) maybeAutoApply();
});

async function loadConfigForm() {
  const key = storageKey('config', currentHostname);
  const autoKey = storageKey('autoApply', currentHostname);
  const stored = await chrome.storage.local.get([key, autoKey]);
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
  const stored = await chrome.storage.local.get([skipKey]);
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
  const stored = await chrome.storage.local.get([skipKey]);
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

function renderSubSelectorInputs(type) {
  const schema = COMPONENT_SCHEMAS[type];
  if (!schema) return;
  $subSelArea.innerHTML = '';

  const req = schema.req || [];
  const desc = schema.desc || {};
  const labels = schema.labels || {};
  const labelOf = (k) => labels[k] || k;

  // Primary selector hint: show the doc description for the PRIMARY key, plus
  // whether the main selector is required.
  const pKey = primaryKeyOf(schema);

  // Rename the top label to the actual selector this field maps to, so it's
  // obvious the CSS Selector is e.g. the "listbox" (the <ul>), not the trigger.
  const primaryLabel = document.getElementById('primaryLabel');
  if (primaryLabel) {
    primaryLabel.textContent = pKey ? `CSS Selector — ${labelOf(pKey)}` : 'CSS Selector';
  }

  // Friendly, plain-language help + example for the primary field.
  const helpInfo = PRIMARY_HELP[type];
  if (helpInfo && helpInfo.ex && $primarySelectorInput) {
    $primarySelectorInput.placeholder = 'e.g. ' + helpInfo.ex;
  }

  const primaryHint = document.getElementById('primaryHint');
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
      <input type="text" data-field="${escapeHtml(f)}" placeholder="${isReq ? 'required' : 'optional'}">
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
            ? `<div class="selector-test-row">${inputHtml}<button class="btn-ghost btn-xs sel-test" title="Test selector on page">🔍</button></div>`
            : inputHtml}
          ${hint ? `<div class="input-hint">${escapeHtml(hint)}</div>` : ''}
        `;
        $subSelArea.appendChild(row);
      }
    }
  }

  $subSelSection.style.display = 'block';
  $previewSection.style.display = 'none';
}

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
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selector) => {
        let el;
        try { el = document.querySelector(selector); }
        catch (e) { return { error: e.message }; }
        if (!el) return { notFound: true };

        // Robust, U1-valid, UNIQUE selector builder (ported from the
        // accessibility_autochecker algorithm): identity ladder + class noise
        // filter + uniqueness gate + id-anchored '>' chain. No spaces, no :nth.
        const NOISE = /^(flex|grid|w-|h-|p-|m-|py-|px-|mt-|mb-|ml-|mr-|text-|bg-|border|rounded|shadow|container|row|col|d-|justify|align|items-|gap-|hidden|visible|relative|absolute|fixed|sticky|block|inline|float|clearfix|sr-only|active|focus|hover|open|show|sc-|ng-|css-|emotion-|jsx-|mui)/i;
        // Never build on a GENERATED id (U1's own u1st-<uuid>, Angular Material's
        // mat-input-N / cdk-*, framework uuids) — they change on every reload.
        const VOLATILE_ID = /^(u1st-|cdk-|mat-(input|select|error|hint|option|autocomplete|dialog|tooltip|mdc)|ng-|ember\d|react-|:r[0-9a-z]+:)|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const idOk = (id) => /^[A-Za-z][\w-]*$/.test(id) && !VOLATILE_ID.test(id);
        const uniqueOnPage = (s) => { try { return document.querySelectorAll(s).length === 1; } catch { return false; } };
        const compound = (node) => {
          if (!node || node.nodeType !== 1) return '';
          if (node.id && idOk(node.id)) return '#' + node.id;
          const testId = node.getAttribute('data-testid') || node.getAttribute('data-test');
          if (testId) return `[data-testid="${testId}"]`;
          const tag = node.tagName.toLowerCase();
          const al = node.getAttribute('aria-label');
          if (al && al.length < 40 && !al.includes('"')) return `${tag}[aria-label="${al}"]`;
          const nm = node.getAttribute('name');
          if (nm && !nm.includes('"')) return `${tag}[name="${nm}"]`;
          const classes = (node.className && typeof node.className === 'string')
            ? node.className.trim().split(/\s+/).filter(c => c && !c.includes(':') && !c.includes('/') && !c.includes('[') && !NOISE.test(c)) : [];
          if (classes.length) {
            for (const c of classes) { try { if (document.getElementsByClassName(c).length === 1) return '.' + c; } catch {} }
            return tag + '.' + classes[0];
          }
          return tag;
        };
        const simple = (node) => {
          if (!node || node.nodeType !== 1) return '';
          let c = compound(node);
          if (c.charAt(0) === '#' || uniqueOnPage(c)) return c;
          let chain = c, cur = node.parentElement, guard = 0;
          while (cur && cur !== document.body && guard++ < 6) {
            const pc = compound(cur);
            chain = pc + '>' + chain;
            if (pc.charAt(0) === '#' || uniqueOnPage(chain)) return chain;
            cur = cur.parentElement;
          }
          return uniqueOnPage(chain) ? chain : c;
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
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['test-engine.js'] });
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
      func: (list) => list.filter(s => { try { return !!document.querySelector(s); } catch { return false; } }),
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
        // Some components are built ONLY when the widget opens (the datepicker
        // popup, the dialog body). For those, only the always-present key (the
        // trigger) must match now — the inner selectors legitimately match 0
        // while closed, so a 0 there is expected, not a warning.
        const DYNAMIC_OPEN = {
          datepicker: ['trigger'],
          dialog: ['trigger'],
          combobox: ['trigger', 'input'],
          'keyboard-grid': [], // container + cell are created only when the widget opens
        };
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

document.getElementById('analyzeBtn')?.addEventListener('click', async () => {
  const primary = $primarySelectorInput.value.trim();
  if (!primary) { renderAdvisorNotes([{ level: 'err', msg: 'Type a CSS selector for the element first.' }]); return; }
  renderAdvisorNotes([{ level: 'ok', msg: 'Analyzing the element on the page…' }]);
  const profile = await analyzeElement(primary);
  if (profile.err || profile.error) { renderAdvisorNotes([{ level: 'err', msg: profile.err || profile.error }]); return; }
  if (profile.notFound) { renderAdvisorNotes([{ level: 'warn', msg: 'No element matches that selector on the page.' }]); return; }

  const rec = recommendComponent(profile);
  if (!rec) { renderAdvisorNotes([{ level: 'warn', msg: 'Could not auto-detect the component type — pick one manually below.' }]); return; }

  $componentType.value = rec.type;
  renderTypeGuide(rec.type);
  renderSubSelectorInputs(rec.type);
  for (const [k, v] of Object.entries(rec.fields || {})) {
    const inp = $subSelArea.querySelector(`input[data-field="${k}"]`);
    if (inp && v) inp.value = v;
  }
  const head = [{ level: 'ok', msg: `Suggested component: “${rec.type}”. Selectors pre-filled below — review, then Generate.` }];
  renderAdvisorNotes(head.concat(rec.notes || []));
});

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
  const key = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const list = stored[key] || [];
  const newKey = mappingKey(currentTemplate);
  // If editing, drop the original (its key may have changed after edits).
  let existingIdx = editingMappingKey ? list.findIndex(m => mappingKey(m) === editingMappingKey) : -1;
  if (existingIdx < 0) existingIdx = list.findIndex(m => mappingKey(m) === newKey);

  btn.textContent = 'Capturing…';
  const tab = await getTab();
  const screenshot = await captureElementScreenshot(currentTemplate.primary);
  const prev = existingIdx >= 0 ? list[existingIdx] : null;
  const entry = {
    type: currentTemplate.type,
    primary: currentTemplate.primary,
    firstArg: currentTemplate.firstArg,
    custom: currentTemplate.custom || null,
    config: currentTemplate.config,
    code: currentTemplate.code,
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
  await chrome.storage.local.set({ [key]: list });

  const wasEditing = editingMappingKey != null || existingIdx >= 0;
  editingMappingKey = null;
  loadMappingsList();
  refreshExportInfo();
  btn.textContent = wasEditing ? 'Updated ✓' : 'Added ✓';
  setTimeout(() => { btn.textContent = 'Add to Mapping'; }, 1500);
});

// Apply every saved mapping for the current host. `silent` suppresses the
// "no mappings" / success notices (used by the auto-run on panel open).
async function applyAllMappings({ silent = false } = {}) {
  const key = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
  const list = stored[key] || [];
  const status = document.getElementById('applyAllStatus');
  if (list.length === 0) {
    if (!silent) showNotice(status, 'No mappings to apply.', 'error');
    return { applied: 0, failed: 0 };
  }
  // Custom mappings (aria-label) run as scripts; u1.fix ones go through the batch.
  const custom = list.filter(m => m && typeof m === 'object' && m.custom);
  const fixes = list.filter(m => !(m && typeof m === 'object' && m.custom));

  let applied = 0, failed = 0, u1Missing = false, err = null;
  if (fixes.length) {
    const result = await applyMappingsBatch(fixes);
    if (result.ok) { applied += result.applied; failed += result.failed; }
    else if (result.u1Missing) { u1Missing = true; }
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
    } else {
      const msg = `Applied ${applied} mapping${applied !== 1 ? 's' : ''}` +
                  (failed ? ` (${failed} failed)` : '') + '.';
      showNotice(status, msg, failed ? 'error' : 'success', 4000);
    }
  }
  return { applied, failed, u1Missing };
}

document.getElementById('applyAllBtn').addEventListener('click', () => applyAllMappings());

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

// Builds the full, self-contained script the implementer pastes into the site
// (after the U1 library tag). Everything here must run WITHOUT the extension.
async function buildDeployableCode(list, hostname) {
  const fixes = [], customs = [], grids = [], clickables = [];
  // Every emitted block is preceded by its "Fix #N" header so the script can be
  // read against the close-out report line by line.
  const header = (m) => {
    const n = m && m.fixNo ? `Fix #${m.fixNo}` : 'Fix';
    // Coerce to the id charset so a malformed/hostile id (e.g. an imported "*/…")
    // can't break out of the /* */ comment and inject code into the client bundle.
    const safeId = m && m.id ? String(m.id).replace(/[^A-Za-z0-9_-]/g, '') : '';
    const id = safeId ? ` [${safeId}]` : '';   // durable id the monitor reports on breakage
    const what = [m && m.type, m && (m.primary || m.firstArg)].filter(Boolean).join('  ');
    return `/* ---- ${n}${id} — ${what} ---- */`;
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
  return parts.join('\n\n');
}

document.getElementById('copyAllBtn').addEventListener('click', async () => {
  const key = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([key]);
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
  const stored = await chrome.storage.local.get([key]);
  const list = stored[key] || [];
  const container = document.getElementById('mappingsList');
  const applyAllRow = document.getElementById('applyAllRow');
  const toolbar = document.getElementById('mappingsToolbar');

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">No mappings yet.</div>';
    if (applyAllRow) applyAllRow.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
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
    if (changed) await chrome.storage.local.set({ [key]: list });
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
          ${m && m.fixNo ? `<span class="mh-fixno">#${m.fixNo}</span>` : ''}
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

  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.dataset.idx, 10);
      list.splice(i, 1);
      await chrome.storage.local.set({ [key]: list });
      loadMappingsList();
      refreshExportInfo();
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
          await chrome.storage.local.set({ [key]: list });
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
      await chrome.storage.local.set({ [key]: list });
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
  const stored = await chrome.storage.local.get([mKey, platKey]);
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
  await chrome.storage.local.set({ [storageKey('platform', currentHostname)]: e.target.value });
  const detectedLabel = document.getElementById('platformDetected');
  if (detectedLabel) detectedLabel.textContent = ' — manual';
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  const { cssLink = '', jsLink = '' } = await chrome.storage.local.get(['cssLink', 'jsLink']);
  const skipKey = storageKey('skipLinks', currentHostname);
  const cfgKey  = storageKey('config', currentHostname);
  const mKey    = storageKey('mappings', currentHostname);
  const stored = await chrome.storage.local.get([skipKey, cfgKey, mKey]);
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
    const all = await chrome.storage.local.get(null);
    delete all.__closeOutReportHtml; // transient render cache — no need to export
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
        await chrome.storage.local.set(data);
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
  if (!tab || !isInjectable(tab)) return;
  const newHostname = getHostname(tab);
  const hostnameChanged = newHostname !== currentHostname;

  currentHostname = newHostname;
  document.querySelectorAll('#mappingsHostname, #exportHostname, #closeOutHostname').forEach(el => {
    el.textContent = currentHostname;
  });

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
//  Boot
// ─────────────────────────────────────────────────────────────────────────────

init();

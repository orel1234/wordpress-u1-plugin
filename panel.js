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
    // Defaults to FALSE, which is what this schema's own desc says ("Default
    // false = navigation menu") and what U1 documents. It was true, so every
    // menu mapping was born with the one setting that makes U1 throw
    // "Submenu must have a trigger element" the moment `submenus` is filled —
    // and a website nav with drop-downs is the overwhelmingly common case.
    // menubar:true is for an application menubar with no nested submenus; it
    // is what gives every item role="menuitem". With it off, the triggers get
    // role="button" and the submenu containers role="menu" instead.
    rootFields:{menubar:false, menuDescription:''},
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

  // Same three selectors as `tabs` above, deliberately: the difference is the
  // engine behind them, not what you have to fill in. `tabs` calls u1.fix.tabs
  // and so needs U1 on the page; this one is DOM-only and runs anywhere.
  'keyboard-tabs': {
    custom:'keyboardTabs',
    selectors:{tabList:'PRIMARY', tab:'', tabPanel:''},
    fields:['tab','tabPanel'],
    rootFields:{isVertical:false},
    selectorRoots:[],
    req:['tab','tabList','tabPanel'],
    labels:{
      tabList:'Container of the tabs alone — NOT the panels',
    },
    desc:{
      tabList:'Selector of the container holding the tabs only. It becomes the tablist, so it must not wrap the panels too.',
      tab:'Selector of the tab elements with the click event. Searched INSIDE each tab list, so one page can hold several strips without them mixing.',
      tabPanel:'Selector of the panel(s) whose content changes. Usually outside the tab list. Matched to tabs in order when the counts agree; if the site renders only the visible panel, every tab points at that one.',
      isVertical:'Default is horizontal (Left/Right arrows). Set true for vertical tabs (Up/Down).',
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
    rootFields:{role:'auto', label:'', activates:''},
    selectorRoots:['activates'],
    placeholders:{ activates: 'input[type="checkbox"]' },
    options:{ role: [
      { value:'auto',     text:'Auto — copy it from what it clicks' },
      { value:'button',   text:'Button — performs an action' },
      { value:'link',     text:'Link — navigates somewhere' },
      { value:'checkbox', text:'Checkbox — on / off' },
      { value:'radio',    text:'Radio — one of a set' },
      { value:'switch',   text:'Switch — on / off toggle' },
      { value:'combobox', text:'Combobox — a select / dropdown' },
      { value:'listbox',  text:'Listbox — a multi-select list' },
      { value:'textbox',  text:'Text field — typed into' },
      { value:'slider',   text:'Slider — a range' },
      { value:'tab',      text:'Tab — one of a tab strip' },
      { value:'menuitem', text:'Menu item — a row in a menu' },
    ] },
    req:['target'],
    labels:{
      target:'Element(s) to make keyboard-operable — ALL matches are handled',
      role:'Announce as',
      label:'Accessible name (leave empty to keep the visible text)',
      activates:'Really clicks',
    },
    desc:{
      target:'Every element matching this becomes focusable (Tab) and activates on Enter (plus Space). Native <button>/<a href> are skipped — they already work.',
      role:'Leave as “auto” and the role is read off whatever “Really clicks” points at — a wrapper around a checkbox announces as a checkbox, keeps aria-checked in step, and toggles on Space. Override with button, link, checkbox, radio, switch, combobox, textbox or slider only if auto reads it wrong.',
      label:'Sets aria-label on each match. Usually leave empty: the visible text is used, and failing that the hidden control\u2019s own name or its <label>.',
      activates:'When the thing you can see is not the thing that works — a styled box with a hidden <input> inside it. Name the real control (checkbox, radio, select, file, text field, range …) and it inherits that control\u2019s role, name and state. Searched inside each match first, so every row fires its own.',
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

// One COMPOUND, e.g. `a.menu-item:not(.has-submenu)`. An optional tag, then any
// number of parts that each begin with a distinct sigil (. # [ :). That
// distinctness is the point: the engine never has to guess how to split the
// input, so matching is linear.
//
// The previous single-regex grammar nested a quantifier over overlapping
// alternatives, which backtracks catastrophically. Measured on the real thing:
// a 28-character non-match took 1.3s and a 32-character one took 21 SECONDS —
// and this runs on every keystroke, so typing a selector froze the panel.
const U1_COMPOUND_RE = /^(?:[\w-]+)?(?:\.[\w-]+|#[\w-]+|\[[^\]]*\]|::?[\w-]+(?:\([^()]*\))?)*$/;

function normalizeU1Selector(s) {
  return String(s == null ? '' : s).trim().replace(/\s*([>+~,])\s*/g, '$1');
}

function isU1ValidSelector(s) {
  const n = normalizeU1Selector(s);
  if (n === '') return true;
  return n.split(',').every(group =>
    group !== '' && group.split(/[>+~]/).every(c => c !== '' && U1_COMPOUND_RE.test(c)));
}

function isValidIdent(s) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

// Longest line we will produce before breaking an object across lines. Wide
// enough that a selector pair fits, narrow enough to stay readable in a doc.
const JS_LINE_WIDTH = 92;

// One-line rendering, or null when the value contains nothing (an empty object
// prints the same either way, so it is left to the caller's fast path).
function formatJsInline(obj) {
  if (obj === null) return 'null';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    if (!obj.length) return '[]';
    const parts = obj.map(formatJsInline);
    return parts.includes(null) ? null : `[${parts.join(', ')}]`;
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (!keys.length) return '{}';
    const parts = keys.map((k) => {
      const v = formatJsInline(obj[k]);
      return v === null ? null : `${isValidIdent(k) ? k : JSON.stringify(k)}: ${v}`;
    });
    return parts.includes(null) ? null : `{ ${parts.join(', ')} }`;
  }
  return String(obj);
}

// Serialize an object as JS source with unquoted identifier keys.
//
// Anything that fits on one line is printed on one line. The implementer pastes
// this into their site and reads it there, and a three-selector mapping spread
// over eight lines is not clearer than the same thing on one — it is just
// longer. Purely a formatting change: the value emitted is identical.
function formatJsObject(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  const padInner = '  '.repeat(indent + 1);

  const inline = formatJsInline(obj);
  if (inline !== null && pad.length + inline.length <= JS_LINE_WIDTH) return inline;

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

// One place that answers "did the user name a target?", used before `activates`
// is in scope during role resolution.
function activatesOf(rootValues) { return !!(rootValues && rootValues.activates); }

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
    // Anything the engine understands passes through. Collapsing to button|link
    // here is what used to make "auto" impossible and a checkbox announce wrong.
    const ROLES = ['auto','button','link','checkbox','radio','switch','combobox','listbox','textbox','slider','tab','menuitem'];
    const asked = String((rootValues && rootValues.role) || 'auto').trim().toLowerCase();
    const role = ROLES.includes(asked) ? asked : (activatesOf(rootValues) ? 'auto' : 'button');
    const label = (rootValues && rootValues.label) || '';
    const activates = (rootValues && rootValues.activates) || '';
    const config = { selectors: { target }, role, label, activates };
    const code = `/* Make every match keyboard-operable (role="${role}" + tabindex + Enter/Space).\n` +
      (role === 'auto' ? `   role="auto": each match takes the role, name and state of what it activates.\n` : '') +
      `   Standalone: needs neither U1 nor the extension. Engine is included in the export. */\n` +
      `window.__u1MakeClickable(${JSON.stringify({ selector: target, role, label, activates })});`;
    return { type, primary: target, firstArg: target, config, code, custom: 'keyboardClickable' };
  }

  // Custom: extension-provided tab strip, full ARIA pattern (no U1).
  if (schema.custom === 'keyboardTabs') {
    const tabList = primary.trim();
    const tab = (fieldValues.tab || '').trim();
    const tabPanel = (fieldValues.tabPanel || '').trim();
    const isVertical = !!(rootValues && (rootValues.isVertical === true || rootValues.isVertical === 'true'));
    const config = { selectors: { tabList, tab, tabPanel }, isVertical };
    const code = buildKeyboardTabsCode(tabList, tab, tabPanel, isVertical);
    return { type, primary: tabList, firstArg: tabList, config, code, custom: 'keyboardTabs' };
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

        // The EXPORTED snippet (docx-gen.js setConfigCall) never writes
        // cfg.direction/cfg.language into a nested .config object — it sets
        // window.u1.dir / window.u1.lang directly, which is what our own
        // skip-link RTL detection (u1-runtime.js computeIsRtl) reads. Without
        // this, previewing "Run on Page" here would look different from what
        // actually happens once the same config is deployed for real.
        if (cfg.direction) u1.dir = cfg.direction;
        if (cfg.language) u1.lang = cfg.language;

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
// `owner` carries the parts of the mapping that are not arguments to u1.fix:
// today that is the answer to "the site already wrote a role here", which has
// to reach the page before the fix does.
async function applyOne(type, primary, config, custom, owner) {
  if (custom === 'ariaLabel') return applyAriaLabel(primary, config);
  if (custom === 'keyboardGrid') return applyKeyboardGrid(primary, config);
  if (custom === 'keyboardClickable') return applyKeyboardClickable(primary, config);
  if (custom === 'keyboardTabs') return applyKeyboardTabs(primary, config);
  return applyFix(type, primary, config, owner);
}

// A readable preview of what the keyboard-grid datepicker mapping does.
// The RUNNABLE install call for a keyboard-grid mapping — identical to what
// mappingToCode and the deployable export emit, so the single "Copy" of a
// template gives code that actually runs (the engine is inlined by the export).
function buildKeyboardTabsCode(tabList, tab, tabPanel, isVertical) {
  const config = { selectors: { tabList, tab, tabPanel }, isVertical };
  return `/* Accessible tab strip — tablist/tab/tabpanel roles, roving tabindex,\n` +
         `   ${isVertical ? 'Up/Down' : 'Left/Right'}/Home/End, and aria-selected kept in step with the page.\n` +
         `   Needs the tabs engine (included at the top of the exported bundle). */\n` +
         `window.__u1InstallTabsFromMapping(${JSON.stringify(tabList)}, ${formatJsObject(config)});`;
}

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
// Installs the full ARIA tabs pattern on the page (no U1): tablist/tab/tabpanel
// roles, roving tabindex, arrow/Home/End, and aria-selected re-read from the
// page after each switch. Same shared engine file the export ships.
async function applyKeyboardTabs(primary, config) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { ok: false, err: 'Cannot run on this page.' };
  const s = (config && config.selectors) || {};
  const opts = {
    tabList: s.tabList || primary,
    tab: s.tab || '',
    tabPanel: s.tabPanel || '',
    isVertical: !!(config && config.isVertical),
  };
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['grid-nav.js'] });
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (a) => (window.__u1InstallTabs ? window.__u1InstallTabs(a) : { ok: false, err: 'grid-nav.js not loaded' }),
      args: [opts],
    });
    return res?.[0]?.result || { ok: false, err: 'No result' };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}

async function applyKeyboardClickable(target, config) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { ok: false, err: 'Cannot run on this page.' };
  const opts = {
    selector: (config && config.selectors && config.selectors.target) || target,
    role: (config && config.role) || 'auto',
    label: (config && config.label) || '',
    // Without this the live Apply silently ignores "Click this instead" while
    // the exported code honours it, so the preview and the page disagree.
    activates: (config && config.activates) || '',
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

// Put the library corrections on the page before any u1.fix.* call runs.
//
// The export inlines a SLICED patch, because there size matters. Here it does
// not, and slicing per apply would push a second set of correctors onto a page
// that already has core installed. So: the whole file, once, guarded by
// __u1Patch inside the patch itself.
//
// world:'MAIN' is not optional — the patch wraps window.u1.fix.*, and in the
// isolated world there is no window.u1 to wrap.
//
// Without this, Apply ran raw U1 while the export ran patched U1, so testing in
// the panel could never show what the client would actually get.
async function ensurePatchOnPage(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN', files: ['u1-patch.js'],
    });
    return true;
  } catch { return false; }  // never block an apply on the corrections
}

async function applyFix(type, primary, config, owner) {
  const tab = await getTab();
  if (!isInjectable(tab)) return { ok: false, err: 'Cannot run on this page.' };
  await ensurePatchOnPage(tab.id);
  // The role the site authored comes off first, exactly as the exported file
  // does it — otherwise Apply and the client's own run disagree about what the
  // component says it is.
  if (owner && owner.overwriteRole && owner.primary) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id }, world: 'MAIN',
        func: (selector, role) => {
          document.querySelectorAll(selector).forEach((el) => {
            if (el.getAttribute('role') === role) el.removeAttribute('role');
          });
        },
        args: [owner.primary, owner.overwriteRole],
      });
    } catch {}
  }
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
  await ensurePatchOnPage(tab.id);
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
        // Watch EVERY root the component owns, not just one.
        //
        // `firstArg` is the element U1 is told to wait for, and for a dialog,
        // listbox, datepicker, carousel or pagination that is the trigger /
        // slide / buttons — while the decoration lands on the CONTAINER. So
        // measuring the first arg alone reported "nothing changed" for those
        // types even when the mapping worked perfectly, which is exactly the
        // false negative that sends you looking at correct selectors.
        const snapAll = (roots) => roots.filter(Boolean).map(r => snap(r));
        const changedAll = (before, roots) => {
          const after = snapAll(roots);
          let n = 0;
          for (let i = 0; i < after.length; i++) n += changedCount(before[i] || new Map(), after[i]);
          return n;
        };
        const waitForChange = async (before, roots, budgetMs) => {
          const list = Array.isArray(roots) ? roots : [roots];
          const baseline = Array.isArray(before) ? before : [before];
          const step = 150;
          for (let waited = 0; waited < budgetMs; waited += step) {
            await new Promise(r => setTimeout(r, step));
            const n = changedAll(baseline, list);
            if (n > 0) return n;
          }
          return 0;
        };

        // Whatever the patch declined to call, from this apply onwards. The
        // wrapper can refuse a fix — a tab strip whose parts it cannot reach
        // together — and until now that refusal was silent, which made a
        // correct-looking mapping do nothing with no explanation anywhere.
        const patch = window.__u1Patch;
        const skipMark = patch && patch.skipped ? patch.skipped.length : 0;

        let applied = 0, failed = 0, noEffect = 0, errs = [], details = [];
        let u1State = null;   // filled the first time a fix has no effect
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

            // Lift it before the call — but ONLY when it is the site's own.
            //
            // A console probe settled what this attribute is: on a fresh load
            // #mainNav did not carry it, the first u1.fix.menu worked, and U1
            // then added it itself. So it is U1's "handled" marker, not a
            // blocker in the markup — and removing one U1 wrote achieves
            // nothing, because U1 tracks the element internally and will not
            // look at it twice in a page load.
            //
            // When U1 has left no fingerprints, the attribute really is the
            // site author's and really does stop U1, so lifting it before the
            // one call that counts is worth doing.
            const siteAuthoredOptOut = preStamped && !u1Touched;

            // The other way an element carries U1's marker and still needs the
            // fix run again: the SITE rebuilt the component after U1 finished.
            //
            // A nav that ships empty and is filled by the page's own JS on
            // DOMContentLoaded is the ordinary case — most themes and every SPA
            // do it. U1 starts earlier, processes the empty container, marks it
            // handled and (correctly, for something empty) hides it. Then
            // innerHTML is replaced and every child U1 decorated is gone, while
            // the container still says "handled", so U1 never returns.
            //
            // The signature is unambiguous: the container is marked, yet the
            // elements the mapping points at carry nothing U1 writes. That can
            // only happen if those elements did not exist when U1 ran. Here
            // re-applying is not a workaround — it is the only way the current
            // children can ever be decorated.
            const cfgSels = (it.config && it.config.selectors) || {};
            let fieldEls = 0, fieldElsTouched = 0;
            for (const fsel of Object.values(cfgSels)) {
              if (typeof fsel !== 'string' || !fsel.trim() || fsel === sel) continue;
              let els = [];
              try { els = Array.from(document.querySelectorAll(fsel)); } catch { continue; }
              for (const el of els.slice(0, 200)) {
                fieldEls++;
                for (const a of el.attributes) {
                  if (U1_ATTR.test(a.name)) { fieldElsTouched++; break; }
                }
              }
            }
            const rebuiltAfterU1 = preStamped && fieldEls > 0 && fieldElsTouched === 0;

            if (siteAuthoredOptOut || rebuiltAfterU1) {
              target.removeAttribute('u1st-avoid-change-detection');
            }

            // The container as well as the element U1 waits for. For most types
            // these are the same node; for the trigger-first ones they are not,
            // and the container is where the roles actually appear.
            let container = null;
            try { container = it.primary && it.primary !== sel ? document.querySelector(it.primary) : null; } catch {}
            const roots = container && container !== target ? [target, container] : [target];
            const before = snapAll(roots);

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
            // Same lift the exported file performs, so Apply cannot look
            // different from what the client will actually run.
            if (it.overwriteRole && it.primary) {
              try {
                document.querySelectorAll(it.primary).forEach((el) => {
                  if (el.getAttribute('role') === it.overwriteRole) el.removeAttribute('role');
                });
              } catch {}
            }
            raw.fix[it.type](sel, it.config);

            // U1 decorates asynchronously (RxJS + MutationObserver), and how
            // long it takes depends on the component and the page. A single
            // 400ms sample called a fix that was still in progress a failure —
            // reporting "nothing changed" about work that had plainly landed,
            // which is worse than saying nothing at all. So watch until it
            // changes, and only give up after a real budget.
            let changed = await waitForChange(before, roots, 4000);

            // Is a role the SITE wrote standing in the way?
            //
            // U1 will not write over an author's role, so a <ul role="menu">
            // mapped as a listbox comes back with the trigger fully decorated
            // and the list untouched — "applied", and inoperable. The cause is
            // readable right here and was not being read: the report said
            // "these fields changed nothing" and left the person to guess.
            //
            // Kept in step with ROLE_BY_TYPE in selector-intel.js. Both lists
            // say the same thing; this one runs in the page's own world, where
            // __u1SelectorIntel does not exist.
            const ROLE_BY_TYPE = {
              listbox: 'listbox', combobox: 'combobox', menu: 'menu', tabs: 'tablist',
              dialog: 'dialog', grid: 'grid', table: 'table', radio: 'radiogroup',
              tooltip: 'tooltip', button: 'button', checkbox: 'checkbox',
              accordion: 'button', heading: 'heading', link: 'link',
            };
            let roleClash;
            (() => {
              const want = ROLE_BY_TYPE[it.type];
              // The CONTAINER, which for a trigger-first type is not the
              // element U1 was handed. Where they are the same node, container
              // is null and the target is it.
              const el = container || target;
              if (!want || !el) return;
              const have = el.getAttribute('role');
              if (!have || have === want) return;
              // U1's own fingerprints mean the role is ours, and asking about
              // our own work is noise people learn to click through.
              if (el.hasAttribute('u1st-avoid-change-detection') ||
                  el.hasAttribute('data-u1-revert') ||
                  el.hasAttribute('u1st-trigger-element')) return;
              roleClash = { sel: it.primary || sel, role: have, willWrite: want };
            })();

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

            // There used to be a second fix.* call here, on the theory that
            // "calling once more costs nothing". It does not. U1 will not look
            // at an element twice in a page load anyway — so the retry never
            // rescued anything — while a second call into a live widget can
            // double-initialise it and leave it half torn down. Removed.

            // Did we make the page WORSE?
            //
            // A live menu came back with aria-hidden="true" on the <nav> and
            // tabindex="-1" on every trigger: hidden from screen readers and
            // removed from the tab order, reported as a success. An apply that
            // leaves the page less usable than it found it is not a partial
            // win, and the tool must never keep it. Measure, and undo.
            const harm = [];
            for (const root of roots) {
              if (!root) continue;
              if (root.getAttribute('aria-hidden') === 'true') {
                harm.push(`${it.type}: the container ended up aria-hidden="true" — hidden from screen readers entirely`);
              }
            }
            // Every item at tabindex="-1" is NOT harm by itself — that is the
            // roving-tabindex pattern, where one item (or the container) holds
            // the single tab stop and arrow keys move between the rest. It is
            // only harm when nothing at all is left to reach it by.
            const itemSel = sels.items || sels.options || sels.pageButtons || sels.slide;
            if (itemSel) {
              let els = [];
              try { els = Array.from(document.querySelectorAll(itemSel)); } catch {}
              const anyItemTabbable = els.some(e => e.getAttribute('tabindex') !== '-1');
              const containerReachable = roots.some(r => r && (
                r.getAttribute('tabindex') === '0' ||
                r.hasAttribute('aria-activedescendant') ||
                !!r.querySelector('[tabindex="0"]')));
              if (els.length && !anyItemTabbable && !containerReachable) {
                harm.push(`${it.type}: every item ended up tabindex="-1" with no tab stop anywhere — nothing is reachable by keyboard`);
              }
            }

            // NOTE: this REPORTS, it does not revert.
            //
            // It used to strip everything U1 had just written. That was built
            // from a single observation of one page, and a heuristic that can
            // silently undo a working mapping is far more expensive than one
            // that merely warns: U1 may leave aria-hidden="true" on a container
            // for reasons of its own, and the specialist knows the library
            // better than this check does. So the mapping stays applied and the
            // warning is loud.

            if (changed > 0) {
              applied++;
              if (harm.length) errs.push(harm[0]);
              // Stamp a revert token on everything that gained U1 attributes,
              // and hand back the list. Deleting the mapping can then undo
              // precisely this, instead of asking for a page reload.
              // One receipt across every root we watched — a dialog's roles land
              // on the container while the trigger is what U1 was handed, and
              // an undo that only knew about the trigger would leave the
              // container's attributes behind.
              const receipt = [];
              let token = 0;
              const seen = new Set();
              roots.forEach((root, i) => {
                for (const rec of diffAdded(before[i] || new Map(), snap(root))) {
                  if (seen.has(rec.el)) continue;
                  seen.add(rec.el);
                  const t = `${it.type}-${++token}`;
                  rec.el.setAttribute('data-u1-revert', t);
                  receipt.push({ token: t, added: rec.added });
                }
              });
              // If it only worked because we took the opt-out off, say so — the
              // attribute is still in the site's markup, so without this the
              // mapping looks fine here and does nothing in production.
              details.push({ type: it.type, sel, status: 'ok', changed, fieldsNoEffect, receipt,
                             unblocked: siteAuthoredOptOut || undefined,
                             rebuilt: rebuiltAfterU1 || undefined,
                             roleClash: roleClash || undefined,
                             harm: harm.length ? harm : undefined });
            } else {
              noEffect++;
              // Nothing happened. Before blaming the selector, ask whether U1
              // is working AT ALL on this page: a library that failed to load
              // its project config answers every fix.* call with undefined and
              // decorates nothing, and its own console log says "0 of 0
              // targets". That is invisible from here unless we look.
              u1State = u1State || (() => {
                const decorated = document.querySelectorAll('[id^="u1st-"]').length;
                const cfg = raw.config || null;
                return {
                  decoratedOnPage: decorated,
                  fixMethods: Object.keys(raw.fix || {}).length,
                  configKeys: cfg && typeof cfg === 'object' ? Object.keys(cfg) : null,
                  // Anything that looks like a registry of what U1 was told to
                  // handle. Named loosely on purpose — we do not own these.
                  targetsish: Object.keys(raw).filter(k => /target|registr|componen|element/i.test(k))
                    .map(k => { const v = raw[k]; return k + ':' + (Array.isArray(v) ? v.length : typeof v); }),
                };
              })();
              details.push({
                type: it.type, sel, status: 'no-effect', changed: 0, rebuilt: rebuiltAfterU1 || undefined,
                roleClash: roleClash || undefined,
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
        const skipped = patch && patch.skipped ? patch.skipped.slice(skipMark) : [];
        return { ok: true, applied, failed, noEffect, errs, details, u1State, skipped };
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
    return `window.__u1MakeClickable(${formatJsObject({ selector: m.primary, role: (m.config && m.config.role) || 'auto', label: (m.config && m.config.label) || '', activates: (m.config && m.config.activates) || '' })});`;
  }
  if (m.custom === 'keyboardTabs') {
    return `/* Accessible tab strip — uses the engine included above. */\n` +
           `window.__u1InstallTabsFromMapping(${JSON.stringify(m.primary)}, ${formatJsObject(m.config)});`;
  }
  if (m.custom === 'staticFix') {
    // The rule name and its options only. The correctors themselves ship in the
    // patch's `statics` region — repeating the code per mapping would put the
    // same forty lines in the bundle once per rule.
    const opts = Object.assign({}, m.config || {});
    delete opts.selectors;
    return `window.__u1Statics = window.__u1Statics || {};\n` +
           `window.__u1Statics[${JSON.stringify(m.primary)}] = ${formatJsObject(opts)};`;
  }
  if (m.custom === 'ariaLabel') {
    return buildAriaLabelCode(m.primary, sel.middleText || (m.config && m.config.middleText) || '', sel.headingSelector || (m.config && m.config.headingSelector) || '');
  }
  if (m.type && m.primary && m.config) {
    // The site wrote a role here and it was decided, explicitly, to replace it.
    // U1 will not write over an author's role, so the attribute has to come off
    // first or the fix lands on a component that still says it is something
    // else. Only ever emitted for a mapping that carries the answer.
    const strip = m.overwriteRole
      ? `/* The site's own role="${m.overwriteRole}" is replaced by this fix. */\n` +
        `document.querySelectorAll(${JSON.stringify(m.primary)}).forEach(function (el) {\n` +
        `  if (el.getAttribute('role') === ${JSON.stringify(m.overwriteRole)}) el.removeAttribute('role');\n` +
        `});\n`
      : '';
    return strip + `window.u1?.fix.${m.type}(${JSON.stringify(m.firstArg || m.primary)}, ${formatJsObject(m.config)});`;
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

/**
 * What survives a pull: the server's rows, plus the local ones it has never
 * seen.
 *
 * The server is the truth about a row it has SEEN. It knows nothing at all
 * about a row whose push failed, and replacing the local copy wholesale treats
 * those two states as one thing. That is what deleted sixteen mappings: every
 * push had been rejected with 413, so the server held eight of twenty four, and
 * the next pull made eight the answer.
 *
 * `everPushed` is the discriminator. A row a colleague deleted was acknowledged
 * once, so it is in that set, so it is NOT kept — the tombstone still wins,
 * which is the behaviour the wholesale replace existed to protect.
 *
 * Pure on purpose: this is the one decision in the sync that can destroy work,
 * and it should be answerable without a server, a browser or a login.
 */
function reconcilePulled(serverRows, localRows, everPushed) {
  const server = Array.isArray(serverRows) ? serverRows : [];
  const local = Array.isArray(localRows) ? localRows : [];
  const seen = new Set(everPushed || []);
  const onServer = new Set(server.map((m) => mappingKey(m)));
  const stranded = local.filter((m) => {
    if (!m || typeof m !== 'object') return false;
    const k = mappingKey(m);
    return !onServer.has(k) && !seen.has(k);
  });
  return { merged: stranded.length ? server.concat(stranded) : server, stranded };
}

/**
 * Does this component type need the model at all?
 *
 * Only when something beyond the primary selector has to be worked out: a
 * second required selector, or a sub-selector the schema does not fill from
 * PRIMARY. A link, a heading and a loading bar have neither — their whole
 * mapping is the selector you already pointed at.
 *
 * A button's single field is `focusTo`, and it is optional; asking a model for
 * an optional scroll-to target is a call, a wait and a charge for something
 * nobody requested.
 */
function needsModelToMap(type) {
  const sc = COMPONENT_SCHEMAS[type];
  if (!sc) return true;
  if ((sc.req || []).length > 1) return true;
  const fields = sc.fields || [];
  if (!fields.length) return false;                 // nothing beyond the primary

  // Everything else asks, including the types whose fields the schema happens
  // to mark "(Optional)". A dialog's closeBtn and a tooltip's trigger are
  // optional to U1 and not optional to the person using it — a dialog you
  // cannot close and a tooltip nothing opens are half-mappings, and skipping
  // the call to save fifteen seconds would be buying speed with quality.
  //
  // ONE exception, named rather than derived: a button's single field is
  // focusTo, "good for scroll-to behavior", which is a nicety nobody has asked
  // for. Buttons are also the commonest thing on a page — four of the
  // twenty-four here — so this is the difference between a scan that flows and
  // one that stops on every ordinary control.
  return type !== 'button';
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

// ─────────────────────────────────────────────────────────────────────────────
//  Sync — the site's work lives on the server
//
//  Registered once, here, because this is the file that knows what a mapping's
//  key is. Everything below happens on the way OUT of a local write, so no save
//  path has to remember to call it.
//
//  Mappings are the only thing tracked per row. Config, skip links and library
//  URLs are whole-object settings — a config is not a list of independently
//  editable things, so a merge on it would be inventing a conflict model the
//  data does not have.
// ─────────────────────────────────────────────────────────────────────────────

/** Mappings the SERVER has, as last read, so a delete can be told from a never-saved. */
let serverMappingKeys = new Set();

/**
 * Which mapping keys the server has ever acknowledged, for this site.
 *
 * This is the difference between "a colleague deleted it" and "it never got
 * there", and without it the two are indistinguishable — which is how twenty
 * four mappings became eight.
 *
 * pullSiteFromServer REPLACES the local copy with the server's, deliberately:
 * merging would resurrect on this machine whatever somebody else deleted on
 * theirs. That is right for a row the server has seen. It is destruction for a
 * row whose push failed — and every push was failing, with 413, because the
 * batch budget was four times the server's body limit. So the local twenty four
 * were replaced by the eight that happened to fit.
 *
 * Private (`__`): it is a fact about this machine's sync state, not about the
 * client's site, and it must never travel in an export.
 */
const pushedKeysStoreKey = (host) =>
  (U1Store.PRIVATE_PREFIX || '__') + 'pushed_' + (host || currentHostname);

async function loadPushedKeys(host) {
  const k = pushedKeysStoreKey(host);
  try { return new Set((await U1Store.get([k]))[k] || []); } catch { return new Set(); }
}

async function rememberPushedKeys(host, keys) {
  if (!keys || !keys.length) return;
  const k = pushedKeysStoreKey(host);
  const have = await loadPushedKeys(host);
  for (const key of keys) have.add(key);
  // setLocalOnly: this is bookkeeping about the sync, and pushing it would be
  // both meaningless to the server and an infinite regress.
  try { await U1Store.setLocalOnly({ [k]: [...have] }); } catch {}
}

U1Store.onSiteWrite = async (keys, items) => {
  // Not signed in, or on a site nobody is assigned to: the panel still works
  // locally and this is simply not its business.
  if (!(await U1Auth.isLoggedIn())) return;

  for (const key of keys) {
    const parsed = U1Store.parseKey(key);
    if (!parsed || parsed.hostname !== currentHostname) continue;
    const value = items[key];

    if (parsed.prefix === 'mappings') {
      const list = Array.isArray(value) ? value : [];
      const rows = list
        .filter((m) => m && typeof m === 'object')
        .map((m) => ({ key: mappingKey(m), payload: m }));
      // Anything the server holds that is no longer in the list was deleted
      // here. Sent as a tombstone, because a row that merely stops being
      // mentioned is indistinguishable from a machine that has not synced.
      const live = new Set(rows.map((r) => r.key));
      for (const gone of serverMappingKeys) {
        if (!live.has(gone)) rows.push({ key: gone, payload: {}, deleted: true });
      }
      const out = await U1Sync.pushMappings(currentHostname, rows);
      serverMappingKeys = live;
      // Only what the server actually confirmed. A batch that 413'd contributes
      // nothing here, which is exactly what makes those rows survive the next
      // pull instead of being replaced by a server copy that never got them.
      await rememberPushedKeys(currentHostname, out.keys || []);
      if (out.conflicts && out.conflicts.length) reportConflicts(out.conflicts);
      continue;
    }

    if (parsed.prefix === 'config')    await U1Sync.pushSettings(currentHostname, { config: value });
    if (parsed.prefix === 'skipLinks') await U1Sync.pushSettings(currentHostname, { skipLinks: value || [] });
    if (parsed.prefix === 'u1Links')   await U1Sync.pushSettings(currentHostname, { u1Links: value });
    // A rejection is a judgement about THIS SITE, not about the person who made
    // it: if a component was not worth mapping here, it is not worth mapping
    // here for a colleague either. Per-machine, three people on one large site
    // each waded through the same forty rejected items.
    if (parsed.prefix === 'dismissed') await U1Sync.pushSettings(currentHostname, { dismissed: value || [] });
  }
};

/**
 * A colleague changed the same component while this panel held an older copy.
 *
 * Reported, never resolved. Picking a winner silently is the one behaviour that
 * makes shared work untrustworthy — whichever side is discarded, somebody's
 * afternoon vanished and nobody was told.
 */
function reportConflicts(conflicts) {
  const status = document.getElementById('mappingsStatus') ||
                 document.getElementById('applyAllStatus');
  const names = conflicts.map((c) => c.key.split('::')[1] || c.key);
  const by = conflicts.find((c) => c.updatedBy);
  showNotice(status,
    `Not saved: ${names.join(', ')} — ${by && by.updatedBy ? by.updatedBy : 'someone else'} ` +
    `changed ${conflicts.length === 1 ? 'it' : 'them'} while you had ${conflicts.length === 1 ? 'it' : 'them'} open. ` +
    `Reload the panel to see their version, then re-apply your change on top.`,
    'error', 20000);
}

/**
 * Everything this site holds on the server, into the panel.
 *
 * The server is the truth, so this REPLACES what is cached locally rather than
 * merging into it. Merging here would quietly resurrect on this machine
 * whatever a colleague deleted on theirs.
 */
async function pullSiteFromServer() {
  if (!(await U1Auth.isLoggedIn())) return { ok: false, reason: 'not_logged_in' };
  let data;
  try {
    data = await U1Sync.pull(currentHostname);
  } catch (err) {
    if (err.offline) return { ok: false, reason: 'offline' };
    if (err.status === 403) return { ok: false, reason: 'not_assigned' };
    return { ok: false, reason: 'error', message: err.message };
  }

  // ── First contact: the server has never held this site ────────────────────
  //
  // Every mapping ever made lived on one machine until now, so on the day this
  // ships EVERY site is in this state — and the naive read replaces the local
  // copy with the server's, which is empty. Forty mappings, overwritten with
  // nothing, silently, on the first panel open.
  //
  // So when the server has never seen this site, the work goes UP instead of
  // being replaced by nothing. `virgin` is deliberately narrow: a site a
  // colleague deliberately emptied leaves tombstones and settings behind, and
  // that is a real state that must still pull down as empty.
  if (data.virgin) {
    const local = (await U1Store.get([storageKey('mappings', currentHostname)]))
      [storageKey('mappings', currentHostname)] || [];
    const mine = local.filter((m) => m && typeof m === 'object');
    if (mine.length) {
      serverMappingKeys = new Set();
      try {
        await U1Sync.pushMappings(currentHostname,
          mine.map((m) => ({ key: mappingKey(m), payload: m })));
        serverMappingKeys = new Set(mine.map((m) => mappingKey(m)));
        await rememberPushedKeys(currentHostname, [...serverMappingKeys]);
        // The sweep and the settings this machine holds go with them, or the
        // next open would find the server "not virgin" and pull them away.
        await pushLocalSettings();
        const cached = (await U1Store.get([sweepStoreKey()]))[sweepStoreKey()];
        if (cached && cached.stops && cached.stops.length) {
          await U1Sync.pushSweep(currentHostname, {
            url: cached.url, phase: cached.phase, cost: cached.cost, stops: cached.stops,
          });
        }
        return { ok: true, mappings: mine.length, sweep: !!(cached && cached.stops), adopted: mine.length };
      } catch (err) {
        // Nothing was overwritten — the local copy is untouched and still the
        // only copy. Say so, rather than leaving a half-migrated site behind.
        return { ok: false, reason: 'adopt_failed', message: err.message };
      }
    }
  }

  serverMappingKeys = new Set(data.mappings.map((m) => mappingKey(m)));

  // ── Keep what never reached the server ───────────────────────────────────
  //
  // The server is the truth about rows it has SEEN. It knows nothing about a
  // row whose push failed, and replacing the local copy wholesale treats those
  // two states as one — which is how twenty four mappings became eight after
  // every push had been rejected with 413.
  //
  // A row is kept only when the server has never acknowledged it. One a
  // colleague deleted WAS acknowledged once, so it is absent from the pushed
  // set's complement and still disappears — the tombstone semantics `virgin`
  // was protecting are untouched.
  const localNow = (await U1Store.get([storageKey('mappings', currentHostname)]))
    [storageKey('mappings', currentHostname)] || [];
  const everPushed = await loadPushedKeys(currentHostname);
  const { merged, stranded } = reconcilePulled(data.mappings, localNow, everPushed);

  // setLocalOnly, not set: going through set() would fire onSiteWrite and push
  // what we just pulled straight back at the server, stamping this machine's
  // name on a colleague's work and racing anything they saved in between.
  const writes = { [storageKey('mappings', currentHostname)]: merged };
  if (data.settings) {
    if (data.settings.config)    writes[storageKey('config', currentHostname)] = data.settings.config;
    if (data.settings.skipLinks) writes[storageKey('skipLinks', currentHostname)] = data.settings.skipLinks;
    if (data.settings.u1Links)   writes[storageKey('u1Links', currentHostname)] = data.settings.u1Links;
    if (data.settings.dismissed) writes[storageKey('dismissed', currentHostname)] = data.settings.dismissed;
  }
  await U1Store.setLocalOnly(writes);

  if (data.sweep) await adoptServerSweep(data.sweep);

  // And try again for the stranded ones, now, rather than leaving them to the
  // next time something happens to save. They are the whole reason this branch
  // exists; a copy kept and never sent is only half a rescue.
  if (stranded.length) {
    try {
      const out = await U1Sync.pushMappings(currentHostname,
        merged.map((m) => ({ key: mappingKey(m), payload: m })));
      await rememberPushedKeys(currentHostname, out.keys || []);
      serverMappingKeys = new Set(merged.map((m) => mappingKey(m)));
    } catch (err) {
      // Still only here. Said out loud, because "kept locally" reads as fine
      // and it is not: this machine is the only copy.
      showNotice(document.getElementById('mappingsStatus'),
        `${stranded.length} mapping${stranded.length === 1 ? '' : 's'} on this computer ` +
        `never reached the server and still have not (${err.message}). They are safe here ` +
        `and they export, but nobody else can see them.`, 'warn', 16000);
    }
  }

  return { ok: true, mappings: merged.length, sweep: !!data.sweep, stranded: stranded.length };
}

/**
 * Push everything an import brought in, site by site.
 *
 * Sites this worker is not assigned to are reported by name rather than
 * skipped quietly: that work exists, it is on this machine, and nobody else
 * will ever see it — which is worth saying out loud at the moment it happens
 * instead of being discovered weeks later.
 */
async function pushImportedSites(data, statusEl) {
  const out = { sent: 0, blocked: [] };
  if (!(await U1Auth.isLoggedIn())) return out;

  const hosts = new Set();
  for (const key of Object.keys(data)) {
    const parsed = U1Store.parseKey(key);
    if (parsed) hosts.add(parsed.hostname);
  }

  for (const host of hosts) {
    const keys = U1Store.SITE_PREFIXES.map((p) => storageKey(p, host));
    const got = await U1Store.get(keys);
    const list = (got[storageKey('mappings', host)] || []).filter((m) => m && typeof m === 'object');

    try {
      if (list.length) {
        // No baseUpdatedAt for another site — this panel has never read it, so
        // the server treats each row as a first write. That is the right call
        // here: one worker per site is how these are assigned, so there is no
        // colleague's version to be racing.
        U1Sync.forget();
        await U1Sync.pushMappings(host, list.map((m) => ({ key: mappingKey(m), payload: m })));
      }
      const fields = {};
      for (const name of ['config', 'skipLinks', 'u1Links', 'dismissed']) {
        const v = got[storageKey(name, host)];
        if (v) fields[name] = v;
      }
      if (Object.keys(fields).length) await U1Sync.pushSettings(host, fields);
      out.sent++;
    } catch (err) {
      if (err.status === 403) out.blocked.push(host);
      else if (statusEl) {
        showNotice(statusEl, `Could not upload ${host}: ${err.message}`, 'error', 10000);
      }
    }
  }
  // The loop above left this panel's version tracking pointing at whichever
  // site it visited last. Re-read the site actually in front of us, so the next
  // save is checked against the right rows rather than being treated as a first
  // write for all of them.
  U1Sync.forget();
  await pullSiteFromServer();
  return out;
}

/** This machine's config, skip links and library URLs, on their way up. */
async function pushLocalSettings() {
  const names = ['config', 'skipLinks', 'u1Links', 'dismissed'];
  const keys = names.map((p) => storageKey(p, currentHostname));
  const got = await U1Store.get(keys);
  const fields = {};
  names.forEach((name, i) => { if (got[keys[i]]) fields[name] = got[keys[i]]; });
  if (Object.keys(fields).length) await U1Sync.pushSettings(currentHostname, fields);
}

/**
 * Say where the work on screen came from.
 *
 * Silence here is the failure mode that matters: a panel showing a local cache
 * because the server was unreachable looks exactly like a panel showing live
 * shared work, and the difference is whether a colleague will ever see what you
 * do next.
 */
function reportSyncState(pulled) {
  const status = document.getElementById('mappingsStatus') ||
                 document.getElementById('applyAllStatus');
  if (pulled && pulled.ok && pulled.adopted) {
    showNotice(status,
      `${pulled.adopted} mapping${pulled.adopted === 1 ? '' : 's'} from this machine ` +
      `${pulled.adopted === 1 ? 'was' : 'were'} the only copy — ${pulled.adopted === 1 ? 'it has' : 'they have'} ` +
      `now been uploaded to the U1 server, so your colleagues will see ${pulled.adopted === 1 ? 'it' : 'them'} too.`,
      'success', 15000);
    return;
  }
  if (!pulled || pulled.ok) return;
  if (pulled.reason === 'adopt_failed') {
    showNotice(status,
      'Your work on this site is still only on this machine — uploading it failed: ' +
      (pulled.message || 'unknown error') + '. Nothing was changed or lost. Try reopening the panel.',
      'error', 20000);
    return;
  }
  if (pulled.reason === 'not_logged_in') return;   // the sign-in gate says this already
  if (pulled.reason === 'not_assigned') return;    // the licence gate says this already
  if (pulled.reason === 'offline') {
    showNotice(status,
      'No connection to the U1 server — this is your machine\'s own copy, and anything ' +
      'you change now will not reach your colleagues. Reconnect and reopen the panel.',
      'error', 20000);
    return;
  }
  showNotice(status, 'Could not load this site\'s shared work: ' + (pulled.message || 'unknown error'),
    'error', 15000);
}

/**
 * A colleague's survey, into this panel.
 *
 * The pictures are fetched one at a time and only for sections that have one,
 * because opening the panel on a large site must not pull a megabyte of images
 * nobody has asked to look at. They arrive after the list is already on screen.
 */
async function adoptServerSweep(sweep) {
  aiSweep = {
    running: false, abort: false,
    phase: sweep.phase === 'components' ? 'components' : 'screens',
    stops: sweep.stops || [], tabId: null, url: sweep.url || '',
  };
  aiCost = sweep.cost || 0;
  aiWorkspaceHost = currentHostname;
  if (aiSweep.phase === 'components') renderSweepPicks(); else renderSweepScreens();

  const have = new Set((sweep.screenshots || []).map((s) => s.n));
  for (const stop of aiSweep.stops) {
    if (stop.thumb || !have.has(stop.n)) continue;
    const url = await U1Sync.fetchThumb(currentHostname, stop.n);
    if (!url) continue;
    stop.thumb = url;
    // Re-rendered per picture rather than at the end: on a slow connection a
    // list that fills in is a list you can start reading.
    if (aiSweep.phase === 'components') renderSweepPicks(); else renderSweepScreens();
  }
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

// Whether an Anthropic key is saved, which is what the two paid Picker modes
// are gated on. It lives up HERE, with the other module state, because boot
// calls refreshAiLocks() a couple of hundred lines below this and the function
// that writes it is two thousand lines further down.
//
// It was declared next to that function, which reads better and does not work:
// `let` is hoisted but not initialised, so the boot-time write hit the temporal
// dead zone and threw a ReferenceError — and the `catch` meant to absorb it
// assigns the same binding, so it threw a second time, out of the catch. Boot
// stopped there. Reported as: clicking the AI tabs sends me to Setup, from a
// panel whose tabs were not even drawn as locked, because the code that draws
// them that way is the code that died.
let aiUnlocked = false;

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

// Repair menu mappings already saved with the combination that cannot work.
//
// menubar:true together with submenus makes U1 throw "Submenu must have a
// trigger element" and abort tagging — the mapping reports as applied and adds
// nothing. Changing the schema default only helps mappings made after it;
// anything already in storage keeps the setting that broke it, which is exactly
// the mapping someone has been staring at. There is no configuration in which
// this pair does something useful, so repair it and say so.
// Are any saved mappings still waiting for their content to be rendered?
// True while a mapping's container is present but its own field selectors match
// nothing — the shape of a component the page builds client-side.
async function mappingContentPending() {
  try {
    const key = storageKey('mappings', currentHostname);
    const list = (await U1Store.get([key]))[key] || [];
    const probes = [];
    for (const m of list) {
      if (!m || m.custom || !m.config || !m.config.selectors) continue;
      const root = m.firstArg || m.primary;
      for (const [k, v] of Object.entries(m.config.selectors)) {
        if (typeof v === 'string' && v.trim() && v !== root) probes.push([root, v]);
      }
    }
    if (!probes.length) return false;
    const tab = await getTab();
    if (!isInjectable(tab)) return false;
    return await inPage(tab.id, (pairs) => pairs.some(([root, field]) => {
      try {
        return !!document.querySelector(root) && document.querySelectorAll(field).length === 0;
      } catch { return false; }
    }), [probes]);
  } catch { return false; }
}

async function migrateFatalMenubar(host) {
  const key = storageKey('mappings', host);
  const list = (await U1Store.get([key]))[key];
  if (!Array.isArray(list) || !list.length) return 0;

  let fixed = 0;
  for (const m of list) {
    if (!m || m.type !== 'menu' || !m.config || m.config.menubar !== true) continue;
    if (!(m.config.selectors && m.config.selectors.submenus)) continue;
    m.config.menubar = false;
    const rebuilt = buildTemplate('menu', m.primary, m.config.selectors, m.config);
    if (rebuilt) { m.code = rebuilt.code; m.firstArg = rebuilt.firstArg; m.config = rebuilt.config; }
    fixed++;
  }
  if (fixed) await U1Store.set({ [key]: list });
  return fixed;
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
  try {
    const repaired = await migrateFatalMenubar(currentHostname);
    if (repaired) {
      showNotice(document.getElementById('applyAllStatus'),
        `Repaired ${repaired} menu mapping${repaired === 1 ? '' : 's'} that had menubar ON together with submenus — U1 throws on that pair and adds nothing. menubar is now off. Reload the page and press Apply All.`,
        'success', 12000);
    }
  } catch {}

  document.querySelectorAll('#mappingsHostname, #exportHostname, #closeOutHostname').forEach(el => {
    el.textContent = currentHostname;
  });

  await refreshSetupTab(tab);
  // Before the Picker is reachable: the two AI modes must not look enterable
  // for the moment between the panel drawing and the key being read.
  await refreshAiLocks();
  await loadConfigForm();
  await refreshConfigSkipList();
  updateConfigPreview();
  // The server first, and before anything is drawn: this site's work belongs to
  // the site, so what a colleague saved is what should be on screen — not this
  // machine's older copy of it.
  const pulled = await pullSiteFromServer();
  await loadMappingsList();
  await refreshExportInfo();
  reportSyncState(pulled);
  // Only if the server had nothing. A local survey is a cache of the shared one
  // and must never be shown on top of it.
  if (!pulled.ok || !pulled.sweep) await restoreSweep();

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
    //
    // It also holds while a mapping's own field selectors match nothing. The
    // container existing is not the same as the component existing: a nav that
    // ships empty and is filled by the page's JS on DOMContentLoaded would
    // otherwise be applied against nothing, and U1 does not revisit an element
    // it has already handled — so the one chance to get it right is missed.
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt < 5 && await mappingContentPending()) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
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
        // The old wording ended "…or ask your developer to embed the U1 links
        // directly in the page HTML", which does not work: CSP governs every
        // script load, whether the tag was injected or hand-written into the
        // page. A developer following that advice loses a day and comes back
        // still blocked. Both options below are ones that actually pass CSP.
        notice.textContent =
          'This page\'s Content-Security-Policy blocks scripts from other domains, so U1 cannot load. ' +
          'Writing the <script> tag into the page HTML will NOT help — CSP applies either way. ' +
          'Two things do work: host the U1 files on the site\'s own domain, which its existing ' +
          'script-src \'self\' already allows and needs no CSP change; or have the site add the U1 ' +
          'domain to script-src and style-src.';
        notice.style.display = 'block';
      }
      // Offer the workaround only now — there is no reason to advertise turning
      // a site's protection off until that protection has actually got in the way.
      const row = document.getElementById('cspBypassRow');
      if (row) {
        row.style.display = 'block';
        const t = document.getElementById('cspBypassToggle');
        if (t) t.checked = await cspBypassActive(currentHostname);
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
    // "No skip links configured" was true and useless. Setup was listing three
    // of them, read off the live page, at the same moment — so the panel said
    // both "here are your skip links" and "you have none", on two tabs, with
    // neither line mentioning the other.
    //
    // They are different things, and the difference is the whole answer: those
    // are in the SITE'S OWN markup and this panel does not manage them, while
    // the configured list is what U1 will render. That was the one thing not
    // said anywhere.
    ul.innerHTML = detectedSkipLinks.length
      ? '<div class="empty-state">' +
          `The page already has ${detectedSkipLinks.length} skip link` +
          `${detectedSkipLinks.length === 1 ? '' : 's'} of its own, written into the ` +
          'site\'s markup. U1 is not rendering <em>those</em> — nothing is configured ' +
          'here, so U1 adds none of its own.' +
        '</div>' +
        '<ul class="detected-list">' + detectedSkipLinks.map((s) => `
          <li>
            <span class="bullet">•</span>
            <span>"${escapeHtml(s.label || '')}"</span>
            <span class="arrow">→</span>
            <span class="target">${escapeHtml(s.selector || s.target || '')}</span>
            <span class="skip-detected-flag">the page's own</span>
          </li>`).join('') + '</ul>' +
        '<div class="empty-state">Add them in Setup to have U1 render them too, or ' +
        'leave them to the site.</div>'
      : '<div class="empty-state">No skip links configured. Set them in Setup.</div>';
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
// ─────────────────────────────────────────────────────────────────────────────
//  FIELD_HOW — how to RECOGNISE the element each field wants.
//
//  `desc` above says what a field IS, in U1's own words from their docs. That
//  is a different question from "which element on this page is it", and the gap
//  between the two is where mappings go wrong: "Selector of the options
//  container" is accurate and still lets you pick the wrapper, the button, or
//  the list, all three of which look like containers of options.
//
//  Measured, not supposed: one listbox was mapped wrongly three times in a row,
//  in three different arrangements, each time with every field resolving and
//  nothing objecting. Stating the mechanical test — "the element whose OWN
//  children are the options" — settled it in one.
//
//  So every line here is a test against the markup, not a description of a
//  role: "its own children", "NOT inside", "exactly one", "the one a person
//  activates". If a line cannot be checked by looking at the DOM, it is not
//  pulling its weight.
//
//  Kept beside the schemas rather than inside them so the two voices stay
//  distinguishable — theirs and ours — and verify.mjs asserts that every
//  selector key of every type has a line here, so type 20 cannot arrive without
//  one.
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_HOW = {
  button: {
    element: 'The element a person clicks. If a <div> wraps a <button>, it is the <button> — the one carrying the click handler, not the box round it.',
    focusTo: 'Where focus should land after the click. Usually the region the button scrolled to or revealed.',
  },
  link: {
    element: 'The <a> itself, not its wrapper. If it has no href it is a button, not a link.',
  },
  menu: {
    menu: 'The element whose OWN CHILDREN are the menu items — the <ul>, not the <nav> around it. A wrapper that also holds a logo or a search box is one level too high: U1 walks the root\'s children looking for items and finds furniture.',
    items: 'Everything the arrow keys move between, top level AND inside drop-downs. The element a person activates: if a row is <li><a>, it is the <a>. One class rarely covers both levels — use a comma group.',
    submenus: 'The drop-down PANELS themselves, not the links inside them. Filling this requires menubar: false.',
    triggers: 'Only the items that OPEN a drop-down — a subset of items. If nothing opens anything, leave it empty.',
    horizontalMenu: 'The same element as the menu when the bar runs left-to-right. It only changes which arrow keys move between items.',
    openByMouseover: 'Items whose drop-down opens on mouseover rather than click. Check the site\'s own handlers before filling this.',
    openByMouseenter: 'The same, for mouseenter.',
    openByFocus: 'Items whose drop-down opens on focus — common in keyboard-friendly navs.',
  },
  accordion: {
    headerSelector: 'The element a person clicks to expand — the clickable header itself, not the section wrapping header and panel together.',
    contentSelector: 'The panel that expands. It must be OUTSIDE the header, not inside it: a panel inside its own trigger collapses the trigger with it.',
    disabledElementsSelector: 'Headers that cannot be opened, if any.',
  },
  carousel: {
    carouselContainer: 'The element holding all the slides. Not the section with the heading and the buttons around it.',
    slide: 'One slide. All of them — the selector should match every slide, including those off-screen. This is also fix.carousel()\'s FIRST argument.',
    prevButton: 'The control that moves back. Exactly one element.',
    nextButton: 'The control that moves forward. Exactly one element.',
    slidePickerButtons: 'The dots or numbers that jump straight to a slide.',
    absoluteCarouselContainerLabel: 'A heading or label describing the carousel, anywhere on the page — this one is not resolved inside the container.',
    activeSlides: 'When several slides are visible at once, the ones currently in view. Leave empty for one-at-a-time carousels.',
  },
  datepicker: {
    container: 'The whole picker panel — days, month and year controls together. Open it on the page before pointing at it; a closed picker often is not in the DOM at all.',
    trigger: 'The field or button that opens the picker, and it is OUTSIDE the picker. This is fix.datepicker()\'s FIRST argument, because U1 waits for it.',
    'year.label': 'The element showing the current year as text.',
    'year.prevButton': 'The control that goes back a year. Exactly one.',
    'year.nextButton': 'The control that goes forward a year. Exactly one.',
    'month.label': 'The element showing the current month as text.',
    'month.prevButton': 'The control that goes back a month. Exactly one.',
    'month.nextButton': 'The control that goes forward a month. Exactly one.',
    'days.table': 'The grid of days ALONE — not the panel that also holds the month and year controls.',
    'days.day': 'Every day cell, including the greyed ones. The element a person clicks.',
    'days.selected': 'The day currently chosen — usually a state class the site toggles.',
    'days.disabled': 'Days that cannot be chosen, including the leading and trailing days of adjacent months.',
  },
  dialog: {
    dialog: 'The modal BOX — the panel with the content. Not the full-screen backdrop behind it, which is a sibling or a parent.',
    trigger: 'What opens it, and it is outside the dialog. Given, it becomes fix.dialog()\'s first argument so U1 waits for it.',
    closeBtn: 'The ✕ or Cancel. Exactly one element inside the dialog.',
    heading: 'The dialog\'s title element — this becomes its accessible name, so pick the text a person would read out.',
    textContent: 'The body text, when the dialog has no heading to name it by.',
    focusTo: 'Where focus goes when the dialog closes. Usually back to the trigger.',
  },
  listbox: {
    listbox: 'The element whose OWN CHILDREN are the options — two or more of them. Not the wrapper that also holds the button, and not the button. Whether it is a <ul> or a <div> is irrelevant: holding the items is what makes it the list.',
    trigger: 'The clickable element that opens it, and it is NOT inside the list. A <button> if there is one. This is also fix.listbox()\'s FIRST argument — U1 waits for the trigger, so the generated call reads fix.listbox("<trigger>", …), which looks wrong and is right.',
    options: 'The items inside the list, and specifically the element a person ACTIVATES. If every row is <li><a>, the option is the <a> — role="option" on a wrapper holding a link puts the focus on one element and the action on another.',
    label: 'A visible label naming the list, if one exists. Leave empty otherwise.',
  },
  combobox: {
    combobox: 'The wrapper holding the input and the popup together. If there is no wrapper, the input itself.',
    listbox: 'The suggestions list — the element whose own children are the options.',
    textbox: 'The <input> a person types into. Exactly one.',
    options: 'The individual suggestions inside the list, and the element a person activates.',
    label: 'The <label> or visible text naming the field.',
  },
  checkbox: {
    element: 'The element carrying the click handler — often a styled <div> or <span>, not a hidden native <input>. Point at what a person actually clicks.',
    checkedState: 'How the page SHOWS it is checked: the class or attribute the site toggles. Tick it on the page and see what changes.',
    uncheckedState: 'The same for unchecked. Without it U1 writes no aria-checked at all, and a screen reader never announces the state.',
    disabled: 'How the page shows it cannot be changed.',
    exclude: 'Elements matched by the selector above that are NOT checkboxes.',
    label: 'The text naming this checkbox.',
  },
  radio: {
    radioGroup: 'The container holding all the buttons of ONE question. Not the form, and not a single option.',
    radioButton: 'Every option in the group — the element a person clicks.',
    checkedState: 'How the page shows which option is chosen: the class or attribute it toggles.',
    uncheckedState: 'The same for the unchosen ones.',
    exclude: 'Anything the selector above catches that is not a radio option.',
  },
  tabs: {
    tabList: 'The strip holding the tabs ALONE. If it also wraps the panels, it is the wrong element — U1 makes it the tablist, and the panels end up inside their own tablist.',
    tab: 'The clickable tabs themselves, searched inside the strip, so several strips on one page do not mix.',
    tabPanel: 'The content panels, and they sit OUTSIDE the tab list. Pointing both fields at the same element hides the tabs along with the content they control.',
  },
  'keyboard-tabs': {
    tabList: 'The strip holding the tabs ALONE — not a wrapper that also contains the panels.',
    tab: 'The clickable tabs, found inside the strip.',
    tabPanel: 'The content panels, OUTSIDE the strip. If the site renders only the visible panel, every tab points at that one.',
  },
  form: {
    form: 'The <form>, or the element wrapping every field and the submit button together.',
    submitButton: 'The control that submits. Exactly one.',
    inputField: 'Every field a person fills — inputs, selects and textareas together.',
    invalidField: 'How the page MARKS a field as wrong: the class or attribute it adds. Submit the form empty and see what appears.',
    requiredField: 'How the page marks a field as required.',
    errorMsg: 'The element holding the message for a bad field.',
    successMsg: 'The confirmation shown after a good submit.',
    formLabelAbsolute: 'A heading naming the whole form, resolved from the page rather than from inside it.',
  },
  table: {
    table: 'The <table>, or the element wrapping every row and cell.',
    row: 'Every row, header rows included.',
    cell: 'Every data cell. Not the headers — those have their own fields.',
    columnheader: 'The cells across the top that name each column.',
    rowheader: 'The cells down the side that name each row, if the table has them.',
  },
  grid: {
    grid: 'The container of every row and cell. Use grid rather than table when a person arrows BETWEEN cells rather than reading down them.',
    row: 'Every row.',
    cell: 'Every cell that takes focus.',
    columnheader: 'The cells naming each column.',
    rowheader: 'The cells naming each row.',
  },
  pagination: {
    container: 'The element holding the page controls.',
    pageButtons: 'The numbered page controls. This is fix.pagination()\'s FIRST argument.',
    prevBtn: 'The control that goes back one page. Exactly one.',
    nextBtn: 'The control that goes forward one page. Exactly one.',
    prevSkip: 'A jump-back control — « or "First" — if the site has one.',
    nextSkip: 'A jump-forward control — » or "Last".',
    results: 'The element announcing how many results there are, so a change of page is announced.',
  },
  loading: {
    loadingBar: 'The bar or spinner itself, not the region it covers.',
  },
  tooltip: {
    tooltip: 'The bubble that appears. Hover or focus the trigger first — a tooltip is often not in the DOM until then.',
    trigger: 'What a person hovers or focuses to show it, and it is outside the bubble.',
  },
  heading: {
    heading: 'The element that reads as a heading on screen but is not one in the markup — a styled <div> or <span>. A real <h2> needs no mapping.',
  },
  'aria-label': {
    target: 'The element that needs a name a screen reader can read. Usually one with an icon and no text.',
  },
  'keyboard-clickable': {
    target: 'An element with a click handler that the keyboard cannot reach — a <div> or <span> acting as a control. A real <button> already works.',
  },
  'keyboard-grid': {
    container: 'The panel holding the whole grid of cells.',
    trigger: 'What opens it, outside the panel. Leave empty if the grid is always on the page.',
    day: 'Every cell that takes focus, in reading order.',
    activate: 'The element inside a cell that carries the click, when the cell itself does not.',
    selected: 'How the page shows the chosen cell.',
    disabled: 'How it shows a cell that cannot be chosen.',
    monthLabel: 'The element showing the current month.',
    monthPrev: 'The control that goes back a month.',
    monthNext: 'The control that goes forward a month.',
    yearLabel: 'The element showing the current year.',
    yearPrev: 'The control that goes back a year.',
    yearNext: 'The control that goes forward a year.',
    controls: 'Any other controls in the panel that should be in the keyboard order.',
  },
};

const TYPE_GUIDE = {
  button:     { what:'A control that performs an action on the page.', keys:'Tab to reach · Enter or Space to activate.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'button' },
  link:       { what:'A control that navigates somewhere else.', keys:'Tab to reach · Enter to follow.', wcag:[['4.1.2','Name, Role, Value'],['2.4.4','Link Purpose in Context']], apg:'link' },
  menu:       { what:'A navigation / actions menu, usually with drop-down submenus.', keys:'Tab to the trigger · Enter or Arrow to open · Arrows between items · Esc closes.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'menubar',
    variants:[
      ['Site navigation (links) — menubar: false', 'Default. Items stay links; only the triggers become buttons. role="menuitem" is NOT expected.'],
      ['Application menubar (commands) — menubar: true', 'Every item becomes role="menuitem". Do not combine with nested submenus — U1 throws “Submenu must have a trigger element”.'],
    ] },
  accordion:  { what:'Headers that expand and collapse panels of content.', keys:'Tab between headers · Enter or Space toggles.', wcag:[['4.1.2','Name, Role, Value'],['1.3.1','Info and Relationships']], apg:'accordion',
    variants:[
      ['Each panel opens in place, under its own header', 'This. Several can be open at once.'],
      ['One panel area, and the controls swap what is in it', 'That is tabs.'],
    ] },
  carousel:   { what:'A rotating set of slides with previous/next controls.', keys:'Tab to the controls · Enter activates · a pause control is required if it auto-plays.', wcag:[['4.1.2','Name, Role, Value'],['2.2.2','Pause, Stop, Hide']], apg:'carousel' },
  datepicker: { what:'A calendar popup for choosing a date.', keys:'Enter on the trigger opens · Arrows move between days · Enter picks · Esc closes.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'dialog-modal' },
  dialog:     { what:'A modal window that takes over the page until dismissed.', keys:'Focus moves in on open · Tab is trapped inside · Esc closes · focus returns to the trigger.', wcag:[['4.1.2','Name, Role, Value'],['2.4.3','Focus Order'],['2.1.2','No Keyboard Trap']], apg:'dialog-modal' },
  listbox:    { what:'A list the user picks one option from.', keys:'Tab to the list · Arrows move the option · Enter selects · Esc closes.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'listbox',
    variants:[
      ['One button opens one list', 'This. The list is the container, the button is the trigger.'],
      ['A standing nav bar with no single trigger', 'That is a menu, not a listbox.'],
      ['The site already put role="menu" on the list', 'Believe it — map it as a menu. Writing role="listbox" over an author\'s role leaves the two disagreeing, and the list ends up decorated by neither.'],
      ['There is a text field that filters the list', 'That is a combobox.'],
    ] },
  combobox:   { what:'A text field with a popup list of suggestions.', keys:'Type to filter · Arrows into the list · Enter selects · Esc closes.', wcag:[['4.1.2','Name, Role, Value'],['4.1.3','Status Messages']], apg:'combobox',
    variants:[
      ['Typing filters the list', 'This.'],
      ['No typing — a button opens a fixed list', 'That is a listbox.'],
    ] },
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
  table:      { what:'A data table — ties each cell to its row/column header.', keys:'Read-only; screen readers announce the header for each cell.', wcag:[['1.3.1','Info and Relationships']], apg:'table',
    variants:[
      ['Cells are read, not operated', 'This. Tab passes over the table; the reader announces each cell with its headers.'],
      ['Cells take focus and arrows move between them', 'That is a grid.'],
    ] },
  grid:       { what:'An interactive table whose cells receive focus.', keys:'Arrows move between cells · Enter activates.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'grid',
    variants:[
      ['Arrows move cell to cell in two directions', 'This.'],
      ['Just rows of data to read', 'That is a table, and it is the lighter fix.'],
    ] },
  pagination: { what:'Numbered page controls for a result list.', keys:'Tab between page buttons · Enter activates · the current page is announced.', wcag:[['4.1.2','Name, Role, Value'],['2.4.4','Link Purpose in Context']], apg:'' },
  loading:    { what:'A loading indicator that must be announced, not silent.', keys:'No focus — announced via a live region.', wcag:[['4.1.3','Status Messages']], apg:'' },
  tooltip:    { what:'Extra text shown next to a control.', keys:'Must appear on FOCUS, not only on hover · Esc dismisses.', wcag:[['1.4.13','Content on Hover or Focus'],['4.1.2','Name, Role, Value']], apg:'tooltip' },
  heading:    { what:'Marks text as a heading so the page can be navigated by structure.', keys:'No focus — screen readers jump between headings.', wcag:[['1.3.1','Info and Relationships'],['2.4.6','Headings and Labels']], apg:'' },
  'aria-label': { what:'Gives a vague control a meaningful name (its text + context).', keys:'No behaviour change — only what is announced.', wcag:[['4.1.2','Name, Role, Value'],['2.4.4','Link Purpose in Context']], apg:'' },
  'keyboard-grid': { what:'Extension engine (no U1): makes a calendar/grid keyboard-operable.', keys:'Arrows between cells · Enter/Space chooses · visible focus ring.', wcag:[['2.1.1','Keyboard'],['4.1.2','Name, Role, Value'],['2.4.7','Focus Visible']], apg:'grid' },
  'keyboard-clickable': { what:'Extension engine (no U1): makes non-focusable elements real controls. Applies to EVERY match.', keys:'Tab to reach · Enter (and Space for buttons) activates.', wcag:[['2.1.1','Keyboard'],['4.1.2','Name, Role, Value']], apg:'button' },
  'keyboard-tabs': { what:'Extension engine (no U1): the same tab strip as "tabs", for a site that has not deployed U1 yet.', keys:'Tab to the active tab · Arrows switch tabs · Home/End jump to the ends · Tab moves into the panel.', wcag:[['4.1.2','Name, Role, Value'],['2.1.1','Keyboard']], apg:'tabs',
    variants:[
      ['The site already loads U1', 'Prefer "tabs" — it is the product doing the work.'],
      ['Demo, staging or prospect site with no U1', 'This one. Identical selectors, runs on any page.'],
      ['Only sets a value, no panel swap', 'That is a radio group → use "radio".'],
      ['Marked each tab with keyboard-clickable role=tab', 'Undo that. It announces "tab" but gives no arrows and no aria-selected — a broken promise, worse than plain buttons.'],
    ] },
};

// Renders the guide for the chosen type (or hides it when nothing is selected).
// Builds the explainer but does NOT show it. It is reference material — read
// once when you meet a type, then permanently in the way. It opens from the (i)
// beside the type picker instead, and the button hides itself for a type that
// has nothing to say.
function renderTypeGuide(type) {
  const box = document.getElementById('typeGuide');
  const btn = document.getElementById('typeGuideBtn');
  if (!box) return;
  const g = TYPE_GUIDE[type];
  closeTypeGuide();
  if (btn) btn.style.display = g ? '' : 'none';
  if (!g) { box.innerHTML = ''; return; }
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

function closeTypeGuide() {
  const box = document.getElementById('typeGuide');
  const btn = document.getElementById('typeGuideBtn');
  if (box) box.style.display = 'none';
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

document.getElementById('typeGuideBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  const box = document.getElementById('typeGuide');
  const btn = document.getElementById('typeGuideBtn');
  if (!box || !box.innerHTML) return;
  const open = box.style.display !== 'none';
  box.style.display = open ? 'none' : 'block';
  btn.setAttribute('aria-expanded', String(!open));
});

// Click-away and Escape. A panel this narrow cannot afford a popover that needs
// hunting for its own close button.
document.addEventListener('click', (e) => {
  if (e.target.closest('#typeGuide') || e.target.closest('#typeGuideBtn')) return;
  closeTypeGuide();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTypeGuide();
});

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
    const howPrimary = pKey ? (FIELD_HOW[type] || {})[pKey] : '';
    const body = ((helpInfo && helpInfo.help) || (pKey && desc[pKey]) || '') +
                 (howPrimary ? '\n' + howPrimary : '');
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
  const howFor = FIELD_HOW[type] || {};
  for (const f of schema.fields) {
    const isReq = req.includes(f);
    const hint = desc[f] || '';
    // Two different questions, so two lines: `desc` is what the field IS, in
    // U1's words; `how` is which element on this page it is, in ours. The
    // second is the one that was missing, and the one mappings go wrong for
    // want of.
    const how = howFor[f] || '';
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
      ${how ? `<div class="input-hint how-hint">${escapeHtml(how)}</div>` : ''}
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
        const isSelRoot = (schema.selectorRoots || []).includes(k);
        const choices = (schema.options && schema.options[k]) || null;
        // A selector needs the whole width — it holds things like
        // 'input[type="checkbox"].toggle' and a 110px label column plus a
        // strength badge leaves a box too small to read what you typed.
        // Dropdowns stack too: their option text is a sentence, and a <select>
        // clips rather than wraps, so a narrow column hides the choice you made.
        row.className = (isSelRoot || choices) ? 'root-text root-wide' : 'root-text';
        const ph = (schema.placeholders && schema.placeholders[k]) || '';
        // A closed set of valid values is a dropdown. Typed free-text here only
        // ever produced silent typos — "checkbox " or "Checkbox" fell through to
        // the fallback role with nothing to say it had.
        const inputHtml = choices
          ? `<select data-root="${escapeHtml(k)}">` + choices.map(c => {
              const val = typeof c === 'string' ? c : c.value;
              const txt = typeof c === 'string' ? c : c.text;
              return `<option value="${escapeHtml(val)}"${val === String(defaultVal || '') ? ' selected' : ''}>${escapeHtml(txt)}</option>`;
            }).join('') + `</select>`
          : `<input type="text" data-root="${escapeHtml(k)}" value="${escapeHtml(String(defaultVal || ''))}"` +
            (ph ? ` placeholder="${escapeHtml(ph)}"` : '') + `>`;
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

// The SHAPE each component has to have, checked against the live page.
//
// Match counts prove every field found something; they cannot prove the fields
// found the right things. A listbox mapped with the trigger button as its
// `listbox` passes every count check and is nonsense — and one did: it was
// generated, previewed, approved and saved without a single step objecting,
// because nothing anywhere asked whether the options were inside the list.
//
// `inside: true`  — the child elements must live within the parent, because
//                   that is where U1 looks for them.
// `inside: false` — they must NOT, because nesting them breaks the widget.
// Types where a child selector reaching outside its parent is FATAL rather than
// partial. These are the ones u1-patch wraps with a context resolver: to reach
// one part it widens the context, widening picks up the strays, and the
// component is refused outright. Everywhere else the extra matches are simply
// ignored, which is the "partial" the message used to promise for everyone.
const FATAL_IF_WIDE = ['tabs'];

const STRUCTURE_RULES = {
  // The listbox is the thing that OPENS. The trigger is outside it — a button
  // that contained the list it opens would disappear along with it.
  listbox:  [{ parent: 'listbox', child: 'options', inside: true },
             { parent: 'listbox', child: 'trigger', inside: false }],
  combobox: [{ parent: 'listbox', child: 'options', inside: true }],
  menu:     [{ parent: 'menu',    child: 'items',   inside: true }],
  // A tab strip holds the tabs; the panels sit outside it. Pointing both at one
  // element makes U1 hide the tabs along with the content they control.
  tabs:     [{ parent: 'tabList', child: 'tab',       inside: true },
             { parent: 'tabList', child: 'tabPanel',  inside: false }],
  table:    [{ parent: 'table',   child: 'row',     inside: true },
             { parent: 'table',   child: 'cell',    inside: true }],
  grid:     [{ parent: 'grid',    child: 'row',     inside: true },
             { parent: 'grid',    child: 'cell',    inside: true }],
  accordion:[{ parent: 'headerSelector', child: 'contentSelector', inside: false }],
  // A radioButton selector reaching outside its group is the same fault as a
  // tab reaching outside its list, and radio had no rule at all — so nothing
  // reported it and nothing narrowed it.
  radio:    [{ parent: 'radioGroup', child: 'radioButton', inside: true }],
};

/**
 * Narrow a child selector so it only matches inside its parent.
 *
 * STRUCTURE_RULES has always known which fields must live inside which — it
 * just reported it. For `tabs` that reporting was worse than useless: a `tab`
 * selector matching outside the tabList makes P.contextRoot.tabs refuse the
 * strip, u1.fix.tabs is never called at all, and the panel said "U1 will only
 * decorate the ones inside it", which is the opposite of what happens.
 *
 * So: fix the selector instead of describing the problem. `.tab-bar__btn`
 * matching eleven elements, six of them in #dealTabs, becomes
 * `#dealTabs>.tab-bar__btn`.
 *
 * A DESCENDANT combinator would be the obvious move and it is not available:
 * isU1ValidSelector splits on [>+~] and rejects a compound containing a space,
 * so `#dealTabs .tab-bar__btn` is invalid to U1 while `#dealTabs>.tab-bar__btn`
 * is fine. Every candidate is therefore checked against that validator before
 * it is written, and a field with no valid narrowing is left alone and
 * reported rather than quietly mangled.
 *
 * Returns [{ field, from, to, was, now }] — empty when nothing needed it.
 */
async function narrowContained(tpl) {
  const rules = STRUCTURE_RULES[tpl && tpl.type] || [];
  const sels = (tpl && tpl.config && tpl.config.selectors) || {};
  const jobs = rules
    .filter((r) => r.inside && sels[r.parent] && sels[r.child])
    .map((r) => ({ field: r.child, parentSel: sels[r.parent], childSel: sels[r.child] }));
  if (!jobs.length) return [];

  const tab = await getTab();
  if (!isInjectable(tab)) return [];

  let found;
  try {
    found = await inPage(tab.id, (list) => {
      const out = [];
      for (const job of list) {
        let parent = null, kids = [];
        try {
          parent = document.querySelector(job.parentSel);
          kids = Array.from(document.querySelectorAll(job.childSel));
        } catch { continue; }
        if (!parent || !kids.length) continue;
        const inside = kids.filter((el) => parent.contains(el) && el !== parent);
        // Nothing outside, or nothing inside — neither is this function's job.
        // "None inside" is a wrong selector, not a wide one, and narrowing it
        // would turn a loud error into a silent no-match.
        if (inside.length === kids.length || !inside.length) continue;
        const scoped = window.__u1SelectorIntel.commonSelectorFor(parent, inside, job.parentSel);
        out.push({
          field: job.field,
          was: job.childSel,
          outside: kids.length - inside.length,
          total: kids.length,
          now: scoped && scoped.selector ? scoped.selector : null,
        });
      }
      return out;
    }, [jobs]);
  } catch { return []; }

  const done = [];
  for (const f of found || []) {
    if (!f.now || f.now === f.was) continue;
    if (!isU1ValidSelector(f.now)) continue;   // rather leave it than mangle it
    setDeep(tpl.config.selectors, f.field, f.now);
    done.push(f);
  }
  if (done.length) tpl.code = mappingToCode(tpl);
  return done;
}

// Which build is actually running.
//
// "I loaded the new version" and "the browser is running the new version" are
// different claims, and for several rounds of this project there was no way to
// tell them apart from inside the panel — a fix would ship, the symptom would
// persist, and both of us would be reasoning about code that was not there.
// The manifest version rarely changes; the commit does.
async function showBuildStamp() {
  const el = document.getElementById('buildStamp');
  if (!el) return;
  try {
    const mf = chrome.runtime.getManifest();
    const stamp = (mf.version_name || mf.version || '').trim();
    el.textContent = 'v' + stamp;
    // A trailing + means the package was built from a tree with uncommitted
    // changes, so the commit named is the last one COMMITTED and not
    // necessarily what is running. Worth spelling out: the stamp exists to
    // answer "which build is this", and a reader who cannot decode it is back
    // where they started.
    el.title = `Extension ${stamp}.` +
      (/\+\)?$/.test(stamp) ? ' The + means it was built from a tree with uncommitted changes, so the commit shown is the last one committed rather than exactly what is running.' : '') +
      ` If a fix looks missing, check this first: chrome://extensions → Remove → Load unpacked. ` +
      `The Errors panel there keeps old entries until you press Clear all, so an error listed ` +
      `is not proof of an error happening.`;
  } catch {}
}
showBuildStamp();

// ─────────────────────────────────────────────────────────────────────────────
//  Saying what things are, screen by screen
// ─────────────────────────────────────────────────────────────────────────────
//
// The run stops on each section with every candidate numbered on the page,
// and you say what they are. Two things make this worth the interruption.
//
// It is FREE. buildTemplate → saveMappingEntry → applyMappingsBatch is already
// a local pipeline; the only thing the model contributes is the sub-field
// selectors, and describeComponent measures those instead. Name everything on a
// section and that section costs nothing.
//
// And it accepts a GROUP. The collector sees six .tab-bar__btn as six buttons —
// which is correct, they are buttons — and the component is the strip they
// form. There is no single candidate to label, so labelling one at a time could
// never have described it. That strip is the one the model failed to identify.
//
// `on` is no longer a setting. Naming a component costs no model call and no
// money, and a section named in full is never charged for — there was no
// version of "off" worth offering, and the checkbox was one more thing to have
// forgotten to tick before paying for a scan.
const sweepLabel = { on: true, resolve: null, marks: new Set(), busy: false, skip: false };

/**
 * The candidates a section's naming pause is working with, by section number.
 *
 * Deliberately NOT on the stop. A stop is persisted to chrome.storage and
 * pushed to the server, and hanging a list of up to 250 candidates off it made
 * a twenty-one section survey 771KB against a 99KB limit — the scan finished
 * and then failed to upload. This is scratch for a pause that is open now.
 */
const sweepCands = new Map();

/**
 * A signal that the element is ALREADY a real control.
 *
 * clickSignals reports everything it can see, and the list mixes two very
 * different findings: `<button>` and `role=link` mean the browser already gives
 * this thing focus and a name, while `onclick`, `cursor:pointer` and
 * `tabindex=-1` mean somebody hung behaviour on a <div>. Only the second group
 * is work. Telling them apart is what turns 121 rows of mostly ordinary links
 * into the handful that actually fail a keyboard.
 */
const NATIVE_SIGNAL =
  /^<(button|a href|input|select|textarea|summary)>$|^role=(button|link|menuitem|menuitemcheckbox|menuitemradio|tab|checkbox|switch|option)$/;

/**
 * Hold the run after each section, so its components can be built before the
 * next one is read.
 *
 * Ticking all twenty-three sections used to mean thirty-five minutes and $14
 * before the components view was reached even once — the loop only set
 * phase='components' after it had finished every section. The components from
 * section 1 were sitting in aiSweep.stops four minutes in and there was no way
 * to get at them short of stopping the run.
 *
 * `resolve` non-null IS the paused state: it is what the continue button calls,
 * what the stop button has to call so the run does not sit waiting for a
 * decision nobody is going to make, and what lets the make-accessible button
 * through its `aiSweep.running` guard.
 */
const sweepPause = { on: true, resolve: null };

/**
 * Stop after a section, show what it found, and wait to be told to carry on.
 *
 * Resolves { stopped:boolean }. The components view is the existing one —
 * nothing here duplicates it, because the whole point is that the fixes are
 * built by the same button, with the same ticks and the same review, as they
 * are when the run has ended.
 */
function pauseForFixes(stop, left) {
  const host = document.getElementById('sweepResume');
  if (!host) return Promise.resolve({ stopped: false });

  clearSweepBusy();          // the run is not working, it is waiting for you
  aiSweep.phase = 'components';
  renderSweepPicks();        // draws the ticks; this banner sits above them

  const k = stop.found.filter((f) => !f.done).length;
  host.style.display = '';
  host.innerHTML = `
    <div class="sweep-resume-head">Section ${stop.n} found ${k} component${k === 1 ? '' : 's'}.</div>
    <div class="sweep-resume-sub">Build the fixes for them now, then continue —
      ${left} section${left === 1 ? '' : 's'} still to read. Nothing is charged while this waits.</div>
    <div class="sweep-resume-btns">
      <button class="btn-primary btn-sm" id="sweepResumeGo">Build these ${k} and continue →</button>
      <button class="btn-outline btn-sm" id="sweepResumeSkip">Skip — carry on without building</button>
      <button class="btn-ghost btn-sm" id="sweepResumeStop">Stop the run here</button>
      <label class="sweep-resume-auto"><input type="checkbox" id="sweepResumeAuto">
        Do not stop again — read the rest straight through</label>
    </div>`;

  return new Promise((resolve) => {
    const finish = (out) => {
      sweepPause.resolve = null;
      host.onclick = null;
      host.style.display = 'none';
      host.innerHTML = '';
      resolve(out);
    };
    // Held here so the stop button can end the wait too. Without it, pressing
    // Stop set aiSweep.abort and then span for sixty seconds waiting on a
    // aiSweep.running that only this promise could clear.
    sweepPause.resolve = finish;
    host.onclick = async (e) => {
      if (e.target.closest('#sweepResumeAuto')) { sweepPause.on = !e.target.checked; return; }
      if (e.target.closest('#sweepResumeStop')) { aiSweep.abort = true; finish({ stopped: true }); return; }
      if (e.target.closest('#sweepResumeSkip')) { finish({ stopped: false }); return; }
      // The primary action BUILDS, then carries on. It used to only carry on,
      // with building left to a separate button in the list — so the obvious
      // press moved the run forward and made nothing, and the drawer ended up
      // reading "8 components found" beside "No mappings yet".
      const go = e.target.closest('#sweepResumeGo');
      if (go) {
        const label = go.textContent;
        go.disabled = true;
        go.textContent = 'Building…';
        try { await buildPickedComponents(); }
        catch (err) { showNotice(document.getElementById('sweepPicksStatus'),
          'Could not build them: ' + err.message, 'error', 9000); }
        finally { go.disabled = false; go.textContent = label; }
        finish({ stopped: false });
      }
    };
  });
}

/**
 * Every component a person named, in the corpus's own shape.
 *
 * Local and private (`__`), because it is evidence rather than site
 * configuration: it belongs to whoever is building the detector, not to the
 * client's site, and it must never travel in a project export.
 */
const LABELS_KEY = (U1Store.PRIVATE_PREFIX || '__') + 'labels';

async function rememberLabel(entry) {
  try {
    const got = await U1Store.get([LABELS_KEY]);
    const list = got[LABELS_KEY] || [];
    // One per root per type — naming the same thing twice is a correction, not
    // a second example.
    const at = list.findIndex((x) => x.root === entry.root && x.type === entry.type);
    if (at >= 0) list[at] = { ...list[at], ...entry, at: Date.now() };
    else list.push({ ...entry, at: Date.now() });
    await U1Store.set({ [LABELS_KEY]: list.slice(-500) });
  } catch {}
}

document.getElementById('exportLabelsBtn')?.addEventListener('click', async () => {
  const got = await U1Store.get([LABELS_KEY]);
  const list = got[LABELS_KEY] || [];
  const status = document.getElementById('sweepPicksStatus');
  if (!list.length) {
    showNotice(status, 'Nothing named yet. Turn on "let me say what things are" and name something.', 'info', 6000);
    return;
  }
  // The shape verify-detect reads, field for field.
  const doc = {
    url: list[0].url || currentHostname,
    note: [
      'Written by naming components in the panel while looking at the page —',
      'not by running the tool and blessing what it found. That distinction is',
      'the whole value of this file: a corpus built from the tool\'s own output',
      'can only ever score 100%.',
    ],
    components: list.map((l) => {
      const c = { type: l.type, root: l.root, why: l.why };
      if (l.fields && Object.keys(l.fields).length) c.fields = l.fields;
      if (l.matches > 1) c.matches = l.matches;
      return c;
    }),
  };
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentHostname || 'site'}.labels.json`;
  a.click();
  showNotice(status, `${list.length} named component${list.length === 1 ? '' : 's'} exported. ` +
    'Drop it in fixtures/ and verify-detect will score against it from then on.', 'success', 9000);
});

/** Types worth offering. Everything the builder can actually create. */
const LABEL_TYPES = () => Object.keys(COMPONENT_SCHEMAS);

/**
 * A picture of ONE element, cut out of the section screenshot already in hand.
 *
 * The sections list answers "which part of the page is this" with a photograph,
 * and that is the only thing in the tool that makes a row and a place on the
 * page the same object in your head. A row in the labelling list had no such
 * thing — hovering it drew an outline on the real page, which means looking
 * away from the panel, and scrolled that page to do it.
 *
 * Nothing is captured here. `shot` was taken for the model a moment ago, `box`
 * came back with the candidate, and the only work is a crop — so a preview
 * costs nothing and cannot fail on a page that has since moved.
 */
function elementCrop(shot, viewport, box, img) {
  if (!shot || !viewport || !box || !box.w || !box.h || !img || !img.naturalWidth) return '';
  // `box` is in CSS pixels; the shot was captured at the device ratio and then
  // scaled to a fixed width. One factor relates them.
  const k = img.naturalWidth / viewport.w;
  // A crop tight to the element is unreadable out of context — a bare button on
  // a bare background. A margin of its own size, clamped, puts it back on the
  // page it lives on.
  const pad = Math.max(24, Math.min(90, Math.round(box.h * 0.8)));
  const x = Math.max(0, Math.round((box.x - pad) * k));
  const y = Math.max(0, Math.round((box.y - pad) * k));
  const w = Math.min(img.naturalWidth - x, Math.round((box.w + pad * 2) * k));
  const h = Math.min(img.naturalHeight - y, Math.round((box.h + pad * 2) * k));
  if (w <= 0 || h <= 0) return '';
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  cx.drawImage(img, x, y, w, h, 0, 0, w, h);
  // The element itself, ringed in the same pink the on-page marks use — the
  // crop alone does not say WHICH of the six things in it you are pointing at.
  cx.strokeStyle = '#ff2d95';
  cx.lineWidth = Math.max(2, Math.round(2 * k));
  cx.strokeRect(
    Math.round((box.x * k) - x), Math.round((box.y * k) - y),
    Math.round(box.w * k), Math.round(box.h * k));
  try { return cv.toDataURL('image/jpeg', 0.8); } catch { return ''; }
}

/**
 * Stop, show what is on this section, and wait.
 * Resolves { labelled:[], done:boolean, stopped:boolean }.
 */
function labelScreen(stop, collected, tab) {
  // The list drops out of the section's own row, not out of a panel above it.
  //
  // A section and the components on it are one thing at two levels, and putting
  // the second in a separate box at the top of the tab broke that: you were
  // reading about "Section 1" in a panel that had no visual connection to the
  // Section 1 row a few inches below, still sitting in the list with its own
  // thumbnail. Now the row opens and the components are inside it.
  //
  // The standalone host stays as the fallback for the case where the row is not
  // on screen — a restored survey, or a phase that is not showing the list.
  const fallback = document.getElementById('sweepLabel');
  const screenRow = document.querySelector(`#sweepPicksList .sweep-screen[data-screen="${stop.n}"]`);
  let host = fallback;
  let drop = null;
  if (screenRow) {
    drop = document.createElement('div');
    drop.className = 'lbl-drop';
    screenRow.insertAdjacentElement('afterend', drop);
    screenRow.classList.add('is-open');
    host = drop;
    host.style.display = '';
    // The row can be anywhere in a list of twenty-three, and the run just
    // scrolled the PAGE to it — the panel has no idea. Bring it into view.
    try { screenRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}

    // Everything else folds away while this one is open.
    //
    // The section being worked on is a few hundred pixels of list, and the
    // twenty-two sections queued behind it are several thousand more — so the
    // components you are deciding about, and the button that builds them, sat
    // in a thin band with the rest of the run scrolling past underneath. They
    // are not gone: the fold says how many and opens on a click.
    const list = document.getElementById('sweepPicksList');
    const others = list
      ? [...list.querySelectorAll('.sweep-screen')].filter((x) => x !== screenRow).length
      : 0;
    if (list && others) {
      list.classList.add('lbl-focus');
      const bar = document.createElement('details');
      bar.className = 'sweep-others';
      bar.innerHTML = `<summary>${others} other section${others === 1 ? '' : 's'} — ` +
        `hidden while this one is open</summary>`;
      bar.addEventListener('toggle', () => list.classList.toggle('lbl-focus', !bar.open));
      // At the BOTTOM. Above the list it sat between you and the section you
      // are working on, and read as a header for it.
      list.appendChild(bar);
    }
  }
  if (!host) return Promise.resolve({ labelled: [], done: false });

  sweepLabel.marks = new Set();
  const made = [];
  const cands = collected.candidates || [];
  // Held in memory, keyed by section — NOT on the stop.
  //
  // Putting it on the stop threaded it straight into everything the stop is
  // part of: chrome.storage, and the survey body pushed to the server. A
  // candidate is ~376 bytes and a section can hold 250 of them, so a
  // twenty-one section run turned a 52KB body into three quarters of a
  // megabyte and the upload came back 413 — "saved on this machine but did not
  // reach the server", on a scan that had just worked perfectly.
  //
  // It is scratch for the pause that is open right now. It has no business
  // outliving the session, let alone travelling.
  sweepCands.set(stop.n, cands);
  // Worth asking about: anything the collector has a guess for, or that showed
  // a click signal. The rest are links, buttons and text — real elements, but
  // not a question. They stay one fold away, because sometimes the noise IS the
  // component: six plain buttons that are a tab strip.
  //
  // `nested` is the collector's own word for "this is a PART of a component of
  // the same kind that is already listed above it" — seven <li>s and seven
  // triggers inside one mega menu. Seventeen rows all reading "menu?" for one
  // menu is not seventeen questions; it is one question asked seventeen times,
  // and it pushed the rest of the section off the end of the list. They fold
  // away with the plain elements, where they are still reachable, because
  // occasionally the part IS the thing you mean to name.
  // Grouped by what there is to DO with each, which is the only distinction
  // that matters when you are working through a section:
  //
  //   components — a menu, a carousel, a tab strip. These are the answer.
  //   bare       — it takes a click and it is not a button or a link. This is
  //                the one that fails a keyboard user, and it is one press to
  //                fix: give it the role it should have had.
  //   native     — a real <a href> or <button>. Nothing to do, and a list that
  //                shows them is a list you have to read past to find the two
  //                groups above.
  //
  // It used to be one flat list of everything with a click signal — 121 rows
  // out of 224 on this page, nearly all of them ordinary links.
  const isNative = (c) => (c.signals || []).some((s) => NATIVE_SIGNAL.test(s));
  const components = cands.filter((c) => !c.nested && c.component);
  const rest = cands.filter((c) => components.indexOf(c) === -1);
  const bare = rest.filter((c) => (c.signals || []).length && !isNative(c) && c.selector);
  const plain = rest.filter((c) => bare.indexOf(c) === -1);
  const interesting = components;   // what the head count is about

  // The picture goes where the pink number was. A number is a lookup you have to
  // perform against the page; a thumbnail of the element IS the answer, and it
  // is the same thing the sections list does one level up. Hovering enlarges it,
  // exactly as a section thumbnail does.
  const thumb = (c) => `
    <span class="lbl-thumb" data-mark="${c.mark}">
      <img class="lbl-img" alt="">
      <img class="lbl-zoom" alt="">
      <span class="lbl-n">${c.mark}</span>
    </span>`;

  // A component row states what it IS, in a control you can correct, and starts
  // ticked. The question being asked is "is this right?", and a row that starts
  // empty asks "what is this?" instead — which is the question the tool is
  // supposed to have answered already.
  const typeSel = (c) => `
    <select class="lbl-row-type" aria-label="What ${escapeHtml(c.selector || 'it')} is">
      ${LABEL_TYPES().map((t) =>
        `<option value="${t}"${t === c.component ? ' selected' : ''}>${t}</option>`).join('')}
    </select>`;

  // Deliberately the same shape as a section row in the picker: tick, picture,
  // a bold name, a quieter line of detail under it. A component and a section
  // are the same kind of object at two scales — one is a piece of the page you
  // are deciding about — and giving them two different layouts made the second
  // list read as a different tool.
  const compRow = (c) => `
    <label class="ai-approved-row ai-bulk-row lbl-row is-comp" data-mark="${c.mark}">
      <input type="checkbox" class="lbl-tick" value="${c.mark}" checked
             aria-label="Build ${escapeHtml(c.component)} on ${escapeHtml(c.selector || 'this')}">
      ${thumb(c)}
      <span class="lbl-body">
        <span class="lbl-title">${typeSel(c)}</span>
        <!-- The selector is editable. What the collector works out is a good
             guess and not a decision — it may be too wide (fourteen matches
             where one is meant), too narrow, or rooted one level off. Correcting
             it here is the difference between a mapping you can use and one you
             have to rebuild by hand in Mappings afterwards. -->
        <input class="lbl-sel-edit" type="text" spellcheck="false"
               value="${escapeHtml(c.selector || '')}"
               placeholder="CSS selector for this component"
               aria-label="Selector to build the ${escapeHtml(c.component)} on">
        <span class="lbl-meta lbl-meta-2">${escapeHtml(c.tag)}${
          c.maybe ? ' · guessed from its class name' : ' · stated by the markup'}${
          c.matches > 1 ? ` · selector hits ${c.matches} elements` : ''}</span>
      </span>
    </label>`;

  const row = (c) => `
    <label class="lbl-row" data-mark="${c.mark}">
      <input type="checkbox" class="lbl-tick" value="${c.mark}">
      ${thumb(c)}
      <span class="lbl-tag">${escapeHtml(c.tag)}</span>
      <span class="lbl-sel">${escapeHtml(c.selector || '(no selector)')}</span>
      ${c.component ? `<span class="lbl-guess">${escapeHtml(c.component)}${c.maybe ? '?' : ''}</span>` : ''}
      ${c.closed ? '<span class="lbl-flag">closed</span>' : ''}
      ${c.matches > 1 ? `<span class="lbl-flag">${c.matches} matches</span>` : ''}
    </label>`;

  host.style.display = '';
  host.innerHTML = `
    <div class="lbl-box">
      <div class="lbl-head">
        <strong>Section ${stop.n}</strong>
        <span class="lbl-sub">${components.length
          ? `These are the ${components.length} component${components.length === 1 ? '' : 's'} found here. ` +
            `Check them, correct anything wrong, then carry on — naming them costs nothing.`
          : `Nothing here reads as a component. Everything on this section is ordinary links and text, ` +
            `or the model has not been asked yet.`}</span>
        <!-- The one honest answer to "it is right there in the picture and not
             in the list". Everything already mapped or dismissed is filtered
             out before this screen — correct, and completely invisible, so a
             component you built an hour ago reads as one the tool has stopped
             finding. -->
        ${collected.skipped ? `<span class="lbl-sub lbl-skipped">${collected.skipped} element${
          collected.skipped === 1 ? ' on this section is' : 's on this section are'} not listed:
          already mapped${collected.dismissed ? `, or dismissed (${collected.dismissed})` : ''},
          or found on an earlier section. They are in the picture; they are not work any more.</span>` : ''}
      </div>

      <div class="lbl-list">${components.map(compRow).join('')}</div>

      ${bare.length ? `<div class="lbl-bare">
        <div class="lbl-bare-head">${bare.length} thing${bare.length === 1 ? '' : 's'} here take${bare.length === 1 ? 's' : ''} a click without being a button or a link</div>
        <p class="lbl-sub">A keyboard cannot reach ${bare.length === 1 ? 'it' : 'them'} and a screen reader says nothing.
        Ticked below, ${bare.length === 1 ? 'it gets' : 'they get'} the role ${bare.length === 1 ? 'it' : 'they'} should have had.</p>
        <div class="lbl-list">${bare.map(row).join('')}</div>
        <div class="lbl-act">
          <button class="btn-outline btn-sm" id="lblRoleBtn" disabled>Make the ticked ones buttons</button>
          <button class="btn-outline btn-sm" id="lblRoleLink" disabled>…or links</button>
        </div>
      </div>` : ''}

      <!-- Everything else, and the way to correct a miss. Shut, because on a
           good section there is nothing to do here — but it is the only answer
           to "it did not find my tab strip", so it says so on the tin rather
           than being a bare count of rows. -->
      <details class="lbl-plain">
        <summary>Missed something? ${plain.length} more element${plain.length === 1 ? '' : 's'} to choose from</summary>
        <p class="lbl-sub">Real links and buttons, text, and the parts of the components above — nothing
        here needs doing on its own. But if a component was missed, this is where it is:
        tick the elements that form it, say what it is, and add it. Six buttons that are a tab strip
        appear here as six buttons.</p>
        <div class="lbl-list">${plain.map(row).join('')}</div>
        <div class="lbl-act">
          <select id="lblType" aria-label="What the ticked elements are">
            ${LABEL_TYPES().map((t) => `<option value="${t}">${t}</option>`).join('')}
          </select>
          <button class="btn-outline btn-sm" id="lblAdd" disabled>Add the ticked ones as this</button>
        </div>
      </details>

      <div class="lbl-made" id="lblMade"></div>

      <!-- One button. "Ask Claude about this section as well" and a second Stop
           both went: the run already has "Stop after this section" above it, and
           the model is what the sections you have not confirmed are for. Two
           more ways out of one screen is what made this area unreadable.
           "Do not ask me again" moved up to the box that decides what gets
           read, beside the other two switches that govern the run. -->
      <div class="lbl-go">
        <button class="btn-ghost btn-sm" id="lblSkip" hidden>Skip the rest — keep what is done</button>
        <button class="btn-primary btn-sm" id="lblFree">${components.length
          ? 'These are right — build them and go on'
          : 'Nothing here — next section'}</button>
      </div>
      <div class="map-mode-hint" id="lblStatus"></div>
    </div>`;

  const status = document.getElementById('lblStatus');
  const addBtn = document.getElementById('lblAdd');
  const roleBtns = ['lblRoleBtn', 'lblRoleLink'].map((id) => document.getElementById(id));
  const sync = () => {
    sweepLabel.marks = new Set([...host.querySelectorAll('.lbl-tick:checked')].map((t) => Number(t.value)));
    addBtn.disabled = sweepLabel.marks.size === 0 || sweepLabel.busy;
    // These act on the bare group only, so they are armed by what is ticked
    // INSIDE it — ticking a menu up in the components list must not offer to
    // turn it into a button.
    const bareTicked = [...host.querySelectorAll('.lbl-bare .lbl-tick:checked')].length;
    for (const b of roleBtns) if (b) b.disabled = !bareTicked || sweepLabel.busy;
  };

  return new Promise((resolve) => {
    const finish = (out) => {
      sweepLabel.resolve = null;
      host.onchange = host.onclick = host.onmouseover = host.onmouseout = null;
      host.innerHTML = '';
      // A drop belongs to one pause and is built fresh for the next; the
      // standalone fallback is a fixture and is only hidden.
      if (drop) {
        drop.remove();
        if (screenRow) screenRow.classList.remove('is-open');
        // Rebuilt from state rather than unpicked by hand — the fold, the
        // hidden rows and the marks this pause set are all undone by one
        // redraw, and the redraw was blocked only while the pause was open.
        if (aiSweep.phase === 'screens') renderSweepScreens();
      } else host.style.display = 'none';
      resolve(out);
    };
    // Declared on sweepLabel since this pause was written and never assigned,
    // so "is the run holding to be told what things are" had no answer outside
    // this function. sweepPreviewScreen needs it: a held run is not moving the
    // page, so hovering a section may still preview it.
    sweepLabel.resolve = finish;

    host.onchange = sync;

    // Hover a row and see the element — as a picture, in the panel, the way the
    // sections list shows a section. Cut from the screenshot already taken for
    // this section, so it costs nothing and does not touch the page.
    //
    // The outline on the real page is still drawn, because "where is it on the
    // actual site" is a different question from "which one is it" and both get
    // asked. What it no longer does is scroll the page out from under you.
    const shotImg = new Image();
    const crops = new Map();
    const byMark = new Map(cands.map((c) => [c.mark, c]));
    const cropFor = (n) => {
      if (!crops.has(n)) {
        const c = byMark.get(n);
        crops.set(n, c ? elementCrop(collected.shot, collected.viewport, c.box, shotImg) : '');
      }
      return crops.get(n);
    };
    // Drawn into the rows as soon as the shot decodes. Doing it on hover meant
    // the list was a wall of numbers until you touched it — and the number was
    // never the thing you wanted to see.
    shotImg.onload = () => {
      for (const holder of host.querySelectorAll('.lbl-thumb')) {
        const n = Number(holder.dataset.mark);
        const src = cropFor(n);
        if (!src) { holder.classList.add('is-blank'); continue; }
        holder.querySelector('.lbl-img').src = src;
        holder.querySelector('.lbl-zoom').src = src;
        holder.classList.add('has-shot');
      }
    };
    if (collected.shot) shotImg.src = collected.shot;

    host.onmouseover = (e) => {
      const r = e.target.closest('.lbl-row');
      if (!r) return;
      const n = Number(r.dataset.mark);
      const c = byMark.get(n);
      if (!tab) return;
      // Hovering marks it ON THE PAGE — by SELECTOR, not by mark number.
      //
      // showMark looks up [data-u1-mark="n"], and the first line of
      // collectCandidates is clearMarks(). Anything that re-reads the page —
      // hovering a row in the sections list, a preview, a re-collect — wipes
      // every mark, and from then on the highlight silently found nothing.
      // That is why this "did not work": not the drawing, the lookup.
      //
      // A selector is not destroyed by anything, and the row already carries
      // one. noScroll because the page is parked on this section deliberately;
      // yanking it elsewhere on a mouse-over is what the preview is for.
      const sel = c && c.selector;
      if (sel) {
        inPage(tab.id, (x) => window.__u1SelectorIntel.highlightSelector(x, { noScroll: true }), [sel])
          .catch(() => {});
      } else {
        inPage(tab.id, (m) => window.__u1SelectorIntel.showMark(m), [n]).catch(() => {});
      }
    };
    host.onmouseout = (e) => {
      // Leaving the list takes the highlight down; moving between rows does not,
      // or every gap between two rows would flash the page.
      if (!host.contains(e.relatedTarget) && tab) {
        inPage(tab.id, () => window.__u1SelectorIntel.clearHilite()).catch(() => {});
      }
    };

    host.onclick = async (e) => {
      // The one control that must work WHILE a build is running.
      if (e.target.closest('#lblSkip')) {
        sweepLabel.skip = true;
        e.target.closest('#lblSkip').textContent = 'Stopping after this one…';
        return;
      }
      if (sweepLabel.busy) return;

      // The one press this screen exists for: yes, these are what they say
      // they are — build them and carry on. Each row is built as the type ITS
      // OWN control says, so correcting one is changing that row's dropdown and
      // nothing else. It used to be one dropdown at the bottom governing every
      // ticked row at once, which is unusable the moment two rows differ and
      // unreadable even when they do not.
      if (e.target.closest('#lblFree')) {
        const ticked = [...host.querySelectorAll('.lbl-list .lbl-row.is-comp')]
          .filter((r) => r.querySelector('.lbl-tick')?.checked)
          .map((r) => ({
            mark: Number(r.dataset.mark),
            type: r.querySelector('.lbl-row-type').value,
            // Empty, or unchanged, means "use what was measured".
            sel: (r.querySelector('.lbl-sel-edit')?.value || '').trim(),
          }));
        if (ticked.length) {
          sweepLabel.busy = true;
          sync();
          const btn = document.getElementById('lblFree');
          const label = btn.textContent;
          let ok = 0;
          const failed = [];
          // One component can sit for a minute or two on a model call, and a
          // build of six is six of those. A way out that does not throw away
          // the ones already saved — they are in Mappings and applied — is the
          // difference between waiting and being stuck.
          sweepLabel.skip = false;
          const skipBtn = document.getElementById('lblSkip');
          if (skipBtn) skipBtn.hidden = false;
          try {
            for (let k = 0; k < ticked.length; k++) {
              if (sweepLabel.skip) {
                failed.push(`${ticked.length - k} skipped at your request`);
                break;
              }
              btn.textContent = `Building ${k + 1} of ${ticked.length}…`;
              const rowEl = host.querySelector(`.lbl-row.is-comp[data-mark="${ticked[k].mark}"]`);
              const res = await confirmedToMapping(ticked[k], stop, tab);
              // The outcome goes ON THE ROW. Pressing build and getting silence
              // — no mapping in the drawer, no error anywhere you would look —
              // is indistinguishable from the button doing nothing, and that is
              // what a one-line hint at the bottom of a long panel amounts to.
              if (res.err) {
                failed.push(`${ticked[k].type}: ${res.err}`);
                if (rowEl) {
                  rowEl.classList.add('is-failed');
                  rowEl.insertAdjacentHTML('beforeend',
                    `<span class="lbl-why">✗ ${escapeHtml(res.err)}</span>`);
                }
                continue;
              }
              ok++;
              made.push(res.found);
              if (res.warn) showNotice(status, res.warn, 'warn', 12000);
              if (rowEl) {
                rowEl.classList.add('is-used');
                rowEl.insertAdjacentHTML('beforeend',
                  `<span class="lbl-why">✓ saved to Mappings</span>`);
              }
            }
          } finally {
            sweepLabel.busy = false;
            btn.textContent = label;
            sweepLabel.skip = false;
            if (skipBtn) skipBtn.hidden = true;
          }
          // And a sentence about the whole press, because "6 ticked, 5 saved"
          // must never again be something you notice by counting rows.
          if (failed.length) {
            showNotice(status,
              `${ok} of ${ticked.length} saved to Mappings. ${failed.length} could not be built: ` +
              failed.join(' · '), 'warn', 16000);
            // Stay on the section. A failure you cannot see and cannot retry is
            // the same as no failure report at all.
            return;
          }
          // Everything the site has, not only the ones just built. u1 decorates
          // an element once per page load, so a mapping made two sections ago
          // may never have met what this section re-rendered — and the whole
          // point of confirming a section is to look at the page afterwards.
          let put = null;
          try { put = await applyAllMappings({ silent: true }); } catch (e) {}
          showNotice(status,
            `${ok} saved to Mappings` +
            (put ? ` · ${put.applied} of ${put.applied + put.failed} now applied on the page` : '') + '.',
            'success', 6000);
        }
        // "and everything after this one, without asking" — the same switch the
        // hold offers, set from the place the decision is actually made.
        finish({ labelled: made, done: true, auto: !sweepLabel.on || !sweepPause.on });
        return;
      }

      // The safety net. Not a component and not a judgement: this element takes
      // a click, it is not a button or a link, and u1.fix.button/link is
      // exactly the correction for that. One press per group rather than one
      // trip through the type dropdown per element.
      const roleBtn = e.target.closest('#lblRoleBtn') || e.target.closest('#lblRoleLink');
      if (roleBtn) {
        const marks = [...host.querySelectorAll('.lbl-bare .lbl-tick:checked')].map((t) => Number(t.value));
        if (!marks.length) return;
        const asType = roleBtn.id === 'lblRoleLink' ? 'link' : 'button';
        sweepLabel.busy = true;
        sync();
        try {
          // One at a time: these are separate controls that happen to share a
          // problem, not one component with several parts.
          for (const m of marks) {
            const res = await labelToMapping(asType, [m], stop, tab);
            if (res.err) { showNotice(status, res.err, 'error', 9000); continue; }
            made.push(res.found);
            document.getElementById('lblMade').insertAdjacentHTML('beforeend',
              `<div class="lbl-done">✓ ${escapeHtml(asType)} on <code>${escapeHtml(res.found.sel)}</code></div>`);
            const tick = host.querySelector(`.lbl-bare .lbl-tick[value="${m}"]`);
            if (tick) { tick.checked = false; tick.closest('.lbl-row').classList.add('is-used'); }
          }
        } finally { sweepLabel.busy = false; sync(); }
        return;
      }

      if (!e.target.closest('#lblAdd')) return;
      const marks = [...sweepLabel.marks];
      if (!marks.length) return;
      const type = document.getElementById('lblType').value;
      sweepLabel.busy = true;
      addBtn.disabled = true;
      try {
        const res = await labelToMapping(type, marks, stop, tab);
        if (res.err) { showNotice(status, res.err, 'error', 9000); }
        else {
          made.push(res.found);
          document.getElementById('lblMade').insertAdjacentHTML('beforeend',
            `<div class="lbl-done">✓ ${escapeHtml(res.found.type)} on <code>${escapeHtml(res.found.sel)}</code>` +
            `<span class="lbl-sub"> — ${escapeHtml(res.found.why)}</span></div>`);
          host.querySelectorAll('.lbl-tick:checked').forEach((t) => {
            t.checked = false;
            t.closest('.lbl-row').classList.add('is-used');
          });
        }
      } finally {
        sweepLabel.busy = false;
        sync();
      }
    };
    sync();
  });
}

/**
 * A confirmed row becomes a mapping — through the engine that reads the
 * container's markup, not the one that measures it from the outside.
 *
 * These produced mappings whose every sub-selector was the ROOT selector again:
 *
 *   fix.tabs('.finder__tabs', { selectors: { tabList: '.finder__tabs' } })
 *   fix.menu('.mega-nav', { selectors: { horizontalMenu: '.mega-nav',
 *                                        menu: '.mega-nav' } })
 *
 * which is not a mapping — u1.fix.tabs needs tabList, tab and tabPanel to be
 * three DIFFERENT things. describeComponent measures a component from a set of
 * ticked marks, and when the tick is the container itself there is nothing to
 * measure the parts from, so every field collapses onto the root.
 *
 * rowFromParts → prepareOne is the path the per-component route has always
 * used: it extracts the container's actual HTML and asks the model to name the
 * parts inside it. That is the one that works, and it is the one the estimate's
 * "Build" row has always been quoting for — a call per component.
 */
async function confirmedToMapping(pick, stop, tab) {
  const cand = (sweepCands.get(stop && stop.n) || []).find((c) => c.mark === pick.mark);
  const sel = pick.sel || (cand && cand.selector) || '';
  if (!sel) return { err: 'That row has no selector to build on.' };

  // A dialog, listbox, datepicker or tooltip is rooted on the thing that
  // APPEARS, and the row holds the control that summons it. Same two sources of
  // the other half, best evidence first, as the bulk path uses.
  let container = '';
  if (triggerRequired(pick.type) || triggerFirstType(pick.type)) {
    const seen = (stop.probed || []).find((p) =>
      p.parts && (p.parts.trigger === sel || p.root === sel) && p.parts.panel);
    container = (seen && seen.parts.panel) ||
      (await inPage(tab.id, (x) => window.__u1SelectorIntel.openedBy(x), [sel])) || '';
  }
  const built = rowFromParts({
    type: pick.type, found: sel, container, label: sel, compIndex: undefined,
  });
  if (built.err) return { err: built.err };
  built.row.needsWork = true;
  const prepared = await prepareOne(built.row, tab);
  if (prepared.err) return { err: prepared.err };

  // ── And SAVE it. ─────────────────────────────────────────────────────────
  // prepareOne only prepares: it works out the selectors and puts a card on
  // the approval track. The bulk route saves by pressing the approve button
  // afterwards, and this route had no such press — so six components were
  // built, reported as done, and Mappings stayed empty.
  //
  // Saved one at a time on purpose. saveMappingEntry reads the stored list,
  // mutates it and writes it back with no locking, so concurrent saves clobber
  // each other. It also means each component appears in the drawer the moment
  // it is finished, rather than all six arriving at the end — which is what
  // makes a six-minute build watchable.
  const tpl = aiCardTemplate(prepared.idx);
  if (!tpl) return { err: 'The prepared mapping could not be read back.' };
  let saved;
  let warn = '';
  try { saved = await saveMappingEntry(tpl, { refreshUi: false }); }
  catch (e) {
    // The store distinguishes "not written" from "written here, not shared".
    // A server that refuses the push — 413 on a site with a lot of mappings —
    // used to be reported as a failed build on a mapping that was already
    // safely in chrome.storage, so the count read "0 of 1 saved" when it was
    // in fact 1 of 1.
    if (!e.localOnly) return { err: 'Could not save it: ' + e.message };
    warn = e.message;
  }
  if (saved && saved.cancelled) return { err: 'Not saved — the role question was declined.' };
  try {
    await applyMappingsBatch([{
      type: tpl.type, primary: tpl.primary, firstArg: tpl.firstArg,
      config: tpl.config, overwriteRole: tpl.overwriteRole,
    }]);
  } catch (e) { /* saved is the durable half; the panel re-applies on open */ }

  // Take the approval card down.
  //
  // prepareOne renders one, because on the manual route the card IS the
  // approval step. Here the approval already happened — you ticked the row and
  // pressed build — so leaving it up asks the same question twice. Worse, a
  // card without data-done is what holds the whole "cards" stage open
  // (stageHasContent), so one left behind sat over the panel until it was
  // dismissed by hand, in a mode whose entire promise is that nothing will ask.
  //
  // Removed only after aiCardTemplate has read it: the template lives in the
  // card's own form.
  document.querySelector(`#aiSlideTrack .ai-map-card[data-card="${prepared.idx}"]`)?.remove();
  if (!document.querySelectorAll('#aiSlideTrack .ai-map-card:not([data-done])').length) {
    setStage(mapMode === 'sweep' ? (aiSweep.phase === 'components' ? 'components' : 'screens') : 'none');
  }

  await loadMappingsList();
  refreshExportInfo();
  return {
    warn,
    found: { id: `s${stop.n}m${pick.mark}`, label: sel, type: pick.type, sel, done: true },
  };
}

/**
 * A type and some marks become a saved, applied mapping — with no model call.
 *
 * describeComponent measures the sub-fields; buildTemplate, saveMappingEntry and
 * applyMappingsBatch are the same three the manual route has always used, so
 * this mapping is indistinguishable from a hand-built one and carries the same
 * narrowing, role question and export.
 */
async function labelToMapping(type, marks, stop, tab, rootOverride) {
  let desc;
  try {
    desc = await inPage(tab.id,
      (t, m, f) => window.__u1SelectorIntel.describeComponent(t, m, f),
      [type, marks, rootOverride || '']);
  } catch (e) { return { err: 'Could not read the page: ' + e.message }; }
  if (!desc) return { err: 'Could not read the page.' };
  if (desc.err) return { err: desc.err };

  // A selector typed in the row wins over the measured one. What the collector
  // works out is a guess: it can be too wide, too narrow, or rooted a level off,
  // and correcting it here is the difference between a usable mapping and one
  // rebuilt by hand in Mappings afterwards. The measured sub-fields are kept —
  // they are relative to the root and are still the best description of it.
  let root = desc.root;
  if (rootOverride && rootOverride !== desc.root) {
    const hits = await inPage(tab.id, (x) => {
      try { return document.querySelectorAll(x).length; } catch (e) { return -1; }
    }, [rootOverride]);
    if (hits === -1) return { err: `That selector is not valid CSS: ${rootOverride}` };
    if (!hits) return { err: `That selector matches nothing on this page: ${rootOverride}` };
    root = rootOverride;
  }
  const tpl = buildTemplate(type, root, desc.fields || {}, {});
  if (!tpl) return { err: `Could not build a ${type} mapping from that.` };

  let saved;
  try { saved = await saveMappingEntry(tpl, { refreshUi: false }); }
  catch (e) { return { err: 'Could not save it: ' + e.message }; }
  if (saved && saved.cancelled) return { err: 'Not saved — the role question was declined.' };

  const res = await applyMappingsBatch([{
    type: tpl.type, primary: tpl.primary, firstArg: tpl.firstArg,
    config: tpl.config, overwriteRole: tpl.overwriteRole,
  }]);
  const verdict = describeApply(res, tpl);
  loadMappingsList();

  // Keep it as ground truth too.
  //
  // fixtures/step.labels.json is the corpus verify-detect scores against, and
  // its own header insists it be written by reading the markup rather than by
  // running the tool and blessing the output — "a corpus built from the tool's
  // own output can only ever score 100%". A label you typed is exactly that
  // kind of source: you looked at the page and said what it is.
  //
  // Kept locally and exported on request; nothing writes the fixture directly.
  rememberLabel({
    type,
    root,
    fields: desc.fields || {},
    matches: (desc.counts && desc.counts[Object.keys(desc.fields || {})[0]]) || undefined,
    why: desc.why || 'named by hand during a scan',
    url: (stop && stop.url) || currentHostname,
  });

  return {
    found: {
      id: `s${stop.n}L${marks.join('_')}`,
      label: `${type} — you named it`,
      type,
      sel: desc.root,
      why: (desc.why || 'measured from what you ticked') + (verdict.ok ? '' : ' · ' + verdict.msg),
      needsWork: true,
      done: true,          // already saved and applied; not work for a later stage
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  What is on screen — one stage at a time
// ─────────────────────────────────────────────────────────────────────────────
//
// The two AI routes share every result panel, and until now every one of them
// showed and hid itself: roughly twenty-five `style.display` writes over six
// containers, with no single place deciding. Nothing enforced exclusion, so the
// Whole-page route ended up stacking the sections list, a pending review card
// and a session-wide "approved and applied" list all at once — not by design,
// but because no line of code was responsible for the question.
//
// setStage is that line. It is the ONLY writer of `display` for these six, and
// a test in verify-sweep.mjs fails the build if anything else writes one, which
// is what stops the stack coming back.
const STAGE_PANELS = {
  screens:    ['sweepPicks'],      // Whole page · which sections to search
  components: ['sweepPicks'],      // Whole page · which components to build
  found:      ['aiResults'],       // Automatic · what is on this section
  cards:      ['aiMappings'],      // either · one card at a time
  review:     ['aiBulkReview'],    // either · approve a batch
  applied:    ['aiApproved'],      // either · what this batch did
  none:       [],
};
const STAGE_IDS = ['aiResults', 'aiMappings', 'aiBulkReview', 'sweepPicks', 'aiApproved'];

// The trail, per route. Manual has no stages; Automatic and Whole page each
// have their own three, and the words differ because the work differs — you
// search SCREENS on one and read one section on the other.
// Numbered, and named after what you DO at each one rather than what lives
// there. "SCREENS › COMPONENTS › APPLIED" are three nouns of equal weight, and
// which of the three you are standing on was carried entirely by an underline —
// reported as not knowing what stage you are at. A number is not decoration
// here: it is the answer to "how far through this am I", which three nouns
// cannot give however they are styled.
const STAGE_TRAIL = {
  sweep: [['screens', 'Pick sections'], ['components', 'Choose fixes'], ['applied', 'Applied']],
  auto:  [['found', 'Found'], ['cards', 'Review'], ['applied', 'Applied']],
};
// Stages that are a moment inside another stage rather than one of their own.
const STAGE_STANDS_FOR = { review: 'cards' };

let currentStage = 'none';

function setStage(stage) {
  if (!STAGE_PANELS[stage]) stage = 'none';
  currentStage = stage;
  const show = STAGE_PANELS[stage];
  for (const id of STAGE_IDS) {
    const el = document.getElementById(id);
    if (el) el.style.display = show.includes(id) ? 'block' : 'none';
  }
  renderStageTrail();
}

/**
 * Where you are and how to get back.
 *
 * This replaces the numbered captions, which were `::before` content on shared
 * containers — so the Whole-page route was labelled "1 · Found on this section"
 * over a list of twenty-six sections it had not read yet.
 */
function renderStageTrail() {
  const host = document.getElementById('stageTrail');
  if (!host) return;
  const trail = STAGE_TRAIL[mapMode === 'sweep' ? 'sweep' : 'auto'];
  const at = STAGE_STANDS_FOR[currentStage] || currentStage;
  const idx = trail.findIndex(([k]) => k === at);
  if (mapMode === 'manual' || idx < 0) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = '';
  host.innerHTML = trail.map(([key, label], i) => {
    // Reachable if it HAS something, not if it happens to be behind you.
    //
    // The first rule was "only a stage you have already been through", which
    // reads sensibly and is wrong the moment you use it: go back to Screens and
    // Components is suddenly ahead of you and dead, even though the components
    // are sitting right there. Reported as "I clicked one and then I cannot
    // click the rest". Direction is not what makes a stage available — content
    // is, and the current stage is the only one that is never a control.
    const state = i === idx ? 'at' : stageHasContent(key) ? 'open' : 'empty';
    const tag = state === 'open' ? 'button' : 'span';
    const attrs = state === 'open' ? ` type="button" data-stage="${key}"` : '';
    // The step number is part of the label, not an ornament beside it, so it
    // survives being read aloud and being read at a glance. "Step 2 of 3,
    // current" is what the stage actually is.
    const where = i === idx ? ` aria-current="step"` : '';
    return `<${tag} class="crumb is-${state}"${attrs}${where}>` +
           `<span class="crumb-n" aria-hidden="true">${i + 1}</span>` +
           `<span class="crumb-label">${escapeHtml(label)}</span></${tag}>` +
           (i < trail.length - 1 ? '<span class="crumb-sep" aria-hidden="true">›</span>' : '');
  }).join('');
}

/** Is there anything in that stage to go to? */
function stageHasContent(key) {
  const stops = (typeof aiSweep !== 'undefined' && aiSweep.stops) || [];
  if (key === 'screens') return stops.length > 0;
  if (key === 'components') {
    return stops.some((x) => (x.found || []).some((f) => !f.done));
  }
  if (key === 'found') return document.querySelectorAll('#aiCompTrack .ai-comp:not([data-done])').length > 0;
  if (key === 'cards') return document.querySelectorAll('#aiSlideTrack .ai-map-card:not([data-done])').length > 0;
  if (key === 'applied') return document.querySelectorAll('#aiApprovedList .ai-approved-row').length > 0;
  return false;
}

document.addEventListener('click', (e) => {
  const back = e.target.closest('#stageTrail [data-stage]');
  if (!back) return;
  const to = back.dataset.stage;
  if (to === 'screens') { aiSweep.phase = 'screens'; renderSweepScreens(); return; }
  if (to === 'components') { aiSweep.phase = 'components'; renderSweepPicks(); return; }
  if (to === 'found') { setStage('found'); return; }
  if (to === 'cards') { setStage('cards'); return; }
  setStage(to);
});

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
const $modeSweepBtn = document.getElementById('modeSweepBtn');
const $modeHint = document.getElementById('modeHint');

let mapMode = 'manual';

// 'manual' | 'auto' | 'sweep'. The two AI routes share every result panel below
// — the inventory cards, the mapping carousel, the approval screen — and differ
// only in what starts them, so `isAi` rather than `isAuto` is what most of this
// function is asking about.
function setMapMode(mode) {
  mapMode = mode;
  const isAuto = mode === 'auto';
  const isSweep = mode === 'sweep';
  const isAi = isAuto || isSweep;
  for (const [btn, on] of [[$modeManualBtn, mode === 'manual'],
                           [$modeAutoBtn, isAuto],
                           [$modeSweepBtn, isSweep]]) {
    btn?.classList.toggle('active', on);
    btn?.setAttribute('aria-selected', String(on));
  }
  if ($modeHint) {
    $modeHint.textContent =
      isSweep ? 'It scrolls the page itself, one section at a time, and shows you everything it found before any of it is applied.'
      : isAuto ? 'Enter the selector of the parent element only — the rest is worked out for you and shown for approval.'
      : 'Fill each selector yourself.';
  }
  // Show one route at a time. In Automatic mode the type picker, the CSS
  // Selector field, the sub-selector form and the preview are all things you
  // never touch — the AI cards carry their own copies — so hiding them is what
  // actually makes this tab readable, rather than shrinking everything.
  const manualOnly = document.getElementById('manualOnly');
  if (manualOnly) manualOnly.style.display = isAi ? 'none' : '';
  // The sub-selector form and the preview are manual-route panels too, but they
  // sit OUTSIDE #manualOnly in the markup — so hiding that block left them on
  // screen. Open a type in Manual, switch to Automatic, and its Selectors form
  // and Generate Template button stayed under the AI cards. Their display is
  // stashed on the way out and restored on the way back, because which of them
  // was open depends on how far the manual flow had got.
  for (const el of [document.getElementById('subSelectorsSection'),
                    document.getElementById('previewSection')]) {
    if (!el) continue;
    if (isAi) {
      if (el.dataset.manualDisplay === undefined) el.dataset.manualDisplay = el.style.display || '';
      el.style.display = 'none';
    } else if (el.dataset.manualDisplay !== undefined) {
      el.style.display = el.dataset.manualDisplay;
      delete el.dataset.manualDisplay;
    }
  }
  // Each AI route has its own starting line — one scans a container, the other
  // scans everything — and only one of them belongs on screen at a time.
  const runRow = document.getElementById('aiRunRow');
  if (runRow) runRow.style.display = isAuto ? '' : 'none';
  const sweepRow = document.getElementById('sweepOnly');
  if (sweepRow) sweepRow.style.display = isSweep ? '' : 'none';
  // The assistant is a dialog now — it is opened on demand, not shown by
  // display, and leaving the AI routes must dismiss it rather than strand it.
  // Show a results panel only when it holds actual results. #aiResults has a
  // fixed shell (summary, list, buttons), so testing its own innerHTML would
  // always be truthy and leave an empty box with a dead button sitting there.
  // Count the CARDS, not the container. Both panels now hold a static carousel
  // shell, so testing the wrapper's children is always truthy and would leave
  // an empty carousel with dead arrows on screen.
  // ONE stage on screen. Restoring both — which is what happened when each had
  // content and they were toggled independently — puts the found list and the
  // mapping cards up together: two carousels with two positions again.
  // Whichever stage still has work to do is the one that comes back — and only
  // that one. setStage decides; nothing here writes display itself.
  if (!isAi) {
    setStage('none');
  } else if (isSweep && aiSweep.stops.length) {
    // Re-drawn rather than merely un-hidden. Testing for a pending row alone
    // missed the case where every screen read is already done: the survey is
    // still there, the completed drawer and the unread sections are still worth
    // seeing, and the panel came back empty.
    if (aiSweep.phase === 'components') renderSweepPicks(); else renderSweepScreens();
  } else {
    setStage(resumeStage());
  }
  // Leaving the sweep running while its own controls are hidden means a page
  // scrolling by itself with no way to stop it. Switching route stops it.
  if (!isSweep && aiSweep.running) aiSweep.abort = true;
}

/** Which stage still has work in it, for coming back to a route. */
function resumeStage() {
  if (document.querySelectorAll('#aiSlideTrack .ai-map-card:not([data-done])').length) return 'cards';
  if (document.querySelectorAll('#aiCompTrack .ai-comp:not([data-done])').length) return 'found';
  // Count the ROWS. The section is a <details> with a summary and a list in
  // the markup, so it always has children — which made it show itself even
  // when it had nothing to report.
  if (document.querySelectorAll('#aiApprovedList .ai-approved-row').length) return 'applied';
  return 'none';
}

// The key settings buttons in both AI modes used to open a modal. There is no
// modal any more — the key is a section in Setup — so they go there, the same
// way a locked mode pill does. One destination, however you arrive at it.
for (const id of ['aiSettingsBtn', 'sweepSettingsBtn']) {
  document.getElementById(id)?.addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="setup"]')?.click();
    document.getElementById('aiKeySection')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

$modeManualBtn?.addEventListener('click', () => setMapMode('manual'));
// ── The two modes that cost money need a key before they mean anything ──────
//
// Both AI modes were freely selectable without one. Pressing either put you in
// front of the whole flow — the estimate, the tick list, the button — and the
// key was asked for at the LAST step, by a dialog, after all the choosing was
// done. "Paste your Anthropic API key first" is a fine sentence in the wrong
// place: it arrives once you have already decided what to spend.
//
// So the gate moves to the door. A locked mode says it is locked, says what
// unlocks it, and pressing it takes you to the place that unlocks it rather
// than simply refusing.
//
// `aiUnlocked` is declared with the rest of the module state at the top of the
// file, NOT here beside the function that owns it. Boot calls this at line
// ~2300 and this is line ~4590: a `let` is not hoisted-initialised, so the
// write below landed in the temporal dead zone, threw, and threw AGAIN out of
// the catch that was supposed to handle it. See the note up there.
async function refreshAiLocks() {
  try { aiUnlocked = !!(await U1AI.getKey()); } catch { aiUnlocked = false; }
  // The key section is a set-once field. Open while there is nothing in it —
  // it is the thing standing between you and two of the three Picker modes —
  // and folded away once there is, where it says only that it is saved.
  const det = document.getElementById('aiKeyDetails');
  if (det) det.open = !aiUnlocked;
  const flag = document.getElementById('aiKeyFlag');
  if (flag) {
    flag.textContent = aiUnlocked ? 'saved' : 'needed';
    flag.className = 'section-flag ' + (aiUnlocked ? 'is-ok' : 'is-needed');
  }
  for (const btn of [$modeAutoBtn, $modeSweepBtn]) {
    if (!btn) continue;
    btn.classList.toggle('is-locked', !aiUnlocked);
    // Not `disabled`. A disabled button is skipped by the keyboard and says
    // nothing about why — and this one has something to say and somewhere to
    // send you, which is the entire point of it.
    btn.setAttribute('aria-disabled', String(!aiUnlocked));
    btn.title = aiUnlocked ? '' : 'Needs an Anthropic API key — press to go and add one';
  }
}

/**
 * True when the mode may be entered. Otherwise: go to where it is unlocked,
 * and say so.
 *
 * Re-reads the key rather than trusting `aiUnlocked`. That flag is written by
 * refreshAiLocks, which is one step in a long boot sequence — and a flag that
 * says "locked" because the step that would have said otherwise did not run is
 * indistinguishable, at the point of the click, from a genuine no. Reported as:
 * clicking the AI tabs sends me to Setup now. Reading storage is one await and
 * removes the entire class of that.
 *
 * It also repaints the buttons, so a wrong answer corrects itself the first
 * time it is pressed instead of persisting for the life of the panel.
 */
async function aiModeAllowed() {
  await refreshAiLocks();
  if (aiUnlocked) return true;
  // Refusing silently is the worst of the three options. The panel simply
  // changed tab, and "why did it do that" is left to be worked out from a
  // section highlight two scrolls away.
  showNotice($aiKeyStatus,
    'That mode calls Claude, so it needs an Anthropic API key. Paste one here and it unlocks.',
    'warn', 8000);
  document.querySelector('.tab-btn[data-tab="setup"]')?.click();
  const box = document.getElementById('aiKeySection');
  const det = document.getElementById('aiKeyDetails');
  if (det) det.open = true;   // being sent to a folded heading explains nothing
  if (box) {
    // Guarded: a throw here would abandon this function before it returns
    // false, and the caller would get a rejected promise instead of "no".
    // Scrolling is the least important thing this does.
    try { box.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); } catch {}
    // A tab change and a scroll is a lot of movement with no stated cause, so
    // the thing you were sent to says, briefly, that it is the thing.
    box.classList.add('is-calling');
    setTimeout(() => box.classList.remove('is-calling'), 2200);
  }
  return false;
}

$modeAutoBtn?.addEventListener('click', async () => { if (await aiModeAllowed()) setMapMode('auto'); });
$modeSweepBtn?.addEventListener('click', async () => { if (await aiModeAllowed()) setMapMode('sweep'); });



// ─────────────────────────────────────────────────────────────────────────────
//  AI MODE — two stages, and the specialist decides at both.
//
//  Stage 1  "Find what's on this page": screenshot with a number drawn on
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

const $aiResults = document.getElementById('aiResults');
const $aiStatus = document.getElementById('aiStatus');
// The key now lives in Setup, and its notices have to appear THERE — $aiStatus
// is the Picker's own status line and is on a tab you are not looking at.
const $aiKeyStatus = document.getElementById('aiKeyStatus');
const $aiKeyRow = document.getElementById('aiKeyRow');
const $aiKeyInput = document.getElementById('aiKeyInput');

let aiFound = null;     // stage 1 result + the element context it was based on
let aiMapped = [];      // stage 2 cards, index-aligned with the DOM cards
// The site the results on screen belong to. Everything in this workspace is
// selectors from ONE page; carrying it to another site is how one client's
// mappings end up filed under another client's hostname.
let aiWorkspaceHost = null;

/**
 * Throws away every AI result on screen and in memory.
 *
 * Called whenever the panel changes site. The panel outlives the tab: switch
 * from one client to the next and the previous scan stayed on screen, still
 * actionable — and "Make all of these accessible" would have saved a whole
 * page of one client's selectors into the other client's mappings file, then
 * auto-applied them there on every panel open.
 */
/**
 * True when the results on screen were scanned on the site now being looked at.
 *
 * The last line of defence before anything is written. A stale workspace is not
 * a cosmetic problem: these selectors would be saved under whatever hostname is
 * current, which is a different client's file.
 */
function aiWorkspaceMatchesSite() {
  return !aiWorkspaceHost || aiWorkspaceHost === currentHostname;
}

function warnWrongSite(statusEl) {
  showNotice(statusEl,
    `These results were scanned on ${aiWorkspaceHost}, and you are now on ${currentHostname}. ` +
    `Saving them here would file one site's components under the other. Scan this page instead.`,
    'error', 10000);
  resetAiWorkspace();
}

function resetAiWorkspace() {
  aiFound = null;
  aiMapped = [];
  aiBulk = { running: false, abort: false, failed: [], armed: false };
  // A sweep in flight is scrolling the page, so clearing the workspace under it
  // has to stop it too — and its stops index into the aiMapped that just went.
  aiSweep.abort = true;
  aiSweep = { running: false, abort: false, phase: 'screens', stops: [] };
  aiWorkspaceHost = null;
  const hide = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
  const empty = (id) => { const el = document.getElementById(id); if (el) el.innerHTML = ''; };
  hide('aiResults'); hide('aiMappings'); hide('aiApproved'); hide('aiBulkReview');
  hide('sweepLog'); hide('sweepPicks');
  empty('aiCompTrack'); empty('aiSlideTrack'); empty('aiApproved');
  empty('aiBulkList'); empty('aiBulkSummary'); empty('aiSummary'); empty('sweepLog');
  empty('sweepPicksList'); empty('sweepPicksSummary');
}
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
  // The names the page actually carries, straight off the elements. Without
  // these the set is only what robustSelector chose to EMIT — and it prefers
  // #id, so for <div class="tab-bar" id="faqTabs"> the class `.tab-bar` was in
  // no produced selector and was reported as invented while sitting on the
  // page. That is the tool refusing to map something it can see.
  for (const t of (context.tokens || [])) knownTokens.add(t);
  for (const s of known) for (const t of (s.match(TOKEN) || [])) knownTokens.add(t);

  const invented = [];
  for (const branch of norm.split(',')) {
    if (known.has(branch)) continue;
    for (const t of (branch.match(TOKEN) || [])) if (!knownTokens.has(t)) invented.push(t);
  }
  if (invented.length) {
    const list = [...new Set(invented)];
    // The set that proves it wrong is the set that can put it right, and
    // "handle this one by hand" is the tool declining to use what it holds.
    const near = list.map((t) => nearestToken(t, knownTokens)).filter(Boolean);
    return {
      ok: false,
      why: `invented — ${list.join(', ')} is on no element we found on the page` +
           (near.length ? ` — did you mean ${[...new Set(near)].join(', ')}?` : ''),
      suggest: [...new Set(near)],
    };
  }
  return { ok: true, value: norm };
}

/**
 * The known token closest to one that is not known, or '' when nothing is near.
 *
 * Ordinary edit distance, capped: `.tab-bar` against a page holding
 * `.tab-bar__btn` should offer it, while `.completely-different` should offer
 * nothing rather than the least-bad of a hundred unrelated names.
 */
function nearestToken(bad, knownTokens) {
  const a = String(bad || '');
  if (!a) return '';
  let best = '', bestD = Infinity;
  for (const t of knownTokens) {
    // Only compare like with like — a class is never the answer for an id.
    if (t[0] !== a[0]) continue;
    const d = editDistance(a, t);
    if (d < bestD) { bestD = d; best = t; }
  }
  // Half the length, so short names need a close match and long ones may differ
  // by a suffix — which is what BEM does.
  return bestD <= Math.max(2, Math.floor(a.length / 2)) ? best : '';
}

function editDistance(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

// The dialog is only ever about the key, so the row is always there and this
// button does the one thing you actually want beside a password field: let you
// read back what you pasted before committing to it.
document.getElementById('aiKeyToggle')?.addEventListener('click', (e) => {
  if (!$aiKeyInput) return;
  const hidden = $aiKeyInput.type === 'password';
  $aiKeyInput.type = hidden ? 'text' : 'password';
  e.currentTarget.textContent = hidden ? 'Hide' : 'Show';
  $aiKeyInput.focus();
});

// Reflect whether a key is saved, without ever rendering the key back.
async function markKeyState() {
  if (!$aiKeyInput || !globalThis.U1AI) return false;
  const saved = await U1AI.getKey();
  $aiKeyInput.placeholder = saved ? '•••••••• saved — type to replace' : 'sk-ant-…';
  const settings = document.getElementById('aiSettingsBtn');
  if (settings) settings.title = saved ? 'Change the API key' : 'No API key yet — click to add one';
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
    // A first run needs the key, so ask for it up front. After that the dialog
    // is behind ⚙ and the screen belongs to the results.
    if (!hasKey && mapMode === 'auto') await aiModeAllowed();   // sends you to Setup
  } catch {}
})();

// An API key pasted into the instruction box would be sent to Claude as prompt
// text — a real leak, and an easy mistake to make when both fields sit in the
// same panel. Catch it on the way in: move it to the key field and say so,
// rather than letting it sit there looking accepted.
const LOOKS_LIKE_KEY = /\bsk-ant-[A-Za-z0-9_-]{10,}/;

// A key pasted into the wrong field should still end up saved rather than sent
// somewhere it does not belong. The instruction box is gone, so this now only
// guards the key field: strip anything around the key and keep the key.
$aiKeyInput?.addEventListener('input', () => {
  const val = $aiKeyInput.value;
  if (!LOOKS_LIKE_KEY.test(val) || LOOKS_LIKE_KEY.exec(val)[0] === val.trim()) return;
  $aiKeyInput.value = (val.match(LOOKS_LIKE_KEY) || [])[0];
});

document.getElementById('aiKeySave')?.addEventListener('click', async () => {
  const val = ($aiKeyInput.value || '').trim();
  if (!val) { showNotice($aiKeyStatus, 'Paste a key first.', 'error', 3000); return; }
  await U1AI.setKey(val);
  $aiKeyInput.value = '';
  $aiKeyInput.placeholder = '•••••••• (saved — type to replace)';
  $aiKeyRow.style.display = 'none';
  showNotice($aiKeyStatus, 'Key saved on this machine.', 'success', 3000);
  // The two locked modes unlock on this press, not on the next panel open.
  await refreshAiLocks();
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
// Scan after a countdown, so a dialog or menu can be opened and LEFT open.
// Pressing anything in this panel moves focus off the page, and a great many
// widgets close on focus-out — which is why "just open it first" does not work
// on its own. The countdown hands the page back to you before the capture.
document.getElementById('aiDelayedBtn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const original = btn.textContent;
  btn.disabled = true;
  for (let n = 5; n > 0; n--) {
    btn.textContent = `⏱ Scanning in ${n}\u2026 open it now`;
    await new Promise(r => setTimeout(r, 1000));
  }
  btn.textContent = original;
  btn.disabled = false;
  document.getElementById('aiDiscoverBtn')?.click();
});

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
    const scopeSel = (document.getElementById('aiScopeInput')?.value || '').trim();
    showAiBusy('Reading…', scopeSel ? `Looking inside ${scopeSel}.` : 'Looking at what is on screen.');
    btn.textContent = 'Reading…';

    // Drop what this site has already settled. The same page gets scanned again
    // and again to reach things that only exist while open, and re-listing what
    // was skipped or already mapped is how that becomes tedious. Filtering here
    // rather than after the answer also means no tokens are spent on them.
    const handled = await alreadyHandled();

    // ONE region, ONE call. Sixty candidates is the collector's cap, so a whole
    // page either summarises the widget you actually care about away or costs a
    // call per section — and one answer covering everything is harder to check
    // than five answers covering one region each. Point at a container instead.
    const collected = await collectRegion(tab, scopeSel, handled);
    if (collected.err) { showNotice($aiStatus, collected.err, 'error', 5000); return; }
    if (!collected.candidates.length) {
      showNotice($aiStatus, scopeSel
        ? `Nothing reviewable inside ${scopeSel} — check the selector, and open it if it is a dialog.`
        : 'Nothing reviewable on screen that has not already been mapped or skipped. Scroll to the part you want, or name a container above.',
        'success', 7000);
      return;
    }

    showAiBusy('Claude is looking…', 'Usually 10–30 seconds.');
    btn.textContent = 'Looking…';
    $aiStatus.textContent = 'Usually 10–30 seconds.';
    $aiStatus.className = 'map-mode-hint';
    $aiStatus.style.display = '';

    const part = await U1AI.discover({
      screenshot: collected.shot,
      // These were being dropped, so every prompt said "Page: (untitled)", an
      // empty URL, and — worse — the literal "The page has NO headings at all."
      // even on pages full of them. The heading-order rule was being fed a lie.
      context: {
        candidates: collected.candidates,
        headings: collected.headings,
        title: collected.title,
        url: collected.url,
      },
      scope: scopeSel || undefined,
    });
    if (!part || part.err) { showNotice($aiStatus, part?.err || 'No answer from the model.', 'error', 8000); return; }

    aiCost += U1AI.estimateCost(part.usage) || 0;
    const mergedContext = { candidates: collected.candidates, tokens: collected.tokens || [] };
    let found = part.components || [];

    // You pointed at ONE element. Handle that element.
    //
    // Typing `.signin` and pressing Scan it came back with three components,
    // because everything inside a container is, technically, inside it — the
    // dropdown, the Register link, the wrapper. All true, none of them what was
    // asked. The scoped box is a way of saying "this one", and answering with an
    // inventory means picking your component out of a list you did not want.
    //
    // The others are counted and named, not silently dropped: the scan saw them
    // and that is worth knowing. They are simply not the answer.
    let alsoInside = [];
    if (scopeSel && found.length > 1) {
      const ranked = await inPage(tab.id, (scope, sels) => {
        const el = (s) => { try { return document.querySelector(s); } catch { return null; } };
        const target = el(scope);
        if (!target) return null;
        return sels.map((s) => {
          const node = el(s);
          if (!node) return 2;
          if (node === target) return 0;              // it IS what was asked for
          // Otherwise the outermost thing inside it is the best reading of
          // "this one" — a wrapper's single real widget, rather than its parts.
          return target.contains(node) ? 1 : 2;
        });
      }, [scopeSel, found.map((c) => c.containerSelector)]);

      if (ranked) {
        const best = Math.min(...ranked);
        const keep = [], rest = [];
        found.forEach((c, i) => (ranked[i] === best ? keep : rest).push(c));
        // Several equally-good candidates means the scope really is a wrapper
        // round separate widgets, and listing them all is the honest answer.
        if (keep.length === 1) { found = keep; alsoInside = rest; }
      }
    }

    const out = { components: found, usage: part.usage,
                  skipped: collected.skipped, scope: scopeSel || '',
                  alsoInside: alsoInside.map((c) => c.label || c.containerSelector) };
    if (!out.components.length) {
      showNotice($aiStatus, scopeSel
        ? `Nothing worth mapping inside ${scopeSel}.`
        : 'Nothing worth mapping on screen right now.', 'success', 7000);
      return;
    }
    const context = mergedContext;

    // Deliberately NOT re-marking here. The 👁 buttons work off each row's
    // container selector, so they need nothing on the page — and re-marking
    // left data-u1-mark attributes scattered across the site's DOM, which both
    // pollutes what the specialist is inspecting and lands in any markup they
    // copy out of DevTools.
    aiFound = { ...out, context };
    // Stamp the site these selectors came from. onTabChanged clears the
    // workspace on a switch, but the panel can also be looking at a tab that
    // changed under it — so the act of saving checks this again.
    aiWorkspaceHost = currentHostname;
    renderAiComponents(aiFound);
    $aiStatus.style.display = 'none';
  } catch (err) {
    showNotice($aiStatus, 'Failed: ' + err.message, 'error', 6000);
  } finally {
    clearAiBusy();
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

/**
 * Collect one region for the model: the candidates inside `scopeSel`, or what is
 * on screen when no container is given, plus the numbered screenshot of it.
 *
 * One region, one call. The collector caps at sixty candidates, so pointing at a
 * container is not a limitation to work around — it is what keeps the widget you
 * care about from being summarised away, and it keeps each answer small enough
 * to actually check.
 *
 * `opts.drop(candidate)` is an extra filter applied before anything is captured
 * or sent, so what it rejects costs nothing. The sweep uses it to leave out the
 * sticky header it already dealt with on the first section.
 *
 * `opts.thumb` also takes a picture WITHOUT the pink numbers on it. That one is
 * never sent anywhere — it is what the approval screen shows beside "screen 4"
 * so a row can be placed on the page without scrolling back to find it.
 *
 * `opts.surveyOnly` stops before the part that costs anything: the candidates
 * are collected (that is in-page code, free and instant) and the plain picture
 * is taken, but the numbers are never drawn and the big screenshot for the model
 * is never made. It is what lets the sweep photograph fifteen sections in
 * twenty seconds so you can choose which of them is worth paying to read.
 */
async function collectRegion(tab, scopeSel, handled, opts) {
  // COLLECTION is free — it is in-page code and nothing leaves the browser —
  // so both the survey and the read collect the whole section. The token budget
  // belongs to the model call, and it is applied there, in batches, so that a
  // section bigger than one batch costs another call instead of losing its tail.
  //
  // It used to be applied here, as a blind head-cut at sixty in DOM order. A
  // 97-element section was surveyed as "6 menus · form · dialog? · carousel?"
  // and then read as its first sixty elements: the whole sticky header and the
  // top of the mega menu, stopping before the form and the carousel ever came
  // into view. They were not mis-detected and not filtered — they were never
  // collected. The survey had seen them, the estimate had charged for them, and
  // nothing anywhere said that thirty-seven elements had been dropped.
  const limit = SWEEP_COLLECT_MAX;
  const context = await inPage(tab.id,
    (n, within) => window.__u1SelectorIntel.collectCandidates(n, within), [limit, scopeSel || null]);
  if (!context) return { err: 'Could not read the page.' };
  if (!context.candidates || !context.candidates.length) {
    return { candidates: [], headings: [], skipped: 0 };
  }

  const drop = (opts && opts.drop) || null;
  const before = context.candidates.length;
  const bin = (handled && handled.dismissed) || new Set();
  let dismissedOut = 0;
  const candidates = context.candidates.filter((c) => {
    if (c.selector && handled.has(c.selector)) {
      if (bin.has(c.selector)) dismissedOut++;
      return false;
    }
    return !(drop && drop(c));
  });
  const skipped = before - candidates.length;
  if (!candidates.length) return { candidates: [], headings: [], skipped, dismissed: dismissedOut };

  // The survey's own picture, with a labelled box round each component that was
  // recognised. It is what the sections list is chosen from, so it shows the
  // finding rather than describing it — and it costs nothing, because drawing
  // and capturing never involve the model.
  let thumb = null;
  // captureVisibleTab photographs the tab in FRONT of the window, whatever id
  // it is handed. A survey keeps running while you work in another tab, so
  // taking the picture anyway would file a photograph of a different page
  // against this section. No picture is honest; the wrong one is not.
  // With the background camera attached the picture is always of THIS tab, so
  // there is nothing to guard against. Without it, a thumbnail of whatever the
  // user happens to be looking at is worse than no thumbnail.
  if (opts && opts.thumb && !sweepCam.attached && !(await pinnedTabIsVisible(tab))) {
    opts = { ...opts, thumb: false };
  }
  if (opts && opts.thumb) {
    try {
      // Including what the PROBE found. The boxes were drawn from the read
      // candidates alone, so a component discovered by pressing it was named in
      // the text and drawn nowhere — on a page where reading finds nothing,
      // that is every box on the picture.
      const drawn = candidates.concat((opts.observed || []).map((c) => ({
        mark: null, selector: c.root, component: c.type, maybe: false, observed: true,
      })));
      await inPage(tab.id, (list) => window.__u1SelectorIntel.drawComponentMarks(list), [drawn]);
      await new Promise(r => setTimeout(r, 200));   // let the overlay paint
      const shot = await captureScreen(tab, 72);
      // Wide enough for the labels to be readable in the 340px hover preview and
      // the full-size view. A sweep holds one per section for the session.
      thumb = await scaleShot(shot, 760);
    } catch { thumb = null; }   // a missing picture must not stop the survey
    finally { await inPage(tab.id, () => window.__u1SelectorIntel.clearMarks()); }
  }

  if (opts && opts.surveyOnly) {
    // Everything below this line exists to build the model's input. A survey
    // never calls the model, so it stops here — and leaves the page untouched,
    // since the numbers were never drawn.
    return {
      shot: null, thumb, candidates, skipped, dismissed: dismissedOut, truncated: !!context.truncated,
      headings: context.headings || [], title: context.title || '', url: context.url || '',
      tokens: context.tokens || [],
    };
  }

  // Draw the numbers, capture, then clear them again immediately so the page is
  // left as it was even if the request fails.
  await inPage(tab.id, () => window.__u1SelectorIntel.drawMarks());
  await new Promise(r => setTimeout(r, 250)); // let the overlay paint
  let shot = null;
  // The picture IS the request, so it has to be a picture of THIS page. Wait
  // for the page to be in front rather than photographing whatever is, and
  // rather than dying — which is what happened before.
  try {
    const raw = await captureScreen(tab, 85, () => showSweepBusy(
      'Waiting for the page',
      'Without the background camera the scan needs its own tab in front. Switch back and it carries on from here — nothing is lost.'));
    // 1568 is the size Anthropic recommends for maximum image fidelity, and this
    // task does not need it: the model is reading two-digit pink numbers, not
    // fine detail. 1280 keeps them legible and costs about a third fewer tokens.
    shot = raw ? await scaleShot(raw, 1280) : null;
  } catch (err) {
    // One section that could not be photographed is one section lost. The
    // loop above knows how to skip a screen and carry on; a throw from here
    // reached the run's outer catch and ended everything.
    shot = null;
  } finally {
    // `keepMarks` leaves the numbers on the page. They are the only binding
    // between a row in the panel and an element in the page — clearMarks strips
    // the attribute — so anything that wants to ask "which element is number 7"
    // after the capture has to hold onto them. The caller that does is the
    // labelling pause; everyone else still gets the page left as it was found.
    if (!(opts && opts.keepMarks)) {
      await inPage(tab.id, () => window.__u1SelectorIntel.clearMarks());
    }
  }
  if (!shot) return { err: 'Could not capture the page.' };

  return {
    shot, thumb, candidates, skipped, dismissed: dismissedOut,
    headings: context.headings || [],
    title: context.title || '',
    url: context.url || '',
    // Carried so a candidate's `box` — which is in CSS pixels — can be turned
    // into a crop rectangle on `shot`, which is a scaled capture. Without the
    // width it was taken at, the two coordinate systems cannot be related.
    viewport: context.viewport || null,
    // Every id, class and tag actually on the page. checkAiSelector needs them
    // to tell a real name from an invented one, and the selector fields need
    // them to offer anything at all — dropping them here is why `.tab-bar` was
    // refused while sitting on the page.
    tokens: context.tokens || [],
  };
}


// Something to look at while it works. A panel that sits still for thirty
// seconds reads as broken, and the two slow steps here are a screenshot and a
// model call — neither of which can report progress, so the least we can do is
// say which one is running.
// `pct` turns the indeterminate sweep bar into a real progress bar. A scan that
// visits twenty sections needs to say how far along it is, or it reads as a
// page scrolling by itself forever.
function showAiBusy(title, sub, pct) {
  const results = document.getElementById('aiResults');
  const track = document.getElementById('aiCompTrack');
  if (!results || !track) return;
  results.style.display = 'block';
  const head = track.previousElementSibling;
  if (head) head.style.display = 'none';
  document.getElementById('aiSummary').innerHTML = '';
  const determinate = typeof pct === 'number' && isFinite(pct);
  const clamped = determinate ? Math.max(0, Math.min(100, Math.round(pct))) : 0;
  track.innerHTML = `
    <div class="ai-busy">
      <div class="ai-busy-bar${determinate ? ' determinate' : ''}">
        <span${determinate ? ` style="width:${clamped}%"` : ''}></span>
      </div>
      <div class="ai-busy-title">${escapeHtml(title)}${determinate ? ` — ${clamped}%` : ''}</div>
      <div class="ai-busy-sub">${escapeHtml(sub || '')}</div>
      ${[0, 1, 2].map(() => '<div class="ai-skel"></div>').join('')}
    </div>`;
}

/**
 * Take the spinner down.
 *
 * showAiBusy writes itself into the results track, and the success path
 * overwrites it by rendering the components. Every OTHER path did not: "nothing
 * reviewable inside .click-nav", "nothing worth mapping", a failed call — each
 * returned early and left the spinner turning over an empty panel with the real
 * message somewhere below it. Pressing Scan it and watching nothing happen was
 * the tool working correctly and saying so underneath a spinner.
 *
 * Only clears if the busy markup is still what is in the track, so calling it
 * after a successful render cannot wipe the results.
 */
function clearAiBusy() {
  const track = document.getElementById('aiCompTrack');
  if (!track || !track.querySelector('.ai-busy')) return;
  track.innerHTML = '';
  const results = document.getElementById('aiResults');
  if (results && !document.querySelector('#aiCompTrack .ai-comp')) {
    results.style.display = 'none';
  }
}

function showMapBusy(label, n, total) {
  const track = document.getElementById('aiSlideTrack');
  if (!track) return;
  // It used to bail whenever a card was already in the track, which meant the
  // FIRST component showed progress and every one after it left the panel
  // standing empty — an outlined box with a heading and nothing in it. The
  // placeholder is its own element, so it can sit alongside finished cards.
  clearMapBusy();
  const holder = document.createElement('div');
  holder.id = 'aiMapBusyHost';
  track.appendChild(holder);
  holder.innerHTML = `
    <div class="ai-busy" id="aiMapBusy">
      <div class="ai-busy-bar"><span></span></div>
      <div class="ai-busy-title">Working out ${escapeHtml(label)} (${n} of ${total})</div>
      <div class="ai-busy-sub">Reading its markup and its click handlers.</div>
      ${[0, 1, 2, 3].map(() => '<div class="ai-skel"></div>').join('')}
    </div>`;
  // Existing cards are hidden while this runs, or the placeholder appears below
  // a card and nobody scrolls to it.
  track.querySelectorAll('.ai-map-card').forEach(c => { c.style.display = 'none'; });
}

function clearMapBusy() {
  document.getElementById('aiMapBusyHost')?.remove();
  document.getElementById('aiMapBusy')?.remove();
}

// The sweep's progress, in its own panel rather than Automatic mode's.
//
// It used to call showAiBusy, which draws into #aiCompTrack — inside #aiResults,
// which also holds "✨ Make all of these accessible" and "Clear". A running
// sweep therefore showed two buttons from the other route, both of which would
// have acted on an empty inventory. Same look, its own container.
// A clock on the current step.
//
// "It has been five minutes on the last screen — how do I know what state it is
// in?" A percentage answers how far along the RUN is and says nothing about
// whether this step is alive. Under a line reading "usually 10-30 seconds", an
// elapsed count of 4:37 is the whole answer, and it needs no interpretation.
let sweepBusyTimer = null;

/**
 * The pinned progress banner.
 *
 * `sub` is one short line — this is position:fixed over the panel, so its
 * height is the amount of the panel it hides, and a three-line message covered
 * the list it was reporting on. `long` is the full sentence, on the tooltip:
 * worth saying, not worth three lines of a fixed header on every section of a
 * thirty-section run.
 */
function showSweepBusy(title, sub, pct, long) {
  const host = document.getElementById('sweepBusy');
  if (!host) return;
  // Pinned for the duration, because the picks list below it is long enough
  // that the progress bar sits off-screen for the whole run.
  host.classList.add('pinned');
  const determinate = typeof pct === 'number' && isFinite(pct);
  const clamped = determinate ? Math.max(0, Math.min(100, Math.round(pct))) : 0;
  host.innerHTML = `
    <div class="ai-busy">
      <div class="ai-busy-bar${determinate ? ' determinate' : ''}">
        <span${determinate ? ` style="width:${clamped}%"` : ''}></span>
      </div>
      <div class="ai-busy-title">${escapeHtml(title)}${determinate ? ` — ${clamped}%` : ''}</div>
      <div class="ai-busy-sub" title="${escapeHtml(long || sub || '')}">${escapeHtml(sub || '')} <span class="ai-busy-clock" id="sweepBusyClock">0:00</span></div>
    </div>`;

  // Restarted per step, because the number that matters is how long THIS step
  // has taken — a total would keep rising through a run that is behaving.
  clearInterval(sweepBusyTimer);
  const startedAt = Date.now();
  const paint = () => {
    const el = document.getElementById('sweepBusyClock');
    if (!el) { clearInterval(sweepBusyTimer); return; }
    const secs = Math.round((Date.now() - startedAt) / 1000);
    el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    el.classList.toggle('is-long', secs > 60);
  };
  sweepBusyTimer = setInterval(paint, 1000);
  paint();
}

function clearSweepBusy() {
  clearInterval(sweepBusyTimer);
  sweepBusyTimer = null;
  const host = document.getElementById('sweepBusy');
  if (host) { host.innerHTML = ''; host.classList.remove('pinned'); }
  markScreenReading(null);
}

/**
 * Which section is being read, marked in the list itself.
 *
 * The percentage says how far along a run is; this says where it is. On a list
 * of twenty-six that is the difference between "something is happening" and
 * "that one, the one I am looking at".
 */
/**
 * A section that has just been read, marked in the list as it happens.
 *
 * Nothing updated the list during a run: it stayed exactly as it was ticked, so
 * ten sections in, the ten already paid for still looked like work to do — and
 * pressing Read again read them a second time. Reported as "if it already read
 * this, why does it need to again", which is the right question.
 *
 * In place rather than a re-render: twenty-six rows carry twenty-six
 * screenshots, and rebuilding them mid-run would throw away the scroll position
 * of the list you are watching.
 */
function markScreenRead(stop) {
  stop.failed = null;
  const row = document.querySelector(`#sweepPicksList .sweep-screen[data-screen="${stop.n}"]`);
  if (row) {
    row.classList.remove('is-failed');
    row.querySelector('.sweep-fail-flag')?.remove();
    row.querySelector('.sweep-outcome')?.remove();
    row.classList.add('is-done');
    const tick = row.querySelector('.sweep-screen-tick');
    if (tick) tick.checked = false;
    const label = row.querySelector('.ai-approved-label');
    if (label && !label.querySelector('.sweep-read-flag')) {
      label.insertAdjacentHTML('beforeend', ' <span class="sweep-read-flag">completed</span>');
    }
    // And what it gave. A completed section with no result on it answers "is it
    // done" and not "was it worth it", and the second is the one you need when
    // deciding whether to carry on.
    const body = row.querySelector('.ai-bulk-body');
    if (body && stop.outcome && !body.querySelector('.sweep-outcome')) {
      body.insertAdjacentHTML('beforeend',
        `<div class="sweep-outcome">${escapeHtml(stop.outcome)}</div>`);
    }
  }
  // …and moves into the completed area, now, rather than staying where it was
  // until the run ends. Screen 1 finished and was still sitting under "still to
  // search" while the drawer below said COMPLETED · 3 — so the drawer was
  // answering for the previous run and this one was invisible in it.
  //
  // The node is moved rather than the list redrawn: twenty-six rows carry
  // twenty-six screenshots, and rebuilding them would throw away the scroll
  // position of the list being watched. The one case that needs a redraw is the
  // first completion, when the two areas do not exist yet.
  const done = document.querySelector('#sweepPicksList .sweep-part-done');
  if (row && done) {
    done.appendChild(row);
    const left = document.querySelector('#sweepPicksList .sweep-part > h4');
    const stops = aiSweep.stops || [];
    if (left) left.textContent = `Still to search · ${stops.filter(x => x.count && !x.scanned).length}`;
    const head = done.querySelector('summary');
    if (head) {
      const readNow = stops.filter(x => x.scanned);
      const found = readNow.reduce((a, x) => a + ((x.found || []).filter(f => !f.done).length), 0);
      head.innerHTML = `Completed · ${readNow.length}` + (found
        ? ` · ${found} component${found === 1 ? '' : 's'} found` +
          `<button class="btn-outline btn-xs" data-build-found>Stop and build these</button>`
        : '');
    }
  } else if (row) {
    renderSweepScreens();
  }

  // The estimate under the list is what the NEXT press will cost, so it has to
  // come down as the run goes.
  syncSweepMakeBtn();
  // And persist it before the next section begins — awaited, not debounced, so
  // stopping after any section leaves that section recorded.
  return saveSweepNow();
}

let sweepReadingNow = null;

/**
 * A screen the run tried and could not finish.
 *
 * It keeps its tick and its place in "still to search", because it really was
 * not searched and pressing again should pick it up. What it gains is the
 * reason — otherwise the only evidence that anything happened to it is a gap in
 * the numbering of the completed drawer.
 */
function markScreenFailed(stop, why) {
  stop.failed = why || 'could not be read';
  const row = document.querySelector(`#sweepPicksList .sweep-screen[data-screen="${stop.n}"]`);
  if (row) {
    row.classList.add('is-failed');
    const label = row.querySelector('.ai-approved-label');
    if (label && !label.querySelector('.sweep-fail-flag')) {
      label.insertAdjacentHTML('beforeend', ' <span class="sweep-fail-flag">not read</span>');
    }
    const body = row.querySelector('.ai-bulk-body');
    if (body && !body.querySelector('.sweep-outcome')) {
      body.insertAdjacentHTML('beforeend',
        `<div class="sweep-outcome">${escapeHtml(stop.failed)} — still ticked, press again to retry</div>`);
    }
  }
  return saveSweepNow();
}

function markScreenReading(n) {
  // Remembered, because the list is redrawn during a run — switching route and
  // back, a restore, the regroup at the end — and a mark that only lives in the
  // DOM comes back attached to whichever row happened to hold it last. That is
  // how the bar could say "section 1" while a row far down the list was lit.
  sweepReadingNow = n;
  document.querySelectorAll('.sweep-screen.is-reading')
    .forEach((r) => r.classList.remove('is-reading'));
  if (n == null) return;
  const row = document.querySelector(`#sweepPicksList .sweep-screen[data-screen="${n}"]`);
  if (!row) return;
  row.classList.add('is-reading');
  try { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
}

// The inventory. Every row's component type and container selector are inputs,
// not labels — a wrong guess is corrected here rather than worked around later.
function renderAiComponents(found) {
  const list = document.getElementById('aiComponentList');
  const comps = found.components || [];
  // The model's prose description of the page told the specialist what they were
  // already looking at. Only the count and what it cost are worth the space.
  document.getElementById('aiSummary').innerHTML =
    `<div class="ai-meta">${comps.length} component${comps.length === 1 ? '' : 's'} found` +
    ` · ${escapeHtml(found.model || '')} · ~$${aiCost.toFixed(3)} this session</div>` +
    // Folded away. It is the same paragraph on every scan, it is read once, and
    // sitting above the results it is only something to scroll past. How many
    // rows were left out earns a place on the summary; the explanation does not.
    // Named, not silently dropped. The scan saw them and that is worth knowing;
    // they are simply not what was pointed at.
    ((found.alsoInside || []).length
      ? `<div class="ai-meta">Also inside ${escapeHtml(found.scope)}, not mapped: ` +
        found.alsoInside.map((n) => escapeHtml(n)).join(', ') +
        ` — scan ${found.alsoInside.length === 1 ? 'it' : 'one of them'} directly to handle ` +
        `${found.alsoInside.length === 1 ? 'it' : 'them'}.</div>`
      : '') +
    `<details class="ai-hint-fold"><summary>What wasn't scanned` +
    (found.skipped ? ` · ${found.skipped} left out` : '') + `</summary>` +
    `<div class="ai-hint-line">Only ${found.scope ? `<code>${escapeHtml(found.scope)}</code>` : 'what was on screen'}` +
    ` was scanned. A dialog, dropdown or datepicker that is closed does not exist in the page
      yet — open one and use <strong>⏱ Scan in 5s</strong>, or name it in the container box.` +
    (found.skipped ? ` <strong>${found.skipped}</strong> already mapped or skipped on this site were left out —
      <button class="btn-ghost btn-xs" id="aiResetDismissed">show them again</button>.` : '') +
    `</div></details>`;

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

        <!-- Switch a found element to a type whose first argument is a TRIGGER
             and the element stops being the component: the help button IS the
             thing you click, but the thing to map is the panel it opens. So ask
             for that panel, and file the found element as the trigger. Without
             this the only way through was to give up on the card and start
             again by hand. -->
        <div class="ai-comp-trigger" id="aiCompTrig${i}" style="display:none;">
          <label class="ai-comp-cont-label" for="aiCompCont${i}"></label>
          <div class="ai-comp-cont-line">
            <input type="text" class="ai-comp-cont" id="aiCompCont${i}" placeholder="#help-panel, .modal…">
            <button class="btn-ghost btn-sm ai-comp-conteye" title="Show it on the page">👁</button>
          </div>
          <div class="input-hint ai-comp-cont-hint" style="display:block;"></div>
          <div class="ai-comp-hit" id="aiCompContHit${i}"></div>
        </div>

        <!-- One element, one action. A global tick plus a batch button counted
             selections across the whole list, so pressing it from the card in
             front of you started work on a different component entirely. -->
        <div class="ai-comp-actions">
          <button class="btn-primary" data-mapone="${i}" ${chk.ok ? '' : 'disabled'}>✨ Make this accessible</button>
          <button class="btn-ghost btn-sm" data-skipcomp="${i}" title="Not needed — take it off the list">Skip</button>
        </div>
      </div>`;
  }).join('') || '<div class="advisor-note ok">✅ Nothing found that needs a mapping.</div>';

  setStage('found');
  // Clear the CARDS, not the container: the carousel head and track are static
  // markup now, and wiping innerHTML took them out with the cards.
  document.getElementById('aiSlideTrack').innerHTML = '';
  clearApproved();
  syncAllTriggerFields();
  showCompSlide(0);
  paintAiRowStrength();
}

const showCompSlide = (i) => slideTo('aiComp', i, '.ai-comp', () => paintAiRowStrength());

/**
 * Every mapping for this site, gone. For clearing the board between runs.
 *
 * Destructive and SHARED — these are on the server too, so this is not just
 * this machine's copy — so it says what it will take before it takes it, and
 * offers the export first. A debugging convenience that quietly deletes a
 * colleague's afternoon is not a convenience.
 *
 * Deliberately per-site: `currentHostname` only. Deleting every mapping for
 * every client from a debug button is not a thing anyone should be one press
 * away from.
 */
document.getElementById('deleteAllBtn')?.addEventListener('click', async () => {
  const key = storageKey('mappings', currentHostname);
  const list = (await U1Store.get([key]))[key] || [];
  const status = document.getElementById('applyAllStatus');
  if (!list.length) { showNotice(status, 'There are none to delete.', 'info', 4000); return; }

  const dlg = document.getElementById('deleteAllDialog');
  const byType = {};
  for (const m of list) byType[m.custom || m.type || '?'] = (byType[m.custom || m.type || '?'] || 0) + 1;
  document.getElementById('deleteAllBody').innerHTML =
    `<strong>${list.length} mapping${list.length === 1 ? '' : 's'} on ${escapeHtml(currentHostname)}</strong> — ` +
    escapeHtml(Object.entries(byType).map(([t, n]) => `${n} ${t}`).join(', ')) + '.<br><br>' +
    'They go from this computer and from the server, so your colleagues lose them too. ' +
    'The page keeps whatever U1 already applied until it is reloaded.<br><br>' +
    'Export from the Export tab first if you might want them back.';

  const go = await new Promise((resolve) => {
    const done = (v) => {
      dlg.close();
      document.getElementById('deleteAllGo').onclick = null;
      document.getElementById('deleteAllCancel').onclick = null;
      resolve(v);
    };
    document.getElementById('deleteAllGo').onclick = () => done(true);
    document.getElementById('deleteAllCancel').onclick = () => done(false);
    dlg.showModal();
  });
  if (!go) return;

  try {
    // Through set(), not setLocalOnly: the server has to be told, or the next
    // pull brings every one of them straight back.
    await U1Store.set({ [key]: [] });
    showNotice(status, `${list.length} mapping${list.length === 1 ? '' : 's'} deleted. ` +
      `Reload the page to see it without them.`, 'success', 8000);
  } catch (err) {
    // Local went; the server did not. Say which, because "deleted" and
    // "deleted here" are different states and the next pull tells them apart.
    showNotice(status, err.localOnly
      ? `Deleted on this computer. The server still has them (${err.message}) — they will ` +
        `come back on the next pull unless this succeeds.`
      : 'Could not delete them: ' + err.message, 'error', 12000);
  }
  await loadMappingsList();
  refreshExportInfo();
});

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

// Types whose fix() first argument is a TRIGGER rather than the component: the
// element you click is not the element that gets decorated. Read from the
// schemas so a new type cannot be forgotten here.
const triggerFirstType = (type) => {
  const sc = COMPONENT_SCHEMAS[type];
  return !!sc && sc.firstArgFrom === 'trigger' && (sc.fields || []).includes('trigger');
};

// Every type whose schema declares a trigger at all — not just the three that
// swap it into first position. tooltip and keyboard-grid take one too, and the
// card used to offer no way to give it, so the only route was to abandon the
// card and rebuild it by hand in Manual.
const acceptsTrigger = (type) => {
  const sc = COMPONENT_SCHEMAS[type];
  return !!sc && (sc.fields || []).includes('trigger');
};

// Required is the schema's own req list, not "has a trigger". dialog declares a
// trigger but does not require one — a dialog with no opener is a real mapping,
// and the card used to refuse it.
const triggerRequired = (type) => {
  const sc = COMPONENT_SCHEMAS[type];
  return !!sc && (sc.req || []).includes('trigger');
};

/**
 * Reads one discovery card into the row shape the mapping step expects, and
 * says why if it cannot. Shared by the per-card button and the bulk run so the
 * two can never disagree about what a trigger-first type means.
 */
function rowFromCompCard(comp) {
  return rowFromParts({
    type: comp.querySelector('.ai-comp-type').value,
    found: comp.querySelector('.ai-comp-sel').value.trim(),
    container: (comp.querySelector('.ai-comp-cont')?.value || '').trim(),
    label: comp.querySelector('.ai-comp-label').textContent,
    compIndex: comp.dataset.i,
  });
}

/**
 * The same rules, without a card to read them off.
 *
 * The whole-page sweep never draws the inventory cards — it goes straight from
 * the model's answer to preparing each component — so the trigger swap and the
 * required-field check had to stop living inside the DOM reader.
 */
function rowFromParts({ type, found, container, label, compIndex }) {
  // For a trigger-first type the found element is the TRIGGER, and the mapping
  // is rooted on what it opens. Everything downstream expects `sel` to be that
  // root, so swap them here rather than teaching each step about the exception.
  // Any other type that accepts a trigger keeps the found element as the
  // component and files what was entered as the trigger — no swap.
  const swap = triggerFirstType(type) && !!container;
  const row = {
    type,
    sel: swap ? container : found,
    trigger: swap ? found : (acceptsTrigger(type) && container ? container : undefined),
    label,
    compIndex,
  };
  // Block only on what the schema actually requires. dialog declares a trigger
  // but does not require one, and this used to refuse it anyway.
  if (triggerRequired(type) && !container) {
    return { err: `A ${type} needs the element it opens. Open it on the page, then paste its selector.`, focusTrigger: true };
  }
  if (!row.sel || !COMPONENT_SCHEMAS[row.type]) {
    return { err: 'Give this one a container selector and a component type first.' };
  }
  return { row };
}

// Show the container field only when the chosen type needs one. Driven off the
// <select>'s own value rather than the type the scan proposed, because the two
// can differ: a type the AI returns that is not in U1_TYPES leaves the dropdown
// showing its first option instead.
function syncTriggerField(comp) {
  const sel = comp?.querySelector('.ai-comp-type');
  const trig = comp?.querySelector('.ai-comp-trigger');
  if (!sel || !trig) return;
  const type = sel.value;
  trig.style.display = acceptsTrigger(type) ? '' : 'none';
  if (!acceptsTrigger(type)) return;

  // The wording comes from the schema because the relationship is not the same
  // in both directions: for a listbox the entered selector is what the found
  // element OPENS, while for a tooltip it is the element that opens the found
  // one. A single hand-written label was wrong for half of them.
  const sc = COMPONENT_SCHEMAS[type] || {};
  const required = triggerRequired(type);
  const label = trig.querySelector('.ai-comp-cont-label');
  if (label) {
    label.textContent = (sc.desc && sc.desc.trigger) || 'Selector of the trigger element';
    if (required) label.insertAdjacentHTML('beforeend', ' <span class="req-star">*</span>');
  }
  const hint = trig.querySelector('.ai-comp-cont-hint');
  if (hint) {
    hint.textContent = triggerFirstType(type)
      ? 'The element above becomes the trigger. Open it on the page first — a closed panel is not there to point at.'
      : 'The element above stays the component; this is what drives it.';
  }
}

// Every card needs this on first paint, not only after someone touches the
// dropdown. When the scan already classified a component as a trigger-first
// type — a listbox, a modal — no change event ever fired, so the field stayed
// hidden and "Make this accessible" failed on a selector the card gave you no
// way to enter. The error even focused the hidden input.
function syncAllTriggerFields() {
  document.querySelectorAll('#aiCompTrack .ai-comp').forEach(syncTriggerField);
}

// Re-check on every change — the type is a dropdown the specialist is expected
// to correct.
document.getElementById('aiCompTrack')?.addEventListener('change', (e) => {
  const sel = e.target.closest('.ai-comp-type');
  if (!sel) return;
  syncTriggerField(sel.closest('.ai-comp'));
});

// 👁 for the container field.
document.getElementById('aiCompTrack')?.addEventListener('click', async (e) => {
  const eye = e.target.closest('.ai-comp-conteye');
  if (!eye) return;
  const comp = eye.closest('.ai-comp');
  const sel = (comp.querySelector('.ai-comp-cont').value || '').trim();
  const hit = comp.querySelector('[id^="aiCompContHit"]');
  if (!sel || !hit) return;
  eye.disabled = true;
  try {
    const res = await testSelector(sel);
    const n = res && typeof res.count === 'number' ? res.count : null;
    hit.className = 'ai-comp-hit ' + (n === 1 ? 'ok' : n ? 'warn' : 'bad');
    hit.textContent = res && res.err ? res.err
      : n === 0 ? 'Matches nothing — if it only exists while open, open it first.'
      : n === 1 ? '1 match — highlighted on the page.'
      : `${n} matches — highlighted. u1.fix decorates only one of them.`;
    if (n) { await highlightMatch(sel, 0, true); setTimeout(() => highlightMatch(sel, 0, false), 2500); }
  } finally { eye.disabled = false; }
});

// Selectors the specialist has already dealt with on this site, either by
// skipping them or by mapping them. Kept per site, like everything else.
async function dismissedSelectors() {
  try {
    const key = storageKey('dismissed', currentHostname);
    return (await U1Store.get([key]))[key] || [];
  } catch { return []; }
}

async function rememberDismissed(sel) {
  if (!sel) return;
  try {
    const key = storageKey('dismissed', currentHostname);
    const list = (await U1Store.get([key]))[key] || [];
    if (list.includes(sel)) return;
    list.push(sel);
    await U1Store.set({ [key]: list.slice(-300) });
  } catch {}
}

// Everything already settled on this site: skipped, or already mapped.
// Everything the scan should not look at again — and WHY, kept apart.
//
// The two reasons are not equivalent and were being reported as one. "Already
// mapped" is finished work. "Dismissed" is a judgement you made once, months
// ago perhaps, on another machine — dismissals are per-project and shared —
// and it is the only one of the two you might want to take back. A run that
// returns nothing because everything on the page was dismissed must say that
// word, or the only available reading is "the tool found nothing".
async function alreadyHandled() {
  const dismissed = new Set(await dismissedSelectors());
  const out = new Set(dismissed);
  try {
    const key = storageKey('mappings', currentHostname);
    for (const m of (await U1Store.get([key]))[key] || []) {
      if (m && m.primary) out.add(m.primary);
      if (m && m.firstArg) out.add(m.firstArg);
    }
  } catch {}
  // A property on the Set, so every `handled.has(...)` call site is untouched.
  out.dismissed = dismissed;
  return out;
}

// Scan just one part of the page, and reset the skipped list.
// This button was in the markup from the start and wired to nothing — pressing
// it did exactly nothing, with no feedback to say so.
document.getElementById('aiDismissBtn')?.addEventListener('click', () => {
  resetAiWorkspace();
  showNotice($aiStatus, 'Cleared.', 'success', 2500);
});

document.getElementById('aiScopeBtn')?.addEventListener('click', () => {
  document.getElementById('aiDiscoverBtn')?.click();
});
document.getElementById('aiScopeInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('aiDiscoverBtn')?.click(); }
});

document.addEventListener('click', async (e) => {
  if (!e.target.closest('#aiResetDismissed')) return;
  try {
    await U1Store.remove([storageKey('dismissed', currentHostname)]);
    showNotice(document.getElementById('aiStatus'),
      'Skipped items are back on the list. Mapped ones stay out — delete the mapping to see them again.', 'success', 5000);
  } catch {}
});

// Map ONE component, on demand, from its own card. No ticking, no batch: the
// button you press is about the element you are looking at.
document.getElementById('aiCompTrack')?.addEventListener('click', async (e) => {
  // Skip: take this component off the list without mapping it. The scan is a
  // suggestion, and a specialist who can see it is not needed should be able to
  // say so in one click rather than working around it.
  const skipBtn = e.target.closest('[data-skipcomp]');
  if (skipBtn) {
    const comp = skipBtn.closest('.ai-comp');
    comp.dataset.done = '1';
    // Remember it. The same page gets scanned repeatedly — that is how you
    // reach a dialog or a datepicker that only exists while open — and without
    // this every pass hands back the same rows to dismiss again.
    rememberDismissed((comp.querySelector('.ai-comp-sel')?.value || '').trim());
    const left = document.querySelectorAll('#aiCompTrack .ai-comp:not([data-done])').length;
    if (left) showCompSlide(Math.min(carouselAt.aiComp || 0, left - 1));
    else {
      setStage('none');
      showNotice(document.getElementById('aiStatus'),
        'Nothing left on the list. Scan again, or switch to Manual.', 'success', 5000);
    }
    return;
  }

  const btn = e.target.closest('[data-mapone]');
  if (!btn) return;
  const status = document.getElementById('aiMapStatus');
  if (isReadonly()) {
    showNotice(status, 'Licence expired — existing mappings still work and export, but new ones are paused.', 'error', 6000);
    return;
  }

  if (!aiWorkspaceMatchesSite()) { warnWrongSite(status); return; }

  const comp = btn.closest('.ai-comp');
  const built = rowFromCompCard(comp);
  if (built.err) {
    showNotice(status, built.err, 'error', built.focusTrigger ? 6000 : 4000);
    if (built.focusTrigger) comp.querySelector('.ai-comp-cont')?.focus();
    return;
  }
  const row = built.row;

  const tab = await getTab();
  if (!isInjectable(tab)) { showNotice(status, 'Cannot read this page.', 'error', 4000); return; }

  // Ask about the site's own role HERE — on the card where the container and
  // the trigger are chosen — rather than two steps later at Approve & apply.
  //
  // This is the moment the decision is actually about something: you are
  // looking at the element, you have just named it, and the answer changes
  // whether a mapping is worth building at all. Answering it after the mapping
  // card has been generated means generating one that cannot work. The answer
  // rides on the row, so Approve & apply does not ask again.
  const roleAsk = { type: row.type, primary: row.sel };
  if (!(await confirmRoleOverwrite(roleAsk))) {
    showNotice(status, 'Left as it is — no mapping was built.', 'info', 5000);
    return;
  }
  if (roleAsk.overwriteRole) row.overwriteRole = roleAsk.overwriteRole;

  const host = document.getElementById('aiMappings');
  const track = document.getElementById('aiSlideTrack');
  host.style.display = 'block';
  setStage('cards');

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Working…';
  comp.classList.add('is-working');
  showMapBusy(row.label, 1, 1);

  try {
    const prepared = await prepareOne(row, tab);
    clearMapBusy();
    if (prepared.err) {
      track.insertAdjacentHTML('beforeend', aiMapCardError(row, prepared.err));
      showSlide(0);
      return;
    }
    showSlide(slideIndex('aiSlide'));
    document.querySelector(`#aiSlideTrack .ai-map-card[data-card="${prepared.idx}"]`)
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

/**
 * Turns one discovery row into a mapping card: reads the element's markup, asks
 * the model to fill the component's fields, and renders the card.
 *
 * This is the paid step — one network round trip per component — and it is
 * shared by the per-card button and the bulk run so both spend the same way and
 * produce identical cards. The card must land in the DOM: aiCardTemplate reads
 * its values back out of #aiMapForm<idx>, and every per-card affordance (edit a
 * selector, Ask AI, Open in builder) works off it.
 *
 * Returns { idx } or { err }; it never throws for an expected failure, so a
 * bulk loop can record one bad selector and keep going.
 */
async function prepareOne(row, tab) {
  const track = document.getElementById('aiSlideTrack');
  // A menu's root has to be the DIRECT PARENT of the items — u1.fix.menu reads
  // the root's own children. <nav> is the element with the aria-label on it and
  // the one that looks like the answer, so it gets chosen constantly, and its
  // children are a logo, a search box and one <ul>: a menu of one item. Descend
  // to the list. Returns null when there is nothing better, and then we keep
  // what the specialist or the model chose.
  if (row.type === 'menu') {
    const better = await inPage(tab.id, (s) => window.__u1SelectorIntel.menuItemsRoot(s), [row.sel]);
    if (better && better !== row.sel) row.sel = better;
  }
  // A listbox is not a judgement call, so it is not asked as one.
  //
  // Inside the container: the clickable thing is the trigger, because it has the
  // event; the thing that CONTAINS several things is the listbox, because that
  // is the shape. The model has been asked three times and answered wrong three
  // times in three different arrangements — the button as the listbox, the
  // wrapper as the listbox, and the two swapped outright — each with a fluent
  // explanation, each with every field resolving. That is the signature of a
  // question that should be measured instead of asked.
  //
  // Measured here, and it OVERRIDES the answer below rather than filling a gap.
  let lbShape = null;
  if (row.type === 'listbox') {
    lbShape = await inPage(tab.id, (s) => window.__u1SelectorIntel.listboxShape(s), [row.sel]);
    // Read from the container that was pointed at; if that was already the list
    // itself, ask its parent, which is where the trigger lives.
    if (!lbShape) {
      lbShape = await inPage(tab.id, (s) => {
        const el = document.querySelector(s);
        const up = el && el.parentElement;
        return up ? window.__u1SelectorIntel.listboxShape(
          window.__u1SelectorIntel.robustSelector(up)) : null;
      }, [row.sel]);
    }
    if (lbShape) { row.sel = lbShape.listbox; row.trigger = lbShape.trigger; }
  }

  // An accordion is rooted on its HEADER BUTTON — headerSelector is the PRIMARY
  // — and contentSelector is required. Detection points at the container,
  // because that is the element carrying the `accordion` class, so the mapping
  // came out as fix.accordion('#faqPanel', { headerSelector: '#faqPanel' }):
  // the container in the button's place, and the required content missing.
  // That is why mapping one did nothing at all.
  //
  // Measured, not asked. The heading level and the collapse behaviour are facts
  // about the markup — the wrapping <h3>, and whether one panel is open or
  // several — and a model that guesses them is guessing at something readable.
  let accShape = null;
  if (row.type === 'accordion') {
    accShape = await inPage(tab.id, (s) => window.__u1SelectorIntel.accordionShape(s), [row.sel]);
    if (accShape) row.sel = accShape.headerSelector;
  }

  // An autocomplete, measured the same way. Nothing detects one — no class
  // pattern matches it, no role path finds it on a site that never wrote the
  // roles, and the probe can only ever answer tabs/menu/accordion/dialog — so
  // all four of its selectors had to be typed by hand. It has a SHAPE though:
  // a text input with a list of options beside it under a common parent, and
  // that is true whether or not the page says so.
  let cbShape = null;
  if (row.type === 'combobox') {
    cbShape = await inPage(tab.id, (s) => window.__u1SelectorIntel.comboboxShape(s), [row.sel]);
    if (cbShape) row.sel = cbShape.combobox;
  }
  const markup = await inPage(tab.id, (s) => window.__u1SelectorIntel.extractComponent(s), [row.sel]);
  if (!markup || markup.error || markup.notFound) {
    // Almost always the same cause: the scan was taken on one section and the
    // page has since moved on — another tab, a closed dialog, a re-render.
    // Saying "matches nothing" invites a hunt for a typo in a selector that
    // was correct when it was written.
    return { err: markup?.error ||
      `${row.sel} is not on the page right now. Scan results go stale as soon as you switch tab or section, or close what you had open — go back to that view, or scan this section again.` };
  }

  const schema = COMPONENT_SCHEMAS[row.type];

  // ── Nothing to ask ────────────────────────────────────────────────────────
  //
  // A link is `selectors: { element: PRIMARY }`. There is no second selector to
  // work out, no state to name, no shape to read — the mapping is entirely
  // determined by the selector already in hand. Same for a heading, whose only
  // extra is a level, and that is the tag. Same for a loading bar.
  //
  // Every one of these was still going to the model with a page of markup and
  // waiting on the answer. On the shop page that is sixteen of the twenty-four
  // mappings — nine links, four buttons, three headings — sixteen calls whose
  // reply the code could have written itself, each one a wait and a charge.
  //
  // A button's only field is `focusTo`, and it is optional: a scroll-to target
  // nobody has asked for. Not worth a call either; it stays editable on the
  // card like every other field.
  if (!needsModelToMap(row.type)) {
    const primaryKey = primaryKeyOf(schema);
    const fields = [];
    // The one measurable extra. u1.fix.heading needs a level, and the element
    // says what it is.
    if (row.type === 'heading') {
      const lvl = await inPage(tab.id, (sel) => {
        try {
          const el = document.querySelector(sel);
          if (!el) return 0;
          return Number((el.tagName.match(/^H(\d)$/) || [])[1]) ||
                 Number(el.getAttribute('aria-level')) || 0;
        } catch (e) { return 0; }
      }, [row.sel]);
      if (lvl) fields.push({ key: 'level', value: String(lvl), why: 'From the element\'s own tag.' });
    }
    const local = {
      primary: row.sel,
      fields,
      options: [],
      confidence: 'high',
      notes: [`${row.type} needs only the element itself — worked out here, with no model call.`],
      usage: null,
    };
    const idx0 = aiMapped.length;
    aiMapped.push({ row, result: local, markup });
    track.insertAdjacentHTML('beforeend', renderAiMapCard(idx0, row, local, markup.recorderActive));
    fillAiMapCard(idx0, row, local);
    return { idx: idx0 };
  }

  const out = await U1AI.mapComponent({
    u1Type: row.type,
    containerSel: row.sel,
    markup,
    instruction: row.trigger
      ? `The specialist identified "${row.trigger}" as the element that opens this ${row.type}. Use it for the trigger field and do not look for another.`
      : undefined,
    fields: schema.fields || [],
    fieldDocs: schema.desc || {},
    options: Object.keys(schema.rootFields || {}),
  });
  aiCost += U1AI.estimateCost(out.usage) || 0;
  if (out.err) return { err: out.err };

  // The specialist already told us which element opens this, and that is
  // better evidence than a guess from markup — so it wins over whatever the
  // model put in `trigger`.
  if (row.trigger) {
    out.fields = (out.fields || []).filter(f => f.key !== 'trigger');
    out.fields.unshift({ key: 'trigger', value: row.trigger,
                         why: 'The element you started from — you identified it as what opens this.' });
  }

  // A tabs mapping without a tabPanel is a tab strip that controls nothing:
  // U1 writes no aria-controls, the arrows move between the tabs, and the
  // content never follows. The schema requires it and the model leaves it out
  // anyway, so it is worked out from the page instead of asked for again —
  // mechanical, free, and it does not depend on the markup saying "tabpanel".
  if (row.type === 'tabs') {
    const has = (out.fields || []).find(f => f.key === 'tabPanel' && String(f.value || '').trim());
    if (!has) {
      const tabField = (out.fields || []).find(f => f.key === 'tab');
      const panels = await inPage(tab.id,
        (listSel, tabSel) => window.__u1SelectorIntel.tabPanelsFor(listSel, tabSel),
        [row.sel, (tabField && tabField.value) || '[role="tab"]']);
      if (panels) {
        out.fields = (out.fields || []).filter(f => f.key !== 'tabPanel');
        out.fields.push({ key: 'tabPanel', value: panels,
          why: 'Worked out from the page — the panels these tabs switch between. Required: without it the tabs control nothing.' });
      }
    }
  }

  // The measured shape wins. Not a preference: the three fields below are
  // determined by the markup, and an answer that disagrees with the markup is
  // wrong however confidently it is phrased.
  if (lbShape) {
    out.fields = (out.fields || []).filter(
      (f) => f.key !== 'trigger' && f.key !== 'options');
    out.fields.unshift(
      { key: 'trigger', value: lbShape.trigger,
        why: 'The clickable element in this container — it carries the event that opens the list.' },
      { key: 'options', value: lbShape.options,
        why: 'The list\'s own items.' });
    out.primary = lbShape.listbox;
  }

  // Same rule for the accordion, and for the same reason: which element is the
  // header, which region it opens, and what level the heading is, are all
  // readable off the page. The model's answer here was a container in the
  // header's place and no content at all.
  if (accShape) {
    out.fields = (out.fields || []).filter(
      (f) => f.key !== 'contentSelector' && f.key !== 'headingLevel' && f.key !== 'collapsesOthers');
    out.fields.unshift(
      { key: 'contentSelector', value: accShape.contentSelector,
        why: 'The region each header opens — read from what the header controls.' },
      { key: 'headingLevel', value: accShape.headingLevel,
        why: 'From the heading wrapping the header button, not guessed.' },
      { key: 'collapsesOthers', value: accShape.collapsesOthers,
        why: accShape.collapsesOthers
          ? 'Only one panel is open on the page, so opening one closes the rest.'
          : 'Several panels can be open at once.' });
    out.primary = accShape.headerSelector;
  }

  if (cbShape) {
    out.fields = (out.fields || []).filter(
      (f) => !['textbox', 'listbox', 'options', 'label'].includes(f.key));
    out.fields.unshift(
      { key: 'textbox', value: cbShape.textbox, why: 'The field you type into.' },
      { key: 'listbox', value: cbShape.listbox, why: 'The list the suggestions appear in.' },
      { key: 'options', value: cbShape.options, why: 'The suggestions themselves — what a person picks.' });
    if (cbShape.label) {
      out.fields.push({ key: 'label', value: cbShape.label, why: 'The field\'s own label.' });
    }
    out.primary = cbShape.combobox;
  }

  const idx = aiMapped.length;
  aiMapped.push({ row, result: out, markup });
  track.insertAdjacentHTML('beforeend', renderAiMapCard(idx, row, out, markup.recorderActive));
  fillAiMapCard(idx, row, out);
  return { idx };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Make all of these accessible
//
//  Prepare every found component, then ONE approval screen, then one press that
//  saves and applies the lot. The per-card path is untouched and both coexist —
//  this is not the old global tick counter, which was removed because it counted
//  selections across a list while showing you a single card. Every row here is
//  named, previewed and individually un-tickable.
// ─────────────────────────────────────────────────────────────────────────────

let aiBulk = { running: false, abort: false, failed: [], armed: false };

const chunksOf = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

function setBulkStatus(msg, kind = 'info', ms = 0) {
  showNotice(document.getElementById('aiBulkStatus'), msg, kind, ms);
}

document.getElementById('aiMapAllBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('aiMapAllBtn');
  const stopBtn = document.getElementById('aiMapAllStopBtn');
  const status = document.getElementById('aiMapStatus');
  if (aiBulk.running) return;
  if (isReadonly()) {
    showNotice(status, 'Licence expired — existing mappings still work and export, but new ones are paused.', 'error', 6000);
    return;
  }

  if (!aiWorkspaceMatchesSite()) { warnWrongSite(status); return; }

  const cards = [...document.querySelectorAll('#aiCompTrack .ai-comp:not([data-done])')];
  const rows = [];
  const blocked = [];
  for (const comp of cards) {
    const built = rowFromCompCard(comp);
    if (built.err) blocked.push({ comp, err: built.err });
    else rows.push({ comp, row: built.row });
  }
  if (!rows.length) {
    showNotice(status, blocked.length
      ? `None of these can be prepared automatically — ${blocked.length} still need a selector or a trigger. Handle them one at a time.`
      : 'Nothing left to prepare.', 'error', 6000);
    return;
  }

  // Spend nothing on the first press. One call per component is the whole cost
  // of this feature, and it should be a number the specialist saw before it was
  // charged, not one they find on a bill.
  if (!aiBulk.armed) {
    aiBulk.armed = true;
    const per = aiCost > 0 ? aiCost / Math.max(1, aiMapped.length) : 0;
    const estimate = per ? ` Roughly $${(per * rows.length).toFixed(2)} more, on top of $${aiCost.toFixed(3)} this session.` : '';
    btn.textContent = `Yes — prepare all ${rows.length}`;
    showNotice(status,
      `${rows.length} component${rows.length === 1 ? '' : 's'} means ${rows.length} model call${rows.length === 1 ? '' : 's'}.${estimate} Press again to start.` +
      (blocked.length ? ` (${blocked.length} will be left for you to do by hand.)` : ''),
      'warn', 12000);
    setTimeout(() => {
      if (!aiBulk.running) { aiBulk.armed = false; btn.textContent = '✨ Make all of these accessible'; }
    }, 12000);
    return;
  }

  const tab = await getTab();
  if (!isInjectable(tab)) { showNotice(status, 'Cannot read this page.', 'error', 4000); return; }

  clearApproved();   // this list is the batch, not the session
  aiBulk = { running: true, abort: false, failed: [], armed: false };
  btn.disabled = true;
  stopBtn.style.display = '';
  setStage('cards');

  try {
    for (let i = 0; i < rows.length; i++) {
      if (aiBulk.abort) break;
      const { comp, row } = rows[i];
      btn.textContent = `Preparing ${i + 1} of ${rows.length}…`;
      showMapBusy(row.label, i + 1, rows.length);
      comp.classList.add('is-working');
      try {
        const prepared = await prepareOne(row, tab);
        // One dead selector must not cost the other eleven their turn.
        if (prepared.err) aiBulk.failed.push({ label: row.label, err: prepared.err });
      } catch (err) {
        aiBulk.failed.push({ label: row.label, err: err.message });
      } finally {
        comp.classList.remove('is-working');
      }
    }
  } finally {
    clearMapBusy();
    aiBulk.running = false;
    btn.disabled = false;
    btn.textContent = '✨ Make all of these accessible';
    stopBtn.style.display = 'none';
    stopBtn.disabled = false;
    stopBtn.textContent = '■ Stop';
  }

  renderBulkReview();
});

document.getElementById('aiMapAllStopBtn')?.addEventListener('click', () => {
  aiBulk.abort = true;
  const b = document.getElementById('aiMapAllStopBtn');
  b.disabled = true;
  b.textContent = 'Stopping…';
});

// Everything prepared and not yet approved, as one list to say yes to.
function renderBulkReview() {
  const wrap = document.getElementById('aiBulkReview');
  const list = document.getElementById('aiBulkList');
  const summary = document.getElementById('aiBulkSummary');
  if (!wrap || !list) return;

  const pending = aiMapped
    .map((entry, idx) => ({ entry, idx }))
    .filter(({ idx }) => !document.querySelector(`#aiSlideTrack .ai-map-card[data-card="${idx}"]`)?.dataset.done);

  if (!pending.length && !aiBulk.failed.length) { setStage(resumeStage()); return; }

  setStage('review');

  // Say how many are being held back, or they read as missing rather than as
  // waiting for a decision.
  const weak = pending.filter(({ entry }) => entry.result.confidence === 'low').length;
  summary.innerHTML =
    `<div class="ai-meta">${pending.length - weak} ready to apply` +
    (weak ? ` · <strong>${weak} left unticked — the model called ${weak === 1 ? 'it' : 'them'} low confidence</strong>` : '') +
    (aiBulk.failed.length ? ` · ${aiBulk.failed.length} could not be prepared` : '') +
    ` · ~$${aiCost.toFixed(3)} spent preparing these</div>`;

  const fails = aiBulk.failed.map(f => `
      <div class="ai-approved-row ai-bulk-row">
        <span class="ai-approved-tick warn">!</span>
        <div class="ai-bulk-body">
          <span class="ai-approved-label">${escapeHtml(f.label)}</span>
          <div class="ai-approved-why">${escapeHtml(f.err)}</div>
        </div>
      </div>`).join('');

  // A sweep produces one flat list of everything on a twelve-screen page, which
  // is a list with no sense of where anything is. Grouped by the section it
  // came from — with that section's own picture and its own share of the cost
  // — it can be read, and a whole screen can be dropped in one click.
  const groups = aiSweep.stops.filter(s => s.indexes.length);
  list.innerHTML = groups.length ? sweepGroupsHtml(groups, pending) + fails
                                 : pending.map(p => bulkRowHtml(p)).join('') + fails;
}

function bulkRowHtml({ entry, idx }) {
  const conf = ['high', 'medium', 'low'].includes(entry.result.confidence) ? entry.result.confidence : 'medium';
  // Low confidence is not ticked. Everything was, and the approve-all that
  // follows applied it — so a guess the model itself flagged as weak ("no h1
  // anywhere, I set level=2 as a guess, a specialist should verify") went onto
  // the page beside the work that was actually asked for.
  //
  // It stays in the list, with its warning and its reasoning, one tick away.
  // The judgement it needs is a person's, and ticked-by-default is the one
  // arrangement that guarantees it does not get one.
  const weak = conf === 'low';
  // Read the template fresh so the row shows what would actually be applied,
  // including any edit made in the carousel after this section was opened.
  const tpl = aiCardTemplate(idx);
  return `
      <div class="ai-approved-row ai-bulk-row" data-bulk-idx="${idx}">
        <input type="checkbox" class="ai-bulk-tick"${weak ? '' : ' checked'} aria-label="Apply ${escapeHtml(entry.row.label)}">
        <div class="ai-bulk-body">
          <span class="ai-approved-label">${escapeHtml(entry.row.label)}</span>
          <code>u1.fix.${escapeHtml(entry.row.type)}</code>
          <span class="ai-conf" data-c="${conf}">${conf}</span>
          ${weak ? '<span class="ai-sev" data-need="1">not ticked — read it first</span>' : ''}
          ${entry.row.needsWork === false
            ? '<span class="ai-sev" data-need="0">already looks correct</span>' : ''}
          <button class="btn-ghost btn-xs" data-bulk-edit="${idx}">Edit</button>
          <div class="ai-approved-why">${escapeHtml(tpl?.primary || entry.row.sel || '')}</div>
          ${tpl ? `<details class="ai-approved-code"><summary>Show the code</summary><div class="code-preview">${escapeHtml(tpl.code)}</div></details>` : ''}
        </div>
      </div>`;
}

function sweepGroupsHtml(groups, pending) {
  const byIdx = new Map(pending.map(p => [p.idx, p]));
  return groups.map((stop, i) => {
    const mine = stop.indexes.map(idx => byIdx.get(idx)).filter(Boolean);
    if (!mine.length) return '';   // every row in it has already been approved
    const img = safeImg(stop.thumb);
    const n = mine.length;
    return `
      <details class="sweep-group" data-stop="${stop.n}"${i === 0 ? ' open' : ''}>
        <summary>
          <input type="checkbox" class="sweep-group-tick" checked
                 aria-label="Apply everything found on screen ${stop.n}">
          ${img ? `<span class="mh-thumb" data-shot="${stop.n}">
                     <img class="mh-img" src="${img}" alt="Section ${stop.n}">
                     <img class="mh-preview" src="${img}" alt="">
                   </span>` : ''}
          <span class="sweep-group-name">Section ${stop.n}</span>
          <span class="sweep-group-meta">${n} component${n === 1 ? '' : 's'} · $${(stop.cost || 0).toFixed(3)}</span>
        </summary>
        <div class="sweep-group-body">${mine.map(p => bulkRowHtml(p)).join('')}</div>
      </details>`;
  }).join('');
}

// Ticking a whole section at a time is wired for both lists by
// wireGroupTicks, alongside the picks list it was written for.

document.getElementById('aiBulkBackBtn')?.addEventListener('click', () => {
  setStage('cards');
  showSlide(slideIndex('aiSlide'));
});

document.getElementById('aiBulkList')?.addEventListener('click', (e) => {
  const edit = e.target.closest('[data-bulk-edit]');
  if (!edit) return;
  const idx = Number(edit.dataset.bulkEdit);
  setStage('cards');
  showSlide(slideIndex('aiSlide'));
  document.querySelector(`#aiSlideTrack .ai-map-card[data-card="${idx}"]`)
    ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
});

document.getElementById('aiBulkApproveBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('aiBulkApproveBtn');
  if (isReadonly()) {
    setBulkStatus('Licence expired — existing mappings still work and export, but new ones are paused.', 'error', 6000);
    return;
  }
  if (!aiWorkspaceMatchesSite()) { warnWrongSite(document.getElementById('aiBulkStatus')); return; }
  const ticked = [...document.querySelectorAll('#aiBulkList .ai-bulk-row[data-bulk-idx]')]
    .filter(r => r.querySelector('.ai-bulk-tick')?.checked)
    .map(r => Number(r.dataset.bulkIdx));
  const items = ticked.map(i => ({ i, tpl: aiCardTemplate(i) })).filter(x => x.tpl);
  if (!items.length) { setBulkStatus('Nothing is ticked.', 'error', 4000); return; }

  btn.disabled = true;
  const original = btn.textContent;

  try {
    // ── Phase A: save, strictly one at a time ────────────────────────────────
    // saveMappingEntry reads the list, mutates it and writes it back with no
    // locking, so running these concurrently would have each write clobber the
    // others and silently drop mappings. This loop is load-bearing, not style.
    const saved = [];
    for (let n = 0; n < items.length; n++) {
      const it = items[n];
      btn.textContent = `Saving ${n + 1} of ${items.length}…`;
      setBulkStatus(`Saving ${n + 1} of ${items.length} — ${it.tpl.primary}`, 'info', 0);
      try {
        const r = await saveMappingEntry(it.tpl, { refreshUi: false });
        // Declining the role question is an answer, not a failure — it must not
        // land in the failed list beside real errors.
        if (r && r.cancelled) continue;
        saved.push(it);
      } catch (err) {
        aiBulk.failed.push({ label: it.tpl.primary, err: err.message });
      }
    }
    loadMappingsList();
    refreshExportInfo();

    // ── Phase B: apply, in chunks ────────────────────────────────────────────
    // applyMappingsBatch already takes an array and loops in-page, but each item
    // polls for up to 4s before concluding no-effect, so one big call would sit
    // silent for a minute. Five at a time keeps progress visible.
    const details = [];
    for (const chunk of chunksOf(saved, 5)) {
      const from = details.length + 1;
      const to = details.length + chunk.length;
      btn.textContent = `Applying ${from}–${to} of ${saved.length}…`;
      setBulkStatus(`Applying ${from}–${to} of ${saved.length}…`, 'info', 0);
      // overwriteRole travels with them. It was dropped here — so a mapping
      // whose role clash had been answered "replace it" was applied WITHOUT
      // the site's role being lifted, U1 refused to write over it, and the
      // element came back undecorated. The single-apply path threaded it and
      // this one did not, which is why it only ever went wrong in bulk: the
      // whole-page route saves and applies exclusively through here.
      const res = await applyMappingsBatch(chunk.map(x => ({
        type: x.tpl.type, primary: x.tpl.primary, firstArg: x.tpl.firstArg,
        config: x.tpl.config, overwriteRole: x.tpl.overwriteRole,
      })));
      chunk.forEach((x, j) => details.push({ x, verdict: describeApply(res, x.tpl, j) }));
      // Saving succeeded even when applying could not run, and the panel
      // re-applies everything on open — so this is not work to do again.
      if (!res.ok && res.u1Missing) {
        setBulkStatus('Saved. U1 is not loaded on this page so nothing was applied — it will apply next time the panel opens on a page that has U1.', 'error', 12000);
      }
    }

    // ── Phase C: report into the same approved list the single flow uses ─────
    const key = storageKey('mappings', currentHostname);
    const existing = (await U1Store.get([key]))[key] || [];
    for (const { x, verdict } of details) {
      const entry = aiMapped[x.i];
      const clashes = await overlappingMappings(x.tpl.primary, existing);
      if (clashes.length) {
        verdict.clashes = clashes;
        verdict.ok = false;
        verdict.msg += ` Also mapped by ${clashes.map(c => `u1.fix.${c.type} on ${c.sel}`).join(', ')} — two on the same elements fight, and the second wins.`;
      }
      const card = document.querySelector(`#aiSlideTrack .ai-map-card[data-card="${x.i}"]`);
      if (card) card.dataset.done = '1';
      if (entry?.row?.compIndex != null) {
        const comp = document.querySelector(`#aiCompTrack .ai-comp[data-i="${CSS.escape(entry.row.compIndex)}"]`);
        if (comp) comp.dataset.done = '1';
      }
      addApproved(entry.row, verdict, x.tpl.code);
    }

    setStage(resumeStage());
    const bad = details.filter(d => !d.verdict.ok).length;
    showNotice(document.getElementById('aiMapStatus'),
      `${details.length} mapping${details.length === 1 ? '' : 's'} saved and applied` +
      (bad ? `, ${bad} with something to look at — see the list below.` : '.'),
      bad ? 'error' : 'success', 9000);
  } catch (err) {
    setBulkStatus('Failed: ' + err.message, 'error', 8000);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Whole page — the same two stages, run over every section by itself.
//
//  Automatic mode does one section per press. A real page is eight to twenty
//  of them, so the actual workflow was: scroll, press, wait, scroll, press —
//  twenty times. Every step of that already exists here; all that was missing
//  was doing them in a row.
//
//  Nothing reaches the site during the sweep. It prepares, and the one approval
//  screen at the end is still the only thing that writes.
// ─────────────────────────────────────────────────────────────────────────────

// 15% back, so a component sitting across the fold is whole in one of the two
// shots rather than cut in half in both.
const SWEEP_OVERLAP = 0.85;
// A page that grows as you scroll never ends. This is the backstop against
// following an infinite feed forever.
//
// It used to be 15, from when every section cost a model call — it was a
// spending guard wearing a loop guard's clothes. The survey costs nothing now,
// so a page taller than fifteen sections was simply being cut off with most of it
// unseen. The real end condition is a scroll position that stops moving; this
// only has to be higher than any page a person would actually scan. Sixty
// sections is about a minute and a half, and still free.
const SWEEP_MAX_STOPS = 60;
// Scrolling starts lazy images and whole sections loading. Capturing straight
// away photographs the skeleton.
const SWEEP_SETTLE_MS = 700;

/**
 * How much of a section is collected, and how much goes into one model call.
 *
 * These were a single number, and conflating them is what lost the tail of
 * every busy section. Collecting is free; asking is not. So collect everything
 * the survey counted, and spend the budget in batches — a 97-element section is
 * two calls, not sixty elements and silence about the other thirty-seven.
 */
const SWEEP_COLLECT_MAX = 250;
const SWEEP_ASK_BATCH = 60;

// phase: 'screens' once the free survey is done and you are choosing which
// sections to pay to read; 'components' once those have been read and you are
// choosing what to fix.
let aiSweep = { running: false, abort: false, phase: 'screens', stops: [], tabId: null };

const $sweepStatus = () => document.getElementById('sweepStatus');

// ─────────────────────────────────────────────────────────────────────────────
//  A sweep outlives the panel
//
//  It was memory only, so closing the browser — or the side panel, which the
//  browser closes for you — threw away a survey that had cost real money to
//  produce, with no way back except paying for it again. A sweep is per SITE
//  and it is durable: it is kept under the hostname, restored the next time
//  that site is in front of you, and only forgotten when you press Clear.
//
//  The `__` prefix marks it private, which keeps it out of exported backups.
//  It is a cache of one machine's scan, not the client's project data — it
//  should not travel to a colleague in a handover file.
// ─────────────────────────────────────────────────────────────────────────────
const sweepStoreKey = (host) => U1Store.PRIVATE_PREFIX + 'sweep_' + (host || currentHostname);

let sweepSaveTimer = null;

/**
 * Persist the survey. Debounced: the render functions call it, and a run
 * re-renders on every section.
 *
 * The thumbnails travel with it — they are the whole reason the list is worth
 * looking at, and "unlimitedStorage" is already granted for exactly this kind
 * of payload. `running`, `abort` and `tabId` are deliberately dropped: a
 * restored sweep is finished, and its tab is gone.
 */
// The debounce is right for typing and ticking, and wrong for a section
// boundary. "Finish one, save it, move to the next" has to mean the write
// actually happened before the next one starts — otherwise a run of quick
// sections coalesces into one save that has not landed yet when the panel is
// closed. saveSweepNow is the same write, awaited, with the pending debounce
// cancelled so it cannot fire again behind it.
function saveSweepNow() {
  clearTimeout(sweepSaveTimer);
  return sweepWrite();
}

function saveSweep() {
  clearTimeout(sweepSaveTimer);
  sweepSaveTimer = setTimeout(sweepWrite, 400);
}

function sweepWrite() {
  return (async () => {
    try {
      if (!aiSweep.stops.length) return;
      // The survey's own site, not the panel's. They are the same except when
      // something has moved the panel, and that is exactly when writing to the
      // panel's key files a scan under the wrong client.
      const host = aiSweep.host || currentHostname;
      await U1Store.set({
        [sweepStoreKey(host)]: {
          v: 1,
          savedAt: Date.now(),
          host,
          url: aiSweep.url || '',
          phase: aiSweep.phase,
          cost: aiCost,
          stops: aiSweep.stops,
        },
      });
      // And to the server, so a colleague on another machine opens this site
      // and sees the same survey — the same sections, the same pictures, the
      // same progress — instead of being asked to pay for it again.
      //
      // The sweep key is private (`__`), so U1Store.set's own sync hook does
      // not fire for it: a survey is not one of the site-scoped prefixes and
      // has its own shape, its own pictures and its own endpoint.
      if (await U1Auth.isLoggedIn()) {
        try {
          await U1Sync.pushSweep(host, {
            url: aiSweep.url, phase: aiSweep.phase, cost: aiCost, stops: aiSweep.stops,
          });
        } catch (err) {
          showNotice(document.getElementById('sweepPicksStatus'),
            'The scan is saved on this machine but did not reach the server, so your ' +
            'colleagues will not see it: ' + err.message, 'error', 12000);
        }
      }
    } catch (err) {
      // Storage being full must not take the run down with it — the results are
      // still on screen and still usable, they just will not survive the panel.
      showNotice(document.getElementById('sweepPicksStatus'),
        'The scan is on screen but could not be saved: ' + err.message, 'warn', 8000);
    }
  })();
}

/** Throw the stored survey away. Only Clear does this — never a tab change. */
async function forgetSweep(host) {
  try { await U1Store.remove([sweepStoreKey(host)]); } catch {}
}

/**
 * Put back the survey for the site now in front of us, if there is one.
 *
 * Nothing here costs anything or touches the page: it is the free half of the
 * work being handed back. The tab it ran on is not restored — that tab is
 * gone, and sweepTab() falls back to the one in front, which is the right
 * answer for a survey being reopened rather than continued.
 */
async function restoreSweep() {
  if (aiSweep.running || aiSweep.stops.length) return false;
  let saved;
  try { saved = (await U1Store.get([sweepStoreKey()]))[sweepStoreKey()]; } catch { return false; }
  if (!saved || !Array.isArray(saved.stops) || !saved.stops.length) return false;

  aiSweep = {
    running: false, abort: false,
    phase: saved.phase === 'components' ? 'components' : 'screens',
    stops: saved.stops, tabId: null, url: saved.url || '',
    // Filed under the site it was saved for, so continuing it later saves it
    // back to the same place.
    host: saved.host || currentHostname,
  };
  aiCost = saved.cost || 0;
  aiWorkspaceHost = currentHostname;
  if (aiSweep.phase === 'components') renderSweepPicks();
  else renderSweepScreens();

  // How old it is, said plainly. A scan from last week describes a page that
  // may have been redeployed twice since, and a stale survey that looks fresh
  // is worse than no survey — it spends money reading sections that moved.
  const summary = document.getElementById('sweepPicksSummary');
  if (summary) {
    summary.insertAdjacentHTML('beforeend',
      `<div class="sweep-restored">Restored from your last scan of this site, ` +
      `${describeAge(saved.savedAt)}. Nothing was charged to bring it back — ` +
      `scan again if the page has changed since.</div>`);
  }
  return true;
}

function describeAge(ts) {
  if (!ts) return 'earlier';
  // Not `const mins` — verify-sweep.mjs lifts the panel's own `const mins =`
  // helper out of this file by regex, and a second declaration of that name
  // anywhere above it is the one the regex finds.
  const ageMins = Math.round((Date.now() - ts) / 60000);
  if (ageMins < 2) return 'just now';
  if (ageMins < 60) return `${ageMins} minutes ago`;
  const ageHours = Math.round(ageMins / 60);
  if (ageHours < 24) return `${ageHours} hour${ageHours === 1 ? '' : 's'} ago`;
  const ageDays = Math.round(ageHours / 24);
  return `${ageDays} day${ageDays === 1 ? '' : 's'} ago`;
}

/**
 * One line in the scan log.
 *
 * A tall page produces two or three lines per section, and thirty sections
 * of that filled the panel and pushed the thing you actually came for — the
 * list of sections to pick from — off the bottom. So the log is an accordion:
 * shut by default, one nested section per section, and the summary line of
 * each carries that screen's result so the detail is there without being in
 * the way. Progress still shows while a sweep runs, because the outer summary
 * mirrors the latest line even while everything is closed.
 */
function sweepLog(n, what, kind, cost) {
  const box = document.getElementById('sweepLog');
  if (!box) return;
  box.style.display = '';

  let wrap = box.querySelector('.sweep-log-wrap');
  if (!wrap) {
    wrap = document.createElement('details');
    wrap.className = 'sweep-log-wrap';
    wrap.innerHTML =
      '<summary><span class="sweep-log-title">Scan log</span>' +
      '<span class="sweep-log-live"></span></summary>' +
      '<div class="sweep-log-body"></div>';
    box.appendChild(wrap);
  }
  const body = wrap.querySelector('.sweep-log-body');

  const row = document.createElement('div');
  row.className = 'sweep-log-row';
  if (kind) row.dataset.kind = kind;
  row.innerHTML =
    `<span class="what">${escapeHtml(what)}</span>` +
    `<span class="cost">${typeof cost === 'number' ? '$' + cost.toFixed(3) : ''}</span>`;

  if (!n) {
    // Not about one section — the end of the page, a limit, a failure. These
    // are the lines worth seeing without opening anything, so they sit loose at
    // the bottom rather than inside a section.
    row.classList.add('sweep-log-note');
    body.appendChild(row);
  } else {
    let sec = body.querySelector(`.sweep-log-screen[data-n="${n}"]`);
    if (!sec) {
      sec = document.createElement('details');
      sec.className = 'sweep-log-screen';
      sec.dataset.n = String(n);
      sec.innerHTML = `<summary><span class="n">Section ${n}</span>` +
        '<span class="sum"></span></summary>';
      body.appendChild(sec);
    }
    sec.appendChild(row);
    // The last line that says something — "pressed 12, nothing opened" is
    // process, "form · tabs? — 51 elements" is the answer.
    if (kind !== 'skip' || !sec.querySelector('.sum').textContent) {
      sec.querySelector('.sum').textContent = what;
    }
  }

  const live = wrap.querySelector('.sweep-log-live');
  if (live) live.textContent = n ? `Section ${n} · ${what}` : what;
  if (wrap.open) body.scrollTop = body.scrollHeight;
}

/** How tall the page is in sections — the basis for the estimate. */
async function sweepMeasure(tab) {
  return inPage(tab.id, () => ({
    height: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0),
    view: window.innerHeight,
    y: window.scrollY,
  }));
}

document.getElementById('sweepStopBtn')?.addEventListener('click', () => {
  aiSweep.abort = true;
  const b = document.getElementById('sweepStopBtn');
  if (b) { b.disabled = true; b.textContent = 'Stopping after this section…'; }
});

document.getElementById('sweepStartBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('sweepStartBtn');
  const status = $sweepStatus();
  if (aiSweep.running) return;

  if (isReadonly()) {
    showNotice(status, 'Licence expired — existing mappings still work and export, but new ones are paused.', 'error', 6000);
    return;
  }
  const tab = await getTab();
  if (!isInjectable(tab)) { showNotice(status, 'Cannot read this page.', 'error', 4000); return; }

  // No API key check and no "are you sure" here any more. This press only
  // photographs the page and counts what is on it, in the panel — it makes no
  // request and costs nothing, so asking permission for it was friction in
  // front of the free half. The confirmation belongs on the next press, which
  // is where the first call is made, and that is where it now lives.
  await runSweep(tab);
});

async function runSweep(tab) {
  const btn = document.getElementById('sweepStartBtn');
  const stopBtn = document.getElementById('sweepStopBtn');
  const status = $sweepStatus();
  const log = document.getElementById('sweepLog');

  // Pinned to the tab this ran on. Hovering a section scrolls the page and
  // draws on it, and `getTab()` answers with whatever tab is in FRONT — so
  // switching browser tabs and moving the mouse over the list scrolled and
  // marked up a completely different page. The results belong to the page they
  // came from, and so does everything that acts on them.
  // The site this survey is ABOUT, carried on the survey itself. sweepStoreKey
  // defaults to currentHostname, which is a property of whatever tab is in
  // front — so anything that re-points the panel mid-run also re-points where
  // the run is filed, silently, one save at a time. The panel is held during a
  // run now; this is so that a future path that moves currentHostname cannot
  // file a scan of one client's site under another client's name.
  aiSweep = { running: true, abort: false, phase: 'screens', stops: [],
              tabId: tab.id, url: tab.url || '', host: getHostname(tab) };
  aiBulk.failed = [];
  if (log) { log.innerHTML = ''; log.style.display = 'none'; }
  btn.disabled = true;
  stopBtn.style.display = '';
  stopBtn.disabled = false;
  stopBtn.textContent = '■ Stop after this section';
  setStage('none');

  // Stamp the site these selectors come from, the same way a single scan does.
  aiWorkspaceHost = currentHostname;

  // Where the page was before we started moving it. A sweep ends fourteen
  // sections down, and leaving it there means the approval screen names
  // components nowhere near what is on the page behind it.
  const startedAt = (await sweepMeasure(tab))?.y || 0;

  // Selectors already dealt with — saved mappings and dismissals — plus, as the
  // sweep goes, everything it has already found. Without the second half the
  // sticky header is discovered again at every scroll position.
  const handled = await alreadyHandled();

  // The camera that does not need the tab in front. It was written, documented
  // at length, and never once called — so every section still went through
  // captureVisibleTab, and captureVisibleTab photographs whatever is IN FRONT.
  // The entire apparatus for carrying on in the background existed and was
  // unreachable: switch tabs and the survey stood still until you came back.
  await announceCamera(tab);

  let n = 0;
  try {
    await inPage(tab.id, () => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, SWEEP_SETTLE_MS));

    while (n < SWEEP_MAX_STOPS && !aiSweep.abort) {
      n++;
      const stop = {
        n, scrollY: 0, thumb: null, cost: 0,
        count: 0, components: '', inventory: '', truncated: false, sticky: 0, probed: [],
        compSels: [], continuedFrom: 0, continuesOnto: 0, positional: 0,
        scanned: false, found: [], indexes: [],
      };
      aiSweep.stops.push(stop);

      const pos = await sweepMeasure(tab);
      stop.scrollY = pos ? pos.y : 0;
      showSweepBusy(`Section ${n}`, 'Photographing this section.',
        pos && pos.height ? Math.min(100, ((pos.y + pos.view) / pos.height) * 100) : undefined);
      btn.textContent = `Section ${n}…`;

      // Survey only: collect what is here and photograph it. No numbers drawn,
      // no big screenshot, no model call — so a fifteen-screen page is looked
      // at in about twenty seconds and costs nothing.
      //
      // A sticky header travels with the viewport and would be counted again at
      // every stop, which is why it is dropped from the second section on.
      // Pressed BEFORE the picture is taken, so what the probe finds can be
      // drawn on it. The probe needs no screenshot of its own.
      let observed = [];
      // Always. It was a checkbox and turning it off only produced worse
      // answers — the scan reads what a component is CALLED, and opening it is
      // how it learns what the component does.
      {
        showSweepBusy(`Section ${n}`, 'Opening each component to see what it is.',
          pos && pos.height ? Math.min(100, ((pos.y + pos.view) / pos.height) * 100) : undefined);
        const probed = await probeScreen(tab);
        await inPage(tab.id, (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' }), [stop.scrollY]);
        if (!probed) sweepLog(n, 'the probe could not run on this page', 'err');
        else if (!probed.pressed) {
          sweepLog(n, 'nothing here could be pressed' +
            (probed.skipped ? ` — ${probed.skipped} were refused as unsafe` : ''), 'skip');
        } else if (!probed.components.length) {
          sweepLog(n, `pressed ${probed.pressed}, nothing opened`, 'skip');
        } else {
          observed = probed.components;
          stop.probed = probed.components;
          sweepLog(n, `pressed ${probed.pressed} · found ` +
            probed.components.map((c) => c.type).join(', '));
          if (!probed.restored) {
            sweepLog(n, 'a component would not close again — the page may look different', 'err');
          }
        }
      }

      const collected = await collectRegion(tab, '', handled, {
        thumb: true,
        surveyOnly: true,
        observed,
        drop: (c) => c.sticky && n > 1,
      });
      if (collected.err) { sweepLog(n, collected.err, 'err'); break; }
      stop.thumb = collected.thumb || null;
      stop.count = collected.candidates.length;
      stop.truncated = !!collected.truncated;
      stop.inventory = screenInventory(collected.candidates);

      // Read as well. The probe above covers what it could press; the reading
      // covers what announces itself, and neither is a superset of the other.
      stop.components = mergeComponents(screenComponents(collected.candidates), observed);
      // Which components are on this section, by selector. The same selector
      // appearing on two consecutive stops is the same element straddling the
      // fold — a table taller than the window — and saying so is what stops you
      // ticking the second section alone and mapping its bottom half.
      stop.compSels = collected.candidates
        .filter(c => c.component && c.selector)
        .map(c => c.selector);
      const prev = aiSweep.stops[aiSweep.stops.length - 2];
      if (prev && prev.compSels) {
        const shared = stop.compSels.filter(s => prev.compSels.includes(s));
        if (shared.length) {
          stop.continuedFrom = prev.n;
          prev.continuesOnto = n;
        }
      }
      // Which section the sticky header landed on. It is counted once, on the
      // first section that sees it — so that section has to say so, or
      // ticking only the middle of a page would silently leave out the site's
      // main navigation.
      stop.sticky = collected.candidates.filter(c => c.sticky).length;
      // Components whose only possible selector counts siblings. Worth knowing
      // BEFORE paying to read the section: the mapping will work and will be
      // fragile, and the better move may be to ask the client for a class.
      stop.positional = collected.candidates
        .filter(c => c.component && /:nth-|:first-child|:last-child|:only-child/.test(c.selector || '')).length;
      sweepLog(n,
        stop.count
          ? (stop.components ? stop.components + ' — ' : 'no complex components — ') +
            `${stop.count}${stop.truncated ? '+' : ''} elements` +
            (stop.truncated ? ' · truncated' : '')
          : 'nothing on this section',
        stop.count ? '' : 'skip');

      if (aiSweep.abort) break;

      // Down one section, less the overlap.
      //
      // behavior:'instant' is load-bearing. A page carrying the very ordinary
      // `html { scroll-behavior: smooth }` animates scrollTo, so window.scrollY
      // on the next line still holds the OLD value — and reading it there to
      // decide whether the page moved concluded "bottom reached" after the
      // first section, every time, on every site that has that one line of
      // CSS. The check has to happen after the scroll has actually landed, so
      // it is a second call after the settle rather than a return value here.
      const y0 = (await sweepMeasure(tab))?.y ?? 0;
      await inPage(tab.id, (frac) => {
        window.scrollTo({ top: window.scrollY + window.innerHeight * frac, left: 0, behavior: 'instant' });
      }, [SWEEP_OVERLAP]);
      await new Promise(r => setTimeout(r, SWEEP_SETTLE_MS));
      const y1 = (await sweepMeasure(tab))?.y ?? 0;
      // The page itself decides when this ends: a scroll position that will not
      // move is the bottom, whatever the height said before lazy content
      // changed it.
      if (y1 <= y0) {
        // Two very different things end a sweep here, and they look identical
        // from the outside: the page really is at its end, or it refused to
        // scroll at all. Saying which turns "it stopped after one section" into
        // something answerable.
        const atEnd = pos && (y1 + pos.view) >= pos.height - 4;
        sweepLog(0, atEnd
          ? `reached the bottom of the page (${Math.round(y1)}px)`
          : `the page would not scroll past ${Math.round(y1)}px of ${Math.round(pos ? pos.height : 0)} — stopping`,
          'skip');
        break;
      }
    }
    if (n >= SWEEP_MAX_STOPS && !aiSweep.abort) {
      sweepLog(0, `stopped at the ${SWEEP_MAX_STOPS}-section limit`, 'skip');
    }
  } catch (err) {
    sweepLog(0, 'Failed: ' + err.message, 'err');
  } finally {
    // Detach before anything else: Chrome's "is debugging this browser" banner
    // stays up for exactly as long as we are attached, and leaving it there
    // after the survey has ended is its own small lie about what is happening.
    await endBackgroundCapture();
    clearSweepBusy();
    aiSweep.running = false;
    btn.disabled = false;
    btn.textContent = '🪄 Scan the whole page';
    stopBtn.style.display = 'none';
    // Our own numbers must never be left on the site's DOM, and the page goes
    // back where it was — the specialist did not scroll it here.
    try { await inPage(tab.id, () => window.__u1SelectorIntel.clearMarks()); } catch {}
    try { await inPage(tab.id, (y) => window.scrollTo(0, y), [startedAt]); } catch {}
    // Regroup: the rows were marked one by one while the run went, and now the
    // list can settle into "still to read" and "already read".
    if (aiSweep.phase === 'screens') renderSweepScreens();
    // Whatever the outcome. A run that found nothing still read those sections
    // and still paid for them, and that has to survive a panel reload — it did
    // not, because the only save on this path hung off a render that an empty
    // run never reached.
    saveSweep();
    // ── And put it on the page ────────────────────────────────────────────
    //
    // Applying was a button in the drawer that you had to remember. It is part
    // of the job, not a step after it: a mapping that is saved and not applied
    // is a page nobody has made accessible yet, and the run has just spent
    // twenty minutes deciding what to do to it.
    //
    // Everything the site has, not only what this run built — u1 decorates an
    // element once per page load, so a mapping made early in a run may never
    // have met the elements a later section re-rendered.
    //
    // Silent: the run reports its own outcome below, and two verdicts about
    // one press is how neither gets read.
    try {
      const put = await applyAllMappings({ silent: true });
      if (put && (put.applied || put.failed)) {
        sweepLog(0, `applied to the page — ${put.applied} of ${put.applied + put.failed}` +
          (put.failed ? `, ${put.failed} could not be` : ''), put.failed ? 'err' : '');
      }
    } catch (err) {
      sweepLog(0, 'saved, but could not be applied to the page: ' + err.message, 'err');
    }

    // If you said "I have moved on to another site" while this held the panel,
    // this is where it lets go.
    await followPendingSiteSwitch();
  }

  const total = aiSweep.stops.reduce((s, x) => s + x.count, 0);
  if (!total) {
    // The commonest reason a survey comes back empty is the skip list: a handful
    // of "Skip" presses in an earlier session, still in force and invisible. The
    // way to undo that has to be offered here, not found.
    const skipped = (await dismissedSelectors()).length;
    showNotice(status, 'Nothing on this page that is not already mapped.', 'success', 0);
    if (skipped) {
      status.insertAdjacentHTML('beforeend',
        ` ${skipped} element${skipped === 1 ? ' was' : 's were'} left out because ${skipped === 1 ? 'it was' : 'they were'} skipped in an earlier scan — ` +
        `<button class="btn-ghost btn-xs" id="aiResetDismissed">show them again</button>.`);
    }
    return;
  }
  status.style.display = 'none';
  aiSweep.phase = 'screens';
  renderSweepScreens();
}

/**
 * The COMPONENTS on this section, as the page itself declares them.
 *
 * This is the line worth reading. "22 links, 19 buttons" tells you how busy a
 * section is; "a nav, a carousel and a tab strip" tells you whether it is
 * worth paying to read — and that is the choice the list exists to support.
 *
 * Free, because none of it is judgement: role="tablist" IS a tab strip and
 * <form> IS a form. What the model is paid for is the part that IS judgement —
 * deciding that seven links and six drop-downs are one menu, and which element
 * is its root. Anything guessed from a class name is marked with a "?" so the
 * two are never confused.
 */
function screenComponents(candidates) {
  const sure = new Map();
  const maybe = new Map();
  for (const c of candidates || []) {
    if (!c.component || c.nested) continue;
    const into = c.maybe ? maybe : sure;
    into.set(c.component, (into.get(c.component) || 0) + 1);
  }
  // A guess is not worth repeating when the same component is already known to
  // be there — a `.hero-carousel` class beside role="region" says one thing.
  for (const k of sure.keys()) maybe.delete(k);
  const say = (m, q) => [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${v > 1 ? v + ' ' : ''}${v > 1 ? k + (k.endsWith('s') ? '' : 's') : k}${q}`);
  return [...say(sure, ''), ...say(maybe, '?')].slice(0, 5).join(' · ');
}

/**
 * Operate this section's components and report what they turned out to be.
 *
 * Reading a page cannot see a widget built from bare <div>s with its handlers
 * hung in JavaScript. That is measured rather than assumed: the same page scores
 * 100% with its roles and class names and 0% with them stripped. Pressing it
 * works on both, because it never looked at either.
 *
 * Costs no model call and no money. What it costs is pressing things on someone
 * else's page, so it sits behind a switch and inside probe.js's own safety net.
 */
/**
 * One line describing the section, from what was read and what was observed.
 *
 * An observation outranks a guess about the same kind of thing: if pressing the
 * strip proved it is a tab strip, "tabs?" from a class name adds nothing and its
 * question mark is now simply wrong. Guesses about kinds nobody probed are kept
 * — the probe presses at most a dozen things per section, so its silence is
 * not evidence of absence.
 */
function mergeComponents(readLine, observed) {
  if (!observed || !observed.length) return readLine;
  const counts = new Map();
  for (const c of observed) counts.set(c.type, (counts.get(c.type) || 0) + 1);
  const proven = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => (v > 1 ? `${v} ${k}${k.endsWith('s') ? '' : 's'}` : k));

  const kinds = new Set(counts.keys());
  const leftover = (readLine || '').split(' · ')
    .filter(Boolean)
    .filter(part => ![...kinds].some(k => part.includes(k)));

  return [...proven, ...leftover].slice(0, 5).join(' · ');
}

async function probeScreen(tab) {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['probe.js'] });
  } catch { return null; }
  try {
    return await inPage(tab.id, async () => {
      const P = window.__u1Probe, S = window.__u1SelectorIntel;
      if (!P || !S) return null;
      const out = await P.probeAll(document.body,
        { inViewport: true, settle: 80, max: 12, limit: 2500 });
      // Selectors are worked out HERE, where the elements are. The panel never
      // handles a node — only a selector produced by the same code that
      // produces every other selector in the tool.
      const nameFor = (root, els) => {
        if (!els || !els.length) return '';
        if (els.length === 1) return S.robustSelector(els[0]);
        const common = root && S.commonSelectorFor ? S.commonSelectorFor(root, els) : null;
        return (common && common.selector) || els.map((e) => S.robustSelector(e)).join(',');
      };
      return {
        restored: out.restored, pressed: out.pressed, skipped: out.skipped,
        components: out.components.map((c) => {
          const parts = {};
          for (const k of Object.keys(c.parts)) parts[k] = nameFor(c.root, c.parts[k]);
          return { type: c.type, root: c.root ? S.robustSelector(c.root) : '', why: c.why, parts };
        }),
      };
    });
  } catch { return null; }
}

/**
 * What kind of thing is on this section, counted in the panel from data the
 * page already handed back. No model, no network, no wait — which is the whole
 * reason the survey can afford to look at every section.
 */
function screenInventory(candidates) {
  const KIND = {
    a: 'links', button: 'buttons', input: 'inputs', select: 'inputs',
    textarea: 'inputs', form: 'forms', nav: 'navs', table: 'tables',
    img: 'images', iframe: 'iframes', video: 'media', audio: 'media',
  };
  // A role is the better answer where there is one — a <div role="tab"> is a
  // tab, not a div, and that is what you are choosing sections by.
  // A container and the things inside it are two different answers. Counting a
  // tablist among its own tabs reported the five-tab finder as six tabs — a
  // number that is wrong in the one place you are using numbers to choose.
  const ROLE = {
    tab: 'tabs', tablist: 'tab strips',
    menu: 'menus', menubar: 'menus',
    dialog: 'dialogs', alertdialog: 'dialogs',
    listbox: 'lists', option: 'options',
    combobox: 'comboboxes', grid: 'grids', table: 'tables', row: 'rows',
    checkbox: 'checkboxes', radio: 'radios', button: 'buttons', link: 'links',
  };
  const tally = new Map();
  for (const c of candidates || []) {
    const kind = ROLE[(c.role || '').toLowerCase()] || KIND[(c.tag || '').toLowerCase()] || 'other';
    tally.set(kind, (tally.get(kind) || 0) + 1);
  }
  // "other" is every div the collector picked up on a class hint. It is real,
  // but naming it adds nothing to a choice, so it sorts last and is dropped
  // once there is anything better to say.
  const rows = [...tally.entries()].sort((a, b) =>
    (a[0] === 'other') - (b[0] === 'other') || b[1] - a[1]);
  const named = rows.filter(([k]) => k !== 'other');
  return (named.length ? named : rows).slice(0, 4)
    .map(([k, v]) => `${v} ${v === 1 ? SINGULAR[k] || k : k}`).join(', ');
}

// Written out rather than stripped with a regex. Chopping /e?s$/ turns "tables"
// into "tabl" and "images" into "imag" — which is where the "1 tabl" in a real
// run came from. English is not regular enough to guess at in a label somebody
// is reading to make a decision.
const SINGULAR = {
  links: 'link', buttons: 'button', inputs: 'input', forms: 'form',
  navs: 'nav', tables: 'table', images: 'image', iframes: 'iframe',
  media: 'media', tabs: 'tab', 'tab strips': 'tab strip', menus: 'menu',
  dialogs: 'dialog', lists: 'list', options: 'option', comboboxes: 'combobox',
  grids: 'grid', rows: 'row', checkboxes: 'checkbox', radios: 'radio',
  other: 'other',
};

// ── The sections, to choose from ─────────────────────────────────────────────
// The survey above cost nothing. Reading a section costs a model call, so the
// choice sits here, in front of the first thing that is charged for — and it is
// made from the photographs, which is the one form in which fifteen sections
// can actually be judged at a glance.

// What a call costs and how long it takes. The money is measured from this
// session as soon as there is anything to measure; the times are not measured
// at all and are labelled as estimates wherever they are shown.
// scanSecs was a flat 15 seconds per section, used by all three places that
// quote a time: the estimate box, the cost dialog, and the "Left" line of a
// running scan. Nothing ever measured it. The COST tightens after the first
// call — sweepAvgCall does that — while the note underneath said "Times are
// estimates" as though that were a property of time rather than of nobody
// having looked.
//
// A 94-element section took 1:34. All three quoted 15 seconds, and the clock
// beside the quote ran past it six times over. That is not a slightly-off
// estimate; it is a number with nothing behind it.
//
// How long a section takes is mostly how much is on it, so the fallback
// scales with the element count, and a measured rate replaces it as soon as one
// section has actually been read.
const SWEEP_EST = {
  scanBase: 10, scanPerElement: 0.85,
  fixSecs: 15, fixPerElements: 6, fallbackCall: 0.13, fixCall: 0.10,
};

/**
 * How long reading a section of `elements` should take, in seconds.
 *
 * Measured seconds-per-element from the sections this session has already
 * read, applied to the one being quoted for — so a run over a long page gets
 * more honest with every screen, in time as well as in money.
 */
function sweepSecsFor(elements) {
  const n = elements || 0;
  const done = (aiSweep.stops || []).filter((s) => s.scanned && s.secs > 0 && s.count > 0);
  if (done.length) {
    const perEl = done.reduce((a, s) => a + s.secs / s.count, 0) / done.length;
    return Math.max(SWEEP_EST.scanBase, Math.round(perEl * n));
  }
  return Math.round(SWEEP_EST.scanBase + n * SWEEP_EST.scanPerElement);
}

/** True once a real duration has been recorded, so the note can stop hedging. */
const sweepTimesMeasured = () =>
  (aiSweep.stops || []).some((s) => s.scanned && s.secs > 0 && s.count > 0);

const sweepAvgCall = () =>
  (aiCost > 0 && aiMapped.length ? aiCost / aiMapped.length : SWEEP_EST.fallbackCall);

const mins = (secs) => secs < 90 ? `~${Math.round(secs)}s`
  : `~${Math.round(secs / 60)}–${Math.round(secs / 60) + 2} min`;

function renderSweepScreens() {
  const wrap = document.getElementById('sweepPicks');
  const list = document.getElementById('sweepPicksList');
  const summary = document.getElementById('sweepPicksSummary');
  if (!wrap || !list) return;
  // The naming pause now renders INSIDE this list, dropped out of its section's
  // row. Redrawing the list throws that away — host, handlers and all — and the
  // promise it is waiting on can then never resolve: the run hangs with no
  // panel and no way out. Toggling a switch in the summary above was enough to
  // do it, because that handler asks for a redraw.
  //
  // A pause owns the list while it is open. Everything a redraw would have
  // shown is still true when it closes, and the run redraws then.
  if (sweepLabel.resolve) return;

  const stops = aiSweep.stops;
  const elements = stops.reduce((s, x) => s + x.count, 0);
  const pickable = stops.filter(s => s.count).length;
  const todo = stops.filter(s => s.count && !s.scanned).length;
  // Two decisions and a price used to sit in one unbroken block, so the eye
  // read them as one thing and the price looked like part of the choosing. They
  // are separate questions — what to read, then what that costs — and each now
  // says which it is.
  summary.innerHTML = `<div class="block-title">What to read</div>` +
    `<div class="ai-meta">${stops.length} section${stops.length === 1 ? '' : 's'} · ` +
    `${elements} element${elements === 1 ? '' : 's'} · nothing spent yet</div>` +
    // Twenty-one sections is twenty-one clicks to clear, and "only the ones
    // with a carousel" starts from none rather than from all. "All" means all
    // the UNREAD ones — the read ones are paid for and are not part of what the
    // next press will charge for.
    `<label class="sweep-all"><input type="checkbox" id="sweepAllTick"${todo ? ' checked' : ''}>` +
    `Read all ${todo} section${todo === 1 ? '' : 's'} that have not been read yet` +
    // The dash state. A half-ticked box is the commonest thing on this screen —
    // you untick a couple of sections — and nothing said so, which made it read
    // as broken rather than as "some".
    (pickable > todo
      ? ` <em>(${pickable - todo} already read — those are not ticked and cost nothing)</em>`
      : '') + `</label>` +
    // Twenty-three sections read straight through is half an hour before any of
    // it can be used. On, because the components from section 1 are ready four
    // minutes in and there is no reason to sit on them — and off is one tick
    // away for a run you intend to start and walk away from.
    // ── How the run should behave, as one either/or ──────────────────────
    // These are two answers to one question, not two independent switches:
    // either the run stops at each section and waits for you, or it does not
    // stop at all. Both ticked is a state the run cannot honour, and both empty
    // is no answer — so they are radios, and the mutual exclusion is in the
    // markup rather than in a handler that has to remember to enforce it.
    `<div class="sweep-mode"><span class="sweep-mode-head">How it should run</span>` +
    `<label class="sweep-all"><input type="radio" name="sweepMode" id="sweepPauseTick"${
      sweepLabel.on || sweepPause.on ? ' checked' : ''}>` +
    `Stop at each section` +
    `<em> — show me what it found, let me build it, carry on when I press continue</em></label>` +
    `<label class="sweep-all"><input type="radio" name="sweepMode" id="sweepSilentTick"${
      !sweepLabel.on && !sweepPause.on ? ' checked' : ''}>` +
    `Do not stop` +
    `<em> — read the whole page and make everything accessible on its own</em></label></div>`;

  // Two areas, because a half-finished run is the ordinary state — you start
  // one, you stop it, you come back tomorrow. "Which of these have I paid for
  // and which are still owed" is the only question the list has to answer then,
  // and a flat list of twenty-six rows with a small tag on some of them does
  // not answer it at a glance.
  const left = stops.filter(x => !x.scanned);
  const read = stops.filter(x => x.scanned);
  // What the completed sections are actually WORTH. A drawer that only counts
  // sections answers "how far have I got" and not "is there anything in there
  // for me yet" — and the second is what decides whether the rest of the run
  // has to finish before any of it can be used.
  const foundSoFar = read.reduce((a, x) => a + ((x.found || []).filter(f => !f.done).length), 0);
  const listHtml = read.length
    ? (left.length
        ? `<div class="sweep-part"><h4>Still to search · ${left.filter(x => x.count).length}</h4>` +
          left.map(sweepScreenRowHtml).join('') + `</div>`
        : `<div class="sweep-part sweep-part-empty">Every section is completed.</div>`) +
      `<details class="sweep-part sweep-part-done" open><summary>Completed · ${read.length}` +
      (foundSoFar
        ? ` · ${foundSoFar} component${foundSoFar === 1 ? '' : 's'} found` +
          `<button class="btn-outline btn-xs" data-build-found>${aiSweep.running
            ? 'Stop and build these' : 'Build fixes for these'}</button>`
        : '') +
      `</summary>` +
      read.map(sweepScreenRowHtml).join('') + `</details>`
    : stops.map(sweepScreenRowHtml).join('');
  list.innerHTML = listHtml;
  // The one-section fold belongs to an open pause. Redrawing the list removes
  // the bar that toggles it but not the class that hides everything, so the
  // other twenty-two stayed hidden with no way to bring them back.
  list.classList.remove('lbl-focus');
  // Re-apply the "reading now" mark the redraw just threw away.
  if (aiSweep.running && sweepReadingNow != null) markScreenReading(sweepReadingNow);

  setStage(mapMode === 'sweep' ? 'screens' : 'none');
  syncSweepMakeBtn();
  saveSweep();
}

/**
 * One section, as a row you can tick to pay to read it.
 *
 * Pulled out of renderSweepScreens so the same row can be shown again AFTER a
 * read, under "not read yet" — reading the first screen used to replace the
 * whole list with its results, and the other seventeen sections simply
 * disappeared with no way back to them short of scanning the page again.
 */
function sweepScreenRowHtml(stop) {
    const img = safeImg(stop.thumb);
    const empty = !stop.count;
    // A section that has already been read starts UNTICKED. It was ticked, so
    // pressing Read a second time — to pick up the ones that failed, or the
    // ones a longer page added — quietly paid for all of them again. Still
    // tickable by hand: re-reading one deliberately is a real thing to want,
    // and it should cost a deliberate click.
    const done = !!stop.scanned;
    const failed = !done && !!stop.failed;
    return `
      <div class="ai-approved-row ai-bulk-row sweep-screen${empty ? ' is-empty' : ''}${done ? ' is-done' : ''}${failed ? ' is-failed' : ''}" data-screen="${stop.n}">
        <input type="checkbox" class="sweep-screen-tick" ${empty ? 'disabled' : (done ? '' : 'checked')}
               aria-label="Search section ${stop.n}${done ? ' again' : ''}">
        ${// One screen, on its own, now.
          //
          // Ticking and pressing the button at the bottom is the right shape
          // for "read these nine" and the wrong shape for "just this one" —
          // which is what a page actually gets worked through as: read one,
          // build its fixes, apply them, look at the page, read the next. That
          // took three actions (untick all, tick one, scroll to the button)
          // where it should take one, and every one of them is a chance to pay
          // for a screen you did not mean.
          //
          // Same run, same guard, same cost dialog — it is the ticking that is
          // skipped, not the confirmation.
          empty ? '' :
          `<button class="btn-icon sweep-play" data-play-screen="${stop.n}"${aiSweep.running ? ' disabled' : ''}
                   title="Search only this section — one call"
                   aria-label="Search only section ${stop.n} — one call">▶</button>`}
        ${img ? `<span class="mh-thumb" data-shot="${stop.n}">
                   <img class="mh-img" src="${img}" alt="Section ${stop.n}">
                 </span>` : ''}
        <div class="ai-bulk-body">
          <span class="ai-approved-label">Section ${stop.n}${done ? ' <span class="sweep-read-flag">completed</span>' : ''}${failed ? ' <span class="sweep-fail-flag">not read</span>' : ''}</span>
          ${// The components come first and in the panel's own text colour.
            // "22 links, 19 buttons" says how busy a section is; the components
            // say whether it is worth paying to read, which is the actual choice.
            //
            // A section with none says so out loud. Left blank, an unmarked
            // picture reads as "the tool missed it" rather than "there is
            // nothing here but links and text" — which is a real answer, and
            // usually a reason not to spend a call on it.
            //
            // "no COMPLEX components", not "no components": a section of
            // links, buttons and inputs is full of components, they are just
            // the simple kind that needs no mapping. The shorter wording read
            // as "nothing here", which is wrong and reads as a failure.
            // ── Once it has been searched, the guess is no longer the answer ──
            //
            // The survey line is a free guess read off the markup: "6 menus ·
            // form · dialog? · carousel?". The search then returned two
            // components — and the row went on displaying the guess, so the
            // panel showed one set of things in the survey and a different set
            // in the results with nothing in between. Asked, exactly: where is
            // this and where is that.
            //
            // Both are true, and they answer different questions. The guess
            // counts what is ON the section. The search reports what is LEFT to
            // map — and most of the difference is that the rest is already
            // mapped, or was found in an earlier section. That sentence already
            // existed, as stop.outcome, written into the scan log: collapsed,
            // and two panels away from the row that raised the question.
            //
            // So a searched section leads with what the search concluded, and
            // keeps the guess under it, named as the guess it was.
            done && stop.outcome
            ? `<span class="sweep-components">${escapeHtml(stop.outcome)}</span>` +
              (stop.components
                ? `<span class="sweep-guess">first pass had guessed: ${escapeHtml(stop.components)}</span>`
                : '')
            : stop.components
            ? `<span class="sweep-components">${escapeHtml(stop.components)}</span>`
            : stop.count
            ? `<span class="sweep-components sweep-none">no complex components — simple elements only</span>`
            : ''}
          ${stop.truncated ? '<span class="ai-sev" data-need="1">only the first 250 counted</span>' : ''}
          ${stop.positional ? '<span class="ai-sev" data-need="1">positional</span>' : ''}
          <div class="ai-approved-why">${stop.count}${stop.truncated ? '+' : ''} element${stop.count === 1 ? '' : 's'}${
            stop.inventory ? ' · ' + escapeHtml(stop.inventory) : ''}${
            // A sticky header is counted once, on the section that first sees
            // it. Ticking only the middle of a page would otherwise leave out
            // the site's main navigation with nothing to say it had.
            stop.sticky ? ` · includes the sticky header (${stop.sticky})` : ''}${
            // Something here runs past the edge of the picture and carries on in
            // the next section. Tick one without the other and you map half of
            // it — which is worth saying before the choice, not after.
            stop.continuedFrom ? ` · continued from section ${stop.continuedFrom}` : ''}${
            stop.continuesOnto ? ` · continues onto section ${stop.continuesOnto}` : ''}${
            stop.positional ? ` · ${stop.positional} can only be reached by position — ask the client for a class` : ''}${
            // An observation is worth marking as one: these were not read off
            // the markup, they were opened and watched.
            (stop.probed || []).length ? ` · ${stop.probed.length} confirmed by opening ${stop.probed.length === 1 ? 'it' : 'them'}` : ''}</div>
        </div>
      </div>`;
}

/**
 * The estimate under the sections list.
 *
 * Two rows, because they are two different promises. "Scan" is what pressing
 * the button now will cost. "Fix" is what would follow IF every component found
 * were then ticked — a ceiling, not a forecast, and said so on the line itself.
 * Rolling them into one number would quote a bill nobody has agreed to yet.
 */
/**
 * The same box, for a run in progress: what it has done and spent, and what is
 * left of THIS run — not what a press that is not going to happen would cost.
 */
function sweepRunningHtml() {
  const p = aiSweep.progress || { at: 0, of: 0, screen: 0 };
  const stops = aiSweep.stops || [];
  const spent = stops.reduce((a, x) => a + (x.cost || 0), 0);
  const left = Math.max(0, p.of - p.at);
  const call = sweepAvgCall();
  // What is left is the elements on the sections not yet read, not a count of
  // sections times a constant — the remaining ones may be nothing like the
  // ones already done.
  const leftEls = stops.filter((s) => !s.scanned && s.count).reduce((a, s) => a + s.count, 0);
  const found = stops.reduce((a, x) => a + ((x.found || []).filter(f => !f.done).length), 0);
  return `
    <div class="sweep-est">
      <div class="sweep-est-head">Searching · section ${p.screen} · ${p.at} of ${p.of}</div>
      <div class="sweep-est-row">
        <span>Done</span><span>${p.at - 1} section${p.at - 1 === 1 ? '' : 's'}</span>
        <span>$${spent.toFixed(2)}</span>
      </div>
      <div class="sweep-est-row">
        <span>Left</span><span>${mins(sweepSecsFor(leftEls))}</span>
        <span>~$${(left * call).toFixed(2)}</span>
      </div>
      <div class="sweep-est-note">${found
        ? `${found} component${found === 1 ? '' : 's'} found so far — you can stop and build them from the drawer above.`
        : 'Nothing found yet. You can stop at any section; what is done stays done.'}</div>
      ${sweepSettledHtml()}
    </div>`;
}

/**
 * What each finished section actually settled, as it goes.
 *
 * A silent run — "do not ask me anything" — reports its progress as a section
 * number and a clock, and the only record of what it DECIDED is the scan log,
 * which is an accordion that starts shut. So twenty minutes in the honest
 * answer to "what has it done?" was "look in a collapsed panel, line by line".
 *
 * Newest first, because the interesting one is the one that just finished.
 */
function sweepSettledHtml() {
  const done = (aiSweep.stops || []).filter((s) => s.scanned && s.outcome);
  if (!done.length) return '';
  const rows = done.slice(-6).reverse().map((s) => {
    const k = (s.found || []).length;
    const built = (s.found || []).filter((f) => f.done).length;
    return `
      <div class="sweep-settled-row">
        <span class="sweep-settled-n">Section ${s.n}</span>
        <span class="sweep-settled-what">${escapeHtml(s.outcome)}</span>
        ${k ? `<span class="sweep-settled-k">${built}/${k} built</span>` : ''}
      </div>`;
  }).join('');
  return `
    <details class="sweep-settled" open>
      <summary>${done.length} section${done.length === 1 ? '' : 's'} settled${
        done.length > 6 ? ' — last 6' : ''}</summary>
      ${rows}
    </details>`;
}

/**
 * How many model calls a set of sections actually costs.
 *
 * Not one per section. A section is asked about in batches of SWEEP_ASK_BATCH,
 * so a 97-element section is two calls — and quoting it as one was the other
 * half of the same bug that lost its tail: the number under the button was
 * right only because the elements past sixty were being silently dropped.
 */
function sweepCallsFor(numbers) {
  const list = (aiSweep.stops || []).filter((s) => numbers.includes(s.n));
  return list.reduce((a, s) => a + Math.max(1, Math.ceil((s.count || 0) / SWEEP_ASK_BATCH)), 0);
}

function sweepEstimateHtml(sections, elements, calls) {
  const call = sweepAvgCall();
  if (calls == null) calls = sections;
  const comps = Math.max(1, Math.round(elements / SWEEP_EST.fixPerElements));
  const measured = aiCost > 0 && aiMapped.length;
  // "26 screens" read as twenty-six pages. They are twenty-six SECTIONS of one
  // page — the sections a scroll passes through. A sweep is pinned to a
  // single tab and a single URL, so the screen count is one by construction,
  // and saying so is what makes the section count mean anything.
  return `
    <div class="sweep-est">
      <div class="block-title">What it costs</div>
      <div class="sweep-est-head">Ticked: ${sections} section${sections === 1 ? '' : 's'} on 1 page · ${elements} element${elements === 1 ? '' : 's'}</div>
      <!-- Three stages, each saying whether it costs anything. The survey is
           already done and was free, and leaving it off the list made the two
           paid rows look like the whole of the work — so "what have I spent so
           far" had no answer on the one panel where it is decided. -->
      <div class="sweep-est-row is-free">
        <span>Survey</span><span>done</span><span>free</span>
      </div>
      <div class="sweep-est-row">
        <span>Find</span><span>${mins(sweepSecsFor(elements))}</span>
        <span>~$${(calls * call).toFixed(2)}</span>
        ${calls > sections ? `<em>${calls} calls for ${sections} section${sections === 1 ? '' : 's'} — the busy ones are asked about in more than one</em>` : ''}
      </div>
      <div class="sweep-est-row">
        <span>Build</span><span>${mins(comps * SWEEP_EST.fixSecs)}</span>
        <span>~$${(comps * SWEEP_EST.fixCall).toFixed(2)}</span>
        <em>costs only for the components you then tick — all ~${comps} of them here</em>
      </div>
      <div class="sweep-est-note">${measured || sweepTimesMeasured()
        ? `From this session's own sections — ${measured ? 'prices' : ''}` +
          `${measured && sweepTimesMeasured() ? ' and ' : ''}${sweepTimesMeasured() ? 'times' : ''} ` +
          `measured, not guessed.`
        : `Estimates, and the time scales with how busy a section is. ` +
          `Both tighten once the first section has been read.`}</div>
    </div>`;
}

// ── What it found, to choose from ───────────────────────────────────────────
// The sweep stops here on purpose. Everything above cost one call per SCREEN;
// working out the selectors for a component costs a call per COMPONENT. Putting
// the choice between the two is what makes "just the first screen" cheap
// instead of merely tidier — nothing below this list is paid for until it is
// ticked and the button is pressed.
function renderSweepPicks() {
  const wrap = document.getElementById('sweepPicks');
  const list = document.getElementById('sweepPicksList');
  const summary = document.getElementById('sweepPicksSummary');
  if (!wrap || !list) return;

  const read = aiSweep.stops.filter(s => s.found.length);
  // A section whose components have all been made accessible is finished, and
  // it is not a choice any more. It used to stay in the list with everything
  // ticked, so the next press offered to do the same work again; and hiding the
  // whole panel after applying took the rest of the page with it. Done sections
  // move to their own drawer, shut, where they can still be looked at.
  // A component that could not be mapped is not done, so its section stays in
  // the pending list carrying the reason. "Six found, five saved" must never
  // again be something you notice by counting.
  const stops = read.filter(s => !s.found.every(f => f.done));
  const finished = read.filter(s => s.found.length && s.found.every(f => f.done));
  const total = stops.reduce((s, x) => s + x.found.length, 0);
  const doneCount = finished.reduce((s, x) => s + x.found.length, 0);
  const barrenCount = read.filter(s => s.scanned && !s.found.length).length;
  if (!total && !doneCount && !barrenCount) { setStage('none'); return; }

  // The way back. Stopping a run to build what it had found left you in the
  // components view with no route to the sections that were never searched —
  // the survey was still there, and unreachable, so the only apparent way on
  // was to start the whole page again.
  const unsearched = aiSweep.stops.filter(x => x.count && !x.scanned).length;
  summary.innerHTML = `<div class="ai-meta">${total} component${total === 1 ? '' : 's'} across ` +
    `${stops.length} section${stops.length === 1 ? '' : 's'} · $${aiCost.toFixed(3)} to find them` +
    (unsearched
      ? ` · <button class="btn-outline btn-xs" data-back-to-sections>← ${unsearched} section${unsearched === 1 ? '' : 's'} still to search</button>`
      : '') + `</div>`;

  list.innerHTML = stops.map((stop, i) => {
    const img = safeImg(stop.thumb);
    const k = stop.found.length;
    return `
      <details class="sweep-group" data-stop="${stop.n}"${i === 0 ? ' open' : ''}>
        <summary>
          <input type="checkbox" class="sweep-group-tick" checked
                 aria-label="Choose everything found on screen ${stop.n}">
          ${img ? `<span class="mh-thumb" data-shot="${stop.n}">
                     <img class="mh-img" src="${img}" alt="Section ${stop.n}">
                     <img class="mh-preview" src="${img}" alt="">
                   </span>` : ''}
          <span class="sweep-group-name">Section ${stop.n}</span>
          <span class="sweep-group-meta">${k} component${k === 1 ? '' : 's'} · $${(stop.cost || 0).toFixed(3)}</span>
        </summary>
        <div class="sweep-group-body">${stop.found.map(f => `
          <div class="ai-approved-row ai-bulk-row" data-pick="${f.id}">
            <input type="checkbox" class="ai-bulk-tick" checked aria-label="Make ${escapeHtml(f.label)} accessible">
            <div class="ai-bulk-body">
              <span class="ai-approved-label">${escapeHtml(f.label)}</span>
              <code>u1.fix.${escapeHtml(f.type)}</code>
              ${f.needsWork ? '<span class="ai-sev" data-need="1">needs work</span>'
                            : '<span class="ai-sev" data-need="0">already looks correct</span>'}
              ${f.failed ? '<span class="ai-sev" data-need="1">could not be mapped</span>' : ''}
              <div class="ai-approved-why">${escapeHtml(f.why || f.sel)}</div>
              ${f.failed ? `<div class="ai-approved-why sweep-failed">${escapeHtml(f.failed)}</div>` : ''}
            </div>
          </div>`).join('')}</div>
      </details>`;
  }).join('');

  // Done, and out of the way. Named, so "which sections have I finished" is
  // answerable at a glance rather than by remembering.
  if (finished.length) {
    const doneBox = document.createElement('details');
    doneBox.className = 'sweep-done';
    doneBox.innerHTML =
      `<summary><span class="sweep-done-name">✓ ${finished.length} section${finished.length === 1 ? '' : 's'} completed</span>` +
      `<span class="sweep-done-meta">${doneCount} component${doneCount === 1 ? '' : 's'} made accessible</span></summary>` +
      `<div class="sweep-done-body">${finished.map(stop => `
        <div class="sweep-done-row" data-screen="${stop.n}">
          ${safeImg(stop.thumb) ? `<span class="mh-thumb"><img class="mh-img" src="${safeImg(stop.thumb)}" alt="Section ${stop.n}"></span>` : ''}
          <div class="ai-bulk-body">
            <span class="ai-approved-label">Section ${stop.n}</span>
            <div class="ai-approved-why">${stop.found.map(f => escapeHtml(f.label)).join(' · ')}</div>
          </div>
        </div>`).join('')}</div>`;
    list.appendChild(doneBox);
  }

  // The sections you did NOT pay to read. Reading one used to replace the
  // list with its results, and the rest of the page went with it — "I ticked
  // screen 1 and made it accessible, where is everything else". They are still
  // surveyed, still free, and still tickable; shut by default because the
  // components just found are what this step is about.
  // Read, and it produced nothing. Not a choice any more and not a failure —
  // but it must be SAYABLE, because two sections ticked and one section of
  // results is otherwise indistinguishable from the run having stopped early.
  const barren = read.filter(s => s.scanned && !s.found.length);
  if (barren.length) {
    const box = document.createElement('div');
    box.className = 'sweep-barren';
    box.innerHTML = barren.map(stop => `
      <div class="sweep-barren-row" data-screen="${stop.n}">
        <span class="sweep-barren-n">Section ${stop.n}</span>
        <span class="sweep-barren-why">${escapeHtml(stop.outcome || 'read, nothing found')}</span>
      </div>`).join('');
    list.appendChild(box);
  }

  const unread = aiSweep.stops.filter(s => !s.scanned && s.count);
  if (unread.length) {
    const rest = document.createElement('details');
    rest.className = 'sweep-rest';
    rest.innerHTML =
      `<summary><span class="sweep-rest-name">${unread.length} section${unread.length === 1 ? '' : 's'} not read yet</span>` +
      `<span class="sweep-rest-meta">already surveyed · free until you read ${unread.length === 1 ? 'it' : 'them'}</span></summary>` +
      `<div class="sweep-rest-body">${unread.map(sweepScreenRowHtml).join('')}` +
      `<button type="button" class="u1-btn u1-btn-secondary" id="sweepReadMoreBtn">Read the ticked sections</button></div>`;
    list.appendChild(rest);
    rest.querySelectorAll('.sweep-screen-tick').forEach(t => { t.checked = false; });
    rest.querySelector('#sweepReadMoreBtn').addEventListener('click', async () => {
      const picks = [...rest.querySelectorAll('.sweep-screen')]
        .filter(r => r.querySelector('.sweep-screen-tick')?.checked)
        .map(r => Number(r.dataset.screen));
      if (!picks.length) {
        showNotice(document.getElementById('sweepPicksStatus'),
          'Tick the sections you want read first.', 'warn', 4000);
        return;
      }
      await scanPickedScreens(picks);
    });
  }

  // The sweep's results belong to the Whole page route. Restoring a survey on
  // panel open, or adopting a colleague's, calls this whatever route is on
  // screen — which put "2 sections completed" and a Make-accessible button
  // underneath the single-element scanner, acting on nothing you were looking at.
  // One stage at a time: the components list IS this stage, and the review
  // that produced it belongs to the one before. Both on screen together, each
  // with its own apply button, is the stack this replaced.
  setStage(mapMode === 'sweep' ? 'components' : 'none');
  syncSweepMakeBtn();
  saveSweep();
}

/** Arm or disarm every per-row ▶ at once. */
function setPlayButtons(on) {
  document.querySelectorAll('#sweepPicksList .sweep-play')
    .forEach((b) => { b.disabled = !on; });
}

const sweepPicked = () => [...document.querySelectorAll('#sweepPicksList .ai-bulk-row[data-pick]')]
  .filter(r => r.querySelector('.ai-bulk-tick')?.checked)
  .map(r => r.dataset.pick);

const sweepPickedScreens = () => [...document.querySelectorAll('#sweepPicksList .sweep-screen')]
  .filter(r => r.querySelector('.sweep-screen-tick')?.checked)
  .map(r => Number(r.dataset.screen));

// One button, two jobs, because the list under it changes and the button is
// always "do the next thing to what is ticked". The count is on it in both
// cases: it is the number of calls that will be charged.
function syncSweepMakeBtn() {
  const btn = document.getElementById('sweepMakeBtn');
  const est = document.getElementById('sweepEstimate');
  if (!btn) return;

  if (aiSweep.phase === 'screens') {
    const picked = sweepPickedScreens();
    // Keep the master tick honest about what is under it. An empty section is
    // disabled and never counts either way, or "select all" could never reach
    // a fully-ticked state on a page that has one.
    const all = document.getElementById('sweepAllTick');
    const ticks = [...document.querySelectorAll('#sweepPicksList .sweep-screen-tick:not(:disabled)')];
    if (all && ticks.length) {
      all.checked = picked.length > 0;
      all.indeterminate = picked.length > 0 && picked.length < ticks.length;
    }
    const elements = aiSweep.stops.filter(s => picked.includes(s.n)).reduce((a, s) => a + s.count, 0);
    // The estimate keeps updating during a run — that is the point of marking
    // each section read as it goes. The BUTTON does not: a run owns it, and it
    // is saying which section it is on. This function used to overwrite that
    // with "Read 25 sections" after every section and re-enable it, so the
    // label flickered between two answers and the button invited a second run
    // on top of the one already going.
    if (!aiSweep.running) {
      btn.disabled = !picked.length;
      btn.textContent = picked.length
        ? `🔎 Find components in ${picked.length} section${picked.length === 1 ? '' : 's'}`
        : '🔎 No sections ticked';
    }
    // The box under the button described the NEXT press while the button
    // described the current run — two different moments, stacked. While a run
    // is going the box is about the run.
    if (est) {
      est.innerHTML = aiSweep.running
        ? sweepRunningHtml()
        : (picked.length ? sweepEstimateHtml(picked.length, elements, sweepCallsFor(picked)) : '');
    }
    return;
  }

  const k = sweepPicked().length;
  btn.disabled = !k;
  btn.textContent = k ? `✨ Build fixes for ${k} component${k === 1 ? '' : 's'} — ${k} more call${k === 1 ? '' : 's'}`
                      : '✨ Nothing ticked';
  if (est) est.innerHTML = '';
}

// One tick for a whole section, in both lists. Same behaviour, so they are
// wired the same way.
function wireGroupTicks(rootId, after) {
  document.getElementById(rootId)?.addEventListener('change', (e) => {
    // A sections-phase row has no group around it — it IS the unit — so it falls
    // straight through to `after`, which recomputes the estimate.
    const group = e.target.closest('.sweep-group');
    if (group) {
      if (e.target.classList.contains('sweep-group-tick')) {
        group.querySelectorAll('.ai-bulk-tick').forEach(t => { t.checked = e.target.checked; });
      } else if (e.target.classList.contains('ai-bulk-tick')) {
        const ticks = [...group.querySelectorAll('.ai-bulk-tick')];
        const head = group.querySelector('.sweep-group-tick');
        if (head) {
          head.checked = ticks.some(t => t.checked);
          head.indeterminate = head.checked && ticks.some(t => !t.checked);
        }
      }
      group.dataset.off = [...group.querySelectorAll('.ai-bulk-tick')].some(t => t.checked) ? '' : '1';
    }
    if (after) after();
  });
  // Clicking the thumbnail opens it full size — the hover preview settles
  // "which screen is this", not "is that the right button".
  document.getElementById(rootId)?.addEventListener('click', (e) => {
    const thumb = e.target.closest('.sweep-group .mh-thumb');
    if (!thumb) return;
    e.preventDefault();          // the summary would otherwise toggle the group
    const stop = aiSweep.stops.find(s => String(s.n) === thumb.dataset.shot);
    if (stop?.thumb) openImageDialog(stop.thumb);
  });
}
wireGroupTicks('sweepPicksList', syncSweepMakeBtn);
wireGroupTicks('aiBulkList');

// ── Hovering a section shows it on the real page ──────────────────────────
//
// A 340px picture of a section answers "roughly where am I". Scrolling the
// actual page there and outlining the components on it answers "is THAT the nav
// I mean" — which is the question you are actually holding while you decide
// whether a section is worth paying to read.
//
// The marks are drawn from a fresh collection at that scroll position rather
// than from what the survey stored: it is local code, it costs nothing, and it
// means the outlines are of the page as it is now, not as it was.
let sweepHover = { n: 0, timer: null, restoreY: null, busy: false };

/**
 * The tab a sweep's results belong to — not whichever tab is in front now.
 *
 * Everything that acts on those results scrolls a page and draws on it, so
 * pointing any of it at the wrong tab is worse than doing nothing. Returns null
 * once that tab is gone, and the caller simply does not act.
 */
async function sweepTab() {
  if (aiSweep.tabId != null) {
    try {
      const t = await chrome.tabs.get(aiSweep.tabId);
      return isInjectable(t) ? t : null;
    } catch { return null; }   // closed or navigated away
  }
  const t = await getTab();
  return isInjectable(t) ? t : null;
}

/**
 * True when there is sweep work — running or finished — tied to a tab that is
 * still open.
 *
 * Switching browser tab changes the panel's hostname, and the panel clears the
 * AI workspace on every hostname change. That is right for a scan of "whatever
 * is in front of me" and wrong for a sweep, which is pinned to one tab: looking
 * at another tab and coming back threw the whole survey away and started it
 * over. The results are still that tab's results, so they stay.
 */
async function sweepIsPinnedAndAlive() {
  if (aiSweep.tabId == null) return false;
  if (!aiSweep.running && !(aiSweep.stops && aiSweep.stops.length)) return false;
  return !!(await sweepTab());
}

/**
 * True when the pinned tab is the one actually on screen.
 *
 * captureVisibleTab photographs whichever tab is in FRONT of the window, not
 * the tab id you pass — pass a backgrounded tab and it hands back a picture of
 * a different page, with no error. A sweep that keeps running while you work in
 * another tab must therefore skip its thumbnails rather than store wrong ones.
 */
/**
 * Block until the sweep's own page is at the front again.
 *
 * captureVisibleTab photographs whatever is in front and throws outright when
 * the window is minimised — and that throw used to escape collectRegion (its
 * try had a finally and no catch), reach the run's outer catch and end a
 * twenty-six section scan on the spot. Switching tabs mid-run is ordinary; it
 * must cost nothing but the wait.
 *
 * Resolves IMMEDIATELY when the tab is already in front, so a run that is never
 * interrupted pays nothing for this. The poll is 120ms, which is below what
 * anyone perceives as a delay on coming back.
 */
// ── Photographing a page that is not in front ───────────────────────────────
//
// captureVisibleTab photographs whatever tab is in FRONT, whatever id it is
// handed, and throws when the window is minimised. Everything the sweep does is
// built on a photograph, so with that as the only camera "leave it running and
// carry on working" is not something the tool can offer — it can only wait, and
// waiting is what it did.
//
// The debugger protocol has a camera that does not care: Page.captureScreenshot
// photographs the tab it is attached to, in the background, unfocused. That is
// the whole difference between pausing and running.
//
// It is attached for the length of a run and detached the moment it ends —
// Chrome shows its own banner on the page for as long as it is attached, which
// is right: the browser saying out loud that something is driving this tab.
//
// It can fail to attach for one ordinary reason: DevTools is already open on
// that tab, and Chrome allows one debugger at a time. That is not an error to
// hide — it changes what the run can do — so it is reported and the run falls
// back to the focus-bound camera.
//
// And one way it fails that is not ordinary at all, which is the whole reason
// the timeout below exists:
//
//   Page.captureScreenshot defaults to fromSurface:true — it photographs the
//   BROWSER'S composited surface. A backgrounded tab does not produce frames,
//   so on a hidden tab that call does not fail, does not return an empty
//   picture, and does not throw. It never settles. `await` on it waits for the
//   rest of the session.
//
// Which is exactly the case the camera was attached for. Every debugger call
// therefore races a clock, and a timeout is not a shrug: it retries once with
// fromSurface:false — the renderer-side path, which does not need frames —
// and if that will not answer either the camera is demoted for the rest of the
// run and the focus-bound one takes over, saying so.
const sweepCam = { tabId: null, attached: false, why: '' };

// A screenshot of a big page is not instant, and killing a slow-but-working
// camera would be its own bug. Eight seconds is far outside a normal capture
// and far inside "why has this section taken two minutes".
const CDP_TIMEOUT_MS = 8000;

/** One debugger command, with a clock on it. Rejects rather than hanging. */
function cdp(tabId, method, params, ms = CDP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`${method} did not answer within ${Math.round(ms / 1000)}s`));
    }, ms);
    chrome.debugger.sendCommand({ tabId }, method, params || {}).then(
      (res) => { if (!done) { done = true; clearTimeout(timer); resolve(res); } },
      (err) => { if (!done) { done = true; clearTimeout(timer); reject(err); } });
  });
}

async function beginBackgroundCapture(tab) {
  sweepCam.tabId = tab.id;
  sweepCam.attached = false;
  sweepCam.why = '';
  if (!chrome.debugger) { sweepCam.why = 'this browser has no debugger API'; return false; }
  try {
    await chrome.debugger.attach({ tabId: tab.id }, '1.3');
    // Page.captureScreenshot happens to work on some builds without its domain
    // enabled and returns an empty result on others, which reads as "the camera
    // is attached and produces nothing" — the worst of the three outcomes.
    try { await cdp(tab.id, 'Page.enable', {}, 3000); } catch {}
    sweepCam.attached = true;
    return true;
  } catch (e) {
    const msg = String((e && e.message) || e);
    sweepCam.why = /already attached/i.test(msg)
      ? 'DevTools is open on that tab, and Chrome allows one debugger at a time'
      : msg;
    return false;
  }
}

/**
 * Attach the background camera, and say in the log which camera this run has.
 *
 * Whether you can switch tabs and carry on working is the single most visible
 * difference between the two, so it is not something to discover by trying it.
 * It is one line at the top of the scan log, before the first section.
 */
async function announceCamera(tab) {
  const ok = await beginBackgroundCapture(tab);
  sweepLog(0, ok
    ? 'background camera on — switch tabs and work as usual, this keeps going'
    : `no background camera (${sweepCam.why}) — this run needs its own tab in front, and pauses when you leave it`,
    ok ? '' : 'skip');
  return ok;
}

async function endBackgroundCapture() {
  if (!sweepCam.attached || sweepCam.tabId == null) { sweepCam.attached = false; return; }
  try { await chrome.debugger.detach({ tabId: sweepCam.tabId }); } catch {}
  sweepCam.attached = false;
}

/**
 * One section, as a data URL.
 *
 * `onWait` is only ever called on the fallback path — the background camera
 * never waits, so a run using it must not print "waiting for the page".
 */
async function captureScreen(tab, quality, onWait) {
  if (sweepCam.attached && sweepCam.tabId === tab.id) {
    // fromSurface:true is the default and photographs the browser's composited
    // surface, which a hidden tab does not produce — so on the very tab this
    // camera exists to photograph, the call can simply never settle. It gets a
    // clock, and a timeout is retried on the renderer-side path, which needs no
    // frames.
    for (const surface of [true, false]) {
      try {
        const res = await cdp(tab.id, 'Page.captureScreenshot',
          { format: 'jpeg', quality, fromSurface: surface });
        if (res && res.data) return 'data:image/jpeg;base64,' + res.data;
        // Attached, no error, no picture. Left as it was, every section would
        // pay the round trip and then fall through anyway.
        sweepCam.why = 'it returned an empty picture';
      } catch (e) {
        // A detach mid-run (the tab navigated, DevTools opened) or a call that
        // would not answer. Either way this is the last word on that path.
        sweepCam.why = String((e && e.message) || e);
      }
    }
    // Both paths tried. Demoted for the rest of the run — retrying a camera
    // that has already cost sixteen seconds of silence on every remaining
    // section is how one slow screen becomes a run nobody can sit through.
    sweepCam.attached = false;
    sweepLog(0, `background camera stopped working (${sweepCam.why}) — ` +
      `from here this run needs its own tab in front`, 'err');
  }
  if (!(await awaitTabVisible(tab, onWait))) return null;
  try {
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality });
  } catch { return null; }
}

async function awaitTabVisible(tab, onWait) {
  if (await pinnedTabIsVisible(tab)) return true;
  let told = false;
  for (let waited = 0; waited < 10 * 60 * 1000; waited += 120) {
    if (aiSweep.abort) return false;
    if (!told && onWait) { told = true; onWait(); }
    await new Promise((r) => setTimeout(r, 120));
    if (await pinnedTabIsVisible(tab)) return true;
  }
  return false;
}

async function pinnedTabIsVisible(tab) {
  try {
    const t = await chrome.tabs.get(tab.id);
    if (!t.active) return false;
    const w = await chrome.windows.get(t.windowId);
    return !!w.focused || w.state !== 'minimized';
  } catch { return false; }
}

async function sweepPreviewScreen(n) {
  const stop = aiSweep.stops.find(s => s.n === n);
  // A run owns the page's scroll position, so previewing during one would move
  // the page out from under the section being read. But a run that is HOLDING —
  // for fixes, or for you to name what is on a section — is not moving
  // anything, and that is exactly when this list is being looked at. Blocking
  // both on one flag is why the preview "stopped working": it was disabled at
  // the only moment it was wanted.
  // …but NOT while the naming pause is open. That pause is built on the marks
  // drawn on the page, and this function re-collects — whose first line is
  // clearMarks(). Hovering the sections list wiped every mark, and the next
  // press of "build them" failed with "None of those marks are on the page any
  // more" on a component that was still plainly there.
  //
  // The hold-for-fixes banner does not depend on marks, so previewing is still
  // allowed there.
  const held = !!sweepPause.resolve;
  if (!stop || sweepHover.busy || sweepLabel.resolve || (aiSweep.running && !held)) return;
  const tab = await sweepTab();
  if (!tab) return;
  sweepHover.busy = true;
  try {
    // Where the page was before any of this, so it can be put back.
    if (sweepHover.restoreY === null) sweepHover.restoreY = (await sweepMeasure(tab))?.y ?? 0;
    await inPage(tab.id, (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' }), [stop.scrollY]);
    // For a screen already read, the components ARE known — mark those, by the
    // selectors that were paid for, rather than re-guessing from the markup.
    // For one not read yet, a fresh local collection is all there is, and it is
    // free.
    const known = (stop.found || []).map(f => ({
      mark: null, selector: f.sel, component: f.type, maybe: false, observed: true,
    }));
    await inPage(tab.id, (known) => {
      const got = window.__u1SelectorIntel.collectCandidates(200, null);
      window.__u1SelectorIntel.drawComponentMarks(known.length ? known : got.candidates);
    }, [known]);
  } catch { /* the page may have navigated away mid-hover */ }
  finally { sweepHover.busy = false; }
}

async function sweepPreviewEnd() {
  const tab = await sweepTab();
  if (!tab) return;
  try {
    await inPage(tab.id, () => window.__u1SelectorIntel.clearMarks());
    if (sweepHover.restoreY !== null) {
      await inPage(tab.id, (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' }), [sweepHover.restoreY]);
      sweepHover.restoreY = null;
    }
  } catch {}
}

document.getElementById('sweepPicksList')?.addEventListener('mouseover', (e) => {
  // Gated on the phase, this stopped working the moment one section had been
  // read — which is exactly when the rest of the list is most worth looking at,
  // and when the "not read yet" rows appear. A row that names a section can
  // preview that section whatever phase the panel is in. Both shapes qualify:
  // an unread screen row, and a group of components found on one.
  const row = e.target.closest('.sweep-screen, .sweep-group, .sweep-done-row');
  if (!row) return;
  const n = Number(row.dataset.screen || row.dataset.stop);
  if (!n || n === sweepHover.n) return;
  sweepHover.n = n;
  document.querySelectorAll('#sweepPicksList .is-previewing')
    .forEach(x => x.classList.remove('is-previewing'));
  row.classList.add('is-previewing');
  // Debounced: sweeping the mouse down twenty-one rows must not fire twenty-one
  // scrolls, and the page jumping about under the cursor is the whole failure
  // mode this guards against.
  clearTimeout(sweepHover.timer);
  sweepHover.timer = setTimeout(() => sweepPreviewScreen(sweepHover.n), 160);
});

document.getElementById('sweepPicksList')?.addEventListener('mouseleave', () => {
  clearTimeout(sweepHover.timer);
  sweepHover.n = 0;
  document.querySelectorAll('#sweepPicksList .is-previewing')
    .forEach(x => x.classList.remove('is-previewing'));
  // Leaving the list puts the page back where it was. A tool that scrolls
  // somebody's page and walks away has moved their work, not shown them theirs.
  sweepPreviewEnd();
});

// Select all / none. It lives in the summary, which is rebuilt on every render,
// so it is delegated rather than bound to the element.
document.getElementById('sweepPicksSummary')?.addEventListener('change', (e) => {
  // Sits in the same rebuilt summary, so it is delegated from the same place.
  // One question, two answers. Stopping means both halves — being shown what a
  // section holds, and being given the chance to build it — because a run that
  // shows you a section and then moves on regardless is not a stop.
  if (e.target.id === 'sweepPauseTick' || e.target.id === 'sweepSilentTick') {
    const stopping = e.target.id === 'sweepPauseTick';
    sweepLabel.on = stopping;
    sweepPause.on = stopping;
    saveSweep();
    return;
  }
  if (e.target.id !== 'sweepAllTick') return;
  const on = e.target.checked;
  document.querySelectorAll('#sweepPicksList .sweep-screen-tick:not(:disabled)')
    .forEach(t => { t.checked = on; });
  syncSweepMakeBtn();
});

// Stop a build between components. Everything already saved stays saved.
document.getElementById('buildStopBtn')?.addEventListener('click', (e) => {
  aiBulk.abort = true;
  const b = e.currentTarget;
  b.disabled = true;
  b.textContent = 'Finishing this one…';
});

document.getElementById('sweepPicksClearBtn')?.addEventListener('click', async () => {
  // Clear is the ONLY thing that forgets a stored survey. Switching site or
  // closing the panel must not, or the durability is theatre.
  //
  // It used to ask only when a section had been paid for. But the survey itself
  // is not nothing: it scrolled the whole page, photographed every section
  // and is shared with everyone on the project — and one press of a small grey
  // word took all of it with no question at all. Always ask.
  if (!(await confirmSweepClear())) return;
  clearTimeout(sweepSaveTimer);
  aiSweep.stops = [];
  await forgetSweep();
  // Shared work, so Clear clears it for everyone — leaving the server copy
  // would mean it silently reappeared the next time the panel was opened.
  if (await U1Auth.isLoggedIn()) {
    try { await U1Sync.deleteSweep(currentHostname); } catch {}
  }
  setStage('none');
  document.getElementById('sweepPicksList').innerHTML = '';
  document.getElementById('sweepLog').style.display = 'none';
  document.getElementById('sweepLog').innerHTML = '';
});

// ── The paid half ───────────────────────────────────────────────────────────
// Work out the selectors for the ticked components, then save and apply them.
// The choice was already made on the list above, so this does not ask a second
// time — it hands the prepared cards to the approval flow and presses its
// button, which is the one path that saves, applies and reports. Duplicating
// that here is how the two would drift.
// ── The first paid step: read the ticked sections ────────────────────────────
// One model call per ticked screen. The photograph the choice was made from is
// the small one; the model needs the numbered 1280px version, and that has to be
// taken at the right scroll position — so this scrolls back to each screen it
// was asked about. ~1.5s of scrolling against 10–30s of call is noise, and
// collecting afresh means the picture and the element list always agree.
async function scanPickedScreens(numbers) {
  const btn = document.getElementById('sweepMakeBtn');
  const status = document.getElementById('sweepPicksStatus');
  // The page the survey walked, not the one in front now — this scrolls back to
  // each section, and doing that to the wrong tab would both waste the calls
  // and move somebody's work.
  const tab = await sweepTab();
  if (!tab) {
    showNotice(status, 'The page these results came from is no longer open.', 'error', 6000);
    return;
  }
  if (!(await U1AI.getKey())) {
    await aiModeAllowed();   // no key: Setup is where that is fixed
    showNotice(status, 'Paste your Anthropic API key first.', 'error', 4000);
    return;
  }
  // This one is paid for, and the picture IS the request — so it has to be a
  // picture of THIS page. The background camera guarantees that without moving
  // anything, and is tried first.
  //
  // Only if it will not attach do we fall back to yanking the tab in front,
  // which is the rude version: it takes the window away from whatever you were
  // doing. That yank used to happen on every run, camera or no camera.
  // A survey restored from storage comes back with tabId null — the tab it
  // originally ran on is gone, and sweepTab() falls back to the one in front.
  // That is the right answer for reopening a survey and the wrong one for
  // continuing it: sweepIsPinnedAndAlive() requires a tabId, so without this a
  // restored survey is not "pinned", the hold in onTabChanged does not apply to
  // it, and pressing ▶ on it and then switching tabs resets it — which is
  // precisely the run that was reported as never having scanned.
  //
  // Reading a section pins the survey to the tab being read, whatever it was
  // pinned to before.
  aiSweep.tabId = tab.id;
  if (!aiSweep.url) aiSweep.url = tab.url || '';
  // A restored survey has no host of its own until it is continued.
  if (!aiSweep.host) aiSweep.host = getHostname(tab) || currentHostname;
  const cam = await announceCamera(tab);
  if (!cam && !(await pinnedTabIsVisible(tab))) {
    try {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      await new Promise(r => setTimeout(r, 250));
    } catch {}
  }

  const stops = aiSweep.stops.filter(s => numbers.includes(s.n));
  const handled = await alreadyHandled();
  const startedAt = (await sweepMeasure(tab))?.y || 0;
  clearApproved();   // a new run, a new answer to "what did I just do"
  aiSweep.running = true;
  aiSweep.abort = false;
  btn.disabled = true;
  // The floating "Stop after this section" button is gone. Every state this
  // run can be sitting in now carries its own way out — the naming pause and
  // the hold-for-fixes banner each have one — and a button that only appears
  // during a run, over the list you are reading, was one more thing in the way.
  // Deliberately NOT shown. The paid run holds after every section, and both
  // holds — naming and building — carry their own way out, next to the decision
  // being made. A button floating over the list you are reading, for the whole
  // length of a thirty-five minute run, was one more thing in the way.
  { const b = document.getElementById('sweepStopBtn'); if (b) b.style.display = 'none'; }
  // The rows are not redrawn during a run, so the ▶s that were live a moment
  // ago have to be disarmed where they stand. The finally redraws the list and
  // brings them back.
  setPlayButtons(false);

  try {
    for (let i = 0; i < stops.length; i++) {
      if (aiSweep.abort) break;
      const stop = stops[i];
      const before = aiCost;
      // Beside the cost, because they answer the same question about the same
      // section and only one of them was ever recorded.
      const beganAt = Date.now();
      // "Searching section 2 of 23" was read as screen 2 — which was already
      // completed and sitting in the drawer below. The counter is the position
      // in THIS run; the sections have numbers of their own. Two numbering
      // systems shown with one word, so the word is no longer alone.
      btn.textContent = `Searching section ${stop.n} — ${i + 1} of ${stops.length}…`;
      aiSweep.progress = { at: i + 1, of: stops.length, screen: stop.n };
      // Word for word what the button says, because they are read together
      // and a difference between them reads as a difference in meaning.
      // The step, not the section. A section is four steps — scroll, read,
      // photograph, ask — and one label covering all four is how "the model has
      // been thinking for ninety seconds" and "this has hung" look identical
      // from outside. Each step now names itself as it starts.
      showSweepBusy(`Section ${stop.n} — ${i + 1} of ${stops.length}`,
        `Reading what is on this section — a few seconds, no charge.`,
        ((i) / stops.length) * 100);
      markScreenReading(stop.n);

      await inPage(tab.id, (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' }), [stop.scrollY]);
      await new Promise(r => setTimeout(r, SWEEP_SETTLE_MS));

      const collected = await collectRegion(tab, '', handled, {
        drop: (c) => c.sticky && stop.n > 1,
        // The numbers stay on the page while you label, because they are the
        // only binding between a row here and an element there.
        keepMarks: sweepLabel.on,
      });
      if (collected.err) {
        sweepLog(stop.n, collected.err, 'err');
        // Attempted and failed is not the same as never tried, and it looked
        // identical: the run moved past sections 6 and 7 and left them sitting
        // in "still to search" with their original survey line, so the only
        // visible fact was that the completed drawer had holes in it.
        //
        // It stays in "still to search" — it genuinely was not searched, and it
        // is still worth a retry — but it says what happened.
        await markScreenFailed(stop, collected.err);
        continue;
      }
      // Every candidate on this section was filtered out before the model was
      // called: either already mapped, already found on an earlier section, or
      // part of the sticky header which is counted once. Nothing was charged.
      //
      // Silently skipping made a two-screen run look like a one-screen run —
      // the second screen produced no components, so renderSweepPicks dropped
      // its row and there was nothing on screen saying it had been looked at.
      // A section that was read and yielded nothing is a RESULT, and it says
      // so on its own row.
      if (!collected.candidates.length) {
        const why = collected.skipped
          ? `nothing new — all ${collected.skipped} element${collected.skipped === 1 ? '' : 's'} here were ` +
            (collected.dismissed === collected.skipped ? 'DISMISSED earlier'
             : collected.dismissed ? `already mapped or found earlier (${collected.dismissed} of them DISMISSED earlier)`
             : 'already found in an earlier section or already mapped')
          : 'nothing on this section to read';
        sweepLog(stop.n, why, 'skip');
        stop.scanned = true;
        stop.outcome = why;
        await markScreenRead(stop);
        continue;
      }

      // ── You say what it is ────────────────────────────────────────────────
      // The run stops here, with the numbers still drawn on the page, and waits.
      // Everything you name is built from measurement and costs nothing; only
      // what is left over is sent to the model. Name it all and the section
      // is free.
      let labelled = [];
      if (!Array.isArray(stop.found)) stop.found = [];
      if (sweepLabel.on) {
        const answer = await labelScreen(stop, collected, tab);
        if (answer.stopped) break;
        // "Do not ask me again." Both interruptions go: no more naming pause on
        // the sections after this one, and no more holding to build what they
        // find. The run reads the rest of the page and applies what it gets.
        if (answer.auto) {
          sweepLabel.on = false;
          sweepPause.on = false;
          sweepLog(stop.n, 'carrying on without asking — the rest of the page runs on its own', 'skip');
        }
        labelled = answer.labelled || [];
        if (labelled.length) {
          for (const made of labelled) {
            stop.found.push(made);
            handled.add(made.sel);
          }
        }
        // Nothing left for the model to look at: the screen is done, unpaid.
        if (answer.done) {
          stop.scanned = true;
          stop.cost = 0;
          stop.secs = Math.round((Date.now() - beganAt) / 1000);
          const k = labelled.length;
          // Confirming used to be free — it measured the component locally. It
          // now goes through the same engine the per-component route uses,
          // which reads the container's markup and costs a call each, because
          // the free measurement produced mappings whose every sub-selector was
          // the root again. Saying "nothing charged" over a real charge is the
          // one thing this line must not do.
          stop.outcome = k
            ? `${k} component${k === 1 ? '' : 's'} you confirmed — saved to Mappings and applied`
            : 'you marked nothing here as a component — nothing charged';
          sweepLog(stop.n, stop.outcome, k ? '' : 'skip', 0);
          await markScreenRead(stop);
          continue;
        }
      }

      // The one step that is neither quick nor local, and the only one that
      // costs. "Usually 10–30 seconds" was written for a sparse section and
      // read as a promise on every section: this one is 94 elements with a
      // picture attached, it took a minute and a half, and the panel said
      // nothing except a clock ticking past its own estimate. A call is allowed
      // 150 seconds before it is given up on, and that is what it now says.
      // Everything still worth asking about — the WHOLE section, not its first
      // screenful of DOM.
      const asking = collected.candidates.filter((c) => !handled.has(c.selector));
      const busyN = asking.length;
      // One call per batch. The picture goes with every batch: the model is
      // being asked "which of these elements form a component, and where is it
      // on this section", and the second half of that question is the image.
      const batches = [];
      for (let b = 0; b < asking.length; b += SWEEP_ASK_BATCH) {
        batches.push(asking.slice(b, b + SWEEP_ASK_BATCH));
      }
      sweepLog(stop.n, `asking about ${busyN} element${busyN === 1 ? '' : 's'}` +
        (batches.length > 1 ? ` in ${batches.length} calls — too many for one` : ''), 'skip');

      const parts = [];
      let died = null;
      for (let b = 0; b < batches.length; b++) {
        showSweepBusy(`Section ${stop.n} — ${i + 1} of ${stops.length}`,
          // Short enough for a banner pinned over the panel. The reassurance
          // that a slow answer is not a stuck one is on the tooltip: it is
          // worth saying once, not worth three lines of a fixed header on
          // every section of a thirty-section run.
          (batches.length > 1 ? `Part ${b + 1}/${batches.length} · ` : '') +
          `asking Claude about ${batches[b].length} element${batches[b].length === 1 ? '' : 's'}` +
          ` — a busy section takes a minute or two`,
          ((i) / stops.length) * 100,
          `Asking Claude about ${batches[b].length} element${batches[b].length === 1 ? '' : 's'} and a ` +
          `picture of this section. A busy one takes a minute or two — it only gives up if ` +
          `Claude goes quiet for a minute, so a long answer is never mistaken for a stuck one.`);
        const got = await U1AI.discover({
          screenshot: collected.shot,
          context: {
            candidates: batches[b],
            headings: collected.headings,
            title: collected.title,
            url: collected.url,
          },
        });
        if (got && got.err) { died = got.err; break; }
        aiCost += U1AI.estimateCost(got.usage) || 0;
        parts.push(got);
        if (aiSweep.abort) break;
      }
      if (died && !parts.length) {
        sweepLog(stop.n, died, 'err');
        await markScreenFailed(stop, died);
        // A rate limit or a network blip is not a reason to abandon the other
        // sections; a bad key is, and it would fail the same way on every one.
        if (/API 401/.test(died)) break;
        continue;
      }
      // Some batches answered and one did not. That is a partial result, and
      // throwing it away would be worse than keeping it — but it must not be
      // reported as a complete reading of the section.
      if (died) sweepLog(stop.n, `part of this section failed: ${died}`, 'err');
      const part = {
        components: parts.flatMap((p) => p.components || []),
        usage: null,
      };

      // needsWork is a LABEL, not a filter — which is how Automatic mode has
      // always treated it. Dropping the rows it marks false looked like a saving
      // and was actually a way to return nothing: the model is conservative with
      // that flag, so a page whose markup reads as broadly reasonable came back
      // empty even though every component on it still needed mapping.
      const found = (part.components || []).filter(c => c && c.containerSelector);
      let seenAgain = 0;
      // Keep what you named. This used to be `stop.found = []`, which is right
      // when the model is the only source and wrong the moment it is not —
      // everything labelled on this section before the call would have been
      // thrown away by the call's own answer.
      stop.found = (stop.found || []).filter((f) => f.done);
      for (const c of found) {
        // Never twice, whatever brought it back: a sticky bar, a repeated
        // footer, or a component straddling the overlap between two sections.
        if (handled.has(c.containerSelector)) { seenAgain++; continue; }
        handled.add(c.containerSelector);
        stop.found.push({
          id: `s${stop.n}i${stop.found.length}`,
          label: c.label || c.containerSelector,
          type: c.u1Type,
          sel: c.containerSelector,
          why: c.why || '',
          needsWork: c.needsWork !== false,
        });
      }
      stop.scanned = true;
      stop.cost = aiCost - before;
      stop.secs = Math.round((Date.now() - beganAt) / 1000);
      await markScreenRead(stop);
      const k = stop.found.length;
      const named = stop.found.filter((f) => f.done).length;
      // Everything that did NOT come back, accounted for.
      //
      // seenAgain only counts things the model returned that we already had —
      // the small half. The big half is dropped BEFORE the call: every
      // candidate already mapped, already dismissed, or already found in an
      // earlier section is filtered out of what gets sent, and that count
      // (collected.skipped) went nowhere. So a section the survey described as
      // "6 menus · form · dialog? · carousel?" came back as "2 components" with
      // the other several silently missing, and the obvious reading is that the
      // search failed.
      //
      // It did not. They were left out on purpose, and now it says so.
      const held = (collected.skipped || 0) + seenAgain;
      stop.outcome = (found.length || named)
        ? `${k} component${k === 1 ? '' : 's'} to map` +
          (named ? ` · ${named} you named, free` : '') +
          (held ? ` · ${held} left out — already mapped, dismissed, or found in an earlier section` : '')
        : held
        ? `nothing new to map — all ${held} thing${held === 1 ? '' : 's'} here are already mapped, dismissed, or were found in an earlier section`
        : 'read, and nothing on it needs mapping';
      sweepLog(stop.n, stop.outcome, k ? '' : 'skip', stop.cost);

      // ── "Do not stop": build them here, one at a time ─────────────────────
      // Finding is not the promise. "Read the rest of the page and make
      // everything accessible on its own" means the mappings arrive in the
      // drawer while it runs — and until now this mode found components,
      // logged them, and left every one of them to be built by hand from a
      // drawer, which is the opposite of what it says.
      if (!sweepPause.on && !sweepLabel.on) {
        const todo = (stop.found || []).filter((f) => !f.done && f.sel);
        for (let b = 0; b < todo.length && !aiSweep.abort; b++) {
          showSweepBusy(`Section ${stop.n} — ${i + 1} of ${stops.length}`,
            `Making ${todo[b].label || todo[b].sel} accessible — ${b + 1} of ${todo.length} on this section. ` +
            `Each one is saved to Mappings as it finishes.`,
            ((i) / stops.length) * 100);
          try {
            const made = await confirmedToMapping(
              { mark: null, type: todo[b].type, sel: todo[b].sel }, stop, tab);
            if (made.err) { todo[b].failed = made.err; sweepLog(stop.n, `${todo[b].type}: ${made.err}`, 'err'); }
            else { todo[b].done = true; todo[b].failed = null; }
          } catch (err) {
            todo[b].failed = err.message;
            sweepLog(stop.n, `${todo[b].type}: ${err.message}`, 'err');
          }
        }
        const built = (stop.found || []).filter((f) => f.done).length;
        if (todo.length) {
          stop.outcome = `${built} of ${todo.length} made accessible — saved to Mappings`;
          sweepLog(stop.n, stop.outcome, built ? '' : 'err');
          await markScreenRead(stop);
          saveSweep();
        }
      }

      // ── Build the fixes for this section, then carry on ───────────────────
      // Only when there is something to build and something still to read.
      // Holding after the last section, or after one that found nothing, is a
      // press that asks for a decision there is nothing to decide.
      const buildable = stop.found.filter((f) => !f.done).length;
      const rest = stops.length - (i + 1);
      if (sweepPause.on && buildable && rest > 0 && !aiSweep.abort) {
        const out = await pauseForFixes(stop, rest);
        if (out.stopped) break;
        // Back to being a run: the sections list is what the busy overlay and
        // the per-section marking are drawn against, and the finally clause
        // redraws whichever phase it ends in.
        aiSweep.phase = 'screens';
        renderSweepScreens();
        setPlayButtons(false);
        btn.disabled = true;
      }
    }
  } catch (err) {
    sweepLog(0, 'Failed: ' + err.message, 'err');
  } finally {
    // Detach first. Chrome's "is debugging this browser" banner stays up for
    // exactly as long as we are attached, and leaving it there after a run has
    // ended is its own small lie about what is happening to the page.
    await endBackgroundCapture();
    clearSweepBusy();
    aiSweep.running = false;
    aiSweep.progress = null;
    btn.disabled = false;
    { const b = document.getElementById('sweepStopBtn'); if (b) b.style.display = 'none'; }
    // The labelling pause asks for the marks to be LEFT on the page, so the run
    // owns taking them down — including when it ends by Stop, by a throw, or in
    // the middle of a section.
    const lblHost = document.getElementById('sweepLabel');
    if (lblHost) { lblHost.style.display = 'none'; lblHost.innerHTML = ''; }
    try { await inPage(tab.id, () => window.__u1SelectorIntel.clearMarks()); } catch {}
    // Same for the hold-for-fixes banner: a throw inside the loop skips its own
    // finish(), and a "continue to the next section" button left on screen
    // after the run has ended is a button that does nothing.
    sweepPause.resolve = null;
    const resHost = document.getElementById('sweepResume');
    if (resHost) { resHost.style.display = 'none'; resHost.innerHTML = ''; resHost.onclick = null; }
    try { await inPage(tab.id, (y) => window.scrollTo(0, y), [startedAt]); } catch {}
    // Regroup: the rows were marked one by one while the run went, and now the
    // list can settle into "still to read" and "already read".
    if (aiSweep.phase === 'screens') renderSweepScreens();
    // Whatever the outcome. A run that found nothing still read those sections
    // and still paid for them, and that has to survive a panel reload — it did
    // not, because the only save on this path hung off a render that an empty
    // run never reached.
    saveSweep();
    // If you said "I have moved on to another site" while this held the panel,
    // this is where it lets go.
    await followPendingSiteSwitch();
  }

  // What the run actually did, per screen, in one line. Ticking two sections and
  // seeing one in the results is alarming and was unexplained: the second had
  // been read and had yielded nothing, and nothing said so.
  const ran = stops.filter(s => s.scanned);
  const empty = ran.filter(s => !s.found.length);
  const total = aiSweep.stops.reduce((s, x) => s + x.found.length, 0);
  const spent = stops.reduce((a, x) => a + (x.cost || 0), 0);

  // One line, in this order: what it did, what it cost, what it got. It used to
  // open with a wall of per-screen prose and never say the last two at all — so
  // a run that read twenty-six sections, spent real money and found nothing
  // ended in a paragraph you had to parse to discover any of that.
  const head = `Searched ${ran.length} section${ran.length === 1 ? '' : 's'}` +
    (spent > 0 ? ` · $${spent.toFixed(2)}` : '') +
    ` · ${total} component${total === 1 ? '' : 's'} to map.`;

  if (total) {
    if (empty.length) {
      showNotice(status, head + ' ' +
        empty.map(s => `Section ${s.n}: ${s.outcome || 'nothing found'}`).join('. ') + '.', 'warn', 14000);
    }
    aiSweep.phase = 'components';
    renderSweepPicks();
    return;
  }

  // Nothing found. The reason decides what to say, because one of the three is
  // yours to undo and the other two are not.
  const dismissedRun = ran.some(s => /DISMISSED/.test(s.outcome || ''));
  showNotice(status, head + ' ' + (dismissedRun
    ? 'Most of what is here was DISMISSED in an earlier session — dismissals belong to the project and are shared, so they may not be yours. Reset them below and read again if that is wrong.'
    : empty.length
      ? 'Everything on these sections is already mapped, or was found in a section searched earlier.'
      : 'Nothing on these sections needs mapping.'),
    dismissedRun ? 'warn' : 'info', 20000);
  if (dismissedRun) offerResetDismissed(status);
}

// ▶ on a single row: read that one section and stop.
//
// It goes through scanPickedScreens like everything else — the function has
// always taken a list of screen numbers, so "one" needs no separate path and
// gets the same stop button, the same log, the same labelling pause and the
// same saved progress. The only thing that differs is the list it is handed.
document.getElementById('sweepPicksList')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-play-screen]');
  if (!btn) return;
  // The row it sits in is a ticking surface and a hover preview; neither should
  // fire because you pressed the button on top of it.
  e.preventDefault();
  e.stopPropagation();
  if (aiSweep.running) {
    showNotice(document.getElementById('sweepPicksStatus'),
      'A scan is already going. Stop it first, or wait for it to finish.', 'warn', 4000);
    return;
  }
  const n = Number(btn.dataset.playScreen);
  const stop = aiSweep.stops.find(s => s.n === n);
  if (!stop || !stop.count) return;
  // Re-reading a screen that is already paid for is a real thing to want and a
  // waste to do by accident, so it says which of the two this is.
  if (!(await confirmSweepCost(1, stop.scanned ? n : 0, stop.count, sweepCallsFor([n])))) return;
  await scanPickedScreens([n]);
});

/**
 * Build every ticked component. Shared by the button and by the hold.
 *
 * Extracted because the hold's own primary action has to do this and then
 * carry on: it used to say "Continue to the next section →" and build nothing,
 * so a section that found eight components and a person who pressed the
 * obvious button moved on with eight found and none made. The drawer then read
 * "8 COMPONENTS FOUND" beside "No mappings yet", which is exactly what it was.
 */
async function buildPickedComponents() {
  const btn = document.getElementById('sweepMakeBtn');
  const status = document.getElementById('sweepPicksStatus');
  const picked = new Set(sweepPicked());
  if (!picked.size) return;
  if (isReadonly()) {
    showNotice(status, 'Licence expired — existing mappings still work and export, but new ones are paused.', 'error', 6000);
    return;
  }
  if (!aiWorkspaceMatchesSite()) { warnWrongSite(status); return; }

  const tab = await getTab();
  if (!isInjectable(tab)) { showNotice(status, 'Cannot read this page.', 'error', 4000); return; }

  const jobs = [];
  for (const stop of aiSweep.stops) {
    for (const f of stop.found) if (picked.has(f.id)) jobs.push({ stop, f });
  }

  clearApproved();   // this list is the batch, not the session
  aiBulk = { running: true, abort: false, failed: [], armed: false };
  btn.disabled = true;
  const original = btn.textContent;
  const stopBtn = document.getElementById('buildStopBtn');
  if (stopBtn) { stopBtn.style.display = ''; stopBtn.disabled = false; stopBtn.textContent = '■ Stop building'; }
  setStage('cards');

  try {
    for (let i = 0; i < jobs.length; i++) {
      // A build is a model call per component, so twenty components is minutes.
      // Stopping keeps everything already saved — they are in Mappings and on
      // the page — and just does not start the next one.
      if (aiBulk.abort) {
        showNotice(status,
          `Stopped. ${i} of ${jobs.length} built and saved; the rest are still ticked.`,
          'warn', 8000);
        break;
      }
      const { stop, f } = jobs[i];
      btn.textContent = `Preparing ${i + 1} of ${jobs.length}…`;
      showMapBusy(f.label, i + 1, jobs.length);
      // A listbox, a datepicker and a tooltip are rooted on the thing that
      // APPEARS, and the sweep holds only the control that summons it. Passing
      // an empty container made rowFromParts refuse every one of them — that is
      // why a page reporting six components saved five, with the reason shown
      // in a panel the auto-approve closed a moment later.
      //
      // Two ways to supply the other half, best evidence first. The probe
      // PRESSED it and watched what came out; that is not a guess. Failing
      // that, it is read off the page the same way every other selector is.
      let container = '';
      if (triggerRequired(f.type) || triggerFirstType(f.type)) {
        const seen = (stop.probed || []).find(p =>
          p.parts && (p.parts.trigger === f.sel || p.root === f.sel) && p.parts.panel);
        container = (seen && seen.parts.panel) ||
          (await inPage(tab.id, (s) => window.__u1SelectorIntel.openedBy(s), [f.sel])) || '';
      }
      const built = rowFromParts({
        type: f.type, found: f.sel, container, label: f.label, compIndex: undefined,
      });
      if (built.err) {
        aiBulk.failed.push({ label: f.label, err: built.err });
        f.failed = built.err;
        continue;
      }
      f.failed = null;
      built.row.needsWork = f.needsWork;
      try {
        const prepared = await prepareOne(built.row, tab);
        if (prepared.err) {
          aiBulk.failed.push({ label: f.label, err: prepared.err });
          f.failed = prepared.err;
        } else { stop.indexes.push(prepared.idx); f.done = true; f.failed = null; }
      } catch (err) {
        aiBulk.failed.push({ label: f.label, err: err.message });
        f.failed = err.message;
      }
    }
  } finally {
    clearMapBusy();
    aiBulk.running = false;
    btn.disabled = false;
    btn.textContent = original;
    if (stopBtn) stopBtn.style.display = 'none';
  }

  renderBulkReview();
  // Everything on that screen is what was just ticked, so approving it again
  // would be the same question twice. The code is still there to read on each
  // row afterwards, and every mapping stays editable in Mappings below.
  document.getElementById('aiBulkApproveBtn')?.click();
  // And the page you were working through comes back — with the sections just
  // finished moved into the completed drawer, and the ones never read still
  // waiting. Hiding it left the review on screen and nothing else, which reads
  // as the end of the job on a page with twenty-five sections left in it.
  renderSweepPicks();
  return { built: (aiBulk.failed || []).length === 0, failed: (aiBulk.failed || []).length };
}

document.getElementById('sweepMakeBtn')?.addEventListener('click', async () => {
  if (aiSweep.running && !sweepPause.resolve) return;
  if (aiSweep.phase === 'screens') {
    const sections = sweepPickedScreens();
    if (!sections.length) return;
    const ticked = aiSweep.stops.filter((s) => sections.includes(s.n))
      .reduce((a, s) => a + (s.count || 0), 0);
    if (!(await confirmSweepCost(sections.length, 0, ticked, sweepCallsFor(sections)))) return;
    await scanPickedScreens(sections);
    return;
  }
  await buildPickedComponents();
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

      <div class="ai-find-actions">
        <button class="btn-primary btn-sm" data-savecard="${idx}">✓ Approve &amp; apply</button>
        <button class="btn-ghost btn-sm" data-skipcard="${idx}">Skip</button>
        <button class="btn-ghost btn-sm" data-editcard="${idx}">Open in builder</button>
        <button class="btn-ghost btn-sm" data-askwhy="${idx}">✨ Ask AI about this</button>
      </div>
      <div class="ai-why" id="aiWhy${idx}" style="display:none;"></div>
    </div>`;
}

// What to do after approving: carry on with what is left, or start a new scan.
// Rendered under the approved list and kept in step with what remains.
function renderApprovedNext() {
  const box = document.getElementById('aiApproved');
  if (!box || !document.querySelectorAll('#aiApprovedList .ai-approved-row').length) return;
  const left = document.querySelectorAll('#aiCompTrack .ai-comp:not([data-done])').length;
  const cards = document.querySelectorAll('#aiSlideTrack .ai-map-card:not([data-done])').length;

  let el = document.getElementById('aiNextRow');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aiNextRow';
    el.className = 'ai-next-row';
    (document.getElementById('aiApprovedList') || box).appendChild(el);
  }
  el.innerHTML = cards
    ? `<button class="btn-primary btn-sm" data-ainext="cards">Next mapping →<span class="ai-next-count">${cards} left</span></button>`
    : left
      ? `<button class="btn-primary btn-sm" data-ainext="list">Next → back to what was found<span class="ai-next-count">${left} left</span></button>`
      : `<button class="btn-primary btn-sm" data-ainext="scan">🔎 Scan this page again</button>` +
        `<span class="ai-next-hint">Everything on this page has been handled. Open a dialog or go to another page, then scan again.</span>`;
}

document.getElementById('aiApproved')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-ainext]');
  if (!btn) return;
  const what = btn.dataset.ainext;
  if (what === 'cards') {
    setStage('cards');
    showSlide(slideIndex('aiSlide'));
    document.querySelector('#aiSlideTrack .ai-map-card:not([data-done])')
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } else if (what === 'list') {
    setStage('found');
    showCompSlide(slideIndex('aiComp'));
    document.getElementById('aiResults').scrollIntoView({ block: 'start', behavior: 'smooth' });
  } else {
    document.getElementById('aiDiscoverBtn')?.click();
  }
});

// Replace a pending row's verdict once the page has actually been measured.
function updateApproved(rowId, verdict) {
  // The verdict has arrived — stop the progress bar that stood in for it.
  document.getElementById(rowId)?.querySelector('[data-pendingbar]')?.remove();
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
    // The stage owns display, not the carousel inside it. An empty track is a
    // reason to move ON, and where to is a stage question.
    if (track.closest('.ai-results')) setStage(resumeStage());
    // Handling the last card must not strand you on an empty panel. If there
    // is still an inventory to work through, go back to it — skipping one
    // element is not a reason to end the run.
    if (id === 'aiSlide') {
      const left = document.querySelectorAll('#aiCompTrack .ai-comp:not([data-done])').length;
      if (left) {
        setStage('found');
        showCompSlide(carouselAt.aiComp || 0);
        document.getElementById('aiResults')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
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

/**
 * Empty the applied list — the LIST, not the section.
 *
 * This used to be `#aiApproved.innerHTML = ''`, which took the <summary> and
 * the count badge with it. addApproved rebuilds only the inner list, so after
 * one re-scan the heading was gone for the rest of the session.
 *
 * It is called at the start of every batch, because the list answers "what did
 * I just do". Left to accumulate it answered "what has happened since the panel
 * opened" — a number that, in the whole-page route, crossed every run and every
 * route switch and read as the current batch. The permanent record is the
 * Mappings list below, which nothing here touches.
 */
function clearApproved() {
  const box = document.getElementById('aiApproved');
  if (!box) return;
  const list = box.querySelector('#aiApprovedList');
  if (list) list.innerHTML = '';
  const n = document.getElementById('aiApprovedN');
  if (n) n.textContent = '';
  if (currentStage === 'applied') setStage(resumeStage());
}

function addApproved(row, verdict, code) {
  const box = document.getElementById('aiApproved');
  if (!box) return null;
  setStage('applied');
  box.open = true;
  const cls = verdict.ok ? 'ok' : 'warn';
  // A conflicting older mapping is actionable, so offer the action rather than
  // just naming the problem — but never delete anything without being asked.
  const clashBtns = (verdict.clashes || []).map(c =>
    `<button class="btn-outline btn-xs" data-dropkey="${escapeHtml(c.key)}">Remove u1.fix.${escapeHtml(c.type)} on ${escapeHtml(c.sel)}</button>`).join(' ');

  const rowId = 'aiApproved' + (++approvedSeq);
  // Resolve these from the box, not by a global id lookup — the list lives
  // inside it, and a lookup is one more thing that can find nothing.
  let listEl = box.querySelector('#aiApprovedList');
  if (!listEl) {
    listEl = box.ownerDocument.createElement('div');
    listEl.id = 'aiApprovedList';
    box.appendChild(listEl);
  }
  const nEl = box.querySelector('#aiApprovedN');
  if (nEl) nEl.textContent = String(listEl.querySelectorAll('.ai-approved-row').length + 1);
  // Approving the last card leaves this list on screen with nothing to do
  // next, which reads as being stuck. Give the run somewhere to go.
  queueMicrotask(renderApprovedNext);
  listEl.insertAdjacentHTML('beforeend', `
    <div class="ai-approved-row" id="${rowId}">
      <span class="ai-approved-tick ${cls}">${verdict.ok ? '✓' : '!'}</span>
      <span class="ai-approved-label">${escapeHtml(row.label)}</span>
      <code>u1.fix.${escapeHtml(row.type)}</code>
      ${verdict.pending ? '<div class="ai-busy-bar" data-pendingbar><span></span></div>' : ''}
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
  // Every selector field on this card gets the page's own names to choose from.
  // Typing a selector blind is where "invented — .tab-bar is on no element" came
  // from, and it is the whole of the work for a combobox, whose four
  // sub-selectors had no source but the keyboard.
  attachSelectorSuggestions(form, (aiFound && aiFound.context) || null);

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

/**
 * Offer the page's real element names on every selector input in a form.
 *
 * A <datalist> rather than a <select>: a selector is not always one element's
 * name — `.a,.b` and `#x>li` are ordinary answers — so the field has to stay
 * free text with the real names offered beside it, not replaced by them.
 *
 * The names come from the collector, which already reports every id, class and
 * tag it saw (`tokens`), plus the full selector it built for each candidate.
 * Nothing new is fetched.
 */
function attachSelectorSuggestions(form, ctx) {
  if (!form) return;
  const names = new Set();
  for (const t of (ctx && ctx.tokens) || []) names.add(t);
  for (const c of (ctx && ctx.candidates) || []) if (c && c.selector) names.add(c.selector);
  if (!names.size) return;

  // One list per form, shared by its fields — a datalist per input would be the
  // same few thousand options repeated for every row on the card.
  const id = 'seldl-' + (form.id || Math.random().toString(36).slice(2, 8));
  let dl = document.getElementById(id);
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = id;
    form.appendChild(dl);
  }
  // Shortest first: `.suggestion` before `#box>ul.list>li.suggestion`, because
  // the short one is nearly always the one meant.
  dl.innerHTML = [...names]
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .slice(0, 1000)
    .map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');

  form.querySelectorAll('input[type="text"][data-field]').forEach((inp) => {
    inp.setAttribute('list', id);
    inp.setAttribute('autocomplete', 'off');   // the browser's history is not the page
  });
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
  const tpl = buildTemplate(entry.row.type, primary, fieldValues, rootValues);
  // The role question was answered on the component card, two steps back. Carry
  // it, or saveMappingEntry asks again — and the export would not strip the
  // role even though the answer was given.
  if (tpl && entry.row.overwriteRole) {
    tpl.overwriteRole = entry.row.overwriteRole;
    tpl.code = mappingToCode(tpl);
  }
  return tpl;
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
    if (!aiWorkspaceMatchesSite()) { warnWrongSite(status); return; }
    if (!tpl) { showNotice(status, 'Nothing to save — the selector is empty.', 'error', 3500); return; }

    save.disabled = true; save.textContent = 'Saving…';

    try {
      const r = await saveMappingEntry(tpl);
      if (r && r.cancelled) {
        save.disabled = false; save.textContent = '✓ Approve & apply';
        showNotice(status, 'Not saved — the role the site wrote is still there. Nothing was changed.', 'info', 6000);
        return;
      }
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
    const rowId = addApproved(row, { ok: true, msg: 'Saved. Applying…', pending: true }, tpl.code);
    showSlide(slideIndex('aiSlide'));
    const next = document.querySelector('#aiSlideTrack .ai-map-card:not([data-done])');
    if (next) next.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else document.getElementById('aiApproved')?.scrollIntoView({ block: 'start', behavior: 'smooth' });

    // ── everything below runs in the background ──
    // The catch is what ends the progress bar when the measurement itself
    // fails. Without it a rejection here left the row spinning "Applying…"
    // forever, which reads as the tool still working on something it has
    // already given up on. The mapping IS saved at this point — only the
    // verdict is missing, so say exactly that.
    (async () => {
      const mkey = storageKey('mappings', currentHostname);
      const existing = (await U1Store.get([mkey]))[mkey] || [];
      const clashes = await overlappingMappings(tpl.primary, existing);

      const res = await applyMappingsBatch([{
        type: tpl.type, primary: tpl.primary, firstArg: tpl.firstArg, config: tpl.config,
        overwriteRole: tpl.overwriteRole,
      }]);
      const verdict = describeApply(res, tpl);

      if (clashes.length) {
        verdict.clashes = clashes;
        verdict.ok = false;
        verdict.msg += ` Also mapped by ${clashes.map(c => `u1.fix.${c.type} on ${c.sel}`).join(', ')} — two on the same elements fight, and the second wins.`;
      }
      updateApproved(rowId, verdict);
    })().catch((err) => {
      updateApproved(rowId, {
        ok: false,
        msg: `Saved, but applying it could not be measured: ${err?.message || err}. Reload the page and re-run Apply to check it took effect.`,
      });
    });
    return;
  }

  const ask = e.target.closest('[data-askwhy]');
  if (ask) {
    const idx = Number(ask.dataset.askwhy);
    const entry = aiMapped[idx];
    const box = document.getElementById('aiWhy' + idx);
    if (!entry || !box) return;
    box.style.display = 'block';
    const key = 'card:' + idx;
    if (!agentThreads.has(key)) {
      box.innerHTML = '<div class="ai-busy"><div class="ai-busy-bar"><span></span></div>' +
        '<div class="ai-busy-sub">Measuring what this mapping does on the page.</div></div>';
      const tpl = aiCardTemplate(idx);
      const ctx = tpl
        ? await agentContext(tpl.type, tpl.primary, tpl.firstArg, tpl.config, tpl.overwriteRole)
        : { err: 'The mapping could not be rebuilt from the form.' };
      if (ctx.err) { box.innerHTML = `<div class="ai-sel-bad">${escapeHtml(ctx.err)}</div>`; return; }
      // It already has the markup this card was built from; prefer it.
      ctx.markup = entry.markup || ctx.markup;
      agentThreads.set(key, { ctx, history: [] });
    }
    renderAgentThread(box, key);
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

// Precise event detection, always on.
//
// It was a checkbox in Setup, defaulting to off. Off, a trigger is guessed from
// its tag, role and aria/data attributes — and on a page written with none of
// those, that guess finds nothing at all, which is the exact page this tool
// exists for. Switching it on only ever made the answers better; the only thing
// the choice bought was a way to have the scan quietly underperform.
//
// The one real cost is that the recorder must be installed BEFORE the page's
// own script runs, so a page already open when it is first registered needs one
// reload. That is said in Setup rather than asked about.
(async () => {
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [RECORDER_ID] });
    if (!existing.length) await setPreciseEvents(true);
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

async function validateMapping(type, primary, fieldValues, rootValues) {
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

  // A name our own tooling writes cannot appear in a mapping.
  //
  // `u1-anchor-<token>-<n>` is stamped by the Studio when a skip link targets an
  // element by CSS selector rather than by id — background.js writes it on every
  // page load, and the token is re-randomised whenever the skip links are saved.
  // `u1st-*` is the U1 library's own. Neither is in the site's HTML, so a mapping
  // built on one depends on other tooling having run first and on a token that
  // changes under it. Generation refuses them now, but a pasted selector, an
  // edit, or a model's answer can still carry one — and it looks like the best
  // answer available.
  for (const [k, v] of Object.entries(map)) {
    const parts = String(v).match(/[#.][\w-]+/g) || [];
    const bad = parts.filter((t) => /^[#.]u1(st)?-/i.test(t));
    if (bad.length) {
      const ours = bad.some((t) => /^[#.]u1-anchor-/i.test(t));
      notes.push({ level: 'err', msg:
        `“${k}” uses ${bad.join(', ')}, which is not in the site's HTML — ` +
        (ours
          ? `the Studio writes that id onto the element at runtime because a skip ` +
            `link points at it, and the random part changes every time the skip ` +
            `links are saved. The skip link is fine and should stay — one element ` +
            `can be a skip target and a mapped component at once. It is only the ` +
            `id that must not be used here.`
          : `the U1 library adds it while it runs.`) +
        ` Use the element's own class or id instead.` });
    }
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
  // menubar:true together with submenus makes U1 throw "Submenu must have a
  // trigger element" and abort tagging entirely — the mapping reports as
  // applied and the DOM gains no roles at all. This is the single most costly
  // config mistake in the tool, so it is an error, not a warning.
  if (type === 'menu' && fieldValues.submenus && rootValues && rootValues.menubar === true) {
    notes.push({ level: 'err', msg: 'menubar is on AND “submenus” is set. U1 throws “Submenu must have a trigger element” for that combination and stops adding roles altogether — the mapping will look applied and do nothing. Turn menubar off for a navigation menu with drop-downs.' });
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
        func: (pairs, t, rules, fatalIfWide) => {
          const out = { counts: {}, optionsAreLinks: false, structure: [] };
          for (const [k, sel] of pairs) {
            try { out.counts[k] = document.querySelectorAll(sel).length; }
            catch { out.counts[k] = -1; }
          }

          // Do the fields describe the SHAPE the component actually has?
          //
          // Counting matches says every field found something; it cannot say
          // they found the right things. A listbox mapped with the trigger
          // button as its `listbox` passes every count check and is nonsense:
          // the listbox has to be the thing that OPENS, and the options have to
          // be inside it. That mapping was generated, previewed, approved and
          // saved without one step objecting.
          const one = (sel) => { try { return document.querySelector(sel); } catch { return null; } };
          const all = (sel) => { try { return Array.prototype.slice.call(document.querySelectorAll(sel)); } catch { return []; } };
          const get = (k) => (pairs.find((pp) => pp[0] === k) || [])[1];

          for (const rule of rules) {
            const pSel = get(rule.parent), cSel = get(rule.child);
            if (!pSel || !cSel) continue;
            const parent = one(pSel), kids = all(cSel);
            if (!parent || !kids.length) continue;   // absence is the counts' job

            if (rule.inside) {
              const outside = kids.filter((el) => !parent.contains(el) || el === parent);
              if (outside.length === kids.length) {
                out.structure.push({ level: 'err', parent: rule.parent, child: rule.child, kind: 'none-inside' });
              } else if (outside.length) {
                out.structure.push({ level: 'warn', parent: rule.parent, child: rule.child,
                                     kind: 'some-outside', n: outside.length, total: kids.length,
                                     fatal: fatalIfWide.indexOf(t) >= 0 });
              }
            } else {
              // The reverse: these must NOT be nested, e.g. a tab panel living
              // inside the tab strip, or a trigger inside the thing it opens.
              const inside = kids.filter((el) => parent.contains(el));
              if (inside.length) {
                out.structure.push({ level: 'err', parent: rule.parent, child: rule.child, kind: 'wrongly-inside' });
              }
            }
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
        args: [Object.entries(map), type, STRUCTURE_RULES[type] || [], FATAL_IF_WIDE],
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
        for (const f of r.structure || []) {
          if (f.kind === 'none-inside') {
            notes.push({ level: 'err', msg:
              `None of the elements “${f.child}” matches are inside “${f.parent}”. ` +
              `U1 looks for them within it, so this mapping will apply and do nothing. ` +
              (f.parent === 'listbox'
                ? `The listbox is the list that OPENS, not the control that opens it — ` +
                  `point it at the panel and put the button in “trigger”.`
                : `Check which element is really the container.`) });
          } else if (f.kind === 'some-outside') {
            // "U1 will only decorate the ones inside it" was true for most
            // types and flatly wrong for the one that matters. For a type the
            // patch wraps with a context resolver, a child selector reaching
            // outside its parent makes the resolver refuse the whole component:
            // u1.fix.* is never called and NOTHING is decorated. Saying
            // "partial" there sent people to check selectors that were fine.
            notes.push({ level: f.fatal ? 'err' : 'warn', msg:
              `${f.n} of the ${f.total} elements “${f.child}” matches are outside “${f.parent}”. ` +
              (f.fatal
                ? `For ${f.parent === 'tabList' ? 'a tab strip' : 'this component'} that is fatal, not partial: ` +
                  `the parts can no longer be reached together, so u1.fix.* is not run at all. ` +
                  `Saving narrows “${f.child}” to the ones inside “${f.parent}” automatically.`
                : `U1 will only decorate the ones inside it.`) });
          } else if (f.kind === 'wrongly-inside') {
            notes.push({ level: 'err', msg:
              `“${f.child}” is inside “${f.parent}”, and it must not be. ` +
              (f.parent === 'tabList'
                ? `A tab panel sits outside the tab strip — pointing both at the same ` +
                  `element makes U1 hide the tabs along with the content.`
                : `Check which is the container and which is the part.`) });
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
    // currentTemplate.config carries the resolved root options (menubar etc.),
    // which is where the fatal menubar+submenus combination lives.
    const notes = await validateMapping(type, primary, fieldValues, currentTemplate.config || {});
    const rec = await recommendSelector(type, currentTemplate.firstArg || primary);
    if (rec && Array.isArray(rec.notes)) {
      for (const n of rec.notes) {
        notes.push({ level: n.level, msg: n.msg + (n.suggestion ? ` → try: ${n.suggestion}` : '') });
      }
    }
    renderAdvisorNotes(notes);
  } catch {}
});

/**
 * Ask before writing our role over one the site's own markup already carries.
 *
 * Molina's dropdown ships `<ul class="signin-dropdown" role="menu">`. Mapped as
 * a listbox, u1 was asked to write `role="listbox"` over the author's role: the
 * trigger got decorated, the list did not, and nothing anywhere said why. Two
 * statements about what an element is, and one of them silently lost.
 *
 * Three answers, because there genuinely are three: the site is wrong, the site
 * is right, or you want to look first. Nothing is saved until one is chosen.
 *
 * Resolves true to carry on saving, false to abandon it.
 */
async function confirmRoleOverwrite(tpl) {
  const dlg = document.getElementById('roleClashDialog');
  if (!dlg || !tpl || !tpl.type || !tpl.primary) return true;
  // Already answered — on the component card, before the mapping was built.
  // Re-reading the DOM would find the same role and ask the same question a
  // second time, which teaches people to click through it without reading.
  if (tpl.overwriteRole) return true;

  const tab = await getTab();
  if (!isInjectable(tab)) return true;

  let clash = null;
  try {
    clash = await inPage(tab.id,
      (sel, type) => window.__u1SelectorIntel.authoredRoleConflict(sel, type),
      [tpl.primary, tpl.type]);
  } catch { return true; }   // cannot read the page — not a reason to block a save
  if (!clash) return true;

  // The role the site chose usually names a component we can map instead, and
  // offering that is the whole point of asking rather than warning.
  const ROLE_TO_TYPE = {
    menu: 'menu', menubar: 'menu', navigation: 'menu', listbox: 'listbox',
    tablist: 'tabs', dialog: 'dialog', grid: 'grid', table: 'table',
    combobox: 'combobox', radiogroup: 'radio', tooltip: 'tooltip',
  };
  const other = ROLE_TO_TYPE[clash.role];
  const canSwitch = !!other && other !== tpl.type && !!COMPONENT_SCHEMAS[other];

  document.getElementById('roleClashBody').innerHTML =
    `<code>${escapeHtml(tpl.primary)}</code> already carries ` +
    `<code>role="${escapeHtml(clash.role)}"</code> in the site's own HTML — we did not put it there. ` +
    `Saving this mapping asks U1 to write <code>role="${escapeHtml(clash.willWrite)}"</code> over it.`;

  const switchBtn = document.getElementById('roleClashSwitch');
  switchBtn.style.display = canSwitch ? '' : 'none';
  if (canSwitch) document.getElementById('roleClashOther').textContent = other;

  return await new Promise((resolve) => {
    const done = (answer) => {
      dlg.close();
      cancel.removeEventListener('click', onCancel);
      over.removeEventListener('click', onOver);
      switchBtn.removeEventListener('click', onSwitch);
      resolve(answer);
    };
    const cancel = document.getElementById('roleClashCancel');
    const over = document.getElementById('roleClashOverwrite');
    const onCancel = () => done(false);
    const onOver = () => {
      // Answering "overwrite" used to do nothing but let the save through, and
      // U1 then met the author's role exactly as before — the question was
      // asked and the answer was discarded. Record it on the mapping: apply and
      // the exported file both lift the attribute before u1.fix runs, which is
      // the only thing that makes the word true.
      tpl.overwriteRole = clash.role;
      done(true);
    };
    const onSwitch = () => {
      // Change the type and let them regenerate: the fields a menu wants are
      // not the fields a listbox wants, so saving straight through would
      // produce a mapping of the new type filled from the old one's form.
      $componentType.value = other;
      $componentType.dispatchEvent(new Event('change'));
      showNotice(document.getElementById('applyStatus'),
        `Switched to ${other} — the site's own role. Fill the fields for it and press Generate Template.`,
        'info', 9000);
      done(false);
    };
    cancel.addEventListener('click', onCancel);
    over.addEventListener('click', onOver);
    switchBtn.addEventListener('click', onSwitch);
    dlg.showModal();
  });
}

// Loads an existing mapping back into the builder for editing. "Add to Mapping"
// will then replace the original (tracked via editingMappingKey).
function loadMappingIntoForm(m) {
  if (!m || typeof m !== 'object' || !m.type || !COMPONENT_SCHEMAS[m.type]) return;
  // Editing IS the manual builder, and the AI routes hide it — the container
  // field lives inside #manualOnly. Open a sweep result in the builder without
  // this and the form fills correctly behind a hidden panel: every sub-selector
  // on screen and no element selector anywhere, which reads as the tool having
  // lost it.
  if (mapMode !== 'manual') setMapMode('manual');
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
      if (inp.type === 'checkbox') { inp.checked = !!(m.config && m.config[k]); continue; }
      const saved = (m.config && m.config[k] != null) ? String(m.config[k]) : '';
      // A <select> given a value it has no option for goes blank, which reads as
      // "nothing chosen" for a field that always has a value. Fall back to the
      // schema default — what a mapping saved before this field existed meant.
      if (inp.tagName === 'SELECT' && !Array.from(inp.options).some(o => o.value === saved)) {
        inp.value = String(schema.rootFields[k] || '');
      } else {
        inp.value = saved;
      }
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
          // Deliberately taken out of reach — by us, or by the site. Reporting
          // it would be the tool flagging its own fix, and `inert` is a
          // statement that this subtree is not part of the page's interface.
          try { if (el.closest('[inert]')) return false; } catch (e) {}
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

/**
 * The scan rules a static fix can actually resolve, and what to call it.
 *
 * Deliberately short. A rule belongs here only when the answer is the same for
 * every element it flags and needs nothing written by a person — otherwise
 * "fix all forty" is forty wrong decisions taken at once, which is worse than
 * forty right ones taken slowly.
 *
 * Everything absent stays read-only, and says why: `img-alt-missing` and
 * `button-noname` need words nobody but you can write; `clickable-div` and the
 * `*-nostate` rules are components, and mapping them as a component is the fix.
 */
const STATIC_FIXABLE = {
  'tabindex-positive':   { does: 'Put every positive tabindex back to 0, so focus follows the page again.' },
  'aria-ref-broken':     { does: 'Drop the aria-labelledby/describedby ids that point at nothing, so the element gets its own name back.' },
  'input-placeholder':   { does: 'Promote each placeholder to a real label. The text is already written — nothing to author.' },
  'table-noheaders':     { does: 'Turn the first row of each data table into <th scope="col">.' },
  'zoom-disabled':       { does: 'Let the page be enlarged: remove user-scalable=no and raise maximum-scale.' },
  'autoplay-audio':      { does: 'Remove the autostart and make sure there is a control. The media stays.' },
  'lang-missing':        { does: 'Set the page language, so a screen reader reads it in the right voice.', needsLang: true },
};

/**
 * Filter-and-results: a field that narrows a list already on the page.
 *
 * Not in STATIC_FIXABLE because no scan rule finds it — it is not a fault in
 * the markup, it is a pattern with a missing status message, and the only way
 * to see it is by shape. Offered from the Scan tab beside the exclude control,
 * measured by filterListShape and applied as a static fix.
 */
async function offerFilterResults() {
  const tab = await getTab();
  if (!isInjectable(tab)) return null;
  return inPage(tab.id, () => {
    const S = window.__u1SelectorIntel;
    if (!S || !S.filterListShape) return null;
    // Any text or search input on the page is a candidate for the pattern; the
    // shape says whether it really is one.
    for (const f of document.querySelectorAll('input[type="search"],input[type="text"],input:not([type])')) {
      const shape = S.filterListShape(S.robustSelector(f));
      if (shape) return shape;
    }
    return null;
  });
}

/** Why a rule offers no bulk fix — shown instead of a button, never as silence. */
const STATIC_WHY_NOT = {
  'img-alt-missing': 'needs alt text only you can write',
  'link-empty': 'needs the link\'s text', 'link-generic': 'needs better link text',
  'button-noname': 'needs the button\'s name', 'input-nolabel': 'needs the field\'s label',
  'iframe-notitle': 'needs a title for the frame', 'title-missing': 'needs a page title',
  'group-nolabel': 'needs a name for the group',
  'clickable-div': 'map it as a component instead — that is the fix',
  'misleading-role': 'map it as a component instead — that is the fix',
  'switch-nostate': 'map it as a switch', 'checkbox-nostate': 'map it as a checkbox',
  'slider-novalue': 'map it as a slider', 'meter-novalue': 'map it as a meter',
  'combobox-noexpanded': 'map it as an autocomplete', 'video-nocaptions': 'needs caption files',
  'target-size-small': 'a CSS change — the exported bundle carries no stylesheet',
  'dup-ids': 'renaming an id breaks whatever queries it',
  'heading-skip': 'map the heading and give it the right level',
  'h1-missing': 'decide which element is the page heading', 'h1-multiple': 'decide which one is the page heading',
  'heading-empty': 'decide whether it is a heading at all',
  'landmarks-missing': 'map the landmarks — Config does this',
  'skip-link-missing': 'Config adds skip links',
  'aria-hidden-focusable': 'use "must not be reachable" on it, or un-hide it',
};

/**
 * Show the results of the scan that was just run, and only those.
 *
 * The Scan tab holds two: the page's own faults, and whether the mappings
 * still work. They are different questions with different answers, and having
 * both on screen made the second look like part of the first — a report saying
 * "36 links have no accessible text" directly above "45 tested · 5 failing"
 * reads as one finding about one thing.
 *
 * Hidden, not cleared: the other run's results are still there and come back
 * when it is run again.
 */
function showOnlyScan(which) {
  const s = document.getElementById('scanResultsSection');
  const m = document.getElementById('elemScanSection');
  if (s) s.style.display = which === 'static' && scanResults.length ? 'block' : 'none';
  if (m) m.style.display = which === 'mappings' ? 'block' : 'none';
  // And say which of the two the results below belong to. With only one on
  // screen there is nothing else to tell you which question was asked.
  const cards = document.querySelectorAll('#tab-scan .scan-choice-card');
  cards.forEach((c, i) => c.classList.toggle('is-showing',
    (which === 'static' && i === 0) || (which === 'mappings' && i === 1)));
}

function renderScanResults() {
  const wrap = document.getElementById('scanResults');
  if (!wrap) return;
  const list = scanFiltered();
  if (!list.length) { wrap.innerHTML = '<div class="empty-state">No issues match this filter. 🎉</div>'; return; }

  // Grouped by RULE. Forty positive tabindex values are one decision taken
  // forty times, and the report used to present them as forty — each with its
  // own "why & how to fix" fold saying the same sentence.
  const groups = new Map();
  for (const r of list) {
    if (!groups.has(r.ruleId)) groups.set(r.ruleId, []);
    groups.get(r.ruleId).push(r);
  }
  const item = (r) => {
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
  };

  wrap.innerHTML = [...groups.entries()].map(([ruleId, rows]) => {
    const r0 = rows[0];
    const fixable = STATIC_FIXABLE[ruleId];
    const why = STATIC_WHY_NOT[ruleId];
    const action = fixable
      ? `<div class="scan-group-fix">
           ${fixable.needsLang ? `<select class="scan-lang" aria-label="Page language">
              ${['he', 'en', 'ar', 'ru', 'fr', 'es'].map((c) =>
                `<option value="${c}"${c === (document.documentElement.lang || 'he') ? ' selected' : ''}>${c}</option>`).join('')}
             </select>` : ''}
           <button class="btn-primary btn-xs scan-fix-all" data-fix-rule="${escapeHtml(ruleId)}">
             Fix all ${rows.length}
           </button>
           <span class="scan-group-does">${escapeHtml(fixable.does)}</span>
         </div>`
      : why
        ? `<div class="scan-group-fix is-manual"><span class="scan-group-does">No bulk fix — ${escapeHtml(why)}.</span></div>`
        : '';
    return `
      <details class="scan-group" data-rule="${escapeHtml(ruleId)}" open>
        <summary>
          <span class="scan-sev-badge sev-${(r0.severity || '').toLowerCase()}">${escapeHtml(r0.severity || '')}</span>
          <span class="scan-issue-title">${escapeHtml(r0.issue || ruleId)}</span>
          <span class="scan-group-n">${rows.length}</span>
          ${r0.wcag ? `<span class="wcag-chip">WCAG ${escapeHtml(r0.wcag)}</span>` : ''}
        </summary>
        ${action}
        <div class="scan-why-body">
          <div class="scan-why-line"><strong>Why:</strong> ${escapeHtml(r0.why || '')}</div>
          <div class="scan-why-line"><strong>Fix:</strong> ${escapeHtml(r0.fix || '')}</div>
        </div>
        ${rows.map(item).join('')}
      </details>`;
  }).join('');
}

/**
 * One press, one rule, every element it flags.
 *
 * The fix is stored as an ordinary mapping (`custom: 'staticFix'`), so it gets
 * storage, sync, export, the drawer, the monitoring hook and the report for
 * nothing — the same route ariaLabel and keyboardClickable already take. What
 * it emits is a DECLARATION; the corrector that reads it lives in the patch's
 * `statics` region and covers every match, including elements the page adds
 * later. That is the difference between fixing forty and fixing forty-and-
 * whatever-comes-next.
 */
document.getElementById('scanResults')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.scan-fix-all');
  if (!btn) return;
  e.preventDefault();
  const rule = btn.dataset.fixRule;
  const spec = STATIC_FIXABLE[rule];
  const status = document.getElementById('scanStatus');
  if (!spec) return;
  if (isReadonly()) {
    showNotice(status, 'Licence expired — existing work still applies and exports, but new fixes are paused.', 'error', 6000);
    return;
  }

  const config = {};
  if (spec.needsLang) {
    const sel = btn.closest('.scan-group-fix')?.querySelector('.scan-lang');
    config.lang = (sel && sel.value) || 'en';
  }

  const label = btn.textContent.trim();
  btn.disabled = true;
  btn.textContent = 'Applying…';
  try {
    // primary IS the rule name: one mapping per rule, so pressing twice
    // corrects the same entry rather than stacking duplicates.
    const tpl = { type: null, custom: 'staticFix', primary: rule, config, needsWork: true };
    const saved = await saveMappingEntry(tpl, { refreshUi: false });
    if (saved && saved.cancelled) { showNotice(status, 'Not saved.', 'warn', 4000); return; }
    await applyStaticFixesToPage();
    await loadMappingsList();
    refreshExportInfo();
    showNotice(status,
      `${rule} — fixed for every element on the page, and for any the page adds later. ` +
      `It is in Mappings and it exports.`, 'success', 8000);
    // Re-scan so the count moves. A fix you cannot see land is a fix you will
    // press again.
    document.getElementById('scanBtn')?.click();
  } catch (err) {
    showNotice(status, 'Could not apply it: ' + err.message, 'error', 8000);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});

/**
 * Run the saved static fixes against the page in front, now.
 *
 * The exported bundle gets them through the patch; the panel has to apply them
 * itself so that pressing "Fix all" changes the page you are looking at rather
 * than only a file you have not pasted yet.
 */
async function applyStaticFixesToPage() {
  const tab = await getTab();
  if (!isInjectable(tab)) return;
  const key = storageKey('mappings', currentHostname);
  const list = (await U1Store.get([key]))[key] || [];
  const on = {};
  for (const m of list) {
    if (m && m.custom === 'staticFix' && m.primary) on[m.primary] = m.config || {};
  }
  if (!Object.keys(on).length) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', files: ['u1-patch.js'] });
  } catch {}
  await inPage(tab.id, (decl) => {
    window.__u1Statics = decl;
    // The correctors are registered; this is what makes them run now rather
    // than at the next mutation.
    if (window.__u1Patch && window.__u1Patch.schedule) window.__u1Patch.schedule();
  }, [on]);
}

// The filter-and-results pattern: find it, then make it announce itself.
let filterShape = null;

document.getElementById('filterFind')?.addEventListener('click', async () => {
  const found = document.getElementById('filterFound');
  const add = document.getElementById('filterAdd');
  const status = document.getElementById('filterStatus');
  showNotice(status, '', 'info', 1);
  filterShape = await offerFilterResults();
  if (!filterShape) {
    add.style.display = 'none';
    found.innerHTML = 'Nothing on this page looks like one — no text field with a list of ' +
      'three or more alike results beside it. If you know where it is, the fields below take a selector.';
    return;
  }
  // Shown before it is applied, because the noun is the one thing only you know
  // and it is what a person actually hears.
  found.innerHTML =
    `<div><strong>${escapeHtml(String(filterShape.count))} results</strong> ` +
    `filtered by <code>${escapeHtml(filterShape.field)}</code></div>` +
    `<div>list <code>${escapeHtml(filterShape.results)}</code> · ` +
    `each one <code>${escapeHtml(filterShape.item)}</code></div>` +
    (filterShape.labelled ? '' : '<div>⚠ the field has no label of its own — give it one too</div>') +
    `<div class="sub-sel-row" style="margin-top:8px">
       <div class="key">a result is a…</div>
       <input type="text" id="filterNoun" value="result" spellcheck="false">
     </div>
     <div class="map-mode-hint">Used in the announcement: “2 branches”, “No branches match”.</div>`;
  add.style.display = '';
});

document.getElementById('filterAdd')?.addEventListener('click', async () => {
  const status = document.getElementById('filterStatus');
  if (!filterShape) return;
  if (isReadonly()) {
    showNotice(status, 'Licence expired — new work is paused.', 'error', 6000);
    return;
  }
  const noun = (document.getElementById('filterNoun')?.value || 'result').trim() || 'result';
  try {
    await saveMappingEntry({
      type: null, custom: 'staticFix', primary: 'filter-results',
      config: { field: filterShape.field, results: filterShape.results, item: filterShape.item, noun },
      needsWork: true,
    }, { refreshUi: false });
    await applyStaticFixesToPage();
    await loadMappingsList();
    refreshExportInfo();
    showNotice(status,
      `Done. Typing in that field now announces how many ${noun}s are showing, and the ` +
      `field is tied to the list it controls.`, 'success', 9000);
  } catch (err) {
    showNotice(status, 'Could not save it: ' + err.message, 'error', 9000);
  }
});

// "This must not be reachable." Both halves, always — see the statics region.
document.getElementById('excludeAdd')?.addEventListener('click', async () => {
  const input = document.getElementById('excludeSel');
  const status = document.getElementById('excludeStatus');
  const sel = (input?.value || '').trim();
  if (!sel) { showNotice(status, 'Type a selector first.', 'warn', 4000); return; }
  if (isReadonly()) {
    showNotice(status, 'Licence expired — new work is paused.', 'error', 6000);
    return;
  }
  const tab = await getTab();
  if (!isInjectable(tab)) { showNotice(status, 'Cannot reach this page.', 'error', 4000); return; }
  // Refuse a selector that matches nothing, here, rather than saving a rule
  // that can only ever do nothing.
  const n = await inPage(tab.id, (x) => {
    try { return document.querySelectorAll(x).length; } catch (e) { return -1; }
  }, [sel]);
  if (n === -1) { showNotice(status, 'That is not valid CSS.', 'error', 6000); return; }
  if (!n) { showNotice(status, 'Nothing on this page matches that selector.', 'error', 6000); return; }

  try {
    await saveMappingEntry(
      { type: null, custom: 'staticFix', primary: 'exclude', config: { selector: sel }, needsWork: true },
      { refreshUi: false });
    await applyStaticFixesToPage();
    await loadMappingsList();
    refreshExportInfo();
    showNotice(status,
      `${n} element${n === 1 ? '' : 's'} taken out of the tab order and out of the screen reader. ` +
      `The scan will stop reporting anything inside it.`, 'success', 8000);
  } catch (err) {
    showNotice(status, 'Could not save it: ' + err.message, 'error', 8000);
  }
});

document.getElementById('excludeTest')?.addEventListener('click', async () => {
  const sel = (document.getElementById('excludeSel')?.value || '').trim();
  if (!sel) return;
  const tab = await getTab();
  if (!isInjectable(tab)) return;
  await inPage(tab.id, (x) => window.__u1SelectorIntel.highlightSelector(x), [sel]).catch(() => {});
});

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
  document.getElementById('scanClearBtn').style.display = scanResults.length ? '' : 'none';
  // One scan on screen at a time.
  //
  // These answer two unrelated questions — "what is wrong with this page" and
  // "do the mappings I built still work" — and they were shown together, so a
  // page scan left the previous run's mapping results sitting under it as if
  // they were part of the same answer. The results are not thrown away; the
  // section reappears the moment its own scan is run again.
  showOnlyScan('static');
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

// ─────────────────────────────────────────────────────────────────────────────
//  Element scan — the 🧪 test, run over every saved mapping
//
//  Deliberately ON DEMAND ONLY. It moves real focus and synthesises real key
//  presses on the client's page, so it must never be wired into
//  loadMappingsList() or the auto-apply on panel open (search: applyAllMappings
//  ({ silent: true })) — that is exactly where it would look natural and be
//  wrong. The only entry points are #elemScanBtn and #elemScanReportBtn.
//
//  Needs no API key: nothing here touches U1AI.
// ─────────────────────────────────────────────────────────────────────────────

let elemScanResults = [];
let elemScanActiveStatus = '*';
let elemScanRunning = false;
let elemScanAbort = false;

// Ordered worst-first, so the chip row reads the way the work should be done.
const ELEM_STATUS_META = {
  fail:    { label: 'Failed',      chip: 'sev-critical' },
  warn:    { label: 'Warnings',    chip: 'sev-medium' },
  pass:    { label: 'Passed',      chip: 'sev-low' },
  absent:  { label: 'Not on page', chip: '' },
  skipped: { label: 'Skipped',     chip: '' },
  error:   { label: 'Errors',      chip: 'sev-high' },
};

function elemScanFiltered() {
  return elemScanResults.filter(r => elemScanActiveStatus === '*' || r.status === elemScanActiveStatus);
}

function renderElemScanFilters() {
  const el = document.getElementById('elemScanFilters');
  if (!el) return;
  const counts = {};
  for (const r of elemScanResults) counts[r.status] = (counts[r.status] || 0) + 1;
  const chip = (s, label, n) =>
    `<button class="scan-chip ${s === '*' ? '' : (ELEM_STATUS_META[s]?.chip || '')} ${elemScanActiveStatus === s ? 'active' : ''}" data-elem-status="${escapeHtml(s)}">${escapeHtml(label)} <span class="n">${n}</span></button>`;
  const chips = Object.keys(ELEM_STATUS_META)
    .filter(s => counts[s])
    .map(s => chip(s, ELEM_STATUS_META[s].label, counts[s]))
    .join('');
  el.innerHTML = `<div class="scan-filter-row">${chip('*', 'All', elemScanResults.length)}${chips}</div>`;
}

function renderElemScanResults() {
  const wrap = document.getElementById('elemScanResults');
  if (!wrap) return;
  const list = elemScanFiltered();
  if (!list.length) { wrap.innerHTML = '<div class="empty-state">Nothing matches this filter.</div>'; return; }
  wrap.innerHTML = list.map(r => {
    const gi = elemScanResults.indexOf(r);
    const meta = ELEM_STATUS_META[r.status] || { label: r.status, chip: '' };
    const testable = r.status === 'pass' || r.status === 'warn' || r.status === 'fail';
    return `
    <div class="scan-item ${meta.chip}" data-elem-idx="${gi}">
      <div class="scan-item-main">
        <span class="scan-sev-badge ${meta.chip}">${escapeHtml(meta.label)}</span>
        <span class="scan-issue-title">Fix #${escapeHtml(String(r.fixNo ?? '—'))} · ${escapeHtml(r.label || r.type)}</span>
        <code>u1.fix.${escapeHtml(r.type)}</code>
        ${r.primary ? `<button class="btn-ghost btn-xs scan-hl" title="Highlight on page">🔍</button>` : ''}
      </div>
      <div class="scan-context">
        ${escapeHtml(r.primary || '')}
        ${testable ? ` · <span class="pills">${testPillsHtml([...r.staticSteps, ...r.keyboardSteps])}</span>` : ''}
      </div>
      ${r.reason ? `<div class="scan-context">${escapeHtml(r.reason)}</div>` : ''}
      ${testable ? `
      <details class="scan-why">
        <summary>What was tested</summary>
        <div class="test-section-title">🏷️ Accessibility (code) <span class="pills">${testPillsHtml(r.staticSteps)}</span></div>
        <ul class="test-steps">${testStepListHtml(r.staticSteps)}</ul>
        <div class="test-section-title">⌨️ Keyboard navigation <span class="pills">${testPillsHtml(r.keyboardSteps)}</span></div>
        <ul class="test-steps">${testStepListHtml(r.keyboardSteps)}</ul>
      </details>` : ''}
    </div>`;
  }).join('');
}

// The engine streams a step the moment it happens. A run of eleven mappings is
// two minutes of the page driving itself; without this the panel just sits.
function elemScanLiveStep(msg) {
  const box = document.getElementById('elemScanProgress');
  if (!box) return;
  if (msg.type === 'u1-test-start') {
    const ul = box.querySelector('#elemScanLiveSteps');
    if (ul) ul.innerHTML = '';
  } else if (msg.type === 'u1-test-step' && msg.step) {
    const ul = box.querySelector('#elemScanLiveSteps');
    if (ul) { ul.insertAdjacentHTML('beforeend', testStepRowHtml(msg.step)); ul.lastElementChild?.scrollIntoView({ block: 'nearest' }); }
  }
}

function elemScanProgressHtml(n, total, m) {
  return `
    <div class="test-head">
      <strong>Testing ${n} of ${total}</strong>
      <code>${escapeHtml(m.primary || m.firstArg || '')}</code>
      <span class="test-live-tag">${escapeHtml(m.type)}</span>
    </div>
    <ul class="test-steps" id="elemScanLiveSteps"></ul>`;
}

/**
 * @param {string} [onlyKey] mappingKey of a single mapping to test. Given, the
 *   run is that one mapping — this is what the 🧪 button in the Mappings drawer
 *   hands over, so the per-mapping test and the all-of-them test produce the
 *   same report in the same place instead of two different kinds of answer in
 *   two different tabs.
 */
async function runElementScan(onlyKey) {
  const status = document.getElementById('elemScanStatus');
  const btn = document.getElementById('elemScanBtn');
  const stopBtn = document.getElementById('elemScanStopBtn');
  const progress = document.getElementById('elemScanProgress');
  const tab = await getTab();
  if (!isInjectable(tab)) { showNotice(status, 'Cannot run on this page.', 'error', 4000); return; }

  const key = storageKey('mappings', currentHostname);
  let all = (await U1Store.get([key]))[key] || [];
  if (onlyKey) {
    all = all.filter(m => typeof m === 'object' && mappingKey(m) === onlyKey);
    if (!all.length) {
      showNotice(status, 'That mapping is no longer saved for this site.', 'error', 5000);
      return;
    }
  }
  if (!all.length) {
    showNotice(status, 'No saved mappings for this site yet — add some in the Picker tab.', 'info', 5000);
    return;
  }

  // A custom aria-label mapping has no widget behaviour to drive, and a legacy
  // string entry has no type at all. Report them rather than pretending.
  const results = [];
  const candidates = [];
  for (const m of all) {
    if (typeof m !== 'object' || !m.type) {
      results.push({ type: 'legacy', primary: String(m), status: 'skipped',
        reason: 'Legacy mapping — re-add it to test it.', staticSteps: [], keyboardSteps: [] });
    } else if (m.custom) {
      results.push({ ...pickMappingFields(m), status: 'skipped',
        reason: 'Custom mapping — nothing for the keyboard test to drive.', staticSteps: [], keyboardSteps: [] });
    } else {
      candidates.push(m);
    }
  }

  // One probe for the whole list. Without this, a site with thirty mappings
  // spends minutes driving elements that are not on the page being looked at.
  const present = new Set(await selectorsPresentOnPage(candidates.map(m => m.primary || m.firstArg || '')));
  const toTest = [];
  for (const m of candidates) {
    const sel = m.primary || m.firstArg || '';
    if (!present.has(sel)) {
      results.push({ ...pickMappingFields(m), status: 'absent',
        reason: 'Not on this page right now — open the page or the dialog it belongs to, then run this again.',
        staticSteps: [], keyboardSteps: [] });
    } else {
      toTest.push(m);
    }
  }

  elemScanRunning = true;
  elemScanAbort = false;
  btn.disabled = true;
  stopBtn.style.display = '';
  showOnlyScan('mappings');
  document.getElementById('elemScanReportRow').style.display = 'none';
  progress.style.display = toTest.length ? 'block' : 'none';

  try {
    for (let i = 0; i < toTest.length; i++) {
      if (elemScanAbort) break;
      const m = toTest[i];
      progress.innerHTML = elemScanProgressHtml(i + 1, toTest.length, m);
      showNotice(status, `Testing ${i + 1} of ${toTest.length} — watch the page.`, 'warn', 0);

      const t0 = Date.now();
      let res = null;
      let errMsg = '';
      try {
        // A widget that never settles must not hold the whole run. The engine's
        // own waits are per-assertion; this is the ceiling for the mapping.
        res = await Promise.race([
          callTestEngine('runTest', [m.type, m.primary || m.firstArg || '',
            (m.config && typeof m.config === 'object') ? m.config : { selectors: {} }]),
          new Promise(r => setTimeout(() => r({ __timeout: true }), 30000)),
        ]);
      } catch (e) {
        errMsg = e?.message || String(e);
      }

      if (res && res.__timeout) {
        results.push({ ...pickMappingFields(m), status: 'error', reason: 'Timed out after 30 seconds.',
          staticSteps: [], keyboardSteps: [], ms: Date.now() - t0 });
      } else if (!res || !res.static) {
        results.push({ ...pickMappingFields(m), status: 'error',
          reason: errMsg || 'Could not run the test — the page may have changed while testing.',
          staticSteps: [], keyboardSteps: [], ms: Date.now() - t0 });
      } else {
        const staticSteps = res.static.steps || [];
        const keyboardSteps = (res.keyboard && res.keyboard.steps) || [];
        const all2 = [...staticSteps, ...keyboardSteps];
        const fail = all2.filter(s => s.status === 'fail').length;
        const warn = all2.filter(s => s.status === 'warn').length;
        results.push({
          ...pickMappingFields(m),
          status: fail ? 'fail' : warn ? 'warn' : 'pass',
          reason: '', staticSteps, keyboardSteps, inspect: res.inspect,
          counts: { pass: all2.length - fail - warn, fail, warn },
          ms: Date.now() - t0,
        });
      }

      // Leave the page as we found it before the next mapping. The dialog branch
      // closes what it opens, but menu/listbox/combobox can leave a popup open —
      // and an open menu swallows the next mapping's key presses.
      await callTestEngine('removeHud', []).catch(() => {});
      await inPage(tab.id, () => {
        const el = document.activeElement;
        if (el) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          if (typeof el.blur === 'function') el.blur();
        }
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 200));
    }
  } finally {
    elemScanRunning = false;
    elemScanAbort = false;
    btn.disabled = false;
    stopBtn.style.display = 'none';
    stopBtn.disabled = false;
    stopBtn.textContent = '■ Stop';
    progress.style.display = 'none';
    progress.innerHTML = '';
    await callTestEngine('removeHud', []).catch(() => {});
  }

  elemScanResults = results;
  elemScanActiveStatus = '*';
  const tested = results.filter(r => ['pass', 'warn', 'fail'].includes(r.status)).length;
  const failed = results.filter(r => r.status === 'fail').length;
  document.getElementById('elemScanCount').textContent =
    `${tested} tested · ${failed} failing`;
  renderElemScanFilters();
  renderElemScanResults();
  document.getElementById('elemScanClearBtn').style.display = '';
  document.getElementById('elemScanReportRow').style.display = results.length ? '' : 'none';
  showNotice(status, tested
    ? `Tested ${tested} mapping${tested === 1 ? '' : 's'}. ${failed} need${failed === 1 ? 's' : ''} work.`
    : 'Nothing could be tested on this page — see the list below for why.',
    failed ? 'warn' : 'success', 6000);
}

// The fields the element scan carries forward from a saved mapping.
function pickMappingFields(m) {
  return {
    key: mappingKey(m), fixNo: m.fixNo, id: m.id, type: m.type,
    primary: m.primary || m.firstArg || '', label: m.type,
    screenshot: m.screenshot || null,
  };
}

document.getElementById('elemScanBtn')?.addEventListener('click', () => {
  runElementScan().catch(err => {
    elemScanRunning = false;
    showNotice(document.getElementById('elemScanStatus'), 'Failed: ' + err.message, 'error', 6000);
  });
});

document.getElementById('elemScanStopBtn')?.addEventListener('click', () => {
  elemScanAbort = true;
  const b = document.getElementById('elemScanStopBtn');
  b.disabled = true;
  b.textContent = 'Stopping…';
});

document.getElementById('elemScanClearBtn')?.addEventListener('click', () => {
  elemScanResults = [];
  document.getElementById('elemScanSection').style.display = 'none';
  document.getElementById('elemScanClearBtn').style.display = 'none';
});

document.getElementById('elemScanFilters')?.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-elem-status]');
  if (!chip) return;
  elemScanActiveStatus = chip.dataset.elemStatus;
  renderElemScanFilters();
  renderElemScanResults();
});

document.getElementById('elemScanResults')?.addEventListener('click', async (e) => {
  if (e.target.closest('.scan-why')) return;
  const item = e.target.closest('.scan-item');
  if (!item) return;
  const r = elemScanResults[Number(item.dataset.elemIdx)];
  if (!r || !r.primary) return;
  const found = await highlightMatch(r.primary, 0, true);
  if (found === false) {
    showNotice(document.getElementById('elemScanStatus'), `Couldn't find "${r.primary}" on the page right now.`, 'warn', 3000);
    return;
  }
  setTimeout(() => highlightMatch(r.primary, 0, false), 3000);
});

document.getElementById('elemScanReportBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('elemScanReportStatus');
  const btn = document.getElementById('elemScanReportBtn');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Building…';
  try {
    const tab = await getTab();
    await generateElementScanReport(currentHostname, elemScanResults, tab?.url || '', tab?.title || '');
    showNotice(status, 'Report opened in a new tab.', 'success', 4000);
  } catch (err) {
    showNotice(status, 'Could not build the report: ' + err.message, 'error', 6000);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('copyTemplateBtn').addEventListener('click', () => {
  const text = $templatePreview.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyTemplateBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
});

// U1-dependent types that have a DOM-only twin in the same dropdown. Read when
// an apply dies on a missing library, so the error can name the way forward
// instead of only naming the problem. Labels must match panel.html's <option>.
const U1_FREE_ALTERNATIVE = {
  tabs: 'tab strip (custom — full pattern, no U1)',
  grid: 'keyboard grid (custom — arrow nav, no U1)',
  datepicker: 'keyboard grid (custom — arrow nav, no U1)',
  button: 'make keyboard-clickable (custom — all matches)',
  link: 'make keyboard-clickable (custom — all matches)',
};

document.getElementById('applyTemplateBtn').addEventListener('click', async () => {
  if (!currentTemplate) return;
  const status = document.getElementById('applyStatus');
  // Measured, for the same reason Apply All is: applyOne answers ok for any
  // u1.fix call that does not throw, and a fix that lands on nothing does not
  // throw. The template is not saved yet, so it goes to the batch directly.
  if (!currentTemplate.custom) {
    // The same repair as the save path, so Apply cannot look different from
    // what a saved mapping would do.
    const narrowedNow = await narrowContained(currentTemplate);
    if (narrowedNow.length) {
      $templatePreview.textContent = currentTemplate.code;
      showNarrowed(status, narrowedNow);
    }
    const res = await applyMappingsBatch([{
      type: currentTemplate.type, primary: currentTemplate.primary,
      firstArg: currentTemplate.firstArg, config: currentTemplate.config,
      overwriteRole: currentTemplate.overwriteRole,
    }]);
    const v = describeApply(res, currentTemplate);
    if (res.u1Missing) {
      const alt0 = U1_FREE_ALTERNATIVE[currentTemplate.type];
      showNotice(status, 'U1 is not loaded on this page — inject it in Setup first' +
        (alt0 ? `, or pick "${alt0}" in the type list, which runs without U1.` : '.'), 'error', 7000);
      return;
    }
    showNotice(status, v.msg, v.ok ? 'success' : 'error', v.ok ? 4000 : 20000);
    if (v.roleClash && await askRoleClash(v.roleClash)) {
      await applyRoleOverwrite(v.roleClash.sel, v.roleClash.role, status);
    }
    return;
  }
  const result = await applyOne(currentTemplate.type, currentTemplate.firstArg || currentTemplate.primary, currentTemplate.config, currentTemplate.custom, currentTemplate);
  if (result.ok) {
    showNotice(status, 'Applied on page.', 'success');
  } else if (result.u1Missing) {
    // Naming the alternative matters here. The export emits window.u1?.fix.*,
    // so on a page without U1 that code is a silent no-op and the only symptom
    // is "nothing happened" — with no error anywhere to explain it. Say which
    // dropdown entry does work on this page.
    const alt = U1_FREE_ALTERNATIVE[currentTemplate.type];
    showNotice(status, 'U1 is not loaded on this page — inject it in Setup first' +
      (alt ? `, or pick "${alt}" in the type list, which runs without U1.` : '.'),
      'error', 7000);
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

// A role the site wrote blocks the fix, and the answer is a decision — so it is
// asked as one, in the middle of the screen.
//
// It was a small button appended to the status line at the bottom of the panel,
// where it went unread: the apply had just reported success-shaped text, the
// eye had already moved on, and the one thing standing between the mapping and
// working was a link below the fold. Same question as the save-time clash, so
// it uses the same dialog rather than inventing a second look for it.
function askRoleClash(clash) {
  const dlg = document.getElementById('roleClashDialog');
  if (!dlg || !clash) return Promise.resolve(false);

  document.getElementById('roleClashBody').innerHTML =
    `<code>${escapeHtml(clash.sel)}</code> carries <code>role="${escapeHtml(clash.role)}"</code> ` +
    `in the site's own HTML — we did not put it there. U1 will not write ` +
    `<code>role="${escapeHtml(clash.willWrite)}"</code> over it, so this fix cannot land while it is there.`;

  // "Map it as <role>" belongs to the save-time question, where the type can
  // still be changed before anything exists. Here the mapping is already built
  // and applied; the choice is replace it or leave it.
  const switchBtn = document.getElementById('roleClashSwitch');
  switchBtn.style.display = 'none';
  const over = document.getElementById('roleClashOverwrite');
  const cancel = document.getElementById('roleClashCancel');
  over.textContent = `Replace role="${clash.role}"`;
  cancel.textContent = 'Leave it';

  return new Promise((resolve) => {
    const done = (answer) => {
      dlg.close();
      over.textContent = 'Overwrite it';
      cancel.textContent = 'Cancel';
      switchBtn.style.display = '';
      over.removeEventListener('click', onOver);
      cancel.removeEventListener('click', onCancel);
      resolve(answer);
    };
    const onOver = () => done(true);
    const onCancel = () => done(false);
    over.addEventListener('click', onOver);
    cancel.addEventListener('click', onCancel);
    dlg.showModal();
  });
}

// Work on what is already found, without waiting for the rest of the run.
//
// The components discovered in completed sections existed and were unreachable:
// the list only turned into the components view when the whole run ended. On a
// twenty-six section page that means the first thing found is unusable for
// eight minutes, and if you stop early it was never clear that stopping is what
// releases it.
//
// Stopping IS the release — the run's tail already moves to the components view
// — so this presses Stop for you and waits, rather than inventing a second path
// into the same place.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-build-found]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();          // it lives inside a <summary>; do not toggle the drawer

  if (aiSweep.running) {
    btn.disabled = true;
    btn.textContent = 'Finishing this section…';
    aiSweep.abort = true;
    // Holding for fixes is a wait on a person, not on work — nothing is going
    // to end it but this. Left alone it span out the full sixty seconds below
    // and then reported the run as still going.
    if (sweepPause.resolve) sweepPause.resolve({ stopped: true });
    // The current section is paid for either way, so it is allowed to land.
    for (let i = 0; i < 400 && aiSweep.running; i++) {
      await new Promise((r) => setTimeout(r, 150));
    }
    return;                     // the run's own tail moves to the components view
  }

  const total = aiSweep.stops.reduce((a, x) => a + ((x.found || []).filter(f => !f.done).length), 0);
  if (!total) return;
  aiSweep.phase = 'components';
  renderSweepPicks();
});

// Back to the sections list, to carry on searching the ones never reached.
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-back-to-sections]')) return;
  aiSweep.phase = 'screens';
  renderSweepScreens();
});

/** Throwing away the survey — always asked, because it is never nothing. */
function confirmSweepClear() {
  const dlg = document.getElementById('sweepClearDialog');
  if (!dlg) return Promise.resolve(true);
  const stops = aiSweep.stops || [];
  const searched = stops.filter((s) => s.scanned).length;
  document.getElementById('sweepClearBody').textContent =
    `${stops.length} section${stops.length === 1 ? '' : 's'} and their pictures go, for everyone on this project. ` +
    (searched
      ? `${searched} of them ${searched === 1 ? 'has' : 'have'} already been searched, and searching them again costs the same as it did the first time. `
      : 'Walking the page again is free, but it takes a few minutes. ') +
    'Components you have already mapped are not affected.';

  return new Promise((resolve) => {
    const go = document.getElementById('sweepClearGo');
    const cancel = document.getElementById('sweepClearCancel');
    const done = (answer) => {
      dlg.close();
      go.removeEventListener('click', onGo);
      cancel.removeEventListener('click', onCancel);
      resolve(answer);
    };
    const onGo = () => done(true);
    const onCancel = () => done(false);
    go.addEventListener('click', onGo);
    cancel.addEventListener('click', onCancel);
    dlg.showModal();
  });
}

/**
 * The cost of a sweep run, stated before it is spent — and what will be left
 * out of it.
 *
 * A run of twenty-six sections cost $3.38 and returned nothing, because
 * everything on the page was on the dismissed list. That list is invisible
 * until AFTER a run comes back empty, which is the one moment the information
 * is worth nothing. It belongs on the dialog that spends the money.
 */
async function confirmSweepCost(sections, rereading, elements, calls) {
  const dlg = document.getElementById('sweepCostDialog');
  const each = sweepAvgCall();
  if (!dlg) return true;
  // A section bigger than one batch is asked about in more than one call. The
  // dialog that spends the money says how many, or the first busy page comes in
  // at twice what was agreed to.
  if (calls == null) calls = sections;

  let skipped = 0;
  try { skipped = (await dismissedSelectors()).length; } catch {}

  document.getElementById('sweepCostBody').innerHTML =
    escapeHtml(`Searching ${sections} section${sections === 1 ? '' : 's'} for components — that is ${calls} call${calls === 1 ? '' : 's'} to Claude` +
      (calls > sections ? ` (the busy sections take more than one)` : '') + `, ` +
      `about $${each.toFixed(2)} each, ~$${(calls * each).toFixed(2)} in total, ` +
      // The dialog quotes the same number the box above it does, from the same
      // function. Two numbers for one press, differing because one was written
      // later than the other, is how an estimate stops being read at all.
      `and roughly ${mins(sweepSecsFor(elements))}.`) +
    // A ▶ next to a completed screen is one press away from paying twice for
    // the same section. The button is still there — deliberately re-reading
    // one is a real thing to want — but it is not something to do without
    // being told which of the two this is.
    (rereading
      ? `<br><br><strong>Screen ${rereading} has already been searched and paid for.</strong> ` +
        `Reading it again is a second call, and replaces what it found.`
      : '') +
    (skipped
      ? `<br><br><strong>${skipped} element${skipped === 1 ? '' : 's'} on this site ${skipped === 1 ? 'is' : 'are'} on the dismissed list</strong> ` +
        `and will be left out of every section. Dismissals belong to the project and are shared, so they may not be yours. ` +
        `If a run has been coming back empty, this is why. ` +
        `<button class="btn-outline btn-xs" data-reset-dismissed>Clear the dismissed list</button>`
      : '');

  return new Promise((resolve) => {
    const go = document.getElementById('sweepCostGo');
    const cancel = document.getElementById('sweepCostCancel');
    const done = (answer) => {
      dlg.close();
      go.removeEventListener('click', onGo);
      cancel.removeEventListener('click', onCancel);
      resolve(answer);
    };
    const onGo = () => done(true);
    const onCancel = () => done(false);
    go.addEventListener('click', onGo);
    cancel.addEventListener('click', onCancel);
    dlg.showModal();
  });
}

// The one cause of an empty run that you can undo, with the undo attached.
function offerResetDismissed(status) {
  if (!status || status.querySelector('[data-reset-dismissed]')) return;
  status.insertAdjacentHTML('beforeend',
    ' <button class="btn-outline btn-xs" data-reset-dismissed>Clear the dismissed list</button>');
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-reset-dismissed]');
  if (!btn) return;
  await U1Store.remove([storageKey('dismissed', currentHostname)]);
  // It can be pressed from inside the cost dialog, where the warning it belongs
  // to is still on screen and would otherwise go on claiming a list that is now
  // empty. Take the paragraph out rather than leaving a stale reason up.
  const inDialog = btn.closest('#sweepCostDialog');
  if (inDialog) {
    const body = document.getElementById('sweepCostBody');
    if (body) body.innerHTML = body.innerHTML.replace(/<br><br><strong>[\s\S]*$/, '') +
      '<br><br><em>Dismissed list cleared — this run will look at everything.</em>';
    return;
  }
  showNotice(document.getElementById('sweepPicksStatus'),
    'Dismissed list cleared for this site. Tick the sections again and read — they will come back with everything on them.',
    'success', 10000);
});

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

// "Replace the site's role and apply."
//
// The decision was previously only reachable at save time, so a mapping already
// on the list had no way to make it: Apply ran, U1 met the author's role, and
// nothing happened — with no way forward except deleting the mapping and
// building it again. The answer is recorded on the mapping so every later apply
// and the exported file make the same choice.
//
// Removing the role is enough on its own. U1 will not look at an element twice
// in a page load, so re-running the fix here would be theatre — but the patch's
// own corrector fills in role="listbox" and role="option" the moment the
// author's role is gone, which is what actually makes the component work.
async function applyRoleOverwrite(sel, was, status) {
  const key = storageKey('mappings', currentHostname);
  const stored = await U1Store.get([key]);
  const list = stored[key] || [];
  const idx = list.findIndex(m => m && typeof m === 'object' && m.primary === sel);
  if (idx < 0) {
    // Not saved yet — the clash was reported by the picker's own Apply. Record
    // the answer on the template so it travels into the mapping when saved.
    if (currentTemplate && currentTemplate.primary === sel) {
      currentTemplate.overwriteRole = was;
      currentTemplate.code = mappingToCode(currentTemplate);
      const res = await applyMappingsBatch([{
        type: currentTemplate.type, primary: currentTemplate.primary,
        firstArg: currentTemplate.firstArg, config: currentTemplate.config,
        overwriteRole: was,
      }]);
      const v = describeApply(res, currentTemplate);
      showNotice(status, `Removed role="${was}" from ${sel}. ` + v.msg +
        ' Save the mapping to keep this answer — the exported file will do the same.',
        v.ok ? 'success' : 'error', 14000);
      return;
    }
    showNotice(status, 'That mapping is no longer on the list.', 'error', 6000);
    return;
  }
  list[idx] = { ...list[idx], overwriteRole: was, code: mappingToCode({ ...list[idx], overwriteRole: was }) };
  await U1Store.set({ [key]: list });

  const r = await applyOne(list[idx].type, list[idx].firstArg || list[idx].primary,
                           list[idx].config, list[idx].custom, list[idx]);
  await loadMappingsList();
  showNotice(status,
    r.ok ? `Removed role="${was}" from ${sel} and re-applied. The exported file now does the same, so the client gets this too.`
         : `Removed role="${was}" from ${sel}, but the fix reported: ${r.err || 'no result'}`,
    r.ok ? 'success' : 'error', 12000);
}

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
// `refreshUi:false` suppresses the list + export re-render. Saving one mapping
// should repaint; saving twelve in a row should repaint once at the end, not
// twelve times — each loadMappingsList() runs an executeScript against the page.
async function saveMappingEntry(template, { editingKey = null, refreshUi = true } = {}) {
  // The site may already have said what this element is, and overruling an
  // author's role is a decision for a person.
  //
  // This lives HERE, not in the button handlers, because there are three ways
  // to create a mapping — the manual Add, the AI card's "Approve & apply", and
  // the bulk save — and only the first one asked. An AI-approved mapping went
  // straight past the question and was only discovered later, after an apply
  // that reported success-shaped text. One save path, one place to ask.
  if (!(await confirmRoleOverwrite(template))) return { cancelled: true };

  // ── A required selector may not be missing ────────────────────────────────
  //
  // validateMapping existed and was called from exactly one place: the manual
  // builder's form. Every other route — the AI card, the bulk save, the sweep's
  // own confirm — went straight past it, so a mapping could be stored and
  // exported with a required field empty and nothing ever said so.
  //
  // That is how this shipped to a client:
  //
  //   fix.tabs("#dealTab-week", { selectors: { tab: ".tab-bar__btn",
  //                                            tabList: "#dealTab-week" } })
  //
  // tabPanel is required and absent, and tabList is a single BUTTON. u1 has
  // nothing to work with, decorates nothing, and reports nothing — the strip
  // stays exactly as it was while the drawer says it is mapped.
  //
  // Here, for the same reason the role question is here: one save path, one
  // place to refuse.
  if (template && template.type && !template.custom) {
    const sc = COMPONENT_SCHEMAS[template.type];
    if (sc) {
      const pKey = primaryKeyOf(sc);
      const missing = (sc.req || []).filter((r) => {
        const v = (r === pKey) ? template.primary
          : ((template.config && template.config.selectors) || {})[r];
        return !v || !String(v).trim();
      });
      if (missing.length) {
        throw new Error(
          `A ${template.type} needs ${missing.join(' and ')} and ${missing.length === 1 ? 'it is' : 'they are'} ` +
          `empty. Saved like this it would decorate nothing and say nothing — fill ` +
          `${missing.length === 1 ? 'it' : 'them'} in, or map this as something else.`);
      }
    }
  }

  // A selector wider than the container it belongs to is repaired here, before
  // anything is stored — so the mapping, its code, and the exported client file
  // all carry the narrowed form. Every route saves through this function, which
  // is why it is the place.
  const narrowed = await narrowContained(template);

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
    // The answer to "the site already wrote a role here". Kept on the record,
    // not on the moment: apply, re-apply and export all have to make the same
    // choice, and a decision that lives only in a dialog cannot be repeated.
    overwriteRole: template.overwriteRole || (prev && prev.overwriteRole) || null,
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

  if (refreshUi) {
    loadMappingsList();
    refreshExportInfo();
  }
  return { updated: existingIdx >= 0, narrowed };
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
  let updated, cancelled, narrowed;
  try {
    ({ updated, cancelled, narrowed } = await saveMappingEntry(currentTemplate, { editingKey: editingMappingKey }));
    if (cancelled) { btn.textContent = 'Add to Mapping'; return; }
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
  // Say it. A selector rewritten behind your back is worse than one left wrong,
  // however good the rewrite.
  if (narrowed && narrowed.length) showNarrowed(status, narrowed);
});

/** What was narrowed, and why it had to be. */
function showNarrowed(status, narrowed) {
  showNotice(status, narrowed.map((n) =>
    `"${n.field}" matched ${n.total} elements, ${n.outside} of them outside the container — ` +
    `narrowed to ${n.now} so the fix can land.`).join(' '), 'warn', 14000);
}

// Apply every saved mapping for the current host. `silent` suppresses the
// "no mappings" / success notices (used by the auto-run on panel open).
// `only` is a mappingKey: apply that one, through exactly this path.
//
// The drawer's ▶ used to call applyFix directly, and applyFix reports ok for
// any call that does not throw — it measures nothing. So one mapping said
// "Applied on page." while the identical mapping under Apply All was measured,
// diagnosed and told you what was in the way. Two answers to the same question,
// and the reassuring one was the one attached to the single-mapping button.
async function applyAllMappings({ silent = false, only = null } = {}) {
  const key = storageKey('mappings', currentHostname);
  const stored = await U1Store.get([key]);
  const all = stored[key] || [];
  const list = only ? all.filter(m => mappingKey(m) === only) : all;
  const status = document.getElementById('applyAllStatus');
  if (list.length === 0) {
    if (!silent) showNotice(status, 'No mappings to apply.', 'error');
    return { applied: 0, failed: 0 };
  }
  // Custom mappings (aria-label) run as scripts; u1.fix ones go through the batch.
  const custom = list.filter(m => m && typeof m === 'object' && m.custom);
  const fixes = list.filter(m => !(m && typeof m === 'object' && m.custom));

  let applied = 0, failed = 0, noEffect = 0, u1Missing = false, err = null, u1State = null;
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
    const r = await applyOne(m.type, m.firstArg || m.primary, m.config, m.custom, m);
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
      // Half-applied mappings, named. This detail only ever reached the AI
      // card, so building the same mapping by hand told you nothing about a
      // menu that decorated its container and skipped every field.
      for (const d of details.filter(x => x.fieldsNoEffect && x.fieldsNoEffect.length)) {
        const m = fixes.find(f => (f.firstArg || f.primary) === d.sel);
        msg += ' ' + describeApply({ ok: true, applied: 1, details: [d] }, m).msg
          .replace(/^Applied — \d+ elements? changed on the page\. /, `${d.sel}: `);
      }
      // The blocker, named, with the one action that clears it.
      //
      // "These fields changed nothing" is a symptom, and it was the whole
      // report. When the cause is a role the site wrote, say the cause: U1 does
      // not write over an author's role, so the fix cannot land however right
      // the selectors are, and re-applying will never change that.
      // describeApply appends this sentence for any detail that went through
      // the loop above; what is left is a clash on a mapping whose fields all
      // moved, which never reached it.
      const clashes = details.filter(d => d.roleClash);
      for (const d of clashes.filter(x => !(x.fieldsNoEffect && x.fieldsNoEffect.length))) {
        msg += ` ${d.roleClash.sel} carries role="${d.roleClash.role}" in the site's own HTML.` +
          ` U1 will not write role="${d.roleClash.willWrite}" over it, so this fix cannot land while it is there.`;
      }
      showNotice(status, msg,
        (failed || noEffect || clashes.length) ? 'error' : (unblocked.length ? 'error' : 'success'),
        (noEffect || failed || unblocked.length || clashes.length) ? 20000 : 4000);
      // showNotice writes textContent, so the action has to be appended as
      // markup afterwards — the same shape offerReload uses.
      if (clashes.length && !silent) {
        const c = clashes[0].roleClash;
        if (await askRoleClash(c)) await applyRoleOverwrite(c.sel, c.role, status);
      }
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

// Apply All polls for up to 4s PER mapping, so a site with several can sit
// there for a long time. It had no busy state at all — the button looked idle
// while the panel was working, which reads as nothing having happened.
document.getElementById('applyAllBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const label = btn.textContent;
  btn.disabled = true;
  btn.classList.add('is-working');
  btn.textContent = 'Applying…';
  try { await applyAllMappings(); }
  finally {
    btn.disabled = false;
    btn.classList.remove('is-working');
    btn.textContent = label;
  }
});

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

// Put the run's "approved" record back to empty. Used when the site has no
// saved mappings left, so the panel cannot claim to have applied any.
function resetApprovedRun() {
  const box = document.getElementById('aiApproved');
  if (box) {
    const list = box.querySelector('#aiApprovedList');
    if (list) list.innerHTML = '';
    const n = box.querySelector('#aiApprovedN');
    if (n) n.textContent = '';
    box.style.display = 'none';
  }
  approvedSeq = 0;
  for (const key of [...agentThreads.keys()]) {
    if (key.startsWith('saved:')) agentThreads.delete(key);
  }
}

// What did applying actually do? One answer, wherever it is asked from.
//
// This lived inside the AI approve handler, so Manual mode never got any of
// it: no per-field report, no explanation of what menubar:false does. Applying
// is applying — the mode you built the mapping in should not change what you
// are told about it.
/**
 * Turns one item's apply result into a sentence.
 *
 * `i` is which item of the batch to describe. This used to be hardcoded to 0,
 * which was invisible while every call passed a one-item array — and would have
 * reported a twelve-mapping batch as twelve copies of the first item's verdict.
 * The per-item `status` is the authority here, not the batch-wide `res.applied`:
 * the in-page loop increments that counter exactly when it pushes status 'ok',
 * so for a single item the two agree, and for a batch only the former is right.
 */
// A role the site wrote blocks the fix outright, and that is true whatever else
// the run reported — so it is appended here, once, rather than in each of the
// callers that show an apply result.
function describeApply(res, m, i = 0) {
  const v = describeApplyResult(res, m, i);
  // A fix the patch declined to call. This is not "no effect" — u1.fix.* never
  // ran at all, so the selectors are innocent and looking at them is wasted
  // time. Say which one and why.
  const skipped = (res.skipped || []).filter((k) => !m || !m.type || k.type === m.type);
  if (skipped.length) {
    v.ok = false;
    v.msg += ` u1.fix.${skipped[0].type} was not run at all: ${skipped[0].why}.` +
      ` Nothing on the page was touched by it — the selectors are not the problem.`;
  }

  const clash = ((res.details || [])[i] || {}).roleClash;
  if (clash) {
    v.ok = false;
    v.msg += ` ${clash.sel} carries role="${clash.role}" in the site's own HTML.` +
      ` U1 will not write role="${clash.willWrite}" over it, so this fix cannot land while it is there.`;
    v.roleClash = clash;
  }
  return v;
}

function describeApplyResult(res, m, i = 0) {
  const d = (res.details || [])[i];
  if (!res.ok) {
    return { ok: false, msg: res.u1Missing
      ? 'U1 is not loaded on this page, so nothing was applied.'
      : 'Applying failed: ' + (res.err || 'unknown') };
  }
  if (d && d.status === 'ok') {
    const v = { ok: true, msg: `Applied — ${d.changed} element${d.changed === 1 ? '' : 's'} changed on the page.` };
    if (d.rebuilt) {
      v.msg += ' Note: this component is built by the site\u2019s own JavaScript after the page loads, so U1 had already finished with the empty container before these elements existed.';
    }
    if (d.fieldsNoEffect && d.fieldsNoEffect.length) {
      v.ok = false;
      // For a menu this is usually not a selector fault. menubar:false is
      // mandatory once there are submenus, and with it off U1 adds tabindex
      // and aria-hidden but no role="menu"/"menuitem" — so the fields look
      // untouched to anyone checking the DOM for roles.
      const menubarFalse = m && m.type === 'menu' && m.config && m.config.menubar === false;
      v.msg += ` But ${d.fieldsNoEffect.map(f => `"${f}"`).join(', ')} changed nothing — U1 decorated the container and left ${d.fieldsNoEffect.length === 1 ? 'that field' : 'those fields'} alone.`;
      // Short, and accurate. With menubar:false U1 DOES give the triggers
      // role="button" and the submenu containers role="menu" — only
      // role="menuitem" is exclusive to menubar:true. The old wording said
      // otherwise and ran to four sentences.
      v.msg += menubarFalse
        ? ` With menubar off, only "triggers" and "submenus" get roles — items stay plain links. Fill those two fields if they are empty.`
        : ` Check the selector, or whether this component supports it.`;
    }
    if (d.unblocked) {
      v.ok = false;
      v.msg += ` Note: ${d.sel} carries u1st-avoid-change-detection in the site's HTML. It was lifted here so the fix could run — remove it from the markup or this will not work in production.`;
    }
    return v;
  }
  // Applied, but something about the result looks harmful. Say it loudly and
  // above everything else — but the mapping IS applied, and undoing it on a
  // heuristic would be worse than letting someone who knows the library look.
  if (d && d.harm && d.harm.length) {
    return { ok: false, msg: `Applied — but check this: ${d.harm.join('; ')}. The mapping is still in place; if that is wrong for this component, use Delete to undo it precisely.` };
  }
  if (d && d.status === 'error') {
    return { ok: false, msg: `u1.fix.${d.type} threw: ${(res.errs && res.errs[0]) || 'unknown error'}` };
  }
  if (d && d.status === 'no-match') return { ok: false, msg: `Nothing on the page matches ${d.sel}.` };
  if (d && d.reason === 'source-opt-out') {
    return { ok: false, msg: `${d.sel} carries u1st-avoid-change-detection in the site's own HTML — U1 skips it.` };
  }
  if (d && d.reason === 'already-processed') {
    return { ok: false, msg: 'U1 had already processed this element this page load. Reload the page and press Apply All.' };
  }
  // The one we chased all day. Say the whole thing, because no amount of
  // selector work can help and the fix is not in this panel.
  if (d && d.rebuilt) {
    return { ok: false, msg: `Nothing changed — not the selectors. ${d.sel} is built by the site's JavaScript after load, so U1 had already finished with the empty container. It never looks at an element twice in one page load. The site has to render this in the HTML, or call u1.fix.* itself once it has built it.` };
  }
  if (res.u1State && res.u1State.decoratedOnPage === 0) {
    return { ok: false, msg: 'U1 is loaded but has decorated nothing anywhere on this page — it never started up for this domain. No mapping can apply until that is fixed, and the selectors are not the problem.' };
  }
  return { ok: false, msg: 'Nothing changed on the page — u1.fix ran without error and wrote no attributes.' };
}

// ── The agent, as a conversation ────────────────────────────────────────────
// One thread per mapping. Context (markup, config, what measurably happened)
// is gathered once and rides with every turn, so the specialist can just say
// "the mapping doesn't work" and get an answer, the way they would with any
// other agent.
const agentThreads = new Map();   // key → { ctx, history: [{role, text}] }

function renderAgentThread(box, key) {
  const t = agentThreads.get(key);
  if (!t) return;
  box.innerHTML =
    `<div class="ai-chat-head"><span>✨ Ask AI</span>` +
    `<button class="ai-why-close" data-closewhy title="Close">✕</button></div>` +
    `<div class="ai-chat-log">${t.history.map(m =>
      m.role === 'user'
        ? `<div class="ai-msg you">${escapeHtml(m.text)}</div>`
        : `<div class="ai-msg bot">${escapeHtml(m.text)}` +
          ((m.selectors || []).length
            ? `<div class="ai-msg-fix">${m.selectors.map(s =>
                `<code>${escapeHtml(s.key)}: ${escapeHtml(s.value)}</code>`).join('')}` +
              `<button class="btn-outline btn-xs" data-chatfix="${escapeHtml(key)}" data-turn="${t.history.indexOf(m)}">Use these</button></div>`
            : '') + `</div>`
      ).join('')}${t.busy ? '<div class="ai-msg bot thinking"><span></span><span></span><span></span></div>' : ''}</div>` +
    `<div class="ai-ask">` +
    `<input type="text" class="ai-ask-input" data-chatinput="${escapeHtml(key)}" ` +
    `placeholder="${t.history.length ? 'Reply…' : 'What isn\u2019t working?'}"${t.busy ? ' disabled' : ''}>` +
    `<button class="btn-outline btn-sm" data-chatsend="${escapeHtml(key)}"${t.busy ? ' disabled' : ''}>Send</button></div>`;
  const log = box.querySelector('.ai-chat-log');
  if (log) log.scrollTop = log.scrollHeight;
  const inp = box.querySelector('.ai-ask-input');
  if (inp && !t.busy) inp.focus();
}

async function agentSend(key, box, text) {
  const t = agentThreads.get(key);
  if (!t || !text) return;
  t.history.push({ role: 'user', text });
  t.busy = true;
  renderAgentThread(box, key);

  const out = await U1AI.chat({ ...t.ctx, history: t.history });
  aiCost += U1AI.estimateCost(out.usage) || 0;
  t.busy = false;
  t.history.push(out.err
    ? { role: 'assistant', text: out.err }
    : { role: 'assistant', text: out.reply || '', selectors: out.selectors || [] });
  renderAgentThread(box, key);
}

// Gather everything the agent needs to answer without being told it: the
// component's markup, the config in force, and what applying it actually does.
// `overwriteRole` matters here too: the agent is asked why a mapping did not
// work, and to answer that it re-applies it and watches. Re-applying it
// differently from how it really runs would have it diagnose a run that never
// happened.
async function agentContext(type, primary, firstArg, config, overwriteRole) {
  const sel = firstArg || primary;
  const tab = await getTab();
  if (!isInjectable(tab)) return { err: 'Cannot read this page.' };
  const markup = await inPage(tab.id, (s) => window.__u1SelectorIntel.extractComponent(s), [sel]);
  if (!markup || markup.error || markup.notFound) {
    return { err: `Nothing on this page matches ${sel}.` };
  }
  const res = await applyMappingsBatch([{ type, primary, firstArg, config, overwriteRole }]);
  const d = (res.details || [])[0];
  const outcome = !res.ok
    ? (res.u1Missing ? 'window.u1 is not loaded on the page at all.' : 'Applying failed: ' + res.err)
    : d && d.status === 'error' ? `u1.fix.${d.type} threw: ${(res.errs || [])[0] || 'unknown'}`
    : d && d.status === 'no-match' ? `Nothing on the page matches ${d.sel}.`
    : res.applied
      ? `${d.changed} element(s) gained U1 attributes.` +
        (d.fieldsNoEffect && d.fieldsNoEffect.length
          ? ` These fields changed nothing: ${d.fieldsNoEffect.join(', ')}.`
          : ' Every configured field changed something.')
      : `Nothing changed at all. u1.fix ran without throwing and wrote no attributes.${d && d.reason ? ' Reason: ' + d.reason + '.' : ''}`;
  // Hand the agent U1's own state, so a conversation starts from what the
  // library is actually doing rather than from the selectors.
  const state = res.u1State
    ? `\n\nState of the u1 library on this page: ${JSON.stringify(res.u1State)}.` +
      (res.u1State.decoratedOnPage === 0
        ? ' It has decorated NOTHING anywhere on this page, so it never started up for this domain — that is not a selector problem.'
        : '')
    : '';
  return { u1Type: type, containerSel: sel, config, markup, outcome: outcome + state };
}

document.addEventListener('click', (e) => {
  const send = e.target.closest('[data-chatsend]');
  if (!send) return;
  const key = send.dataset.chatsend;
  const box = send.closest('.ai-why');
  const inp = box.querySelector('.ai-ask-input');
  const text = (inp?.value || '').trim();
  if (text) agentSend(key, box, text);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const inp = e.target.closest('[data-chatinput]');
  if (!inp) return;
  e.preventDefault();
  const text = inp.value.trim();
  if (text) agentSend(inp.dataset.chatinput, inp.closest('.ai-why'), text);
});

// Close the agent's answer. It also lives inside the mapping's body, so
// collapsing the mapping puts it away.
document.addEventListener('click', (e) => {
  const x = e.target.closest('[data-closewhy]');
  if (!x) return;
  const box = x.closest('.ai-why');
  if (box) box.style.display = 'none';
});

// "Use these" — write the agent's proposed selectors where they belong: into
// the saved mapping if the thread is about one, otherwise into the card's form.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-chatfix]');
  if (!btn) return;
  const key = btn.dataset.chatfix;
  const t = agentThreads.get(key);
  const turn = t && t.history[Number(btn.dataset.turn)];
  if (!turn || !turn.selectors) return;

  if (key.startsWith('card:')) {
    const idx = Number(key.slice(5));
    const form = document.getElementById('aiMapForm' + idx);
    if (!form) return;
    for (const s of turn.selectors) {
      const inp = s.key === 'primary'
        ? form.querySelector('input[data-field="__primary"]')
        : form.querySelector(`input[data-field="${CSS.escape(s.key)}"]`);
      if (inp) inp.value = s.value;
    }
    await refreshAiCard(idx);
    btn.textContent = 'Applied ✓';
    btn.disabled = true;
    return;
  }

  const mkey = storageKey('mappings', currentHostname);
  const list = (await U1Store.get([mkey]))[mkey] || [];
  const m = list[t.savedIdx];
  if (!m) return;
  for (const s of turn.selectors) {
    if (s.key === 'primary') m.primary = s.value;
    else {
      m.config = m.config || {};
      m.config.selectors = m.config.selectors || {};
      m.config.selectors[s.key] = s.value;
    }
  }
  const rebuilt = buildTemplate(m.type, m.primary, m.config.selectors || {}, m.config);
  if (rebuilt) Object.assign(m, { code: rebuilt.code, firstArg: rebuilt.firstArg, config: rebuilt.config });
  await U1Store.set({ [mkey]: list });
  t.ctx.config = m.config;
  await loadMappingsList();
  refreshExportInfo();
  showNotice(document.getElementById('applyAllStatus'),
    'Mapping updated. Apply it to see the difference.', 'success', 5000);
});

// Recovering work filed under another hostname for the same client.// Recovering work filed under another hostname for the same client.
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

// The keyboard engines live in grid-nav.js. For DEPLOYMENT we inline their
// source so the produced snippet runs on the live site with no extension.
//
// grid-nav.js holds three INDEPENDENT engines (grid/datepicker, make-clickable,
// tab strip) marked off by //#region u1-engine:<kind>. Inlining the whole file
// shipped all three to every client — roughly 26KB where a site using one of
// them needs 5–14KB. `kinds` narrows it to what the mappings actually call.
async function getGridEngineSource(kinds) {
  try {
    const res = await fetch(chrome.runtime.getURL('grid-nav.js'));
    const src = await res.text();
    const wanted = new Set(kinds && kinds.length ? kinds : ['grid', 'clickable', 'tabs']);

    const picked = [];
    const re = /\/\/#region u1-engine:([a-z]+)\r?\n([\s\S]*?)\r?\n\/\/#endregion/g;
    let m;
    while ((m = re.exec(src))) if (wanted.has(m[1])) picked.push(m[2]);

    // If the markers are ever lost to a bad edit, fall back to the whole file:
    // a deliverable that is larger than it needs to be still works, one missing
    // its engine does not.
    return stripComments(picked.length ? `'use strict';\n${picked.join('\n\n')}` : src);
  } catch { return ''; }
}

// The U1 patch corrects defects in the library itself (see u1-patch.js). It is
// sliced the same way the engine is, so a site that maps tabs and a menu ships
// those two corrections rather than all fifteen.
//
// `core` is always included: it carries the per-match wrapper for u1.fix.*, the
// observer the other regions register with, and the skip-link fix, which has no
// mapping type of its own to key off.
async function getPatchSource(types) {
  try {
    const res = await fetch(chrome.runtime.getURL('u1-patch.js'));
    const src = await res.text();

    const wanted = new Set(['core']);
    (types || []).forEach((t) => wanted.add(t));
    // The popup a combobox opens IS a listbox, and the corrections for the open
    // list live with the role rather than with one of its two callers. Without
    // this a combobox ships without them.
    if (wanted.has('combobox')) wanted.add('listbox');

    const picked = [];
    const re = /\/\/#region u1-patch:([a-z]+)\r?\n([\s\S]*?)\r?\n\/\/#endregion/g;
    let m;
    while ((m = re.exec(src))) if (wanted.has(m[1])) picked.push(m[2]);

    // Only `core` matched means there is nothing type-specific to correct —
    // still worth shipping, because the wrapper and the skip-link fix apply to
    // every site. Nothing matched at all means the markers are gone; ship the
    // whole file rather than silently dropping the corrections.
    if (!picked.length) return stripComments(src);
    return stripComments(`'use strict';\n${picked.join('\n\n')}`);
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
  const fixes = [], customs = [], grids = [], clickables = [], tabStrips = [];
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
    // Must sit in an engine-carrying bucket, not with the plain customs: its
    // call is meaningless without the engine source shipped alongside it.
    else if (m.custom === 'keyboardTabs') tabStrips.push(m);
    // Declarations, not calls: a static fix switches on a corrector that lives
    // in the patch, so it has to be emitted BEFORE the patch runs.
    else if (m.custom === 'staticFix') { const c = mappingToCode(m); if (c) statics.push(header(m) + '\n' + c); }
    else if (m.custom) { const c = mappingToCode(m); if (c) customs.push(header(m) + '\n' + c); } // regenerated, never stored m.code
    else { const c = mappingToCode(m); if (c) fixes.push(header(m) + '\n' + c); }
  }

  const parts = [];
  parts.push(`/* ============================================================\n` +
    ` * U1 accessibility mappings — ${hostname}\n` +
    ` * Generated by U1 Studio on ${new Date().toLocaleString()}\n` +
    ` * Paste AFTER the U1 library <script> tag.\n` +
    ` * ============================================================ */`);

  // Which static rules were switched on, ahead of everything. The correctors
  // that read this ship inside the patch, and they run the moment it loads —
  // so a declaration after it would arrive one pass too late.
  if (statics.length) {
    parts.push(`/* ---- 0. Static corrections — which ones are on ---- */\n` + statics.join('\n\n'));
  }

  // The patch must be in place BEFORE the u1.fix.* calls below it: part of what
  // it does is wrap those functions so they apply to every match instead of the
  // first, and a wrapper installed afterwards would be too late.
  if (fixes.length || statics.length) {
    const mappedTypes = [...new Set(sorted.filter((m) => m && m.type && !m.custom).map((m) => m.type))];
    // The statics region carries every corrector the table above can switch on.
    if (statics.length) mappedTypes.push('statics');
    const patch = await getPatchSource(mappedTypes);
    if (patch) {
      parts.push(
        `/* ---- 1. Library corrections ----\n` +
        ` * Corrects defects in the U1 library for the components mapped below:\n` +
        ` * per-match application, missing keys, and ARIA states left unmaintained.\n` +
        ` * Each correction checks the current state first, so it goes quiet on\n` +
        ` * its own once the library ships the same fix. */\n` +
        `(function () {\n${patch}\n})();`
      );
    }
    // Wrapped in a named function and called, rather than run inline, so the
    // resize hook further down can run exactly the same calls again. See there
    // for why that is needed at all.
    if (fixes.length) {
      parts.push(`/* ---- 2. Component mappings ---- */\n` +
        `function __u1ApplyMappings() {\n` + fixes.join('\n\n') + `\n}\n__u1ApplyMappings();`);
    }
  }
  if (customs.length) {
    parts.push(`/* ---- 3. Accessible names ---- */\n` +
      `function __u1ApplyNames() {\n` + customs.join('\n\n') + `\n}\n__u1ApplyNames();`);
  }
  if (grids.length || clickables.length || tabStrips.length) {
    // Only the engines these mappings actually call.
    const kinds = [];
    if (grids.length) kinds.push('grid');
    if (clickables.length) kinds.push('clickable');
    if (tabStrips.length) kinds.push('tabs');
    // A hosted engine turns ~26KB of pasted code into one <script src> line,
    // and lets an engine fix reach every client without anyone re-pasting it.
    // Empty field → inline, exactly as before, so a client who will not load a
    // third-party script still gets something that works.
    const engine = await getGridEngineSource(kinds);
    const calls = grids.map(g =>
      header(g) + `\nwindow.__u1InstallGridFromMapping(${JSON.stringify(g.primary)}, ${JSON.stringify(g.config, null, 2)});`
    ).concat(clickables.map(c =>
      header(c) + `\nwindow.__u1MakeClickable(${JSON.stringify({ selector: c.primary, role: (c.config && c.config.role) || 'button', label: (c.config && c.config.label) || '', activates: (c.config && c.config.activates) || '' }, null, 2)});`
    )).concat(tabStrips.map(t =>
      header(t) + `\nwindow.__u1InstallTabsFromMapping(${JSON.stringify(t.primary)}, ${JSON.stringify(t.config, null, 2)});`
    )).join('\n\n');
    parts.push(
      `/* ---- 4. Keyboard engines (grid / clickable / tab strip) ----\n` +
      ` * Adds the ARIA roles, names and states each pattern needs, roving\n` +
      ` * tabindex, arrow/Home/End/Enter/Space, a visible focus ring, and\n` +
      ` * re-applies itself on every re-render and each time a widget opens. */\n` +
      (engine ? `(function () {\n${engine}\n})();\n\n${calls}`
              : `/* !! Engine source unavailable — re-copy this script. */\n${calls}`)
    );
  }

  // ── Responsive re-apply ────────────────────────────────────────────────────
  // u1 processes an element ONCE per page load and stamps it; it does not come
  // back. On a responsive site that is a real gap: a page loaded wide has the
  // desktop nav fixed and the hamburger either hidden or not built yet. Resize
  // to a phone width and the site swaps in a menu u1 has never seen — no roles,
  // no aria, no keyboard. The visitor who most needs it gets nothing.
  //
  // Re-calling the same fixes is safe BECAUSE of that stamp: elements already
  // processed are skipped, so this costs nothing on a page that has not changed
  // and decorates whatever the breakpoint just introduced.
  //
  // Only on a real width change — a phone firing resize as the address bar
  // hides must not re-run this on every scroll. Height changes are ignored for
  // the same reason.
  if (fixes.length || customs.length) {
    const reapply = [fixes.length ? '__u1ApplyMappings' : null,
                     customs.length ? '__u1ApplyNames' : null].filter(Boolean);
    parts.push(
      `/* ---- ${customs.length ? 4 : 3}. Responsive re-apply ----\n` +
      ` * u1 decorates an element once per page load. A responsive site swaps its\n` +
      ` * navigation at a breakpoint, and the menu that appears was never seen by\n` +
      ` * u1 — so it arrives with no roles, no aria and no keyboard support.\n` +
      ` * This re-runs the same calls after a real WIDTH change. Elements u1 has\n` +
      ` * already processed are skipped by the library itself, so nothing is done\n` +
      ` * twice. */\n` +
      `(function () {\n` +
      `  var lastWidth = window.innerWidth;\n` +
      `  var t = null;\n` +
      `  window.addEventListener('resize', function () {\n` +
      `    if (window.innerWidth === lastWidth) return;   // height only — ignore\n` +
      `    lastWidth = window.innerWidth;\n` +
      `    clearTimeout(t);\n` +
      `    t = setTimeout(function () {\n` +
      `      try { ${reapply.map(f => f + '();').join(' ')} } catch (e) {}\n` +
      `    }, 250);\n` +
      `  });\n` +
      `})();`
    );
  }

  // ── Monitoring hook — inert unless the page is loaded with ?u1qa=1 ─────────
  // Lets the external daily monitor detect a mapping whose selector no longer
  // resolves. On such a page it logs ONE greppable console.error per broken
  // mapping, carrying the durable id, the type, the exact field that broke, the
  // selector and the page — the monitor parses these lines straight into its
  // dashboard. Completely silent for real visitors (no ?u1qa=1 → returns early).
  const checks = [];
  for (const m of sorted) { const c = qaCheckFor(m); if (c) checks.push(c); }
  if (checks.length) {
    parts.push(
      `/* ---- 5. Monitoring hook (only runs with ?u1qa=1) ---- */\n` +
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
  // During an element scan the specialist is looking at the Scan tab, and
  // #testResults lives in Picker where they cannot see it. Send the live steps
  // where they are actually watching.
  if (elemScanRunning) { elemScanLiveStep(msg); return; }
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

// Shared by the single-mapping panel and the element scan, so the two views of
// the same test can never drift apart.
function testStepListHtml(steps) {
  const icon = (s) => s === 'pass' ? '✓' : s === 'fail' ? '✗' : '⚠';
  return (steps || []).map(s => {
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
}

// Pass / fail / warn tally for a step list, in the shared pill style.
function testPillsHtml(steps) {
  const list = steps || [];
  const f = list.filter(s => s.status === 'fail').length;
  const w = list.filter(s => s.status === 'warn').length;
  const p = list.length - f - w;
  return `<span class="pill pass">${p}✓</span><span class="pill fail${f ? '' : ' zero'}">${f}✗</span><span class="pill warn${w ? '' : ' zero'}">${w}⚠</span>`;
}

function renderTestResults(m, res) {
  const box = document.getElementById('testResults');
  if (!box) return;
  const stepRows = testStepListHtml;
  const staticSteps = (res.static && res.static.steps) || [];
  const kbSteps = (res.keyboard && res.keyboard.steps) || [];
  const pills = testPillsHtml;
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

/**
 * The Scan tab's list of what "every mapping" covers, by name.
 *
 * The card offered to test them all without ever naming one, so the only way to
 * find out what a press would cover was to press it. Each row can also be run on
 * its own — one option, the same run, restricted to that mapping.
 */
function renderElemScanSaved(list) {
  const box = document.getElementById('elemScanSaved');
  if (!box) return;
  const real = list.filter(m => m && typeof m === 'object' && m.type);
  if (!real.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
  box.style.display = '';
  // Named exactly as the Mappings drawer names them — the same id badge, the
  // same type pill, the same selector, in the same order. A mapping you are
  // looking for here is one you already recognise from down there, and
  // inventing a second way to write it down ("u1.fix.heading" three times over)
  // made a list of distinct things look like one thing repeated.
  box.innerHTML = real.map(m => `
    <div class="elem-scan-saved-row">
      ${m.id ? `<span class="mh-id">${escapeHtml(m.id)}</span>` : ''}
      <span class="mh-type">${escapeHtml(m.type)}</span>
      <span class="mh-sel">${escapeHtml(m.primary || m.firstArg || '')}</span>
      <button class="btn-ghost btn-xs" data-testone="${escapeHtml(mappingKey(m))}"
              title="Run the keyboard test on this one">🧪</button>
    </div>`).join('');
  box.querySelectorAll('[data-testone]').forEach(b => {
    b.addEventListener('click', () => runElementScan(b.dataset.testone));
  });
}

async function loadMappingsList() {
  const key = storageKey('mappings', currentHostname);
  const stored = await U1Store.get([key]);
  const list = stored[key] || [];
  renderElemScanSaved(list);
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
    // Nothing is saved, so "approved and applied" is describing mappings that
    // no longer exist. Clear it, and drop the agent threads that were about
    // them — a conversation about a deleted mapping has nothing to be about.
    resetApprovedRun();
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
            <button class="ask-btn" data-idx="${idx}" data-tip="Ask AI" title="Ask AI about this mapping — why it isn't working, or change it in your own words"${legacy ? ' disabled' : ''}>✨</button>
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
  // ── Hover a mapping, see it on the page ───────────────────────────────────
  //
  // A row says `.signin-dropdown`. Which thing on the screen that IS cannot be
  // read off the string, and the alternative is opening devtools and pasting it
  // into a querySelector — for a question asked dozens of times an hour.
  //
  // Debounced, because running the mouse down a list of forty must not fire
  // forty scrolls; and every match is outlined, not just the first, so a
  // selector that has quietly widened to catch fourteen elements shows it here
  // rather than in production.
  let hoverTimer = null;
  let hoverSel = '';
  const stopHover = () => {
    clearTimeout(hoverTimer);
    hoverSel = '';
    getTab().then((t) => {
      if (t && isInjectable(t)) inPage(t.id, () => window.__u1SelectorIntel.clearMarks());
    }).catch(() => {});
  };

  container.querySelectorAll('.mapping-head').forEach(head => {
    head.addEventListener('mouseenter', () => {
      const m = list[parseInt(head.dataset.idx, 10)];
      const sel = m && typeof m === 'object' ? (m.primary || m.firstArg || '') : '';
      if (!sel || sel === hoverSel) return;
      hoverSel = sel;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(async () => {
        const tab = await getTab();
        if (!tab || !isInjectable(tab)) return;
        const n = await inPage(tab.id,
          (s) => window.__u1SelectorIntel.highlightSelector(s), [sel]);
        // Only report the empty case, and only on the row itself: a mapping
        // that matches nothing on the page in front of you is usually just a
        // mapping for another page, not a fault.
        head.title = n === 0 ? `${sel} matches nothing on this page right now`
                   : n === -1 ? `${sel} is not a valid selector`
                   : n > 1 ? `${sel} matches ${n} elements` : '';
      }, 180);
    });
    head.addEventListener('mouseleave', stopHover);
  });
  container.addEventListener('mouseleave', stopHover);

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
  // The agent on a saved mapping — a conversation about THIS mapping, which is
  // where you notice one is not doing what you wanted.
  container.querySelectorAll('.ask-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const m = list[idx];
      if (!m || !m.type) return;
      const item = btn.closest('.mapping-item');
      const body = item.querySelector('.mapping-body');
      let box = item.querySelector('.ai-why');
      if (!box) {
        box = document.createElement('div');
        box.className = 'ai-why';
        (body || item).appendChild(box);
      }
      if (body && body.style.display === 'none') {
        body.style.display = '';
        item.querySelector('.mapping-head')?.setAttribute('aria-expanded', 'true');
      }
      box.style.display = 'block';

      const key = 'saved:' + (m.id || idx);
      if (!agentThreads.has(key)) {
        box.innerHTML = '<div class="ai-busy"><div class="ai-busy-bar"><span></span></div>' +
          '<div class="ai-busy-sub">Reading this component and measuring what the mapping does.</div></div>';
        const ctx = await agentContext(m.type, m.primary, m.firstArg, m.config, m.overwriteRole);
        if (ctx.err) { box.innerHTML = `<div class="ai-sel-bad">${escapeHtml(ctx.err)}</div>`; return; }
        agentThreads.set(key, { ctx, history: [], savedIdx: idx });
      }
      renderAgentThread(box, key);
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
      if (!m || typeof m !== 'object') return;
      // The test's home is the Scan tab — that is where its report is built,
      // filtered and exported. Running it from here used to print a different,
      // smaller answer in the Picker tab, so the same button gave two kinds of
      // result depending on which list you pressed it from. It moves you, and a
      // control that moves you says so before it does it.
      const name = m.primary || m.firstArg || m.type;
      const ok = confirm(
        `Test "${name}"?\n\n` +
        `This moves you to the Scan tab, where the result is shown with the ` +
        `rest of the mapping tests and can be exported. The page will be driven ` +
        `by the keyboard while it runs.`);
      if (!ok) return;
      document.querySelector('.tab-btn[data-tab="scan"]')?.click();
      await runElementScan(mappingKey(m));
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
      // Through applyAllMappings, scoped to this one. It measures the DOM, says
      // which fields moved and which did not, and names a role standing in the
      // way — none of which the direct call did.
      btn.disabled = true;
      try { await applyAllMappings({ only: mappingKey(m) }); }
      finally { btn.disabled = false; }
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
        // Every site goes up, not only the one in front of you. U1Store.set's
        // sync hook is scoped to the current hostname — right for a save, wrong
        // for an import, where nine sites out of ten would have landed on this
        // machine alone and the button would have been telling the truth about
        // half of what it did.
        const up = await pushImportedSites(data, status);
        showNotice(status,
          `Imported ${sites} site${sites !== 1 ? 's' : ''}.` +
          (up.sent ? ` ${up.sent} uploaded to the server.` : '') +
          (up.blocked.length ? ` Not uploaded — you are not assigned to ${up.blocked.join(', ')}; ` +
            `that work is on this machine only.` : '') +
          (dropped ? ` (${dropped} unsafe/unknown entr${dropped !== 1 ? 'ies' : 'y'} skipped.)` : ''),
          up.blocked.length ? 'error' : 'success', up.blocked.length ? 15000 : 6000);
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

// ─────────────────────────────────────────────────────────────────────────────
//  Working on a site whose policy blocks U1
//
//  A site can tell browsers "only run scripts from my own domain". U1 lives on
//  another domain, so it never loads and there is nothing to map. This lifts
//  that restriction FOR THIS BROWSER ONLY, so the specialist can do the work.
//
//  It fixes nothing for the site's visitors, and it is not a substitute for the
//  real remedies (host U1 on the site's own domain, or have the site allow ours)
//  — the notice above the toggle says so, and this comment exists so nobody
//  later mistakes it for one.
//
//  Deliberately session rules, not dynamic ones: session rules die with the
//  browser, so a forgotten toggle cannot outlive the day's work. It is also
//  cleared when leaving the site and when the panel closes.
// ─────────────────────────────────────────────────────────────────────────────

// DNR rule ids must be positive integers and unique among session rules. Derive
// one per host so toggling the same site twice replaces rather than stacks.
function cspRuleIdFor(host) {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) | 0;
  return 10000 + Math.abs(h) % 900000;
}

async function cspBypassActive(host) {
  if (!host || host === 'unknown') return false;
  try {
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    return rules.some(r => r.id === cspRuleIdFor(host));
  } catch { return false; }
}

// Returns { ok } or { err } — the caller shows the real reason rather than a
// checkbox that silently does nothing.
async function setCspBypass(host, on) {
  const id = cspRuleIdFor(host);
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [id],
      addRules: on ? [{
        id,
        priority: 2,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'content-security-policy', operation: 'remove' },
            { header: 'content-security-policy-report-only', operation: 'remove' },
          ],
        },
        // main_frame and sub_frame only: the policy that blocks U1 is the one
        // delivered with the document. Stripping it from every asset request
        // would be a wider hole for no extra benefit.
        condition: { urlFilter: `||${host}`, resourceTypes: ['main_frame', 'sub_frame'] },
      }] : [],
    });
    return { ok: true };
  } catch (e) {
    return { err: e?.message || String(e) };
  }
}

// Take every one of ours back down. Called when the panel closes.
async function clearAllCspBypasses() {
  try {
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    const ours = rules.filter(r => r.id >= 10000 && r.id < 910000).map(r => r.id);
    if (ours.length) await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ours });
  } catch {}
}

document.getElementById('cspBypassToggle')?.addEventListener('change', async (e) => {
  const on = e.target.checked;
  const status = document.getElementById('cspBypassStatus');
  const host = currentHostname;
  const res = await setCspBypass(host, on);
  if (res.err) {
    e.target.checked = !on;
    showNotice(status,
      `Could not change it: ${res.err}. If this says permissions, the extension needs ` +
      `"declarativeNetRequestWithHostAccess" adding to its manifest.`, 'error', 12000);
    return;
  }
  if (!on) { showNotice(status, `Restriction restored for ${host}.`, 'info', 4000); return; }
  // The policy arrives with the page, so removing the header only counts from
  // the next load. Saying "on" without saying that reads as broken.
  showNotice(status, `Off for ${host} in this browser. Reloading the page so it takes effect…`, 'success', 6000);
  try {
    const tab = await getTab();
    if (tab?.id) await chrome.tabs.reload(tab.id);
  } catch {}
});

// Leaving the site puts it back — the toggle is for the page in front of you,
// not a standing exemption for a client's domain.
async function releaseCspBypassFor(host) {
  if (!host || host === 'unknown') return;
  if (await cspBypassActive(host)) await setCspBypass(host, false);
}

window.addEventListener('pagehide', () => { clearAllCspBypasses(); });

/**
 * Say why the panel is showing a site that is not the tab in front.
 *
 * Without this the hold is invisible and reads as the panel being stuck: you
 * are looking at one site and the mappings list names another. One line, in
 * the place a tab change would otherwise have redrawn.
 */
// Where the panel should go once the run has finished letting go of it. Set
// only by pressing the button in the hold notice — the panel never decides on
// its own that you have moved on.
let sweepLeaveFor = null;

function noteSweepHoldsPanel(tab) {
  const host = document.getElementById('sweepHoldsPanel');
  if (!host) return;
  const here = tab && isInjectable(tab) ? getHostname(tab) : '';
  // Looking at the scan's own tab is the ordinary case and needs no notice.
  if (!here || here === currentHostname) { host.style.display = 'none'; return; }
  host.style.display = '';
  if (sweepLeaveFor) {
    host.textContent = `Finishing this section, then moving to ${sweepLeaveFor}. ` +
      `Everything read so far is saved.`;
    return;
  }
  // Holding the panel is right for "I glanced at another tab" and wrong for "I
  // have moved on to a different site" — and from inside the panel those two
  // are the same event. It cannot be told apart by watching, so it is asked.
  //
  // The hold has no time limit: a twenty-screen run is twenty minutes, and for
  // twenty minutes the mappings list, the config form and the export tab would
  // all be about a site you are no longer on, with no way out but waiting or
  // pressing Stop and knowing that is what Stop was for. This is the way out,
  // named after where it goes.
  host.innerHTML =
    `Still scanning <strong>${escapeHtml(currentHostname)}</strong> — this panel stays with ` +
    `the scan until it finishes. Nothing here is about ${escapeHtml(here)}.` +
    `<button class="btn-outline btn-xs" data-leave-scan="${escapeHtml(here)}">` +
    `Work on ${escapeHtml(here)} instead — ends the scan</button>`;
}

function clearSweepHoldsPanel() {
  const host = document.getElementById('sweepHoldsPanel');
  if (host) { host.style.display = 'none'; host.innerHTML = ''; }
}

// "I have actually moved on." The scan finishes the section it is on — that
// call is paid for either way, and abandoning it mid-flight would waste it —
// and the panel follows once it lets go.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-leave-scan]');
  if (!btn) return;
  sweepLeaveFor = btn.dataset.leaveScan;
  aiSweep.abort = true;
  const stop = document.getElementById('sweepStopBtn');
  if (stop) { stop.disabled = true; stop.textContent = 'Stopping after this section…'; }
  noteSweepHoldsPanel(await getTab());
});

/**
 * Follow a switch that was asked for while the run held the panel.
 *
 * Called from the end of a run's finally, after aiSweep.running is false, so
 * the hold no longer applies and onTabChanged does its ordinary work.
 */
async function followPendingSiteSwitch() {
  if (!sweepLeaveFor) return;
  sweepLeaveFor = null;
  clearSweepHoldsPanel();
  // The survey on screen belongs to the site being left. sweepIsPinnedAndAlive
  // would keep it — right for a glance at another tab, wrong here, where the
  // answer to "am I still working on that site" was an explicit no. It is saved
  // and comes back on its own when that site is opened again.
  resetAiWorkspace();
  const t = await getTab();
  if (t) await onTabChanged(t);
}

async function onTabChanged(tab) {
  // Moving to a non-web tab used to leave currentHostname pointing at the site
  // you were last on, with nothing on screen saying so — save now and it lands
  // on the previous site.
  // ── A running scan owns the panel ────────────────────────────────────────
  //
  // The background camera made "start a scan and carry on working" possible;
  // this is what made it not work anyway. Reported as: started a single-screen
  // scan, switched tabs, and it reset — it had not really scanned.
  //
  // Everything below re-points the panel at whatever tab is IN FRONT. The
  // single most damaging line is the quietest one: currentHostname is
  // reassigned, and sweepStoreKey() defaults to currentHostname — so from that
  // moment every save of the RUNNING scan was written under the other site's
  // key and pushed to the other site on the server. Then the cascade below
  // pulled that other site's own survey down over the top of it. Come back and
  // the scan is gone, and its sections are unread, because that is genuinely
  // what is now stored under this site's name.
  //
  // A scan is pinned to one tab. Which tab you happen to be LOOKING at is not
  // information about it, so it is not allowed to change anything about it —
  // not the site the panel is filed under, not the licence check, not the
  // mappings list, and not the survey on screen. The panel stays on the run
  // until the run ends, and says which site it is still showing.
  if (aiSweep.running && await sweepIsPinnedAndAlive()) {
    noteSweepHoldsPanel(tab);
    return;
  }
  clearSweepHoldsPanel();

  if (!tab || !isInjectable(tab)) { borrowedHost = true; renderHostWarning(); return; }
  borrowedHost = false;
  renderHostWarning();
  const newHostname = getHostname(tab);
  // Session-only detection must not follow you to the next site.
  if (newHostname !== currentHostname) detectedSkipLinks = [];
  const hostnameChanged = newHostname !== currentHostname;
  const previousHostname = currentHostname;

  currentHostname = newHostname;
  document.querySelectorAll('#mappingsHostname, #exportHostname, #closeOutHostname').forEach(el => {
    el.textContent = currentHostname;
  });

  // Assignment is per site, so moving to a different host has to be re-checked
  // — otherwise one assigned site would unlock every tab in the window.
  if (hostnameChanged && !(await enforceLicence(currentHostname))) return;

  if (hostnameChanged) {
    // Scan results are selectors from the site you just left; leaving them on
    // screen invites approving one client's components into another client's
    // file. But a sweep is pinned to the tab it started on, and if that tab is
    // still open the results still belong to it — throwing away a survey
    // because you glanced at another tab is the worse of the two failures, and
    // every write path already refuses to save across sites.
    if (!(await sweepIsPinnedAndAlive())) resetAiWorkspace();
    // And put the site you just left back the way you found it.
    await releaseCspBypassFor(previousHostname);
    const t = document.getElementById('cspBypassToggle');
    if (t) t.checked = false;
    const row = document.getElementById('cspBypassRow');
    if (row) row.style.display = 'none';
    const cs = document.getElementById('cspBypassStatus');
    if (cs) cs.style.display = 'none';
    await loadConfigForm();
    await refreshConfigSkipList();
    updateConfigPreview();
    U1Sync.forget();          // one site's versions must not vouch for another's
    const pulled = await pullSiteFromServer();
    await loadMappingsList();
    await refreshExportInfo();
    reportSyncState(pulled);
    // The workspace was just cleared for the new site — so this is the new
    // site's own last survey coming back, not the previous one following you.
    if (!pulled.ok || !pulled.sweep) await restoreSweep();
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

// Ten seconds, counted down, cancellable. Sign out is one click from every tab
// and sits right beside the email address, so it gets pressed by accident — and
// the cost is re-authenticating from the middle of a piece of work.
let signOutTimer = null;
function stopSignOutCountdown() {
  if (signOutTimer) { clearInterval(signOutTimer); signOutTimer = null; }
  document.getElementById('signOutDialog')?.close();
}
function askSignOut() {
  const dlg = document.getElementById('signOutDialog');
  const out = document.getElementById('signOutCountdown');
  // No <dialog> support: do what was asked rather than trapping them signed in.
  if (!dlg || typeof dlg.showModal !== 'function') { signOut(); return; }
  let left = 10;
  const tick = () => {
    out.textContent = `Signing out in ${left} second${left === 1 ? '' : 's'}.`;
    if (left-- <= 0) { stopSignOutCountdown(); signOut(); }
  };
  tick();
  signOutTimer = setInterval(tick, 1000);
  if (!dlg.open) dlg.showModal();
  document.getElementById('signOutCancelBtn')?.focus();
}
document.getElementById('signOutCancelBtn')?.addEventListener('click', stopSignOutCountdown);
document.getElementById('signOutNowBtn')?.addEventListener('click', () => {
  stopSignOutCountdown();
  signOut();
});
// Escape closes a <dialog> natively. The interval has to die with it, or the
// countdown runs on and signs out from behind a dialog nobody can see.
document.getElementById('signOutDialog')?.addEventListener('close', () => {
  if (signOutTimer) { clearInterval(signOutTimer); signOutTimer = null; }
});

document.getElementById('gateSignOutBlocked').addEventListener('click', askSignOut);
document.getElementById('signOutBtn').addEventListener('click', askSignOut);

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

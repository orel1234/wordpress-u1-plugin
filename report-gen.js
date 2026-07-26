'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  CLOSE-OUT REPORT
//  A separate, self-contained HTML report of every accessibility fix, grouped
//  by page, with a per-element explanation beside a screenshot of that element.
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_TYPE_DESC = {
  button:    'Interactive button exposed with the correct button role, name and pressed/disabled state for assistive technology.',
  link:      'Link given an accessible name and proper link role so screen-reader users understand its destination.',
  menu:      'Navigation menu made fully keyboard-operable with correct ARIA menu / menuitem semantics.',
  accordion: 'Accordion headers and panels wired up with expanded/collapsed state so they can be toggled by keyboard.',
  carousel:  'Carousel made accessible with labelled slides and operable previous/next controls.',
  datepicker:'Date picker exposed as an accessible grid with labelled month/year navigation and selectable days.',
  dialog:    'Dialog announced with the correct role, focus trapping and an accessible close control.',
  listbox:   'Listbox exposed with selectable options and an accessible label.',
  combobox:  'Combobox wired up with a text field, popup listbox and autocomplete semantics.',
  checkbox:  'Custom checkbox exposed with the checkbox role and checked / unchecked state.',
  radio:     'Radio group exposed with the radiogroup role and selectable, labelled radio buttons.',
  tabs:      'Tabs wired up with tablist / tab / tabpanel roles and keyboard arrow navigation.',
  form:      'Form fields associated with their labels, with required and error states announced.',
  table:     'Data table given header associations so cell relationships are announced.',
  grid:      'Interactive grid exposed with rows, cells and column headers for keyboard navigation.',
  tooltip:   'Tooltip associated with its trigger so its text is announced on focus.',
  heading:   'Marked as a heading at the right level so screen-reader users can navigate the page by its structure.',
};

// Plain-language explanation of what each selector row targets.
const REPORT_SELECTOR_DESC = {
  menu: 'The whole menu container.',
  submenus: 'The drop-down sub-menus inside the menu.',
  items: 'The individual items users move between.',
  triggers: 'The elements that open a sub-menu.',
  horizontalMenu: 'Tells U1 the menu is horizontal (left/right arrow keys).',
  headerSelector: 'The clickable section headers.',
  contentSelector: 'The panels that expand and collapse.',
  carouselContainer: 'The carousel wrapper.',
  slide: 'Each slide.',
  prevButton: 'The “previous” button.',
  nextButton: 'The “next” button.',
  container: 'The component’s container.',
  trigger: 'The control that opens the component.',
  label: 'The element’s accessible label.',
  dialog: 'The dialog / pop-up box.',
  closeBtn: 'The button that closes the dialog.',
  heading: 'The heading / title element.',
  textContent: 'The dialog’s body text.',
  listbox: 'The list of options.',
  options: 'Each selectable option.',
  textbox: 'The text field users type in.',
  combobox: 'The combobox wrapper.',
  element: 'The element being made accessible.',
  checkedState: 'How U1 detects the “checked” state.',
  uncheckedState: 'How U1 detects the “unchecked” state.',
  radioGroup: 'The group of radio buttons.',
  radioButton: 'Each radio button.',
  tabList: 'The row of tabs.',
  tab: 'Each individual tab.',
  tabPanel: 'The content panel each tab shows.',
  form: 'The form being made accessible.',
  submitButton: 'The button that submits the form.',
  inputField: 'The form’s input fields.',
  formLabelAbsolute: 'The labels for the form fields.',
  invalidField: 'Fields marked as invalid.',
  requiredField: 'Fields marked as required.',
  errorMsg: 'The error messages shown to the user.',
  successMsg: 'The success message shown after submission.',
  table: 'The data table.',
  grid: 'The interactive grid.',
  row: 'Each row.',
  cell: 'Each cell.',
  columnheader: 'The column-header cells.',
  rowheader: 'The row-header cells.',
  pageButtons: 'The numbered page buttons.',
  prevBtn: 'The “previous page” button.',
  nextBtn: 'The “next page” button.',
  results: 'Each result shown on the page.',
  loadingBar: 'The loading indicator that is announced.',
  slidePickerButtons: 'The slide-picker (dot) buttons.',
  openByMouseover: 'Sub-menu items that open on hover.',
  openByMouseenter: 'Sub-menu items that open on mouse-enter.',
  openByFocus: 'Sub-menu items that open on focus.',
  disabled: 'How U1 detects the disabled state.',
  exclude: 'A hidden input excluded from focus.',
  focusTo: 'Where focus moves after the interaction.',
  tooltip: 'The tooltip text element.',
  'year.label': 'Shows the current year.',
  'year.prevButton': 'Go to the previous year.',
  'year.nextButton': 'Go to the next year.',
  'month.label': 'Shows the current month.',
  'month.prevButton': 'Go to the previous month.',
  'month.nextButton': 'Go to the next month.',
  'days.table': 'The grid of days.',
  'days.day': 'Each day cell.',
  'days.selected': 'The selected day.',
  'days.disabled': 'The disabled days.',
  'middle text': 'Fixed words inserted into the label.',
  'heading text': 'The nearby heading whose text is appended.',
};

function reportSelectorDesc(key) {
  if (REPORT_SELECTOR_DESC[key]) return REPORT_SELECTOR_DESC[key];
  const last = key.split('.').pop();
  return REPORT_SELECTOR_DESC[last] || 'A selector this fix uses.';
}

// Normalize a page URL for grouping/display: drop the dynamic "#u1st-…" hash,
// the query string, and any trailing slash, so the same page captured more than
// once (with a different hash/query) groups into a single section.
function reportCleanUrl(u) {
  if (!u) return '';
  let s = String(u).split('#')[0].split('?')[0];
  s = s.replace(/\/+$/, '');
  return s;
}

// Only emit a real data:image URL into <img src> — never an arbitrary/imported
// string (which could break the attribute or beacon externally; on a file://
// opened report there is no CSP to fall back on).
function reportSafeImg(src) { return (typeof src === 'string' && /^data:image\//i.test(src)) ? src : ''; }

function reportEsc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Flatten a (possibly nested) selectors object into [dottedKey, value] pairs,
// skipping empty values.
function reportFlattenSelectors(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...reportFlattenSelectors(v, key));
    else if (v !== '' && v != null) out.push([key, String(v)]);
  }
  return out;
}

function reportDescribe(m) {
  const type = (m && m.type) || 'unknown';
  const primary = (m && m.primary) || '';

  // Custom aria-label mapping has its own config shape (no `selectors`).
  if (m && m.custom === 'ariaLabel') {
    const c = m.config || {};
    const mid = c.middleText || '';
    const entries = [];
    if (mid) entries.push(['middle text', mid]);
    if (c.headingSelector) entries.push(['heading text', c.headingSelector]);
    return {
      label: 'Aria-label',
      desc: `Gives the button a clear accessible name: its own text${mid ? ` + "${mid}"` : ''}${c.headingSelector ? ' + the nearby heading text' : ''}.`,
      primary,
      entries,
    };
  }

  if (m && m.custom === 'keyboardGrid') {
    const sel = (m.config && m.config.selectors) || {};
    return {
      label: 'Keyboard grid',
      desc: 'Calendar/grid made fully keyboard-operable: each cell exposed as a grid cell with an accessible date label, arrow-key navigation, Enter/Space to choose, and a visible focus indicator.',
      primary,
      entries: reportFlattenSelectors(sel),
    };
  }
  if (m && m.custom === 'keyboardClickable') {
    const role = (m.config && m.config.role) || 'button';
    return {
      label: 'Keyboard-clickable',
      desc: `Elements that looked clickable but could not be reached by keyboard are now focusable and announced as a ${role}, activating on Enter${role === 'button' ? ' or Space' : ''}.`,
      primary,
      entries: [['announced as', role]].concat((m.config && m.config.label) ? [['accessible name', m.config.label]] : []),
    };
  }

  const label = type.charAt(0).toUpperCase() + type.slice(1);
  const desc = REPORT_TYPE_DESC[type] || 'Accessibility fix applied to this component.';
  const selectors = (m && m.config && m.config.selectors) || {};
  const entries = reportFlattenSelectors(selectors);
  return { label, desc, primary, entries };
}

// Group mappings by page (pageUrl, else hostname).
// If onlyHostname is given, only that site's mappings are included.
function reportCollectPages(allStorage, onlyHostname) {
  const pages = new Map(); // pageKey → { title, url, hostname, items: [] }
  for (const [key, value] of Object.entries(allStorage)) {
    if (!key.startsWith('mappings_')) continue;
    const hostname = key.slice('mappings_'.length);
    if (onlyHostname && hostname !== onlyHostname) continue;
    const list = Array.isArray(value) ? value : [];
    for (const m of list) {
      if (!m || typeof m !== 'object' || !m.type) continue; // skip legacy strings
      const cleanUrl = reportCleanUrl(m.pageUrl);
      const pageKey = cleanUrl || hostname;
      if (!pages.has(pageKey)) {
        pages.set(pageKey, {
          title: m.pageTitle || hostname,
          url: cleanUrl,
          hostname,
          items: [],
        });
      }
      pages.get(pageKey).items.push(m);
    }
  }
  return Array.from(pages.values());
}

function reportBuildHtml(pages) {
  const generatedAt = new Date().toLocaleString();
  const totalFixes = pages.reduce((s, p) => s + p.items.length, 0);

  const pagesHtml = pages.map(page => {
    const rows = page.items.slice()
      .sort((a, b) => ((a && a.fixNo) || 1e9) - ((b && b.fixNo) || 1e9))
      .map(m => {
      const d = reportDescribe(m);
      const selectorRows = d.entries.map(([k, v]) =>
        `<tr><td class="sel-key">${reportEsc(k)}</td><td class="sel-val">${reportEsc(v)}</td>` +
        `<td class="sel-desc">${reportEsc(reportSelectorDesc(k))}</td></tr>`
      ).join('');
      const shot = reportSafeImg(m.screenshot);
      const img = shot
        ? `<img src="${shot}" alt="Screenshot of ${reportEsc(d.primary)}">`
        : `<div class="no-shot">No screenshot captured.<br><span>Open the element's page and use the 📷 button on the mapping.</span></div>`;
      return `
        <div class="element">
          <div class="element-info">
            <h3>${m.id ? `<span class="mapid" title="Monitor id">${reportEsc(m.id)}</span> ` : ''}<span class="badge">${reportEsc(d.label)}</span> <code>${reportEsc(d.primary)}</code></h3>
            <p class="desc">${reportEsc(d.desc)}</p>
            ${selectorRows ? `<table class="selectors"><tbody>${selectorRows}</tbody></table>` : ''}
          </div>
          <div class="element-shot">${img}</div>
        </div>`;
    }).join('');

    return `
      <section class="page">
        <div class="page-head">
          <h2>${reportEsc(page.title)}</h2>
          ${page.url ? `<a href="${reportEsc(page.url)}">${reportEsc(page.url)}</a>` : `<span>${reportEsc(page.hostname)}</span>`}
          <span class="count">${page.items.length} element${page.items.length !== 1 ? 's' : ''}</span>
        </div>
        ${rows}
      </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>U1 Accessibility Close-out Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a1a2e; background: #f5f6fa; margin: 0; padding: 32px; }
  .report { max-width: 960px; margin: 0 auto; }
  .report-head { border-bottom: 3px solid #6c4cf1; padding-bottom: 16px; margin-bottom: 24px; }
  .report-head h1 { margin: 0 0 6px; font-size: 26px; color: #1f1147; }
  .report-head .meta { color: #666; font-size: 13px; }
  .report-head .u1 { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg,#6c4cf1,#a06cff); color: #fff; font-weight: 800; margin-right: 8px; vertical-align: middle; }
  section.page { background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); padding: 20px 24px; margin-bottom: 28px; }
  .page-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid #eee; padding-bottom: 12px; margin-bottom: 16px; }
  .page-head h2 { margin: 0; font-size: 19px; color: #1f1147; }
  .page-head a, .page-head span { color: #6c4cf1; font-size: 13px; text-decoration: none; word-break: break-all; }
  .page-head .count { margin-left: auto; color: #888; font-size: 12px; }
  .element { display: grid; grid-template-columns: 1fr 320px; gap: 20px; padding: 16px 0; border-bottom: 1px dashed #e5e5ef; align-items: start; }
  .element:last-child { border-bottom: none; }
  .element-info h3 { margin: 0 0 8px; font-size: 15px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .element-info code { background: #f0eefb; color: #4b32c3; padding: 2px 6px; border-radius: 5px; font-size: 12px; word-break: break-all; }
  .badge { background: #6c4cf1; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: .4px; }
  .fixno { background:#111827; color:#fff; font:700 11px/1.6 ui-monospace,Menlo,Consolas,monospace; padding:2px 8px; border-radius:6px; }
  .mapid { background:#f3f4f6; color:#4b5563; font:600 10px/1.6 ui-monospace,Menlo,Consolas,monospace; padding:2px 7px; border-radius:6px; border:1px dashed #cbd5e1; }
  .desc { margin: 0 0 10px; font-size: 13px; color: #444; line-height: 1.5; }
  table.selectors { border-collapse: collapse; width: 100%; font-size: 12px; }
  table.selectors td { border: 1px solid #eee; padding: 4px 8px; vertical-align: top; }
  .sel-key { color: #6c4cf1; font-weight: 600; white-space: nowrap; width: 1%; }
  .sel-val { font-family: "SF Mono", Consolas, monospace; color: #333; word-break: break-all; }
  .sel-desc { color: #666; }
  .element-shot img { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; }
  .no-shot { border: 1px dashed #ccc; border-radius: 8px; padding: 24px 12px; text-align: center; color: #999; font-size: 12px; }
  .no-shot span { font-size: 11px; color: #bbb; }
  .empty { text-align: center; color: #888; padding: 60px 20px; }
  @media print { body { background: #fff; padding: 0; } section.page { box-shadow: none; break-inside: avoid; } .element { break-inside: avoid; } }
  @media (max-width: 640px) { .element { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <div class="report">
    <div class="report-head">
      <h1><span class="u1">u</span>Accessibility Close-out Report</h1>
      <div class="meta">${totalFixes} accessibility fix${totalFixes !== 1 ? 'es' : ''} across ${pages.length} page${pages.length !== 1 ? 's' : ''} · Generated ${reportEsc(generatedAt)}</div>
    </div>
    ${pages.length ? pagesHtml : '<div class="empty">No accessibility mappings saved yet. Build component templates and add them to a mapping first.</div>'}
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Static issues report — every accessibility problem the Scan tab flagged,
//  each with a screenshot of the element and a plain-language fix.
// ─────────────────────────────────────────────────────────────────────────────

// Map a flagged issue string to a clear "how to fix" recommendation.
function issueFix(issue) {
  const s = (issue || '').toLowerCase();
  if (s.includes('page title')) return 'Add a descriptive <title> in the document <head>.';
  if (s.includes('meta description')) return 'Add <meta name="description" content="…"> summarising the page.';
  if (s.includes('lang')) return 'Set the page language on the root element, e.g. <html lang="en">.';
  if (s.includes('empty heading')) return 'Give the heading real text, or remove the heading element.';
  if (s.includes('skips')) return 'Do not skip heading levels — use sequential levels (H2 then H3, not H2 then H4).';
  if (s.includes('no h1')) return 'Add exactly one <h1> that describes the page.';
  if (s.includes('more than one h1')) return 'Keep a single <h1> per page; demote the extras to <h2>.';
  if (s.includes('alt')) return 'Add descriptive alt text, or alt="" if the image is purely decorative.';
  if (s.includes('accessible text') || s.includes('no accessible')) return 'Give the control visible text or an aria-label.';
  if (s.includes('non-descriptive')) return 'Replace generic text ("click here") with text that describes the destination.';
  if (s.includes('accessible name')) return 'Add text content, an aria-label, or a value so the button has a name.';
  if (s.includes('label')) return 'Associate a <label for="id"> with the field, or add an aria-label.';
  return 'Review this element for the accessibility issue noted.';
}

const STATIC_CAT_LABEL = {
  meta: 'Meta', heading: 'Heading', landmark: 'Landmark', image: 'Image',
  link: 'Link', button: 'Button', 'form-field': 'Form field',
};

function buildStaticIssuesHtml(hostname, items, pageUrl, pageTitle) {
  const generatedAt = new Date().toLocaleString();
  const rows = items.map(it => {
    const shot = reportSafeImg(it.screenshot);
    const img = shot
      ? `<img src="${shot}" alt="Screenshot">`
      : `<div class="no-shot">No screenshot<br><span>(element off-screen or has no box)</span></div>`;
    return `
      <div class="issue">
        <div class="issue-info">
          <h3><span class="badge">${reportEsc(STATIC_CAT_LABEL[it.cat] || it.cat)}</span>
            ${it.severity ? `<span class="lvl sev-${reportEsc((it.severity || '').toLowerCase())}">${reportEsc(it.severity)}</span>` : ''}
            ${it.wcag ? `<span class="lvl">WCAG ${reportEsc(it.wcag)}</span>` : ''}
            ${it.detail ? `<span class="lvl">${reportEsc(it.detail)}</span>` : ''}</h3>
          <p class="problem">⚠ ${reportEsc(it.issue)}</p>
          ${it.why ? `<p class="content">${reportEsc(it.why)}</p>` : ''}
          ${it.text ? `<p class="content">Context: <em>${reportEsc(it.text)}</em></p>` : ''}
          ${it.selector ? `<p class="sel"><code>${reportEsc(it.selector)}</code></p>` : ''}
          <p class="fix"><strong>How to fix:</strong> ${reportEsc(it.fix || issueFix(it.issue))}</p>
        </div>
        <div class="issue-shot">${img}</div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>U1 Static Accessibility Issues</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a1a2e; background: #f5f6fa; margin: 0; padding: 32px; }
  .report { max-width: 960px; margin: 0 auto; }
  .report-head { border-bottom: 3px solid #6c4cf1; padding-bottom: 16px; margin-bottom: 24px; }
  .report-head h1 { margin: 0 0 6px; font-size: 26px; color: #1f1147; }
  .report-head .meta { color: #666; font-size: 13px; }
  .report-head .u1 { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:8px; background:linear-gradient(135deg,#6c4cf1,#a06cff); color:#fff; font-weight:800; margin-right:8px; vertical-align:middle; }
  .issue { display: grid; grid-template-columns: 1fr 320px; gap: 20px; background:#fff; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,.08); padding:18px 22px; margin-bottom:18px; align-items:start; border-left:4px solid #f0a500; }
  .issue-info h3 { margin:0 0 8px; font-size:15px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .badge { background:#6c4cf1; color:#fff; font-size:11px; padding:2px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:.4px; }
  .lvl { color:#888; font-size:12px; font-weight:600; }
  .problem { margin:0 0 8px; font-size:14px; color:#b8860b; font-weight:600; }
  .content { margin:0 0 6px; font-size:13px; color:#444; }
  .content em { color:#1f1147; font-style:normal; }
  .sel { margin:0 0 8px; }
  .sel code { background:#f0eefb; color:#4b32c3; padding:2px 6px; border-radius:5px; font-size:12px; word-break:break-all; }
  .fix { margin:0; font-size:13px; color:#245c2b; background:#eafaef; border-radius:6px; padding:8px 10px; }
  .issue-shot img { width:100%; height:auto; border:1px solid #ddd; border-radius:8px; }
  .no-shot { border:1px dashed #ccc; border-radius:8px; padding:24px 12px; text-align:center; color:#999; font-size:12px; }
  .empty { text-align:center; color:#888; padding:60px 20px; }
  @media print { body { background:#fff; padding:0; } .issue { box-shadow:none; break-inside:avoid; } }
  @media (max-width: 640px) { .issue { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <div class="report">
    <div class="report-head">
      <h1><span class="u1">u</span>Static Accessibility Issues</h1>
      <div class="meta">${items.length} issue${items.length !== 1 ? 's' : ''} on
        ${pageTitle ? reportEsc(pageTitle) + ' — ' : ''}
        ${pageUrl ? `<a href="${reportEsc(pageUrl)}">${reportEsc(pageUrl)}</a>` : reportEsc(hostname)}
        · Generated ${reportEsc(generatedAt)}</div>
    </div>
    ${items.length ? rows : '<div class="empty">No static issues found — nice.</div>'}
  </div>
</body>
</html>`;
}

// Public: store + open + download a static-issues report. `items` come from the
// Scan tab (already screenshotted by the caller).
async function generateStaticIssuesReport(hostname, items, pageUrl, pageTitle) {
  const html = buildStaticIssuesHtml(hostname, items, pageUrl, pageTitle);
  await chrome.storage.local.set({ __closeOutReportHtml: html });
  try { await chrome.tabs.create({ url: chrome.runtime.getURL('report.html') }); } catch {}
  try {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `U1-Static-Issues-${hostname || 'page'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch {}
  return { issues: items.length };
}

// Public: build the report for one site, store it and open it in a real tab.
async function generateCloseOutReport(onlyHostname) {
  const allStorage = await chrome.storage.local.get(null);
  const pages = reportCollectPages(allStorage, onlyHostname);
  const html = reportBuildHtml(pages);

  // Store the HTML so the extension page (report.html) can render it. This opens
  // reliably in a normal tab, unlike a blob: URL created in the side panel.
  await chrome.storage.local.set({ __closeOutReportHtml: html });
  try { await chrome.tabs.create({ url: chrome.runtime.getURL('report.html') }); } catch {}

  // Also offer it as a downloadable file. A blob *download* works fine (only
  // opening a blob: URL in a tab did not), so the user can save/share the HTML.
  try {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const host = onlyHostname || 'all-sites';
    const a = document.createElement('a');
    a.href = url;
    a.download = `U1-CloseOut-Report-${host}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch {}

  return { pages: pages.length, fixes: pages.reduce((s, p) => s + p.items.length, 0) };
}

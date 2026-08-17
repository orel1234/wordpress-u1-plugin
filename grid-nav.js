'use strict';
//#region u1-engine:grid
// ─────────────────────────────────────────────────────────────────────────────
//  U1 Studio — accessible grid/datepicker engine (no U1).
//  Injected via chrome.scripting.executeScript({files:['grid-nav.js']}) by BOTH
//  panel.js (manual/auto apply) and background.js (auto-apply on every page
//  load) so a custom keyboard-grid mapping survives a fresh page load without
//  the side panel being open.
// ─────────────────────────────────────────────────────────────────────────────
window.__u1InstallGrid = function (o) {
const containerSel = o.container, cellSel = o.day, activateSel = o.activate;
const FLAG = '__u1GridNav';
if (!containerSel || !cellSel) return { ok: false, err: 'container and day are required' };

// A clear, visible focus ring on the focused day (sites often hide the default).
// Re-checked on every scan: when armed at document_start there is no <head> yet,
// so the node can be lost during parsing — and SPA frameworks can wipe it too.
// Focus ring drawn as a floating overlay that tracks the focused cell. This works
// on inline custom elements (which have no paintable box for `outline`) and,
// crucially, never changes the page's layout.
const gridRing = () => {
  let r = document.getElementById('__u1GridRing');
  if (!r || !r.isConnected) {
    r = document.createElement('div');
    r.id = '__u1GridRing';
    Object.assign(r.style, {
      position: 'fixed', pointerEvents: 'none', zIndex: '2147483646',
      border: '3px solid #2563eb', borderRadius: '6px', boxSizing: 'border-box',
      boxShadow: '0 0 0 2px rgba(255,255,255,.85)', display: 'none',
      transition: 'left .1s ease, top .1s ease, width .1s ease, height .1s ease',
    });
    (document.body || document.documentElement).appendChild(r);
  }
  return r;
};
let ringTarget = null;
const drawRing = () => {
  const r = gridRing();
  if (!ringTarget || !ringTarget.isConnected || document.activeElement !== ringTarget) { r.style.display = 'none'; return; }
  const b = ringTarget.getBoundingClientRect();
  if (b.width < 8 || b.height < 8) { r.style.display = 'none'; return; } // never ring a sliver
  Object.assign(r.style, { display: 'block', left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' });
};
const showRing = (el) => { ringTarget = el; drawRing(); };
if (!window.__u1RingHooked) {
  window.__u1RingHooked = true;
  addEventListener('scroll', drawRing, true);
  addEventListener('resize', drawRing);
  addEventListener('focusout', () => setTimeout(drawRing, 0), true);
}

const ensureStyle = () => {
  const host = document.head || document.documentElement;
  if (!host) return;
  let st = document.getElementById('__u1GridStyle');
  // Present AND already parented to the current host → nothing to do.
  if (st && st.isConnected && st.parentNode === host) return;
  if (st) st.remove();
  st = document.createElement('style');
  st.id = '__u1GridStyle';
  // Tint only — the visible ring is the floating overlay, so nothing here can
  // affect layout (outline/position/display on inline custom elements broke it).
  st.textContent = '[role=gridcell]:focus{background:rgba(37,99,235,.12) !important;outline:none !important;}';
  host.appendChild(st);
};
ensureStyle();

// Activation: fire exactly one click. (An earlier version sent a full
// pointer/mouse burst, which range datepickers counted as multiple picks.)
const fireClick = (el) => {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
  const p = { bubbles: true, cancelable: true, composed: true, view: window, detail: 1, button: 0, buttons: 1, clientX: cx, clientY: cy };
  // NOTE: do NOT el.focus() here — the click target is often a tiny inner
  // node (a tooltip), and stealing focus to it shows a stray black dot.
  // Exactly ONE activation: a range datepicker counts clicks (1st = start,
  // 2nd = end), so a mousedown+mouseup+click burst reads as several picks and
  // resets the range. Native .click() alone is verified to select correctly.
  if (typeof el.click === 'function') { try { el.click(); return; } catch (e) {} }
  el.dispatchEvent(new MouseEvent('click', p));
};
const matches = (el, sel) => { if (!sel || !el) return false; try { return el.matches(sel) || !!el.querySelector(sel); } catch (e) { return false; } };
// An <a> WITHOUT href is NOT focusable or keyboard-activatable (Angular sites use
// them as fake buttons) — it must be wired like a plain div, not skipped.
const isNativeFocusable = (el) => {
  if (!el || !el.tagName) return false;
  if (el.tagName === 'A') return el.hasAttribute('href');
  return /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !el.disabled;
};

const wireButton = (el, label) => {
  if (!el || el.__u1Btn) return; el.__u1Btn = true;
  if (!isNativeFocusable(el)) {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fireClick(el); } });
  }
  if (label && !el.getAttribute('aria-label') && !(el.textContent || '').trim()) el.setAttribute('aria-label', label);
};
const announce = (el) => { if (!el || el.__u1Live) return; el.__u1Live = true; el.setAttribute('aria-live', 'polite'); el.setAttribute('role', 'status'); };

const wireExtras = () => {
  if (o.trigger) document.querySelectorAll(o.trigger).forEach(t => {
    t.setAttribute('aria-haspopup', 'grid');
    t.setAttribute('aria-expanded', document.querySelector(containerSel) ? 'true' : 'false');
  });
  if (o.monthPrev) document.querySelectorAll(o.monthPrev).forEach(e => wireButton(e, 'Previous month'));
  if (o.monthNext) document.querySelectorAll(o.monthNext).forEach(e => wireButton(e, 'Next month'));
  if (o.yearPrev) document.querySelectorAll(o.yearPrev).forEach(e => wireButton(e, 'Previous year'));
  if (o.yearNext) document.querySelectorAll(o.yearNext).forEach(e => wireButton(e, 'Next year'));
  if (o.monthLabel) document.querySelectorAll(o.monthLabel).forEach(announce);
  if (o.yearLabel) document.querySelectorAll(o.yearLabel).forEach(announce);
  if (o.controls) document.querySelectorAll(o.controls).forEach(e => wireButton(e, ''));
};

const install = (cont) => { if (!cont || cont[FLAG]) { if (cont && cont[FLAG]) cont[FLAG].retag(); return; } setupGrid(cont); };
const scan = () => { ensureStyle(); document.querySelectorAll(containerSel).forEach(install); wireExtras(); };

window.__u1GridWatchers = window.__u1GridWatchers || {};
if (!window.__u1GridWatchers[containerSel]) {
  let scheduled = false;
  const debounced = () => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; scan(); }); };
  const docMo = new MutationObserver(debounced);
  docMo.observe(document.documentElement, { childList: true, subtree: true });
  window.__u1GridWatchers[containerSel] = docMo;
}

function setupGrid(cont) {
  const columns = o.columns, direction = o.direction;
  const dayCells = () => Array.from(cont.querySelectorAll(cellSel));
  // Require a real, day-sized box — collapsed/sliver elements (a few px wide)
  // are layout artifacts, not days, and focusing them looks like a stray bar.
  const isVisible = (c) => { const r = c.getBoundingClientRect(); return r.width >= 8 && r.height >= 8; };
  const isDisabled = (c) => o.disabled ? matches(c, o.disabled) : false;
  // A real day cell has a day number — skip the blank pad cells before the 1st / after the last.
  const hasDay = (c) => /\d/.test((c.textContent || ''));
  const navCells = () => dayCells().filter(c => isVisible(c) && !isDisabled(c) && hasDay(c));
  const cellOf = (el) => (el && el.closest) ? el.closest(cellSel) : null;
  const rtl = direction === 'rtl' || (direction === 'auto' && getComputedStyle(cont).direction === 'rtl');

  // Grid roles on the table structure (if any).
  const table = cont.querySelector('table') || (dayCells()[0] && dayCells()[0].closest('table'));
  if (table && table.getAttribute('role') !== 'grid') table.setAttribute('role', 'grid');
  (table || cont).querySelectorAll('tr').forEach(r => { if (r.getAttribute('role') !== 'row') r.setAttribute('role', 'row'); });

  const dateLabel = (c) => {
    const idSrc = c.id || ((c.querySelector('[id]') || {}).id) || '';
    const m = /\d{4}-\d{2}-\d{2}/.exec(idSrc);
    if (m) { const d = new Date(m[0]); if (!isNaN(d)) return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
    return (c.textContent || '').trim().replace(/\s+/g, ' ');
  };

  const retag = () => {
    const cells = dayCells();
    if (!cells.length) return;
    const anyFocusable = cells.some(c => c.getAttribute('tabindex') === '0' && !isDisabled(c));
    cells.forEach(c => {
      // NEVER touch layout (display/position) here — doing so visibly breaks
      // calendars. The focus ring is drawn by a floating overlay instead.
      if (c.getAttribute('role') !== 'gridcell') c.setAttribute('role', 'gridcell');
      if (isDisabled(c)) { c.setAttribute('aria-disabled', 'true'); c.setAttribute('tabindex', '-1'); }
      else {
        if (!c.hasAttribute('tabindex')) c.setAttribute('tabindex', '-1');
        if (!c.getAttribute('aria-label')) { const l = dateLabel(c); if (l) c.setAttribute('aria-label', l); }
      }
      if (o.selected) c.setAttribute('aria-selected', matches(c, o.selected) ? 'true' : 'false');
    });
    // Always give ONE cell tabindex=0 so Tab can enter the grid — even if
    // cells aren't laid out yet (CSS-animated open fires no DOM mutation).
    if (!anyFocusable) {
      const f = navCells()[0] || cells.find(c => !isDisabled(c) && hasDay(c)) || cells.find(c => !isDisabled(c));
      if (f) f.setAttribute('tabindex', '0');
    }
  };
  retag();
  const mo = new MutationObserver(() => retag());
  mo.observe(cont, { childList: true, subtree: true });

  // Hover-triggered tooltips (mouseenter/leave) don't fire on keyboard
  // focus — so mirror them, making the tooltip appear on focus too (WCAG 1.4.13).
  const hover = (el, on) => {
    if (!el) return;
    const t = el.matches && el.matches(cellSel) ? (el.querySelector('[class*=tooltip],[class*=cell]') || el) : el;
    const o = { bubbles: true, cancelable: true, view: window };
    try { el.dispatchEvent(new MouseEvent(on ? 'mouseenter' : 'mouseleave', o)); el.dispatchEvent(new MouseEvent(on ? 'mouseover' : 'mouseout', o)); } catch (e) {}
    if (t !== el) { try { t.dispatchEvent(new MouseEvent(on ? 'mouseenter' : 'mouseleave', o)); } catch (e) {} }
  };
  const focusCell = (cur, next) => {
    if (!next) return;
    if (cur) { cur.setAttribute('tabindex', '-1'); hover(cur, false); }
    next.setAttribute('tabindex', '0'); next.focus(); next.scrollIntoView({ block: 'nearest' });
    showRing(next);
    hover(next, true);
  };

  cont.addEventListener('keydown', (e) => {
    const cur = cellOf(document.activeElement);
    if (!cur) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isDisabled(cur)) return;
      // Click the element that actually holds the handler — the `activate`
      // selector (e.g. search-ui-calendar-cell). Do NOT drill into it: the
      // first child is often a tooltip, not the day. Fall back sensibly.
      const target = activateSel ? (cur.querySelector(activateSel) || cur)
        : (cur.querySelector('a[href],button,[role="button"],[onclick]') || cur.firstElementChild || cur);
      fireClick(target);
      // The site tends to yank focus back to the input after a pick (bad for a
      // round-trip where you still need the return date). Keep focus INSIDE the
      // calendar: re-grab it a few times, but only while the calendar is open
      // and only if focus actually escaped the grid.
      // Remember WHICH day this was. Angular re-creates the cells after a pick, so
      // we must re-find the same day by identity — otherwise focus snaps back to
      // the first day of the calendar and you can never pick the return date.
      const idOf = (c) => { try { return c.id || ((c.querySelector('[id]') || {}).id) || ''; } catch (e) { return ''; } };
      const pickedId = idOf(cur);
      const pickedText = (cur.textContent || '').trim();
      const sameDay = () => {
        const cells = dayCells();
        if (pickedId) { const byId = cells.find(c => idOf(c) === pickedId); if (byId) return byId; }
        if (pickedText) { const byText = cells.find(c => (c.textContent || '').trim() === pickedText); if (byText) return byText; }
        return cur.isConnected ? cur : null;
      };
      const keep = () => {
        try {
          if (!cont.getBoundingClientRect().height) return;
          if (cont.contains(document.activeElement)) return; // user already moved within grid — leave it
          const back = sameDay();
          if (back) {
            dayCells().forEach(c => { if (c !== back && c.getAttribute('tabindex') === '0') c.setAttribute('tabindex', '-1'); });
            back.setAttribute('tabindex', '0'); back.focus(); hover(back, true); showRing(back);
          }
        } catch (e) {}
      };
      [0, 120, 300].forEach(t => setTimeout(keep, t));
      return;
    }
    let k = e.key;
    if (rtl && k === 'ArrowRight') k = 'ArrowLeft'; else if (rtl && k === 'ArrowLeft') k = 'ArrowRight';
    const cells = navCells();
    const i = cells.indexOf(cur);
    if (i < 0 && !(e.key === 'Home' || e.key === 'End')) return;
    let next = null;
    const td = cur.tagName === 'TD' ? cur : cur.closest('td');
    const tr = td && td.parentElement;
    if (k === 'ArrowRight') next = cells[i + 1];
    else if (k === 'ArrowLeft') next = cells[i - 1];
    else if (e.key === 'Home') next = cells[0];
    else if (e.key === 'End') next = cells[cells.length - 1];
    else if (k === 'ArrowDown' || k === 'ArrowUp') {
      if (!columns && tr) {
        const colIndex = Array.from(tr.children).indexOf(td);
        let sib = k === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
        while (sib) {
          const raw = sib.children[colIndex];
          const cand = raw && (raw.matches(cellSel) ? raw : raw.querySelector(cellSel));
          if (cand && isVisible(cand) && !isDisabled(cand) && hasDay(cand)) { next = cand; break; }
          sib = k === 'ArrowDown' ? sib.nextElementSibling : sib.previousElementSibling;
        }
      } else { const step = columns || 7; next = cells[i + (k === 'ArrowDown' ? step : -step)]; }
    } else return;
    if (next) { e.preventDefault(); focusCell(cur, next); }
  });

  // On open, pull focus INTO the grid (selected day, else first) so the
  // user lands on the days — but only steal focus from the trigger /
  // nothing, never from something the user is actively using.
  // Find the element focus should START on: scan INTO the component and take the
  // first genuine item, so we never land on a wrapper, a sliver or a blank pad cell.
  const firstRealTarget = () => {
    // 1. the day the site already marked as chosen (correct datepicker behaviour)
    if (o.selected) { const sel = cont.querySelector(o.selected); if (sel && isVisible(sel)) return sel; }
    // 2. the first proper day cell (visible, real size, has a number, not disabled)
    const n = navCells();
    if (n.length) return n[0];
    // 3. nothing matched `day` — scan deeper for the first real, number-bearing box
    let cand = null;
    try {
      cand = Array.from(cont.querySelectorAll(cellSel + ',[role=gridcell],td,li,a[href],button'))
        .find(e => isVisible(e) && /\d/.test(e.textContent || '') && !isDisabled(e));
    } catch (e) {}
    if (cand) return cand;
    // 4. last resort: the first natively focusable thing inside the component
    return cont.querySelector('a[href],button,[tabindex]:not([tabindex="-1"]),input,select,textarea');
  };

  const focusIntoGrid = () => {
    try {
      if (!cont.getBoundingClientRect().height) return;
      if (cont.contains(document.activeElement)) return;
      const a = document.activeElement;
      const fromTrigger = o.trigger && a && a.matches && a.matches(o.trigger);
      if (!(a == null || a === document.body || fromTrigger)) return;
      const start = firstRealTarget();
      if (start) {
        start.setAttribute('tabindex', '0');
        start.focus(); start.scrollIntoView({ block: 'nearest' }); hover(start, true); showRing(start);
      }
    } catch (e) {}
  };
  // Try now and again shortly after (calendars animate/populate on open).
  focusIntoGrid();
  setTimeout(focusIntoGrid, 250);

  cont[FLAG] = { retag, mo };
}

scan();
const present = document.querySelectorAll(containerSel).length;
return { ok: true, watching: true, cells: present ? document.querySelectorAll(cellSel).length : 0,
         note: present ? '' : 'Container not present yet — wires automatically when the widget opens.' };
};

// Convenience wrapper: build the engine options from a stored mapping
// ({primary, config}) applying the same mis-fill guards panel.js uses, then
// install. Used by background.js so custom grids auto-apply on every page load.
window.__u1InstallGridFromMapping = function (primary, config) {
  const s = (config && config.selectors) || {};
  const day = s.day || s.cell || '';
  if (!primary || !day) return { ok: false, err: 'container and day are required' };
  const notDay = (v) => (v && v !== day) ? v : '';
  const controls = (s.controls || '').split(',').map(x => x.trim()).filter(x => x && x !== day).join(',');
  return window.__u1InstallGrid({
    container: primary,
    trigger: s.trigger || '', day, selected: notDay(s.selected), disabled: notDay(s.disabled),
    activate: notDay(s.activate),
    monthLabel: s.monthLabel || '', monthPrev: s.monthPrev || '', monthNext: s.monthNext || '',
    yearLabel: s.yearLabel || '', yearPrev: s.yearPrev || '', yearNext: s.yearNext || '',
    controls,
    columns: (config && config.columns) || 0, direction: (config && config.direction) || 'auto',
  });
};

//#endregion
//#region u1-engine:clickable
// ─────────────────────────────────────────────────────────────────────────────
//  Make-keyboard-operable: turn non-focusable elements (<a> without href, divs
//  and spans acting as controls) into real keyboard controls — role + tabindex
//  + Enter/Space activation. Unlike u1.fix.* this handles EVERY match, and it
//  re-applies on re-render so framework repaints can't strip it.
//  Standalone: DOM only, needs neither U1 nor the extension.
// ─────────────────────────────────────────────────────────────────────────────
window.__u1MakeClickable = function (opts) {
  const sel = opts && opts.selector;
  if (!sel) return { ok: false, err: 'selector is required' };
  // 'auto' (the default) reads the role off whatever `activates` points at, so a
  // wrapper around a checkbox announces as a checkbox and not as a button. An
  // explicit value always wins — the page author has seen the widget.
  const wantRole = String(opts.role || 'auto').toLowerCase();
  const role = (wantRole === 'auto' && !opts.activates) ? 'button'
             : (wantRole === 'auto' ? 'auto' : wantRole);
  const label = opts.label || '';

  // What a target IS, in ARIA terms. A styled wrapper is a stand-in for the
  // control inside it, so it has to inherit that control's role, its state and
  // its keyboard contract — a checkbox that says "button" and never reports
  // checked is not accessible, it is only reachable.
  const kindOf = (t) => {
    if (!t) return 'button';
    const explicit = (t.getAttribute('role') || '').toLowerCase();
    if (explicit) return explicit;
    const tag = t.tagName;
    if (tag === 'INPUT') {
      const ty = (t.getAttribute('type') || 'text').toLowerCase();
      if (ty === 'checkbox') return 'checkbox';
      if (ty === 'radio') return 'radio';
      if (ty === 'range') return 'slider';
      if (ty === 'file' || ty === 'button' || ty === 'submit' || ty === 'reset' || ty === 'image') return 'button';
      return 'textbox';
    }
    if (tag === 'TEXTAREA') return 'textbox';
    if (tag === 'SELECT') return t.multiple ? 'listbox' : 'combobox';
    if (tag === 'A' && t.hasAttribute('href')) return 'link';
    if (tag === 'SUMMARY') return 'button';
    return 'button';
  };

  // Roles whose value the user changes rather than whose action they trigger.
  // These need the real control focused, not clicked: you cannot type into a
  // wrapper, and clicking a <select> from script does not open it.
  const DELEGATES = { textbox: 1, combobox: 1, listbox: 1, slider: 1, spinbutton: 1 };
  // Roles that carry a checked state we have to mirror and keep mirrored.
  const CHECKED = { checkbox: 1, radio: 1, switch: 1, menuitemcheckbox: 1, menuitemradio: 1 };

  // The accessible name of the control, for when the wrapper has none of its
  // own. Without this a row of identical styled boxes all announce as
  // "checkbox" with nothing to tell them apart.
  const nameOf = (t) => {
    if (!t) return '';
    const aria = t.getAttribute('aria-label');
    if (aria) return aria.trim();
    const by = t.getAttribute('aria-labelledby');
    if (by) {
      const txt = by.split(/\s+/).map(id => {
        const n = document.getElementById(id);
        return n ? n.textContent : '';
      }).join(' ').trim();
      if (txt) return txt;
    }
    try {
      const labs = t.labels;
      if (labs && labs.length && labs[0].textContent.trim()) return labs[0].textContent.trim();
    } catch (e) {}
    return (t.getAttribute('title') || t.getAttribute('placeholder') ||
            (t.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(t.type) ? t.value : '') || '').trim();
  };

  // Mirror the control's live state onto the wrapper. Called on wiring, after
  // every activation, and on every change the page makes itself — a checkbox
  // ticked by the site's own JS has to update the announcement too.
  const syncState = (el, t, r) => {
    if (!t || t === el) return;
    if (CHECKED[r]) {
      el.setAttribute('aria-checked', t.indeterminate ? 'mixed' : (t.checked ? 'true' : 'false'));
    }
    if (r === 'combobox' || r === 'listbox') {
      const v = t.selectedOptions && t.selectedOptions[0];
      if (v) el.setAttribute('aria-valuetext', v.textContent.trim());
    }
    if (r === 'slider') {
      if (t.value !== undefined) el.setAttribute('aria-valuenow', t.value);
      if (t.min !== '') el.setAttribute('aria-valuemin', t.min);
      if (t.max !== '') el.setAttribute('aria-valuemax', t.max);
    }
    if (t.disabled) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
    if (t.required) el.setAttribute('aria-required', 'true');
  };

  // A hidden-but-focusable input behind a wrapper is a duplicate tab stop that
  // announces nothing useful. Once the wrapper speaks for it, take it out of
  // the tab order — but only when it really is invisible, never when both are
  // on screen and the user may want either.
  const isVisuallyHidden = (t) => {
    try {
      const r = t.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) return true;
      const st = getComputedStyle(t);
      return st.opacity === '0' || st.visibility === 'hidden' || st.clipPath === 'inset(50%)';
    } catch (e) { return false; }
  };
  // `activates` splits WHAT THE USER REACHES from WHAT ACTUALLY FIRES. The
  // common case is a styled wrapper with the real <input> hidden inside it: the
  // wrapper is what you can see and tab to, the input is what has to be clicked.
  // Without this the two cannot be reconciled — decorating the input leaves
  // nothing visible to focus, and decorating the wrapper toggles nothing.
  const activates = opts.activates || '';

  // Resolve inside the marked element FIRST. On a list of fifty rows each
  // wrapper must fire its own input; a document-wide lookup would send every
  // row's Enter to the first input on the page. The document fallback is for
  // the case where the target genuinely lives elsewhere.
  // Counts how often `activates` found nothing, so a selector that matches
  // nothing is reported rather than silently degrading. Falling back to the
  // wrapper looks identical to working until you notice nothing happens.
  let missCount = 0;
  const targetOf = (el) => {
    if (!activates) return el;
    let t = null;
    try { t = el.querySelector(activates) || document.querySelector(activates); } catch (e) { return el; }
    if (!t) { missCount++; return el; }
    return t;
  };

  // A real click is a SEQUENCE. el.click() dispatches only the click event, so a
  // widget that listens on pointerdown or mousedown — which plenty of custom
  // file pickers, menus and toggles do — sees nothing at all and looks broken.
  // Dispatching the whole sequence is closer to what a mouse actually does, not
  // further from it: a browser fires every one of these on a genuine click.
  const fire = (el, t, r) => {
    t = t || targetOf(el);
    // Value controls want focus, not a click. Enter on a wrapper around a text
    // field should put the caret in the field; clicking it would do nothing a
    // screen-reader user could perceive.
    if (DELEGATES[r]) {
      try { t.focus(); } catch (e) {}
      if (t !== el && typeof t.click === 'function' && r !== 'textbox') { try { t.click(); } catch (e) {} }
      return;
    }
    const opts = { bubbles: true, cancelable: true, view: window, button: 0, composed: true };
    const send = (Ctor, type, extra) => {
      try { t.dispatchEvent(new Ctor(type, Object.assign({}, opts, extra || {}))); } catch (e) {}
    };
    const hasPointer = typeof window.PointerEvent === 'function';
    if (hasPointer) send(PointerEvent, 'pointerdown', { pointerType: 'mouse', isPrimary: true });
    send(MouseEvent, 'mousedown');
    if (hasPointer) send(PointerEvent, 'pointerup', { pointerType: 'mouse', isPrimary: true });
    send(MouseEvent, 'mouseup');
    // .click() last and preferred: on a native control it also performs the
    // default action (ticking a checkbox, opening a file dialog), which a
    // synthetic MouseEvent does not always do.
    if (typeof t.click === 'function') { try { t.click(); return; } catch (e) {} }
    send(MouseEvent, 'click');
  };

  const wire = () => {
    let n = 0;
    let els;
    try { els = document.querySelectorAll(sel); } catch (e) { return 0; }
    els.forEach(el => {
      if (el.__u1Click) return;
      // A native control (or an <a href>) is already keyboard-operable — leave it.
      // A native control is already keyboard-operable — leave it. But when an
      // `activates` target is named the marked element is by definition a
      // stand-in for something else, so this bail-out must not apply to it.
      const native = /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) ||
                     (el.tagName === 'A' && el.hasAttribute('href'));
      if (native && !activates) return;
      el.__u1Click = true;
      const t = targetOf(el);
      const r = (role === 'auto') ? kindOf(t) : role;
      el.setAttribute('role', r);
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      const name = label || nameOf(t);
      if (name && !el.getAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', name);
      syncState(el, t, r);

      // A real native control — input/button/select/textarea/a[href] — is never
      // hidden here, even when it is visually invisible. MDC-style checkboxes
      // (Angular Material's mat-checkbox among them) render the actual <input>
      // at opacity:0 and paint the checkmark via a sibling SVG/div purely for
      // looks, while the input itself stays the framework-managed, already-
      // tabbable, already-role="checkbox" accessible interface. isVisuallyHidden
      // cannot tell that apart from a genuinely decorative hidden proxy, so it
      // used to hide BOTH — pulling an already-working, framework-wired native
      // checkbox out of the accessibility tree because it happened to be
      // styled invisible, which broke it worse than doing nothing would have.
      const tIsNative = t && (/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t.tagName) ||
                              (t.tagName === 'A' && t.hasAttribute('href')));
      if (t !== el && isVisuallyHidden(t) && !tIsNative) {
        t.setAttribute('tabindex', '-1');
        // tabindex first, then aria-hidden — hiding a focusable element from the
        // accessibility tree while it can still be tabbed to is itself a defect.
        t.setAttribute('aria-hidden', 'true');
      }
      // The site can change the control without going through us. Mirror that.
      if (t !== el && !t.__u1Sync) {
        t.__u1Sync = true;
        const back = () => syncState(el, t, r);
        t.addEventListener('change', back);
        t.addEventListener('input', back);
      }

      el.addEventListener('keydown', (e) => {
        // Links activate on Enter only; everything else on Enter and Space.
        // Space is what a checkbox user reaches for first, so it must not scroll.
        const enter = e.key === 'Enter';
        const space = e.key === ' ' || e.key === 'Spacebar';
        if (!enter && !(space && r !== 'link')) return;
        e.preventDefault();
        fire(el, t, r);
        // After our own activation too — a native checkbox flips its `checked`
        // property, which reflects to no attribute and fires no event we see.
        syncState(el, t, r);
      });
      n++;
    });
    return n;
  };

  const wired = wire();

  // Check the activates selector NOW, while there is somebody to tell. Left to
  // discovery-by-keypress this reports as "the mapping does nothing", which
  // sends people looking at the wrapper, the role and the tabindex — anywhere
  // but the one selector that is wrong.
  let activatesFound = null;
  if (activates) {
    activatesFound = 0;
    let bad = false;
    try {
      document.querySelectorAll(sel).forEach(el => {
        if (el.querySelector(activates) || document.querySelector(activates)) activatesFound++;
      });
    } catch (e) { bad = true; }
    if (bad) {
      return { ok: false, wired, role, err: `"${activates}" is not a valid selector.` };
    }
    if (!activatesFound) {
      return { ok: false, wired, role, activatesFound: 0,
        err: `Marked ${wired} element${wired === 1 ? '' : 's'}, but "${activates}" matches nothing — ` +
             `Enter/Space would fall back to clicking the marked element itself. ` +
             `Check the selector: ".a.b" means one element carrying BOTH classes, ".a .b" is a descendant, ` +
             `and a class containing a hyphen is one name, not two.` };
    }
  }

  // Keep it applied across framework re-renders.
  window.__u1ClickWatchers = window.__u1ClickWatchers || {};
  if (!window.__u1ClickWatchers[sel]) {
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return; queued = true;
      requestAnimationFrame(() => { queued = false; wire(); });
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    window.__u1ClickWatchers[sel] = mo;
  }
  return { ok: true, wired, role, activatesFound, missedActivates: missCount };
};

//#endregion
//#region u1-engine:tabs
// ─────────────────────────────────────────────────────────────────────────────
//  Tab strip: the full WAI-ARIA tabs pattern on a page we do not own.
//
//  Why this exists next to u1.fix.tabs rather than instead of it: fix.tabs needs
//  window.u1 on the page, so on a site that has not deployed U1 yet — a demo, a
//  prospect, a staging box — it cannot run at all. This is DOM-only.
//
//  What separates it from marking each tab role="tab" by hand (which is what
//  keyboard-clickable with role=tab does) is everything that makes the role
//  true: one tab in the tab sequence instead of all of them, arrow keys between
//  them, aria-selected kept in step with the page's own idea of the active tab,
//  and each tab pointed at its panel. A role="tab" without those promises a
//  keyboard contract that does not exist, which is worse than plain buttons.
//
//  Standalone: DOM only, needs neither U1 nor the extension.
// ─────────────────────────────────────────────────────────────────────────────
// Anything that takes keyboard focus on its own. Used to decide whether a
// tabpanel needs to be put into the tab sequence itself.
const FOCUSABLE = 'a[href],button,input,select,textarea,summary,iframe,' +
  'audio[controls],video[controls],[contenteditable]:not([contenteditable="false"]),' +
  '[tabindex]:not([tabindex="-1"])';

window.__u1InstallTabs = function (opts) {
  const listSel  = opts && opts.tabList;
  const tabSel   = opts && opts.tab;
  const panelSel = opts && opts.tabPanel;
  const vertical = !!(opts && opts.isVertical);
  if (!listSel || !tabSel || !panelSel) {
    return { ok: false, err: 'tabList, tab and tabPanel are all required' };
  }

  let uid = 0;
  const idFor = (el, prefix) => {
    if (!el.id) el.id = `u1-${prefix}-${Date.now().toString(36)}-${uid++}`;
    return el.id;
  };

  /**
   * Which tab the PAGE considers active. We are a layer on top of someone
   * else's widget: it already has an opinion, expressed as a class it toggles.
   * Reading that opinion — rather than storing our own — is what keeps
   * aria-selected honest when the tab is changed by a route change, a click we
   * never saw, or the site's own script.
   */
  const activeIn = (tabs) => {
    // The site's own signal is read FIRST. aria-selected is only a fallback,
    // because from the second pass onwards that attribute is OURS: checking it
    // first made the engine read back its own stale answer and pin the strip to
    // whichever tab happened to be active when it was installed.
    const bySite = tabs.findIndex((t) =>
      /(^|\s)(active|selected|current|is-active|is-selected)(\s|$)/i.test(t.getAttribute('class') || '') ||
      t.getAttribute('aria-current') === 'true' ||
      t.getAttribute('aria-current') === 'page');
    if (bySite !== -1) return bySite;
    // No class signal — a site that maintains aria-selected itself. Our first
    // pass copied its value, so reading it back really is reading the site.
    const byAria = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    return byAria === -1 ? 0 : byAria;
  };

  const wire = () => {
    const lists = Array.from(document.querySelectorAll(listSel));
    if (!lists.length) return { lists: 0, tabs: 0, panels: 0 };

    let tabCount = 0, panelCount = 0;

    lists.forEach((list) => {
      // Scoped to this list: a page may hold several tab strips, and pairing a
      // tab with another strip's panel would be worse than leaving it alone.
      const tabs = Array.from(list.querySelectorAll(tabSel));
      if (!tabs.length) return;

      // Panels usually sit OUTSIDE the tablist (that is the point — the strip
      // switches what is below it), so they are looked up document-wide.
      const panels = Array.from(document.querySelectorAll(panelSel));

      list.setAttribute('role', 'tablist');
      if (vertical) list.setAttribute('aria-orientation', 'vertical');
      else list.removeAttribute('aria-orientation'); // horizontal is the default

      const active = activeIn(tabs);

      tabs.forEach((tab, i) => {
        tab.setAttribute('role', 'tab');
        idFor(tab, 'tab');
        tab.setAttribute('aria-selected', i === active ? 'true' : 'false');
        // Roving tabindex — the reason Tab reaches the panel instead of walking
        // through every tab first.
        tab.tabIndex = i === active ? 0 : -1;

        // One panel per tab where the counts line up. When they do not (a site
        // that renders only the visible panel) every tab points at the single
        // live panel, which is still true and still better than no link.
        const panel = panels.length === tabs.length ? panels[i] : panels[0];
        if (panel) {
          panel.setAttribute('role', 'tabpanel');
          idFor(panel, 'tabpanel');
          panel.setAttribute('aria-labelledby', tab.id);
          // A panel joins the tab sequence ONLY when it holds nothing focusable
          // — then tabindex=0 is what lets a keyboard user reach and scroll its
          // text. A panel full of fields already has its own stops, and adding
          // one in front of them is a dead stop, not an improvement.
          //
          // Re-evaluated on every pass, and the marker records that the
          // tabindex is ours: a panel that gains a field later must lose it,
          // and one the site set itself must never be touched.
          if (panel.querySelector(FOCUSABLE)) {
            if (panel.dataset.u1PanelTabindex) {
              panel.removeAttribute('tabindex');
              delete panel.dataset.u1PanelTabindex;
            }
          } else if (!panel.hasAttribute('tabindex')) {
            panel.tabIndex = 0;
            panel.dataset.u1PanelTabindex = '1';
          }
          tab.setAttribute('aria-controls', panel.id);
          panelCount++;
        }
        tabCount++;
      });

      if (list.__u1TabKeys) list.removeEventListener('keydown', list.__u1TabKeys);
      const onKey = (e) => {
        const current = Array.from(list.querySelectorAll(tabSel));
        const here = current.indexOf(e.target.closest(tabSel));
        if (here === -1) return;

        const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
        const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
        let to = -1;
        if (e.key === prevKey) to = (here - 1 + current.length) % current.length;
        else if (e.key === nextKey) to = (here + 1) % current.length;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = current.length - 1;
        else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          // A div acting as a tab has no native activation. Native controls
          // already do this themselves, so touching them would double-fire.
          const tag = e.target.tagName;
          if (tag !== 'BUTTON' && tag !== 'A' && tag !== 'INPUT') {
            e.preventDefault();
            e.target.click();
          }
          return;
        } else return;

        // Only once the key is known to be ours: Home/End must still scroll the
        // page everywhere else.
        e.preventDefault();
        const target = current[to];
        target.focus();
        // Activation follows focus. The panel swap is the site's own click
        // handler doing its job; we then re-read which tab it made active, so
        // aria-selected reflects what actually happened rather than what we
        // assumed would happen.
        target.click();
        requestAnimationFrame(wire);
      };
      list.addEventListener('keydown', onKey);
      list.__u1TabKeys = onKey;

      // A click by mouse changes the active tab too, and aria-selected has to
      // follow it or a screen reader reads a stale strip.
      if (!list.__u1TabClick) {
        const onClick = () => requestAnimationFrame(wire);
        list.addEventListener('click', onClick);
        list.__u1TabClick = onClick;
      }
    });

    return { lists: lists.length, tabs: tabCount, panels: panelCount };
  };

  const first = wire();

  // Keep it applied across framework re-renders, the same way the other two
  // engines do. Without this a React repaint silently strips every attribute.
  window.__u1TabWatchers = window.__u1TabWatchers || {};
  const key = `${listSel}|${tabSel}|${panelSel}`;
  if (!window.__u1TabWatchers[key]) {
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; wire(); });
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    window.__u1TabWatchers[key] = mo;
  }

  if (!first.lists) {
    return { ok: true, watching: true, tabs: 0, panels: 0,
             note: 'Tab list not present yet — wires automatically when it appears.' };
  }
  if (!first.tabs) {
    return { ok: false, tabs: 0,
             err: `Found the tab list, but "${tabSel}" matches nothing inside it. ` +
                  `The tab selector is searched WITHIN the tab list, so it must match the tabs themselves.` };
  }
  if (!first.panels) {
    return { ok: false, tabs: first.tabs, panels: 0,
             err: `Wired ${first.tabs} tab${first.tabs === 1 ? '' : 's'}, but "${panelSel}" matches nothing. ` +
                  `Panels usually sit outside the tab list — give a selector for the content area that changes.` };
  }
  return { ok: true, watching: true, lists: first.lists, tabs: first.tabs, panels: first.panels };
};

// Convenience wrapper mirroring __u1InstallGridFromMapping: rebuild the engine
// options from a stored mapping so background.js can re-apply on every load.
window.__u1InstallTabsFromMapping = function (primary, config) {
  const s = (config && config.selectors) || {};
  return window.__u1InstallTabs({
    tabList: s.tabList || primary,
    tab: s.tab || '',
    tabPanel: s.tabPanel || '',
    isVertical: !!(config && config.isVertical),
  });
};
//#endregion

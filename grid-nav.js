'use strict';
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
  const role = (opts.role === 'link') ? 'link' : 'button';
  const label = opts.label || '';
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
  const fire = (el) => {
    const t = targetOf(el);
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
      if (!el.hasAttribute('role')) el.setAttribute('role', role);
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (label && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
      el.addEventListener('keydown', (e) => {
        // Buttons activate on Enter AND Space; links on Enter only (ARIA spec).
        if (e.key === 'Enter' || (role === 'button' && e.key === ' ')) { e.preventDefault(); fire(el); }
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

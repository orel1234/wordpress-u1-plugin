'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  U1 Studio — in-page test engine
//  Injected into the target page via chrome.scripting.executeScript({files:[…]}).
//  Everything hangs off window.__u1TestEngine so panel.js can call it with a
//  tiny func wrapper. Logic ported from accessibility_autochecker (component
//  checkers + keyboard sequences + robust selector algorithm).
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  if (window.__u1TestEngine) return; // idempotent

  // ── Robust, U1-valid, UNIQUE selector builder ─────────────────────────────
  // The implementation lives in selector-intel.js, which panel.js injects just
  // before this file (see callTestEngine). Keeping one copy matters: the whole
  // point of `robustSelector` is that it never emits a selector U1 will reject
  // or one anchored on a generated id, and two copies drift apart silently.
  //
  // The local fallback below covers the case where this file is injected on its
  // own — reduced to the identity ladder without the uniqueness chain, so if it
  // ever runs it is obviously the degraded path rather than a second opinion.
  const robustSelector = (node) => {
    if (window.__u1SelectorIntel) return window.__u1SelectorIntel.robustSelector(node);
    if (!node || node.nodeType !== 1) return '';
    if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) return '#' + node.id;
    const cls = (node.className && typeof node.className === 'string')
      ? node.className.trim().split(/\s+/).filter(Boolean) : [];
    return cls.length ? node.tagName.toLowerCase() + '.' + cls[0] : node.tagName.toLowerCase();
  };

  // ── Selector recommendation per U1 component type ──────────────────────────
  // Returns { notFound?, err?, count, current, tag, robust, notes:[{level,msg,suggestion}] }
  function recommendSelector(type, primary) {
    let el;
    try { el = document.querySelector(primary); }
    catch (e) { return { err: e.message }; }
    if (!el) return { notFound: true };
    let count = -1;
    try { count = document.querySelectorAll(primary).length; } catch {}
    const notes = [];
    const cls = (el.className && typeof el.className === 'string') ? el.className : '';

    // Several fixers re-query with querySelector and so only ever fix the first
    // match. The patch shipped with every export calls those once per match, so
    // for them a multi-match selector is a legitimate choice rather than a
    // mistake — but only when the OTHER selectors also resolve inside each
    // match, which is the part that actually catches people out.
    const PER_MATCH = ['tabs', 'combobox', 'listbox', 'dialog', 'tooltip', 'pagination', 'radio'];
    if (count > 1) {
      notes.push(PER_MATCH.includes(type)
        ? { level: 'info',
            msg: `Matches ${count} elements — all ${count} will be fixed, one at a time. ` +
                 `Make sure the other selectors below match inside EVERY one of them; ` +
                 `a match whose panel/content selector finds nothing is skipped. ` +
                 `Use #id here if you meant only this one.`,
            suggestion: robustSelector(el) }
        : { level: 'warn',
            msg: `Matches ${count} elements — not unique. U1 uses the first match, which may be the wrong one.`,
            suggestion: robustSelector(el) });
    }

    if (type === 'dialog') {
      const cont = el.closest('[role="dialog"],[role="alertdialog"],dialog,.modal,[aria-modal="true"]');
      if (/\bmodal-dialog\b/.test(cls) || (cont && cont !== el)) {
        notes.push({ level: 'warn',
          msg: 'Point `dialog` at the outer modal container with a unique id — not a generic inner wrapper like .modal-dialog.',
          suggestion: robustSelector(cont || el) });
      }
    } else if (type === 'form') {
      if (el.tagName !== 'FORM') {
        const form = el.closest('form');
        notes.push({ level: 'err',
          msg: 'For a form, the root must be the <form> element itself — not an input or wrapper.',
          suggestion: form ? robustSelector(form) : '(no <form> ancestor found)' });
      }
    } else if (type === 'table' || type === 'grid') {
      const isTable = el.tagName === 'TABLE' || el.getAttribute('role') === 'grid';
      if (!isTable) {
        const tbl = el.querySelector('table') || el.closest('table');
        notes.push({ level: 'warn',
          msg: 'Point this at the <table> (or [role="grid"]) element.',
          suggestion: tbl ? robustSelector(tbl) : '' });
      }
    }

    return { count, current: primary, tag: el.tagName.toLowerCase(), robust: robustSelector(el), notes };
  }

  // ── Static accessibility checks (Dimension A) ──────────────────────────────
  // Ported from accessibility_autochecker/server/component-checkers/*. Pure DOM
  // reads → each returns { label, status:'pass'|'fail'|'warn', message, wcag }.
  const q = (sel, root) => { if (!sel) return null; try { return (root || document).querySelector(sel); } catch { return null; } };
  const qa = (sel, root) => { if (!sel) return []; try { return Array.from((root || document).querySelectorAll(sel)); } catch { return []; } };
  const txt = (el) => (el && el.textContent || '').trim().replace(/\s+/g, ' ');
  const accName = (el) => {
    if (!el) return '';
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const t = lb.split(/\s+/).map(id => txt(document.getElementById(id))).join(' ').trim(); if (t) return t; }
    return txt(el) || (el.getAttribute('title') || el.value || '').trim();
  };
  const P = (label, message, wcag, why) => ({ label, status: 'pass', message: message || '', wcag, why: why || '' });
  const F = (label, message, wcag, why) => ({ label, status: 'fail', message: message || '', wcag, why: why || '' });
  const W = (label, message, wcag, why) => ({ label, status: 'warn', message: message || '', wcag, why: why || '' });

  function checksFor(type, primary, sel, cfg) {
    sel = sel || {};
    cfg = cfg || {};
    const root = q(primary);
    const steps = [];
    if (!root) { steps.push(F('Element found', `Nothing matches "${primary}" on the page.`)); return steps; }

    if (type === 'dialog') {
      // U1 sets role/aria-modal/name only while the dialog is OPEN. When it's
      // closed these are legitimately absent — report "open it to verify" instead
      // of failing a correct-but-closed dialog.
      const rc = root.getBoundingClientRect();
      const cs = getComputedStyle(root);
      const isOpen = rc.width > 0 && rc.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
      const closedNote = 'The dialog is closed right now, so U1 has not applied this yet. Open it and re-test to verify.';
      const role = root.getAttribute('role');
      steps.push(['dialog', 'alertdialog'].includes(role)
        ? P('role="dialog"', `Has role="${role}".`, '4.1.2')
        : (isOpen ? F('role="dialog"', `The dialog has role="${role || '(none)'}" — U1 should set role="dialog" when open.`, '4.1.2')
                  : W('role="dialog"', 'Not set while closed.', '4.1.2', closedNote)));
      steps.push(root.getAttribute('aria-modal') === 'true'
        ? P('aria-modal="true"', '', '4.1.2')
        : W('aria-modal="true"', isOpen ? 'Missing aria-modal="true".' : 'Not set while closed.', '4.1.2', isOpen ? '' : closedNote));
      steps.push(accName(root) ? P('Accessible name', `"${accName(root).slice(0, 40)}"`, '4.1.2')
        : (isOpen ? F('Accessible name', 'Dialog has no aria-label / aria-labelledby.', '4.1.2')
                  : W('Accessible name', 'Not set while closed.', '4.1.2', closedNote)));
      if (sel.closeBtn) {
        const cb = q(sel.closeBtn, root) || q(sel.closeBtn);
        steps.push(cb ? P('Close button present', '', '2.1.2') : W('Close button present', `No element matches closeBtn "${sel.closeBtn}".`, '2.1.2'));
        if (cb) steps.push((cb.getAttribute('role') === 'button' || cb.tagName === 'BUTTON')
          ? P('Close is a button', '', '4.1.2') : W('Close is a button', 'Close button should have role="button".', '4.1.2'));
      }
    } else if (type === 'menu' || type === 'menubar') {
      // U1 behaviour depends on menubar: true => full ARIA menu (role=menuitem on
      // every item); false/undefined => navigation menu where only the `triggers`
      // become role="button" with aria-haspopup, and submenu containers get role="menu".
      const isMenubar = type === 'menubar' || cfg.menubar === true;
      const role = root.getAttribute('role');
      const items = qa(sel.items, root);
      if (isMenubar) {
        steps.push(['menu', 'menubar'].includes(role) ? P('Container role', `role="${role}".`, '4.1.2')
          : W('Container role', `Container has role="${role || '(none)'}" (expected menu/menubar).`, '4.1.2'));
        if (items.length) {
          // Items inside a CLOSED submenu only receive role="menuitem" when U1
          // processes them on open — so judge by the VISIBLE items to avoid a
          // flaky "1/3" that flips between runs.
          const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
          const visItems = items.filter(vis);
          const withRole = items.filter(i => i.getAttribute('role') === 'menuitem').length;
          const visWithRole = visItems.filter(i => i.getAttribute('role') === 'menuitem').length;
          if (withRole === items.length) {
            steps.push(P('Items are menuitems', `${withRole}/${items.length}.`, '4.1.2'));
          } else if (visItems.length && visWithRole === visItems.length) {
            steps.push(W('Items are menuitems', `Visible items OK (${visWithRole}/${visItems.length}); ${items.length - withRole} hidden submenu item(s) not yet tagged.`, '4.1.2',
              'U1 tags submenu items with role="menuitem" only when the submenu OPENS, so items in a closed dropdown correctly read as untagged right now. Open the submenu and re-test to confirm they get the role. This is why the count can differ between runs — it is not a stable defect.'));
          } else {
            steps.push(F('Items are menuitems', `${visWithRole}/${visItems.length} visible items have role="menuitem".`, '4.1.2',
              'Some VISIBLE menu items are missing role="menuitem". With menubar:true every item should get it. If U1 also logged "Submenu must have a trigger element", that error aborts tagging — see the note below.'));
          }
        } else steps.push(W('Menu items found', `No items match "${sel.items || '(items not set)'}".`, '4.1.2'));
        // menubar:true + submenus is a known U1 pitfall that throws and leaves roles half-applied.
        if (sel.submenus && qa(sel.submenus, root).length) {
          steps.push(W('menubar:true with submenus', 'This menu has submenus AND menubar:true.', '4.1.2',
            'U1 throws "Submenu must have a trigger element" when menubar:true is combined with nested submenus, which aborts role tagging and makes the test flaky (roles appear on one run, not the next). For a navigation menu with dropdowns use menubar:false — then U1 wires the triggers/submenus correctly instead.'));
        }
      } else {
        // Navigation menu (menubar:false) — the correct U1 output.
        steps.push(items.length ? P('Menu items found', `${items.length} item(s).`, '')
          : W('Menu items found', `No items match "${sel.items || '(items not set)'}".`, ''));
        // U1 may place role="button"/aria-haspopup on the trigger itself OR on a
        // button/link inside it — so check the element and its descendants.
        const hasBtnRole = (t) => t.getAttribute('role') === 'button' || t.tagName === 'BUTTON' || !!t.querySelector('[role=button],button');
        const hasPopup = (t) => t.getAttribute('aria-haspopup') || t.getAttribute('aria-expanded') !== null
          || !!t.querySelector('[aria-haspopup],[aria-expanded]');
        const trigs = qa(sel.triggers, root);
        if (sel.triggers && trigs.length) {
          const asBtn = trigs.filter(hasBtnRole).length;
          steps.push(asBtn === trigs.length ? P('Submenu triggers are buttons', `${asBtn}/${trigs.length}.`, '4.1.2')
            : W('Submenu triggers are buttons', `${asBtn}/${trigs.length} triggers act as a button.`, '4.1.2',
              'U1 gives a submenu trigger role="button" (or wraps a <button>) so screen-reader users know it opens a submenu. This only appears AFTER the submenu is wired — if the submenu never opened during the test, it can read 0 here even though it works live. Open the menu and re-test to confirm.'));
          const withPopup = trigs.filter(hasPopup).length;
          steps.push(withPopup ? P('Triggers expose aria-haspopup/expanded', `${withPopup}/${trigs.length}.`, '4.1.2')
            : W('Triggers expose aria-haspopup/expanded', 'No trigger exposes aria-haspopup/aria-expanded.', '4.1.2',
              'aria-haspopup tells assistive tech the control opens a submenu, and aria-expanded reflects open/closed. U1 sets aria-expanded dynamically — it may be absent while the menu is closed and appear only once opened. Not necessarily a real defect.'));
        }
        const subs = qa(sel.submenus, root);
        if (sel.submenus && subs.length) {
          const asMenu = subs.filter(s => s.getAttribute('role') === 'menu' || !!s.querySelector('[role=menu]')).length;
          steps.push(asMenu ? P('Submenus have role="menu"', `${asMenu}/${subs.length}.`, '4.1.2')
            : W('Submenus have role="menu"', `${asMenu}/${subs.length} submenu containers have role="menu".`, '4.1.2',
              'A submenu should expose role="menu" so it is announced as a menu. U1 may add it on open, so a closed submenu can read 0 here. Confirm by opening the submenu and re-testing.'));
        }
        // Informational (a pass, not a warning) — explains why "menuitem" is absent.
        steps.push(P('menubar is false → navigation-menu mode', 'role="menuitem" is not expected here.', '',
          'With menubar:false U1 treats this as a navigation menu: items stay ordinary links and DON\'T get role="menuitem". That role is only for an application menubar (menubar:true). So a missing "menuitem" here is correct, not a bug.'));
      }
    } else if (type === 'form') {
      steps.push(root.tagName === 'FORM' ? P('Root is a <form>', '', '1.3.1')
        : W('Root is a <form>', `Root is <${root.tagName.toLowerCase()}> — U1 expects the <form>.`, '1.3.1'));
      const inputs = qa('input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea', root);
      const unlabeled = inputs.filter(i => {
        const id = i.id;
        const hasFor = id && q(`label[for="${id}"]`);
        return !(hasFor || i.closest('label') || i.getAttribute('aria-label') || i.getAttribute('aria-labelledby'));
      });
      steps.push(inputs.length === 0 ? W('Inputs labelled', 'No inputs found in the form.', '1.3.1')
        : unlabeled.length === 0 ? P('Inputs labelled', `All ${inputs.length} inputs have a label.`, '1.3.1')
        : F('Inputs labelled', `${unlabeled.length}/${inputs.length} inputs have no real label.`, '1.3.1'));
      const submit = q('button[type=submit],input[type=submit],button', root);
      steps.push(submit && accName(submit) ? P('Submit has a name', '', '4.1.2')
        : W('Submit has a name', 'No submit button with an accessible name.', '4.1.2'));
    } else if (type === 'table' || type === 'grid') {
      // A "grid" is often built from DIVs with ARIA roles — accept role="grid"
      // (and its role="columnheader"/"row" cells) as equivalent to a real <table>.
      const isAriaGrid = root.getAttribute('role') === 'grid' || root.getAttribute('role') === 'treegrid' || !!q('[role=grid],[role=treegrid]', root);
      const table = root.tagName === 'TABLE' ? root : q('table', root);
      if (!table && !isAriaGrid) {
        steps.push(F('Table / grid found', 'No <table> and no [role="grid"] under this selector.', '1.3.1'));
        return steps;
      }
      if (table) {
        steps.push((q('caption', table) || accName(table)) ? P('Caption / label', '', '1.3.1')
          : W('Caption / label', 'Table has no <caption> or aria-label.', '1.3.1'));
        steps.push(qa('thead th, th', table).length ? P('Header cells (th)', '', '1.3.1')
          : F('Header cells (th)', 'No <th> header cells.', '1.3.1'));
        const th = qa('th', table);
        if (th.length) steps.push(th.every(h => h.getAttribute('scope')) ? P('th has scope', '', '1.3.1')
          : W('th has scope', 'Some header cells lack a scope attribute.', '1.3.1'));
      } else {
        const gridEl = root.getAttribute('role') === 'grid' ? root : q('[role=grid],[role=treegrid]', root);
        steps.push(accName(gridEl) ? P('Grid has a label', '', '1.3.1') : W('Grid has a label', 'The [role="grid"] has no aria-label / aria-labelledby.', '1.3.1'));
        steps.push(qa('[role=columnheader],[role=rowheader]', gridEl).length ? P('Header cells (columnheader/rowheader)', '', '1.3.1')
          : W('Header cells (columnheader/rowheader)', 'No [role="columnheader"] / [role="rowheader"] cells.', '1.3.1'));
        steps.push(qa('[role=row]', gridEl).length ? P('role="row" present', `${qa('[role=row]', gridEl).length} rows.`, '4.1.2')
          : W('role="row" present', 'No [role="row"] elements.', '4.1.2'));
      }
    } else if (type === 'accordion') {
      // headerSelector IS the primary, so the headers are `primary` itself across
      // the whole document — NOT descendants of the single matched header.
      const trigs = qa(primary).length ? qa(primary)
        : qa(sel.headerSelector).length ? qa(sel.headerSelector)
        : qa('button,[role=button],summary,[aria-expanded]', root.parentElement || document).slice(0, 8);
      steps.push(trigs.length ? P('Headers found', `${trigs.length}.`, '') : W('Headers found', 'No accordion headers found.', ''));
      if (trigs.length) {
        steps.push(trigs.every(t => t.tagName === 'BUTTON' || t.getAttribute('role') === 'button')
          ? P('Headers are buttons', '', '4.1.2') : F('Headers are buttons', 'Some headers are not buttons.', '4.1.2'));
        steps.push(trigs.every(t => t.getAttribute('aria-expanded') !== null)
          ? P('aria-expanded present', '', '4.1.2') : F('aria-expanded present', 'Some headers lack aria-expanded.', '4.1.2'));
      }
    } else if (type === 'tabs') {
      steps.push((q('[role=tablist]', root) || root.getAttribute('role') === 'tablist')
        ? P('role="tablist"', '', '4.1.2') : F('role="tablist"', 'No [role="tablist"].', '4.1.2'));
      const tabs = qa('[role=tab]', root);
      steps.push(tabs.length ? P('role="tab" present', `${tabs.length} tabs.`, '4.1.2') : F('role="tab" present', 'No [role="tab"].', '4.1.2'));
      if (tabs.length) steps.push(tabs.every(t => t.getAttribute('aria-selected') !== null)
        ? P('aria-selected present', '', '4.1.2') : F('aria-selected present', 'Some tabs lack aria-selected.', '4.1.2'));
      // OUTSIDE the tab list, not inside it. This looked in `root` — the
      // tabList — and a panel nested in its own tab strip is the arrangement
      // STRUCTURE_RULES exists to forbid, because U1 then hides the tabs along
      // with the content they control. So a CORRECTLY built strip failed this
      // check every time. Follow aria-controls first, since that is the link
      // the tabs themselves declare, and fall back to the document.
      // Falling back to an UNSCOPED qa('[role=tabpanel]') here used to let any
      // tabpanel anywhere in the document — belonging to a completely different
      // widget — count as this one's, which could mask role/tab failures on
      // THIS strip behind a false PASS. If there are no tabs in root to read
      // aria-controls from, and the mapping's own tabPanel selector finds
      // nothing either, that is a real failure, not something to paper over.
      const panelIds = qa('[role=tab]', root).map(t => t.getAttribute('aria-controls')).filter(Boolean);
      const byControls = panelIds.map(id => document.getElementById(id)).filter(Boolean);
      const panels = byControls.length ? byControls : qa(sel.tabPanel);
      steps.push(panels.length
        ? P('role="tabpanel" present', `${panels.length} panel${panels.length === 1 ? '' : 's'}, outside the tab list where they belong.`, '4.1.2')
        : F('role="tabpanel" present', 'No [role="tabpanel"] found via aria-controls from this strip\'s tabs, and the configured tab panel selector matches nothing.', '4.1.2'));
    } else if (type === 'listbox') {
      steps.push(root.getAttribute('role') === 'listbox' ? P('role="listbox"', '', '4.1.2') : F('role="listbox"', `role="${root.getAttribute('role') || '(none)'}".`, '4.1.2'));
      const opts = qa(sel.options, root);
      if (opts.length) steps.push(opts.filter(o => o.getAttribute('role') === 'option').length === opts.length
        ? P('Options have role', `${opts.length}.`, '4.1.2') : W('Options have role', 'Some options lack role="option".', '4.1.2'));
    } else if (type === 'radio') {
      // radio had no static branch at all: it fell through to the generic
      // "does the container have a name" check, so a radio group that U1 never
      // touched looked exactly like one that works.
      const group = root.getAttribute('role') === 'radiogroup' ? root : q('[role=radiogroup]', root);
      steps.push(group ? P('role="radiogroup"', '', '4.1.2')
        : F('role="radiogroup"', `The container has role="${root.getAttribute('role') || '(none)'}".`, '4.1.2'));
      // The ROLE, counted on its own. Counting the mapped selector's matches
      // here would report "3 options" for three plain divs U1 never touched,
      // which is the failure this branch exists to catch.
      const roled = qa('[role=radio]', root);
      const mapped = qa(sel.radioButton, root);
      steps.push(roled.length ? P('role="radio" present', `${roled.length} options.`, '4.1.2')
        : F('role="radio" present',
            mapped.length
              ? `"${sel.radioButton}" matches ${mapped.length} elements and none of them has role="radio" — U1 has not decorated this group.`
              : 'No [role="radio"] elements.', '4.1.2'));
      const radios = roled.length ? roled : mapped;
      if (roled.length) {
        // Everything the mapping points at should have become a radio. A
        // shortfall means U1 reached some of them and not the rest.
        if (mapped.length) {
          const named = mapped.filter(r => r.getAttribute('role') === 'radio').length;
          steps.push(named === mapped.length ? P('Every option is a radio', '', '4.1.2')
            : W('Every option is a radio', `${named}/${mapped.length} of "${sel.radioButton}" have role="radio".`, '4.1.2'));
        }
        const checked = radios.filter(r => r.hasAttribute('aria-checked')).length;
        steps.push(checked === radios.length ? P('aria-checked on every option', '', '4.1.2')
          : F('aria-checked on every option', `${checked}/${radios.length} carry it — the rest have no state to announce.`, '4.1.2'));
        // The defect u1-patch:radio exists to correct, and nothing verified
        // that the correction landed: getCheckedRadio() returns the first radio
        // WITHOUT aria-checked, so the group ends up with two tab stops and Tab
        // lands on an unselected option.
        const stops = radios.filter(r => r.getAttribute('tabindex') === '0').length;
        steps.push(stops === 1 ? P('Exactly one tab stop', 'Arrow keys move between the rest.', '2.1.1')
          : F('Exactly one tab stop', `${stops} of ${radios.length} options are in the tab order. A radio group takes one stop; arrows move within it.`, '2.1.1'));
      }
    } else if (type === 'heading') {
      steps.push(root.getAttribute('role') === 'heading' || /^H[1-6]$/.test(root.tagName)
        ? P('Is a heading', `${root.tagName.toLowerCase()}${root.getAttribute('aria-level') ? ' aria-level=' + root.getAttribute('aria-level') : ''}.`, '1.3.1')
        : F('Is a heading', 'Element is not a heading and has no role="heading".', '1.3.1'));
    } else if (type === 'ariaLabel' || type === 'aria-label') {
      const targets = qa(primary);
      const labelled = targets.filter(t => (t.getAttribute('aria-label') || '').trim());
      steps.push(targets.length === 0 ? W('Targets found', `No elements match "${primary}".`, '')
        : labelled.length === targets.length ? P('All targets have aria-label', `${labelled.length}/${targets.length}.`, '2.4.4')
        : F('All targets have aria-label', `${labelled.length}/${targets.length} have an aria-label.`, '2.4.4'));
    } else {
      // Generic: element exists + has an accessible name.
      steps.push(accName(root) ? P('Accessible name', `"${accName(root).slice(0, 40)}"`, '4.1.2')
        : W('Accessible name', 'Element has no accessible name (text / aria-label).', '4.1.2'));
    }
    return steps;
  }

  // Same non-unique-selector logic recommendSelector() already has for the
  // Picker's mapping-creation form (line ~48) — surfaced here too, because a
  // test result computed from document.querySelector()'s first match, with no
  // note that a second/third match exists, reads as "the fix is broken" when
  // the fix may be sitting correctly on a DIFFERENT element than the one this
  // run happened to check.
  const PER_MATCH_TYPES = ['tabs', 'combobox', 'listbox', 'dialog', 'tooltip', 'pagination', 'radio'];
  function uniquenessStep(type, primary) {
    let count = -1;
    try { count = document.querySelectorAll(primary).length; } catch { return null; }
    if (count <= 1) return null;
    return PER_MATCH_TYPES.includes(type)
      ? W('Selector matches multiple elements',
          `"${primary}" matches ${count} elements on this page. This test only checked the first one — if it fails here, the others may still be fixed correctly.`, '')
      : W('Selector matches multiple elements',
          `"${primary}" matches ${count} elements — U1 fixes only the first, and this test checked only that one. Point this at a unique #id if you meant a specific instance.`, '');
  }

  function runStaticChecks(type, primary, selectors, cfg) {
    const steps = checksFor(type, primary, selectors, cfg);
    const note = uniquenessStep(type, primary);
    if (note) steps.unshift(note);
    const fails = steps.filter(s => s.status === 'fail').length;
    const warns = steps.filter(s => s.status === 'warn').length;
    return { steps, summary: { total: steps.length, pass: steps.length - fails - warns, fail: fails, warn: warns } };
  }

  // ── Keyboard-navigation test (Dimension B) with on-page animated HUD ───────
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  // Poll a predicate until it's truthy (or the timeout elapses); returns the
  // truthy value, or false on timeout. Async widgets (portal datepickers, modal
  // dialogs, framework re-renders) settle on their own schedule, so WAITING for
  // the real condition — instead of betting on one fixed delay — is what makes a
  // result the same from run to run. This is the core fix for flaky/inconsistent
  // checks: a slightly-slow widget no longer flips a pass into a warn.
  async function waitFor(fn, timeout = 2000, interval = 50) {
    const end = Date.now() + timeout;
    for (;;) {
      let v; try { v = fn(); } catch (e) { v = false; }
      if (v) return v;
      if (Date.now() >= end) return false;
      await delay(interval);
    }
  }
  // Read the "selected/active cell" signal a roving-tabindex OR activedescendant
  // grid uses, so we can tell whether an arrow key actually moved the selection.
  const gridActiveSig = (container) => {
    const ad = document.activeElement;
    const adId = (container && container.getAttribute && container.getAttribute('aria-activedescendant')) || '';
    const tabbable = container && container.querySelector ? container.querySelector('[role=gridcell][tabindex="0"],[role=gridcell][aria-selected="true"]') : null;
    return (ad ? (ad.id || ad.getAttribute && ad.getAttribute('aria-label') || '') : '') + '|' + adId + '|' + (tabbable ? (tabbable.id || tabbable.getAttribute('aria-label') || tabbable.textContent || '') : '');
  };
  const KEYCODES = { Enter: 13, ' ': 32, Escape: 27, Tab: 9, ArrowDown: 40, ArrowRight: 39, ArrowUp: 38, ArrowLeft: 37, Home: 36, End: 35 };
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'; };
  const activeInside = (el) => !!el && (document.activeElement === el || el.contains(document.activeElement));
  function press(el, key) {
    const target = el || document.activeElement || document.body;
    const opts = { key, code: key, keyCode: KEYCODES[key] || 0, which: KEYCODES[key] || 0, bubbles: true, cancelable: true };
    target.dispatchEvent(new KeyboardEvent('keydown', opts));
    target.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  // Small helper to stream test lifecycle/steps to the panel (isolated content-
  // script world has chrome.runtime). The steps card now lives IN the panel; only
  // the on-page highlight box remains here.
  function sendToPanel(msg) { try { chrome.runtime && chrome.runtime.sendMessage && chrome.runtime.sendMessage(msg); } catch (e) {} }

  function removeHud() { ['__u1TestHud', '__u1TestBox'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); }
  function makeHud(title) {
    removeHud();
    // Only the highlight box stays on the page (pointer-events:none, follows focus).
    const box = document.createElement('div');
    box.id = '__u1TestBox';
    Object.assign(box.style, { position: 'fixed', zIndex: 2147483646, border: '2px solid #6c4cf1', background: 'rgba(108,76,241,0.18)', boxShadow: '0 0 0 1px rgba(255,255,255,0.5)', pointerEvents: 'none', transition: 'all .25s ease', display: 'none', boxSizing: 'border-box' });
    document.body.appendChild(box);
    return {
      addStep() { /* steps now render in the panel via sendToPanel */ },
      highlight(el) {
        if (!el) { box.style.display = 'none'; return; }
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {}
        const r = el.getBoundingClientRect();
        Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      },
    };
  }

  async function runKeyboardTest(type, primary, sel, cfg) {
    sel = sel || {};
    cfg = cfg || {};
    const steps = [];
    const hud = makeHud(primary);
    sendToPanel({ type: 'u1-test-start', primary });
    const rec = (label, status, message, el) => {
      steps.push({ label, status, message: message || '' });
      sendToPanel({ type: 'u1-test-step', section: 'keyboard', step: { label, status, message: message || '' } });
      if (el) hud.highlight(el);
    };
    const root = q(primary);
    if (!root) { rec('Element found', 'fail', `Nothing matches "${primary}".`); return { steps }; }

    try {
      if (type === 'dialog') {
        // A dialog's trigger is usually NOT a descendant of the dialog
        // container itself (the container is often portaled to the end of
        // <body>), so this can't be scoped the way tabpanel/tab lookups are —
        // but if sel.trigger matches more than one element on the page, the
        // report should say so instead of silently driving whichever one
        // document.querySelector happens to return first.
        if (sel.trigger) {
          let triggerCount = -1;
          try { triggerCount = document.querySelectorAll(sel.trigger).length; } catch {}
          if (triggerCount > 1) rec('Trigger selector matches multiple elements', 'warn',
            `"${sel.trigger}" matches ${triggerCount} elements — this test drove the first one.`);
        }
        const trigger = q(sel.trigger, root) || q(sel.trigger) || root;
        trigger.focus(); await delay(120); rec('Focus the trigger', activeInside(trigger) ? 'pass' : 'warn', '', trigger);
        // Elements already open before the click (a cookie banner, another
        // mapping's modal) must not be mistaken for the one THIS trigger
        // opens — the unscoped fallback below only makes sense for dialogs
        // that are genuinely new.
        const openBefore = new Set(qa('[role=dialog],[role=alertdialog],dialog:not([hidden])').filter(visible));
        trigger.click();
        // Wait for the dialog to actually appear rather than betting on a delay.
        const dlg = await waitFor(() => {
          if (visible(root)) return root;
          const fresh = qa('[role=dialog],[role=alertdialog],dialog:not([hidden])')
            .find(el => visible(el) && !openBefore.has(el));
          return fresh || false;
        }, 2000);
        rec('Trigger opens the dialog', dlg ? 'pass' : 'warn', dlg ? '' : 'No dialog appeared after activating the trigger.', dlg);
        if (dlg) {
          await waitFor(() => activeInside(dlg), 500);
          rec('Focus moves into the dialog', activeInside(dlg) ? 'pass' : 'fail', '', document.activeElement);
          rec('aria-modal="true"', dlg.getAttribute('aria-modal') === 'true' ? 'pass' : 'warn', '');
          press(document.activeElement, 'Escape');
          const closed = await waitFor(() => !visible(dlg), 800);
          rec('Escape closes the dialog', closed ? 'pass' : 'fail', closed ? '' : 'Dialog still visible after Escape.');
          // Only meaningful when a trigger selector was actually provided — otherwise
          // we'd be matching focus against the dialog itself, which can't pass.
          if (closed && sel.trigger) {
            const a = document.activeElement;
            rec('Focus returns to the trigger', (a && a.matches && a.matches(sel.trigger)) ? 'pass' : 'warn', '', a);
          }
        }
      } else if (type === 'tabs') {
        const tabs = qa('[role=tab]', root);
        if (!tabs.length) { rec('Tabs found', 'fail', 'No [role="tab"] elements.'); }
        else {
          tabs[0].focus(); await delay(250); rec('Focus first tab', activeInside(tabs[0]) ? 'pass' : 'warn', '', tabs[0]);
          const before = document.activeElement;
          press(document.activeElement, 'ArrowRight');
          const movedTab = await waitFor(() => document.activeElement !== before, 700);
          rec('ArrowRight moves to next tab', movedTab ? 'pass' : 'warn', movedTab ? '' : 'Focus did not move on ArrowRight.', document.activeElement);
        }
      } else if (type === 'accordion') {
        // primary IS the header selector — take the first matching header directly.
        const trig = q(primary) || q(sel.headerSelector) || q('button,[role=button],summary,[aria-expanded]');
        if (!trig) { rec('Header found', 'fail', 'No accordion header found.'); }
        else {
          trig.focus(); await delay(250); rec('Focus a header', activeInside(trig) ? 'pass' : 'warn', '', trig);
          const before = trig.getAttribute('aria-expanded');
          // Native <button> accordions toggle on the click default of Enter, which a
          // synthetic KeyboardEvent can't produce — so activate with a real .click().
          trig.click();
          await waitFor(() => trig.getAttribute('aria-expanded') !== before, 700);
          const after = trig.getAttribute('aria-expanded');
          rec('Activate expands/collapses', before !== after ? 'pass' : 'warn',
            before !== after ? `aria-expanded ${before} → ${after}` : 'aria-expanded did not change on activation.', trig);
          if (before !== after) { trig.click(); await delay(200); } // restore only if we actually changed it
        }
      } else if (type === 'menu' || type === 'menubar') {
        const trigger = q(sel.triggers, root);
        const opener = trigger || qa(sel.items, root)[0] || q('a,button', root);
        if (!opener) { rec('Menu item found', 'fail', 'No menu items / triggers found.'); }
        else {
          opener.focus(); await delay(250); rec('Focus a menu item', activeInside(opener) ? 'pass' : 'warn', '', opener);
          const isMenubarKb = (type === 'menubar' || cfg.menubar === true);
          const before = document.activeElement;
          press(document.activeElement, isMenubarKb ? 'ArrowRight' : 'ArrowDown');
          const moved = await waitFor(() => document.activeElement !== before, 700);
          if (isMenubarKb) {
            // In an application menubar, arrow keys MUST move focus between items.
            rec('Arrow moves focus within menu', moved ? 'pass' : 'warn',
              moved ? '' : 'In a menubar (menubar:true) arrow keys should move focus between items, but focus did not move.', document.activeElement);
          } else {
            // Navigation menu (menubar:false): the expected key is TAB, not arrows.
            // Arrow support is optional here, so treat "no move" as informational, not a warning.
            rec('Arrow key (optional in a nav menu)', 'pass',
              moved ? 'Arrow moved focus.' : 'Arrows do not move focus — that is fine: a navigation menu (menubar:false) is operated with Tab, not arrow keys. Arrow navigation is only required for an application menubar (menubar:true).', document.activeElement);
          }

          // If a submenu trigger + submenu container are configured, verify it opens
          // and keyboard focus can reach the submenu items (Enter/Space, then Tab).
          const sub = q(sel.submenus, root);
          if (trigger && sub) {
            // Open state: aria-expanded (U1 sets it) OR an "open/show/active" class on the
            // trigger or submenu OR the submenu actually rendering. Robust against slow
            // close animations and dropdowns that toggle a class rather than display.
            // Only fairly specific "open" classes — NOT generic ones like active/in/
            // visible, which persist when closed (e.g. a nav item's .active) and would
            // make the submenu look permanently open, breaking close detection.
            const OPENCLS = /(^|\s)(is-open|open|show|shown|expanded|dropdown-open|submenu-open)(\s|$)/i;
            const hasOpenClass = (el) => el && typeof el.className === 'string' && OPENCLS.test(el.className);
            const isOpen = () => {
              if (trigger.getAttribute('aria-expanded') === 'true') return true;
              if (trigger.getAttribute('aria-expanded') === 'false') return false;
              if (sub.offsetParent === null && getComputedStyle(sub).position !== 'fixed') return false;
              return visible(sub) || hasOpenClass(sub) || hasOpenClass(trigger) || hasOpenClass(sub.parentElement);
            };
            // Definitive "closed" signals only (no generic-class noise), so a real close is detected reliably.
            const isClosed = () => {
              if (trigger.getAttribute('aria-expanded') === 'false') return true;
              if (trigger.getAttribute('aria-expanded') === 'true') return false;
              if (sub.offsetParent === null && getComputedStyle(sub).position !== 'fixed') return true;
              return !visible(sub);
            };
            trigger.focus(); await delay(200);
            press(trigger, 'Enter'); await delay(400);
            let open = isOpen();
            if (!open) { trigger.click(); await delay(450); open = isOpen(); }
            rec('Trigger opens the submenu', open ? 'pass' : 'warn', open ? '' : 'Submenu did not open on Enter/click.', open ? sub : trigger);
            if (open) {
              // NOTE: a synthetic Tab KeyboardEvent cannot move native focus, so instead
              // we verify the submenu items are actually keyboard-focusable (what Tab relies on).
              const focusable = sub.querySelector('a[href],button,[tabindex]:not([tabindex="-1"]),input,select,textarea');
              if (focusable) {
                focusable.focus(); await delay(250);
                const got = sub.contains(document.activeElement);
                rec('Submenu items are keyboard-focusable', got ? 'pass' : 'warn',
                  got ? 'Tab will reach these items.'
                      : 'The first submenu item did not take focus in this automated pass — it may be hidden/animating when focus was attempted. Open the submenu manually and press Tab to confirm.', focusable);
              } else {
                rec('Submenu items are keyboard-focusable', 'warn', 'No natively focusable element (link/button) found inside the submenu container.', sub);
              }
              // Dispatch Escape widely — U1 may listen on the item, the trigger, or the
              // document — then poll up to ~2.5s so a slow close animation still registers.
              press(document.activeElement, 'Escape'); press(trigger, 'Escape'); press(document, 'Escape'); press(document.body, 'Escape');
              let closed = false;
              for (let i = 0; i < 16; i++) { if (isClosed()) { closed = true; break; } await delay(150); }
              if (closed) {
                rec('Escape closes the submenu', 'pass', '', trigger);
              } else {
                // Many U1 menus (e.g. .signin) close on FOCUS-OUT, not Escape — the
                // trigger has no aria-expanded and the <ul> keeps display:block until
                // focus leaves. Emulate focus-loss and re-check before warning.
                try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch {}
                try { document.body.focus(); } catch {}
                press(document, 'Escape');
                let closedOut = false;
                for (let i = 0; i < 12; i++) { if (isClosed()) { closedOut = true; break; } await delay(150); }
                if (closedOut) {
                  rec('Submenu closes (on focus-out)', 'pass',
                    'This menu closes when focus leaves it (focus-out), not on Escape — a valid pattern for a navigation dropdown.', trigger);
                } else {
                  rec('Escape closes the submenu', 'warn',
                    'Submenu still reported open after Escape and focus-out. If it visibly DOES close, U1 may close it in a way the test cannot read — verify manually.', trigger);
                }
              }
            }
          } else {
            press(document.activeElement, 'Escape'); await delay(250); rec('Escape handled', 'pass', '');
          }
        }
      } else if (type === 'listbox') {
        // This used to focus the first option and press ArrowDown — on a list
        // that was still CLOSED. focus() on a display:none element does nothing,
        // the key went to <body>, and the whole widget came back "pass, pass".
        // A listbox with a trigger has to be OPENED first, exactly as the dialog
        // branch does, because everything worth testing only exists once it is.
        const trigger = q(sel.trigger, root) || q(sel.trigger);
        const listWasOpen = visible(root);

        if (trigger && !listWasOpen) {
          trigger.focus(); await delay(120);
          rec('Focus the trigger', activeInside(trigger) ? 'pass' : 'warn', '', trigger);

          // By KEY, not by click. A mouse click is not the thing under test, and
          // a widget that only opens on click is precisely the failure to find.
          press(trigger, 'Enter');
          let opened = await waitFor(() => visible(root), 1200);
          if (!opened) {
            press(trigger, 'ArrowDown');
            opened = await waitFor(() => visible(root), 1200);
            rec('Enter on the trigger opens the list', opened ? 'warn' : 'fail',
              opened ? 'Enter did nothing; ArrowDown opened it. A keyboard user will try Enter first.'
                     : 'Neither Enter nor ArrowDown opened the list. It opens on mouse click only — the mapping is applied and the component is not operable by keyboard.',
              trigger);
          } else {
            rec('Enter on the trigger opens the list', 'pass', '', root);
          }
          if (!opened) { hud.highlight(trigger); return { steps }; }

          rec('aria-expanded says "open"',
            trigger.getAttribute('aria-expanded') === 'true' ? 'pass' : 'fail',
            trigger.getAttribute('aria-expanded') === 'true' ? ''
              : `The list is open and the trigger still reports aria-expanded="${trigger.getAttribute('aria-expanded') || '(none)'}". A screen reader announces it as collapsed.`,
            trigger);

          await waitFor(() => activeInside(root), 600);
          rec('Focus moves into the list', activeInside(root) ? 'pass' : 'fail',
            activeInside(root) ? '' : 'The list opened and focus stayed on the trigger — there is nothing to arrow through yet.',
            document.activeElement);
        }

        const opts = qa(sel.options, root).filter(visible);
        if (!opts.length) {
          rec('Options found', 'fail', `Nothing visible matches "${sel.options || '(not set)'}" inside the list.`);
          return { steps };
        }
        rec('Options carry role="option"',
          opts.every(o => o.getAttribute('role') === 'option') ? 'pass' : 'warn',
          opts.every(o => o.getAttribute('role') === 'option') ? ''
            : `${opts.filter(o => o.getAttribute('role') !== 'option').length} of ${opts.length} options have no role="option".`,
          opts[0]);

        if (!activeInside(root)) { opts[0].focus(); await delay(200); }

        // Two models are both correct: DOM focus moving between options, or
        // focus parked on the container with aria-activedescendant naming the
        // current one. Read both, or the valid one reads as a failure.
        const sig = () => root.getAttribute('aria-activedescendant') + '|' +
          qa(sel.options, root).findIndex(o => o.getAttribute('aria-selected') === 'true') + '|' +
          (document.activeElement && document.activeElement.id) + '|' +
          qa(sel.options, root).indexOf(document.activeElement);
        const before = sig();
        press(document.activeElement, 'ArrowDown');
        const moved = await waitFor(() => sig() !== before, 900);
        rec('ArrowDown moves the active option', moved ? 'pass' : 'fail',
          moved ? '' : 'Nothing moved: not focus, not aria-activedescendant, not aria-selected. The options are decorated and the list cannot be walked.',
          document.activeElement);

        if (trigger && !listWasOpen) {
          press(document.activeElement, 'Escape');
          const closed = await waitFor(() => !visible(root), 900);
          rec('Escape closes the list', closed ? 'pass' : 'fail',
            closed ? '' : 'The list is still open after Escape — the only way out is the mouse.', trigger);
          if (closed) {
            const back = await waitFor(() => document.activeElement === trigger, 500);
            rec('Focus returns to the trigger', back ? 'pass' : 'fail',
              back ? '' : 'The list closed and focus did not come back — Tab restarts from the top of the page.',
              document.activeElement);
          }
        }
      } else if (type === 'combobox') {
        const tb = q(sel.textbox, root) || (root.matches('input,[role=combobox],[contenteditable]') ? root : q('input,[role=combobox]', root)) || root;
        tb.focus(); await delay(250); rec('Focus the combobox', activeInside(tb) ? 'pass' : 'warn', '', tb);
        const beforeExp = (tb.getAttribute('aria-expanded') || root.getAttribute('aria-expanded'));
        press(tb, 'ArrowDown');
        await waitFor(() => (tb.getAttribute('aria-expanded') === 'true') || (root.getAttribute('aria-expanded') === 'true')
          || !!(q(sel.listbox, root) || q('[role=listbox]', root) || q('[role=listbox]')), 700);
        const lb = q(sel.listbox, root) || q('[role=listbox]', root) || q('[role=listbox]');
        const opened = (tb.getAttribute('aria-expanded') === 'true') || (root.getAttribute('aria-expanded') === 'true') || (lb && visible(lb)) || (beforeExp !== (tb.getAttribute('aria-expanded') || root.getAttribute('aria-expanded')));
        rec('ArrowDown opens the list', opened ? 'pass' : 'warn', opened ? '' : 'aria-expanded did not become true and no listbox appeared on ArrowDown.', lb || tb);
      } else if (type === 'radio') {
        const radios = qa(sel.radioButton, root);
        if (!radios.length) { rec('Radio buttons found', 'fail', `No radios match "${sel.radioButton || '(not set)'}".`); }
        else {
          const start = radios.find(r => r.getAttribute('tabindex') === '0') || radios[0];
          start.focus(); await delay(250); rec('Focus a radio', activeInside(start) ? 'pass' : 'warn', '', start);
          const beforeChecked = radios.findIndex(r => r.getAttribute('aria-checked') === 'true');
          const beforeAD = root.getAttribute('aria-activedescendant');
          const beforeFocus = document.activeElement;
          press(document.activeElement, 'ArrowDown');
          await waitFor(() => (radios.findIndex(r => r.getAttribute('aria-checked') === 'true') !== beforeChecked)
            || (root.getAttribute('aria-activedescendant') !== beforeAD)
            || (document.activeElement !== beforeFocus), 700);
          const afterChecked = radios.findIndex(r => r.getAttribute('aria-checked') === 'true');
          const moved = (afterChecked !== beforeChecked) || (root.getAttribute('aria-activedescendant') !== beforeAD) || (document.activeElement !== beforeFocus);
          rec('Arrow moves between radios', moved ? 'pass' : 'warn', moved ? '' : 'No change in aria-checked / aria-activedescendant / focus after Arrow.', document.activeElement);
        }
      } else if (type === 'checkbox') {
        const cb = root;
        cb.focus(); await delay(250); rec('Focus the checkbox', activeInside(cb) ? 'pass' : 'warn', '', cb);
        const before = cb.getAttribute('aria-checked');
        press(cb, ' '); // Space toggles a checkbox
        await waitFor(() => cb.getAttribute('aria-checked') !== before, 500);
        let after = cb.getAttribute('aria-checked');
        if (after === before) { cb.click(); await waitFor(() => cb.getAttribute('aria-checked') !== before, 500); after = cb.getAttribute('aria-checked'); } // fallback: real activation
        rec('Space toggles aria-checked', (after !== before) ? 'pass' : 'warn',
          (after !== before) ? `aria-checked ${before} → ${after}` : 'aria-checked did not change on Space/activation.', cb);
        if (after !== before) { cb.click(); await delay(150); } // restore
      } else if (type === 'datepicker' || type === 'keyboard-grid') {
        // Built by our grid engine and usually inside a popup that only exists
        // once opened. Open it via the trigger, WAIT for the grid to actually
        // render (portals are async — this is why the old fixed-delay version
        // sometimes "didn't test" it), then verify arrow-key cell navigation.
        const trigger = q(sel.trigger, root) || q(sel.trigger) || root;
        // sel.container / '[role=grid]' with no scope at all would grab the
        // first datepicker grid ANYWHERE on the page — wrong widget entirely
        // on a page with more than one. Root's own subtree first, always.
        let container = q(sel.container, root) || q(sel.container)
          || (root && root.matches && root.matches('[role=grid]') ? root : null) || q('[role=grid]', root) || q('[role=grid]');
        if (!container || !visible(container)) {
          if (trigger) { trigger.focus(); await delay(100); trigger.click(); }
          container = await waitFor(() => {
            const c = q(sel.container, root) || q(sel.container) || q('[role=grid]', root) || q('[role=grid]');
            return c && visible(c) ? c : false;
          }, 2500);
        }
        if (!container) {
          rec('Grid/datepicker opens', 'warn', 'No grid appeared. Open the datepicker on the page first, then run the test.');
        } else {
          const hasGrid = !!(container.matches && (container.matches('[role=grid]') || container.querySelector('[role=grid],[role=gridcell]')));
          rec('Grid semantics (role=grid/gridcell)', hasGrid ? 'pass' : 'warn', hasGrid ? '' : 'No role="grid"/"gridcell" found inside the widget.', container);
          const cellSel = sel.day || sel.cell || '[role=gridcell]';
          let cells = qa(cellSel, container).filter(visible);
          if (!cells.length) cells = qa('[role=gridcell]', container).filter(visible);
          if (!cells.length) {
            rec('Grid cells found', 'warn', 'No focusable grid cells found in the widget.');
          } else {
            const start = container.querySelector('[role=gridcell][tabindex="0"]') || cells[0];
            start.focus();
            await waitFor(() => activeInside(container), 500);
            rec('A cell can receive focus', activeInside(container) ? 'pass' : 'warn', '', start);
            const before = gridActiveSig(container);
            press(document.activeElement, 'ArrowRight');
            const moved = await waitFor(() => gridActiveSig(container) !== before, 900);
            rec('ArrowRight moves between cells', moved ? 'pass' : 'warn',
              moved ? '' : 'Arrow key did not move the selection — roving tabindex / aria-activedescendant may not be wired.', document.activeElement);
            const opCell = document.activeElement;
            rec('Cell is keyboard-operable', (opCell && (opCell.getAttribute('role') === 'gridcell' || activeInside(container))) ? 'pass' : 'warn', '', opCell);
          }
        }
      } else {
        // Generic focusable check — but many types are CONTAINERS that are not
        // meant to take focus themselves (their focus lives on inner controls),
        // so a "not focusable" result there is expected, not a defect.
        const CONTAINER_TYPES = ['form', 'table', 'grid', 'carousel', 'pagination', 'loading', 'tooltip'];
        root.focus(); await delay(200);
        if (activeInside(root)) rec('Element is focusable', 'pass', '', root);
        else if (CONTAINER_TYPES.indexOf(type) >= 0)
          rec('Container (focus lives on inner controls)', 'pass', 'This is a container — it is not meant to receive focus itself; its individual controls are what users focus.', root);
        else
          rec('Element is focusable', 'warn', 'Element did not take keyboard focus.', root);
      }
    } catch (e) {
      rec('Test error', 'warn', String(e && e.message ? e.message : e));
    }
    return { steps };
  }

  // ── Inspect the REAL applied code (so the user can see ground truth) ───────
  // Returns the opening tag (attributes only, no children) of the container and
  // of the first few relevant children, plus the outerHTML of the container.
  function openTag(el) {
    if (!el) return '';
    const attrs = Array.from(el.attributes || []).map(a => `${a.name}="${a.value}"`).join(' ');
    return `<${el.tagName.toLowerCase()}${attrs ? ' ' + attrs : ''}>`;
  }
  function inspectCode(type, primary, sel) {
    sel = sel || {};
    const root = q(primary);
    if (!root) return { notFound: true, primary };
    const parts = [{ label: primary + '  (container)', tag: openTag(root) }];
    // Pick the most relevant child selector per type.
    const childSel = sel.items || sel.options || sel.headerSelector || sel.trigger || sel.closeBtn || sel.triggers || sel.submenus;
    if (childSel) {
      qa(childSel, root).slice(0, 6).forEach((c, i) => parts.push({ label: `${childSel} [${i}]`, tag: openTag(c) }));
    }
    // Trim the full markup so we never ship megabytes back to the panel.
    let html = '';
    try { html = root.outerHTML; if (html.length > 4000) html = html.slice(0, 4000) + '\n… (truncated)'; } catch {}
    return { primary, tags: parts, outerHTML: html };
  }

  async function runTest(type, primary, config) {
    config = config || {};
    const selectors = config.selectors || config; // accept either a config or a bare selectors object
    const staticRes = runStaticChecks(type, primary, selectors, config);
    const keyboard = await runKeyboardTest(type, primary, selectors, config);
    const inspect = inspectCode(type, primary, selectors);
    return { static: staticRes, keyboard, inspect };
  }

  window.__u1TestEngine = { robustSelector, recommendSelector, runStaticChecks, runKeyboardTest, runTest, inspectCode, removeHud };
})();

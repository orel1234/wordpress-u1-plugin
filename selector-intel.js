// ─────────────────────────────────────────────────────────────────────────────
//  selector-intel.js — shared selector intelligence.
//
//  Loaded TWO ways (both are supported by the code below, which never assumes a
//  page DOM at load time):
//    1. <script src> in panel.html   → the panel uses the pure scoring helpers.
//    2. executeScript({files:[...]}) → injected into the inspected page, where
//       `window.__u1SelectorIntel.analyze(...)` walks the real DOM.
//
//  Everything it produces must be a U1-VALID selector: compound simple selectors
//  joined only by `> + ~` (no spaces, no descendant combinator, no :pseudo) and
//  never anchored on a generated id. See U1_SELECTOR_RE / VOLATILE_ID below.
// ─────────────────────────────────────────────────────────────────────────────
(function (root) {
  'use strict';

  // ── Shared vocabulary (kept identical to test-engine.js / panel.js) ────────

  // U1 validates selectors with a strict regex: compound simple-selectors joined
  // only by > + ~ combinators, plus comma groups. ".nav > li" is REJECTED.
  // A pseudo-class is legal. U1's own menu documentation uses one:
  //   items: 'a.menu-item:not(.has-submenu), li.has-submenu'
  // This grammar rejected every `:pseudo`, so the selector printed in the vendor's
  // docs failed our validation and the auto-mapper could never propose it. What
  // U1 genuinely cannot take is a DESCENDANT SPACE — only > + ~ join compounds —
  // and that is still rejected.
  const U1_SELECTOR_RE = /^(?:[\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?)(?:[>+~]?(?:[\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?))*(?:,(?:[\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?)(?:[>+~]?(?:[\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?))*)*$/;

  // Utility / framework / state classes — present on thousands of elements and
  // liable to change, so never the basis of a mapping.
  const NOISE = /^(flex|grid|w-|h-|p-|m-|py-|px-|mt-|mb-|ml-|mr-|text-|bg-|border|rounded|shadow|container|row|col|d-|justify|align|items-|gap-|hidden|visible|relative|absolute|fixed|sticky|block|inline|float|clearfix|sr-only|active|focus|hover|open|show|sc-|ng-|css-|emotion-|jsx-|mui)/i;

  // GENERATED ids (U1's own u1st-<uuid>, Angular Material, framework uuids) —
  // they change on every reload, so a mapping built on one breaks silently.
  const VOLATILE_ID = /^(u1st-|cdk-|mat-(input|select|error|hint|option|autocomplete|dialog|tooltip|mdc)|ng-|ember\d|react-|:r[0-9a-z]+:)|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  const normalize = (s) => String(s == null ? '' : s).trim().replace(/\s*([>+~,])\s*/g, '$1');
  const isU1Valid = (s) => { const n = normalize(s); return n === '' || U1_SELECTOR_RE.test(n); };
  const idOk = (id) => /^[A-Za-z][\w-]*$/.test(id) && !VOLATILE_ID.test(id);
  const classOk = (c) => !!c && !c.includes(':') && !c.includes('/') && !c.includes('[') && !c.includes('(');

  // ───────────────────────────────────────────────────────────────────────────
  //  A. selectorStrength — how trustworthy is this selector, as a mapping?
  //  Pure: works in the panel with no page access. `count` (live match count) is
  //  optional; pass it when known for a sharper grade.
  // ───────────────────────────────────────────────────────────────────────────
  const LEVELS = ['weak', 'medium', 'strong'];
  const down = (lvl) => LEVELS[Math.max(0, LEVELS.indexOf(lvl) - 1)];

  // Grade one compound segment (e.g. `.a.b`, `#id`, `div[name="x"]`).
  function gradeSegment(seg) {
    if (/^#[\w-]+$/.test(seg)) return 'strong';
    // Stable, semantic attribute selectors are as good as an id.
    if (/\[(data-testid|data-test|id|name|aria-label|role)\s*[=~|^$*]?=?/.test(seg)) return 'strong';
    if (/\[[^\]]+\]/.test(seg)) return 'medium';
    if (/\.[\w-]+/.test(seg)) return 'medium';
    return 'weak'; // bare tag, or *
  }

  function selectorStrength(sel, opts) {
    opts = opts || {};
    const raw = String(sel == null ? '' : sel);
    const norm = normalize(raw);
    const reasons = [];

    if (!norm) return { level: 'empty', label: '', reasons: [] };

    if (!isU1Valid(norm)) {
      return {
        level: 'invalid', label: 'Invalid',
        reasons: ['U1 only supports > + ~ combinators — no spaces, no descendant, no :pseudo-class.'],
      };
    }

    // Grade the WEAKEST branch of a comma group, and within a branch the LAST
    // segment (that is the element U1 actually decorates).
    const gradeBranch = (branch) => {
      const segs = branch.split(/[>+~]/).filter(Boolean);
      const g = gradeSegment(segs[segs.length - 1] || '');
      // An ancestor chain adds context, so a bare-tag leaf scoped by an id or a
      // class (`.signin-dropdown>li`) is worth more than that tag on its own.
      if (g === 'weak' && segs.length > 1 && segs.slice(0, -1).some(s => gradeSegment(s) !== 'weak')) {
        return /^#[\w-]+$/.test(segs[0]) ? 'strong' : 'medium';
      }
      return g;
    };
    let level = norm.split(',').map(gradeBranch)
      .reduce((a, b) => (LEVELS.indexOf(b) < LEVELS.indexOf(a) ? b : a), 'strong');

    // Generated id anywhere → the selector will not survive a reload.
    const ids = (norm.match(/#[\w-]+/g) || []).map(s => s.slice(1))
      .concat((norm.match(/\[id\s*=\s*["']([^"']+)["']\]/g) || [])
        .map(s => s.replace(/^\[id\s*=\s*["']|["']\]$/g, '')));
    if (ids.some(id => VOLATILE_ID.test(id))) {
      level = 'weak';
      reasons.push('Generated id — it changes on every page load, so this mapping breaks on reload.');
    }

    // Utility / state classes.
    const classes = (norm.match(/\.[\w-]+/g) || []).map(s => s.slice(1));
    if (classes.length && classes.every(c => NOISE.test(c))) {
      level = down(level);
      reasons.push('Utility or state class (e.g. active / flex / sc-) — likely to change.');
    }

    // Live match count.
    if (typeof opts.count === 'number') {
      if (opts.count === -1) {
        return { level: 'invalid', label: 'Invalid', reasons: ['Not a valid CSS selector.'] };
      }
      if (opts.count === 0) {
        if (!opts.allowZero) {
          level = 'weak';
          reasons.push('Matches nothing on this page right now.');
        } else {
          reasons.push('Matches 0 right now — expected for a widget that only exists while open.');
        }
      } else if (opts.count > 1 && opts.unique) {
        level = down(level);
        reasons.push('Matches ' + opts.count + ' elements — u1.fix.* decorates only ONE of them (the last match).');
      }
    }

    const label = level === 'strong' ? 'Strong' : level === 'medium' ? 'Medium' : 'Weak';
    if (!reasons.length) {
      reasons.push(level === 'strong' ? 'Anchored on a stable id or attribute.'
        : level === 'medium' ? 'Class-based — fine, as long as the class is meaningful and stable.'
        : 'Tag-only — matches far too broadly to be reliable.');
    }
    return { level, label, reasons };
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Below this line everything needs a live DOM (the injected copy only).
  // ───────────────────────────────────────────────────────────────────────────
  const hasDom = typeof document !== 'undefined' && !!document.querySelectorAll;

  const countOf = (s) => { try { return document.querySelectorAll(s).length; } catch { return -1; } };
  const uniqueOnPage = (s) => countOf(s) === 1;

  function compound(node) {
    if (!node || node.nodeType !== 1) return '';
    if (node.id && idOk(node.id)) return '#' + node.id;
    const testId = node.getAttribute('data-testid') || node.getAttribute('data-test');
    if (testId) return `[data-testid="${testId}"]`;
    const tag = node.tagName.toLowerCase();
    const al = node.getAttribute('aria-label');
    if (al && al.length < 40 && !al.includes('"')) return `${tag}[aria-label="${al}"]`;
    const nm = node.getAttribute('name');
    if (nm && !nm.includes('"')) return `${tag}[name="${nm}"]`;
    const classes = classesOf(node).filter(c => !NOISE.test(c));
    if (classes.length) {
      for (const c of classes) {
        try { if (document.getElementsByClassName(c).length === 1) return '.' + c; } catch {}
      }
      return tag + '.' + classes[0];
    }
    return tag;
  }

  // Build a unique, U1-valid selector (no spaces, no :nth) for `node`.
  function robustSelector(node) {
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
  }

  function classesOf(el) {
    const cn = el && el.className;
    if (!cn || typeof cn !== 'string') return [];
    return cn.trim().split(/\s+/).filter(classOk);
  }

  // ── B. commonSelectorFor — the heart of auto-fill ──────────────────────────
  // Given a container and a target element set, find the SHORTEST U1-valid
  // selector that covers every target and nothing else inside the container.
  // Returns { selector, count, exact, why } or null.
  function commonSelectorFor(container, els, containerSel) {
    els = (els || []).filter(e => e && e.nodeType === 1);
    if (!els.length) return null;

    const inContainer = (sel) => {
      try { return Array.from(container.querySelectorAll(sel)); } catch { return null; }
    };
    const covers = (sel) => {
      const got = inContainer(sel);
      if (!got) return null;
      const set = new Set(got);
      const missing = els.filter(e => !set.has(e)).length;
      return { extra: got.length - (els.length - missing), missing, total: got.length };
    };

    // Candidate tokens, cheapest first: a shared class, then tag, then attribute.
    const tokens = [];
    const classCount = new Map();
    for (const e of els) for (const c of new Set(classesOf(e))) classCount.set(c, (classCount.get(c) || 0) + 1);
    // Prefer a class ALL targets share, and prefer non-noise, longer (more
    // specific) names — `.main-nav__dropdown-link` over `.link`.
    const shared = [...classCount.entries()]
      .filter(([c, n]) => n === els.length && !NOISE.test(c))
      .map(([c]) => c)
      .sort((a, b) => b.length - a.length);
    for (const c of shared) tokens.push('.' + c);

    const tags = new Set(els.map(e => e.tagName.toLowerCase()));
    if (tags.size === 1) tokens.push([...tags][0]);

    for (const t of tokens) {
      const r = covers(t);
      if (!r || r.missing) continue;
      // Exact within the container → prefer the bare token when it is also
      // scoped page-wide, otherwise anchor it on the container.
      if (r.extra === 0) {
        const bare = normalize(t);
        const anchored = normalize(containerSel + '>' + t);
        // A bare TAG (`li`, `a`) is far too broad to stand alone even when it
        // happens to be exact today, so anchor it on the container first. A
        // class token is specific enough to prefer in its short form.
        const order = /^[a-z]/i.test(t) ? [anchored, bare] : [bare, anchored];
        for (const s of order) {
          if (isU1Valid(s) && countOf(s) === r.total) {
            return { selector: s, count: r.total, exact: true, why: whyFor(t, els) };
          }
        }
        if (isU1Valid(bare)) return { selector: bare, count: countOf(bare), exact: false, why: whyFor(t, els) };
      }
    }

    // No single token works — try a comma group of per-element class tokens.
    // This is what covers a menu whose top-level links and drop-down links use
    // two different classes.
    // Pick, for each element, the class that covers the MOST of the target set
    // (longest name only as a tiebreak). Choosing the most specific class per
    // element instead would split one group into several — e.g. a nav whose
    // triggers carry both .main-nav__link and .main-nav__trigger would yield a
    // needless third branch for a class the other items already cover.
    const groups = new Map(); // class → elements
    for (const e of els) {
      const c = classesOf(e).filter(x => !NOISE.test(x))
        .sort((a, b) => (classCount.get(b) - classCount.get(a)) || (b.length - a.length))[0];
      if (!c) continue;
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(e);
    }
    if (groups.size >= 2 && groups.size <= 4) {
      const covered = [...groups.values()].reduce((n, g) => n + g.length, 0);
      if (covered === els.length) {
        const sel = normalize([...groups.keys()].map(c => '.' + c).join(','));
        const r = covers(sel);
        if (isU1Valid(sel) && r && !r.missing && r.extra === 0) {
          return { selector: sel, count: countOf(sel), exact: true, why: whyFor(sel, els) };
        }
      }
    }

    // Last resort: a robust selector for the first element only — clearly flagged
    // as partial so the review panel asks rather than asserts.
    const one = robustSelector(els[0]);
    if (!one || !isU1Valid(one)) return null;
    return { selector: one, count: countOf(one), exact: false, why: 'Only the first of ' + els.length + ' could be matched by one selector.' };
  }

  function whyFor(token, els) {
    const n = els.length;
    const sample = (els[0].textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return `${n} element${n === 1 ? '' : 's'} share ${token}${sample ? ` — first one reads “${sample}”` : ''}.`;
  }

  // ── C. clickSignals — does this element have a click event? ────────────────
  // Heuristic layer. `addEventListener` registrations are invisible after the
  // fact from any world, so this reads every OTHER available signal. When the
  // opt-in recorder (event-recorder.js) is present in the MAIN world, the panel
  // upgrades `confidence` to 'verified' via a second pass — see panel.js.
  const DATA_TRIGGER = /trigger|toggle|open|dropdown|menu|tab|accordion|collaps|expand|modal|dialog/i;

  function clickSignals(el) {
    const signals = [];
    if (!el || el.nodeType !== 1) return { clickable: false, confidence: 'likely', signals };
    const tag = el.tagName.toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();

    if (tag === 'button' || tag === 'summary' || tag === 'select' || tag === 'textarea') signals.push('<' + tag + '>');
    else if (tag === 'a' && el.hasAttribute('href')) signals.push('<a href>');
    else if (tag === 'input') signals.push('<input>');

    if (/^(button|link|menuitem|menuitemcheckbox|menuitemradio|tab|checkbox|switch|option)$/.test(role)) signals.push('role=' + role);
    if (el.onclick || el.hasAttribute('onclick')) signals.push('onclick');
    for (const a of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
      if (el.hasAttribute(a)) signals.push(a);
    }
    for (const at of Array.from(el.attributes || [])) {
      if (/^data-/.test(at.name) && DATA_TRIGGER.test(at.name)) { signals.push(at.name); break; }
    }
    const ti = el.getAttribute('tabindex');
    if (ti != null && parseInt(ti, 10) >= 0) signals.push('tabindex=' + ti);

    // cursor:pointer only counts when the PARENT isn't also pointer — otherwise
    // every child of a clickable card lights up.
    try {
      if (getComputedStyle(el).cursor === 'pointer' &&
          (!el.parentElement || getComputedStyle(el.parentElement).cursor !== 'pointer')) {
        signals.push('cursor:pointer');
      }
    } catch {}

    return { clickable: signals.length > 0, confidence: 'likely', signals };
  }

  // ── D. AUTO_RULES — per component type, how to find each field ─────────────
  // Each rule returns an ARRAY of candidates (best first). Returning >1 makes the
  // review panel ask the specialist instead of guessing.
  const cand = (container, els, containerSel, why) => {
    const r = commonSelectorFor(container, els, containerSel);
    if (!r) return null;
    return { selector: r.selector, count: r.count, exact: r.exact, why: why || r.why };
  };

  const uniq = (arr) => arr.filter((v, i) => v && arr.indexOf(v) === i);
  const qsa = (root, sel) => { try { return Array.from(root.querySelectorAll(sel)); } catch { return []; } };

  // Elements inside `container` that look like they open something.
  //
  // The evidence must be POSITIVE — an aria relationship, a data-* trigger
  // attribute, or a real panel of its own. A plain <a href> that merely sits
  // inside a drop-down is NOT a trigger: its parent holds the other links, so
  // "my parent contains several links" wrongly promotes every drop-down item.
  function findTriggers(container) {
    const all = qsa(container, 'button,a,[role="button"],[aria-haspopup],[aria-expanded],summary,[class*="trigger"],[class*="toggle"]');
    return all.filter(el => {
      if (!clickSignals(el).clickable) return false;
      if (el.hasAttribute('aria-haspopup') || el.hasAttribute('aria-expanded') || el.hasAttribute('aria-controls')) return true;
      for (const at of Array.from(el.attributes || [])) {
        if (/^data-/.test(at.name) && DATA_TRIGGER.test(at.name)) return true;
      }
      if (/trigger|toggle/i.test(el.className || '')) return true;
      const panel = siblingPanel(el);
      return !!(panel && panel !== container && !panel.contains(container));
    });
  }

  // The panel a trigger opens: the element named by aria-controls, else a later
  // sibling that is itself a CONTAINER of several items (≥2 links/buttons, or a
  // list). A lone <a> sibling is another menu item, not a panel.
  function siblingPanel(trigger) {
    if (!trigger || !trigger.getAttribute) return null;
    const controls = trigger.getAttribute('aria-controls');
    if (controls) { const t = document.getElementById(controls); if (t) return t; }
    let n = trigger.nextElementSibling;
    while (n) {
      if (n.nodeType === 1 && !/^(a|button|input|img|span|svg)$/i.test(n.tagName) &&
          (qsa(n, 'a,button').length >= 2 || qsa(n, 'li').length >= 1)) return n;
      n = n.nextElementSibling;
    }
    return null;
  }

  const AUTO_RULES = {
    menu: {
      items: (c, cs) => {
        const els = uniq(qsa(c, 'a[href],button,[role="menuitem"]'));
        return [cand(c, els, cs, `Every clickable item in the menu — ${els.length} found, top level plus drop-downs.`)].filter(Boolean);
      },
      triggers: (c, cs) => {
        const t = findTriggers(c);
        if (!t.length) return [];
        const out = [cand(c, t, cs, `${t.length} item${t.length === 1 ? '' : 's'} that open a drop-down.`)];
        // Alternative reading: every <button> in the menu.
        const btns = qsa(c, 'button');
        if (btns.length && btns.length !== t.length) out.push(cand(c, btns, cs, `All ${btns.length} <button> elements in the menu.`));
        return out.filter(Boolean);
      },
      submenus: (c, cs) => {
        const panels = uniq(findTriggers(c).map(siblingPanel).filter(Boolean));
        const out = [];
        if (panels.length) out.push(cand(c, panels, cs, `${panels.length} panel${panels.length === 1 ? '' : 's'} that appear when a top-level item is clicked.`));
        // Alternative reading, by class name. Only elements that actually WRAP
        // several items count — a link named `…__dropdown-link` is an item
        // inside the panel, not the panel.
        const byName = qsa(c, '[class*="dropdown"],[class*="submenu"],[class*="sub-menu"],ul ul')
          .filter(e => !/^(a|button|input|span)$/i.test(e.tagName) && qsa(e, 'a,button,li').length >= 2);
        if (byName.length && byName.length !== panels.length) {
          out.push(cand(c, byName, cs, `${byName.length} element${byName.length === 1 ? '' : 's'} named like a drop-down.`));
        }
        return out.filter(Boolean);
      },
      horizontalMenu: (c, cs) => {
        try {
          const st = getComputedStyle(c);
          const kids = Array.from(c.children).filter(k => k.nodeType === 1);
          const row = (st.display.includes('flex') && st.flexDirection.startsWith('row')) ||
            (kids.length > 1 && Math.abs(kids[0].getBoundingClientRect().top - kids[1].getBoundingClientRect().top) < 6);
          if (!row) return [];
        } catch { return []; }
        return [{ selector: cs, count: countOf(cs), exact: true, why: 'The items sit side by side, so this is a horizontal bar (left/right arrows).' }];
      },
      // A boolean option rather than a selector (see `bool` handling below).
      // menubar:true makes every item role="menuitem" — but combined with nested
      // submenus U1 throws "Submenu must have a trigger element". A site nav
      // with drop-downs therefore needs menubar:false, which is now the schema
      // default too.
      menubar: (c) => {
        const hasSubmenus = findTriggers(c).some(t => siblingPanel(t));
        return [hasSubmenus
          ? { bool: false, why: 'This nav has drop-downs. With menubar ON, U1 throws “Submenu must have a trigger element” — so it must be OFF. Items stay links; only the triggers become buttons.' }
          : { bool: true, why: 'A flat bar of commands with no drop-downs — menubar ON gives every item role="menuitem".' }];
      },

      openByMouseenter: (c, cs) => {
        // Only propose when the drop-downs are genuinely revealed on hover.
        const trig = findTriggers(c);
        if (!trig.length) return [];
        const wrappers = uniq(trig.map(t => t.parentElement).filter(Boolean));
        const hoverOpens = wrappers.some(w => {
          const p = siblingPanel(w.querySelector('button,a') || w);
          if (!p) return false;
          try { return getComputedStyle(p).display === 'none' || getComputedStyle(p).visibility === 'hidden'; } catch { return false; }
        });
        if (!hoverOpens) return [];
        const r = cand(c, wrappers, cs, 'Their panel is hidden until something reveals it — but whether that is HOVER or a click cannot be told from the markup. Tick this only if hovering alone opens the menu.');
        // Left unticked: guessing wrong here rewires the menu to the wrong event.
        if (r) r.optIn = true;
        return r ? [r] : [];
      },
    },

    listbox: {
      options: (c, cs) => {
        const lis = qsa(c, ':scope>li').length ? qsa(c, ':scope>li') : qsa(c, 'li');
        if (lis.length) {
          // Per U1's listbox controller, `options` MUST be the individual items —
          // pointing it at the container leaves arrow keys and ESC dead.
          return [cand(c, lis, cs, `${lis.length} option rows. These must be the individual items — if this points at the whole list, arrows and Esc stop working.`)].filter(Boolean);
        }
        const links = qsa(c, 'a,button,[role="option"]');
        return [cand(c, links, cs, `${links.length} options in the list.`)].filter(Boolean);
      },
      trigger: (c, cs) => outsideTrigger(c, cs, 'The button that opens this list.'),
    },

    dialog: {
      trigger: (c, cs) => outsideTrigger(c, cs, 'The button that opens this dialog.'),
      closeBtn: (c, cs) => {
        let el = c.querySelector('[aria-label*="close" i],[title*="close" i],.close,.close-btn,.modal-close');
        if (!el) el = qsa(c, 'button').find(b => { const t = (b.textContent || '').trim().toLowerCase(); return t === '×' || t === 'x'; }) || null;
        if (!el) return [];
        const r = cand(c, [el], cs, 'The X / Close button — Esc will be wired to it.');
        return r ? [r] : [];
      },
      heading: (c, cs) => {
        const h = c.querySelector('h1,h2,h3,h4,h5,h6');
        if (!h) return [];
        const r = cand(c, [h], cs, `The dialog title — a screen reader announces “${(h.textContent || '').trim().slice(0, 40)}” on open.`);
        return r ? [r] : [];
      },
    },

    accordion: {
      contentSelector: (c, cs) => {
        const p = siblingPanel(c);
        if (!p) return [];
        const r = cand(p.parentElement || document.body, [p], robustSelector(p.parentElement || document.body), 'The panel that opens and closes under the header.');
        return r ? [r] : [];
      },
    },

    tabs: {
      tab: (c, cs) => {
        const els = qsa(c, '[role="tab"]').length ? qsa(c, '[role="tab"]') : qsa(c, 'a,button,li');
        return [cand(c, els, cs, `${els.length} tab buttons — arrow keys move between these.`)].filter(Boolean);
      },
    },

    table: {
      row: (c, cs) => { const r = cand(c, qsa(c, 'tr'), cs, 'Every row in the table.'); return r ? [r] : []; },
      cell: (c, cs) => { const r = cand(c, qsa(c, 'td'), cs, 'Every data cell.'); return r ? [r] : []; },
    },

    grid: {
      row: (c, cs) => { const r = cand(c, qsa(c, 'tr,[role="row"]'), cs, 'Every row in the grid.'); return r ? [r] : []; },
      cell: (c, cs) => { const r = cand(c, qsa(c, 'td,[role="gridcell"]'), cs, 'Every cell — arrow keys move between these.'); return r ? [r] : []; },
    },

    carousel: {
      carouselContainer: (c, cs) => {
        const p = c.parentElement;
        if (!p || p === document.body) return [];
        const r = { selector: robustSelector(p), count: 0, exact: true, why: 'The wrapper that holds all the slides.' };
        r.count = countOf(r.selector);
        return isU1Valid(r.selector) ? [r] : [];
      },
    },
  };

  // Shared: find the button OUTSIDE the container that opens it.
  function outsideTrigger(c, cs, why) {
    let el = null;
    const prev = c.previousElementSibling;
    if (prev && /^(button|a)$/i.test(prev.tagName)) el = prev;
    if (!el && c.parentElement) {
      el = c.parentElement.querySelector('[aria-haspopup],[aria-expanded],button');
      if (el === c || (el && c.contains(el))) el = null;
    }
    if (!el && c.id) el = document.querySelector(`[aria-controls="${c.id}"]`);
    if (!el) return [];
    const sel = robustSelector(el);
    if (!sel || !isU1Valid(sel)) return [];
    return [{ selector: sel, count: countOf(sel), exact: true, why }];
  }

  // ── E. analyze — the entry point the panel calls in the page ───────────────
  // Returns { containerSel, tag, profile, fields: { key: [candidate, …] } }.
  // Candidate elements are stamped with data-u1-idx so a second MAIN-world pass
  // can attach real addEventListener data (see panel.js autoAnalyze).
  function analyze(type, containerSel) {
    let c;
    try { c = document.querySelector(containerSel); }
    catch (e) { return { error: e.message }; }
    if (!c) return { notFound: true };

    const rules = AUTO_RULES[type];
    const fields = {};
    if (rules) {
      for (const [field, fn] of Object.entries(rules)) {
        let list = [];
        try { list = fn(c, containerSel) || []; } catch (e) { list = []; }
        // Keep selector candidates only when U1 can actually use them; boolean
        // option candidates (`bool`) carry no selector and are always kept.
        list = list.filter(x => x && (typeof x.bool === 'boolean' || (x.selector && isU1Valid(x.selector))));
        if (list.length) fields[field] = list.slice(0, 3);
      }
    }

    // Stamp the elements we care about so the MAIN-world pass can look up their
    // real listeners. One element can appear under two fields, so each candidate
    // records the indices it owns rather than a range — a shared element keeps
    // the index it was first given.
    let idx = 0;
    const seen = new Map(); // element → index
    for (const list of Object.values(fields)) {
      for (const c2 of list) {
        if (!c2.selector) continue; // boolean option — nothing to stamp
        try {
          const els = Array.from(document.querySelectorAll(c2.selector)).slice(0, 20);
          c2.idxs = els.map(e => {
            if (seen.has(e)) return seen.get(e);
            const i = idx++;
            seen.set(e, i);
            e.setAttribute('data-u1-idx', String(i));
            return i;
          });
          c2.signals = els.slice(0, 5).map(e => clickSignals(e).signals.join(' '));
        } catch {}
      }
    }

    return {
      containerSel,
      tag: c.tagName.toLowerCase(),
      hasRules: !!rules,
      fields,
      stampCount: idx,
    };
  }

  // Remove the temporary stamps left by analyze().
  function clearStamps() {
    document.querySelectorAll('[data-u1-idx]').forEach(e => e.removeAttribute('data-u1-idx'));
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  F. Set-of-mark collection — the bridge between a screenshot and the DOM.
  //
  //  A vision model cannot be trusted to invent CSS selectors, and asking it to
  //  describe an element in prose leaves us guessing which node it meant. So we
  //  number every candidate, draw the SAME numbers onto the page before the
  //  screenshot, and send the numbered list alongside. The model then refers to
  //  element 7 and we look up 7 — no selector is ever invented by the model.
  // ───────────────────────────────────────────────────────────────────────────

  const MARK_ATTR = 'data-u1-mark';
  const MARK_LAYER = '__u1_mark_layer__';

  // Viewport size read off the document rather than the bare globals, so the
  // module works anywhere `document` does.
  const vw = () => (root.innerWidth || document.documentElement.clientWidth || 0);
  const vh = () => (root.innerHeight || document.documentElement.clientHeight || 0);

  function visibleInViewport(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return null;
    if (r.bottom < 0 || r.top > vh() || r.right < 0 || r.left > vw()) return null;
    try {
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) < 0.05) return null;
    } catch {}
    return r;
  }

  const accName = (el) => (
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    el.getAttribute('alt') ||
    (el.tagName === 'INPUT' ? (el.getAttribute('placeholder') || el.value || '') : '') ||
    (el.textContent || '')
  ).trim().replace(/\s+/g, ' ').slice(0, 60);

  // Elements worth showing the model: anything interactive, plus the structural
  // landmarks and media that carry the most common accessibility defects.
  const CANDIDATE_SEL = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'summary', 'label',
    '[role]', '[tabindex]', '[onclick]', '[contenteditable="true"]',
    'nav', 'form', 'table', 'dialog', 'iframe', 'video', 'audio',
    'img', 'svg[aria-label]', 'h1', 'h2', 'h3',
    '[class*="modal"]', '[class*="dropdown"]', '[class*="tab"]',
    '[class*="carousel"]', '[class*="slider"]', '[class*="accordion"]',
  ].join(',');

  function collectCandidates(limit) {
    clearMarks();
    const max = limit || 60;
    const seen = new Set();
    const out = [];

    for (const el of qsa(document, CANDIDATE_SEL)) {
      if (out.length >= max) break;
      if (seen.has(el)) continue;
      if (el.closest('#' + MARK_LAYER)) continue;   // never mark our own overlay
      const r = visibleInViewport(el);
      if (!r) continue;
      // Skip a wrapper whose only content is a single already-listed child —
      // it produces two marks pointing at visually identical boxes.
      if (el.childElementCount === 1 && seen.has(el.firstElementChild)) continue;
      seen.add(el);

      const mark = out.length + 1;
      el.setAttribute(MARK_ATTR, String(mark));
      const sel = robustSelector(el);
      const usable = isU1Valid(sel) ? sel : '';
      out.push({
        mark,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        name: accName(el),
        selector: usable,
        // How many elements this selector actually hits. >1 is fine for a field
        // meant to match many (menu items), and wrong for one meant to match a
        // single element — u1.fix.* decorates only one of them.
        matches: usable ? countOf(usable) : 0,
        // The facts a reviewer needs and a screenshot cannot show.
        alt: el.hasAttribute('alt') ? el.getAttribute('alt') : null,
        ariaLabel: el.getAttribute('aria-label') || '',
        ariaHidden: el.getAttribute('aria-hidden') || '',
        tabindex: el.getAttribute('tabindex'),
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
        labelled: !!(el.id && document.querySelector(`label[for="${el.id}"]`)) ||
                  !!el.closest('label') || !!el.getAttribute('aria-labelledby'),
        signals: clickSignals(el).signals,
        box: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      });
    }
    return {
      candidates: out,
      viewport: { w: vw(), h: vh() },
      title: document.title,
      url: (document.location && document.location.href) || '',
    };
  }

  // Draw the numbers onto the page so the screenshot and the list agree. One
  // fixed-position overlay, removed again before the user sees anything.
  function drawMarks() {
    clearOverlay();
    const layer = document.createElement('div');
    layer.id = MARK_LAYER;
    Object.assign(layer.style, {
      position: 'fixed', inset: '0', zIndex: '2147483646', pointerEvents: 'none',
    });
    document.querySelectorAll('[' + MARK_ATTR + ']').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px',
        width: r.width + 'px', height: r.height + 'px',
        outline: '2px solid #ff2d95', outlineOffset: '-1px', boxSizing: 'border-box',
      });
      const tag = document.createElement('div');
      tag.textContent = el.getAttribute(MARK_ATTR);
      Object.assign(tag.style, {
        position: 'fixed', left: Math.max(0, r.left) + 'px',
        top: Math.max(0, r.top - 14) + 'px',
        background: '#ff2d95', color: '#fff', font: 'bold 11px/1.2 monospace',
        padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap',
      });
      layer.appendChild(box);
      layer.appendChild(tag);
    });
    document.body.appendChild(layer);
    return document.querySelectorAll('[' + MARK_ATTR + ']').length;
  }

  const clearOverlay = () => { const l = document.getElementById(MARK_LAYER); if (l) l.remove(); };

  function clearMarks() {
    clearOverlay();
    document.querySelectorAll('[' + MARK_ATTR + ']').forEach(e => e.removeAttribute(MARK_ATTR));
    return true;
  }

  // Re-highlight a single mark on demand (clicking a finding in the panel).
  function showMark(mark) {
    clearOverlay();
    const el = document.querySelector(`[${MARK_ATTR}="${mark}"]`);
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const r = el.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.id = MARK_LAYER;
    Object.assign(layer.style, {
      position: 'fixed', left: r.left + 'px', top: r.top + 'px',
      width: r.width + 'px', height: r.height + 'px',
      outline: '3px solid #ff2d95', background: 'rgba(255,45,149,0.18)',
      zIndex: '2147483646', pointerEvents: 'none', boxSizing: 'border-box',
    });
    document.body.appendChild(layer);
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  G. extractComponent — what stage 2 of the AI flow reads.
  //
  //  The container's real markup, cleaned of everything that is noise to a
  //  mapping decision (scripts, styles, SVG path data, long text), plus an
  //  explicit list of which descendants actually have click handlers. The event
  //  list matters most: class names lie about what is a trigger, and the real
  //  handler data is something the model cannot get from the HTML alone.
  // ───────────────────────────────────────────────────────────────────────────
  function extractComponent(containerSel, maxChars) {
    let c;
    try { c = document.querySelector(containerSel); }
    catch (e) { return { error: e.message }; }
    if (!c) return { notFound: true };

    // Work on a copy so the live page is never touched.
    const clone = c.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,template').forEach(e => e.remove());
    clone.querySelectorAll('svg,canvas,picture source').forEach(e => {
      e.innerHTML = '';
      if (e.tagName.toLowerCase() === 'svg') e.setAttribute('data-stripped', 'svg');
    });
    // Collapse long text: the shape of the markup is what matters here.
    const walk = document.createTreeWalker(clone, 4 /* NodeFilter.SHOW_TEXT */);
    let t;
    while ((t = walk.nextNode())) {
      const v = t.nodeValue.replace(/\s+/g, ' ');
      t.nodeValue = v.length > 60 ? v.slice(0, 60) + '…' : v;
    }

    let html = clone.outerHTML;
    const limit = maxChars || 24000;
    const truncated = html.length > limit;
    if (truncated) html = html.slice(0, limit);

    // Real event data for the descendants, keyed by a selector the model can
    // reuse. Includes the MAIN-world recorder's verdict when it is installed.
    const rec = root.__u1EventMap || null;
    const interactive = [];
    const all = qsa(c, 'a,button,input,select,textarea,summary,[role],[tabindex],[onclick],[class*="trigger"],[class*="toggle"],li,[aria-haspopup],[aria-expanded],[aria-controls]');
    for (const el of all.slice(0, 80)) {
      const sig = clickSignals(el);
      const real = rec && rec.has(el) ? rec.types(el) : null;
      if (!sig.clickable && !real) continue;
      interactive.push({
        tag: el.tagName.toLowerCase(),
        classes: classesOf(el),
        role: el.getAttribute('role') || '',
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
        signals: sig.signals,
        realHandlers: real,                       // null = recorder not installed
        opensPanel: !!siblingPanel(el),
      });
    }

    return {
      containerSel,
      tag: c.tagName.toLowerCase(),
      html,
      truncated,
      interactive,
      recorderActive: !!rec,
    };
  }

  const api = {
    // pure
    selectorStrength, normalize, isU1Valid, U1_SELECTOR_RE, NOISE, VOLATILE_ID,
    // DOM
    robustSelector, commonSelectorFor, clickSignals, analyze, clearStamps, AUTO_RULES,
    // set-of-mark (AI review)
    collectCandidates, drawMarks, clearMarks, showMark, extractComponent,
  };

  root.__u1SelectorIntel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  void hasDom;
})(typeof globalThis !== 'undefined' ? globalThis : this);

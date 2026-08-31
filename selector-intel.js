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
//  never anchored on a generated id. See U1_COMPOUND_RE / VOLATILE_ID below.
// ─────────────────────────────────────────────────────────────────────────────
(function (root) {
  'use strict';

  // ── Shared vocabulary (kept identical to test-engine.js / panel.js) ────────

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

  // Utility / framework / state classes — present on thousands of elements and
  // liable to change, so never the basis of a mapping.
  // Names written onto the page by our own tooling. None may enter a mapping.
  //
  // Two different sources, and it is worth knowing which is which:
  //
  //   u1-anchor-<token>-<n>   OURS. The Studio stamps this on an element when a
  //                           skip link targets it by CSS selector rather than
  //                           by id — a skip link needs something to jump to.
  //                           Written at runtime by background.js on every page
  //                           load, and re-randomised each time the skip links
  //                           are saved (the token exists precisely so a stale
  //                           anchor from a previous run cannot be mistaken for
  //                           a current one).
  //   u1st-*                  The U1 library's own: u1st-tabbable-element,
  //                           u1st-avoid-change-detection.
  //
  // Neither is in the site's HTML. A mapping built on one depends on other
  // tooling having already run — and on a token that changes the next time
  // somebody edits a skip link. It resolves perfectly in a panel looking at a
  // page that has been through all of that, and is fragile or dead anywhere
  // else.
  //
  // The trap is that it LOOKS like the best answer available: an id, unique on
  // the page, short and stable-looking. `#u1-anchor-f9u36-1` outranked
  // `.click-nav` in every test compound() applies.
  const U1_GENERATED = /^u1(st)?-/i;

  const NOISE = /^(flex|grid|w-|h-|p-|m-|py-|px-|mt-|mb-|ml-|mr-|text-|bg-|border|rounded|shadow|container|row|col|d-|justify|align|items-|gap-|hidden|visible|relative|absolute|fixed|sticky|block|inline|float|clearfix|sr-only|active|focus|hover|open|show|sc-|ng-|css-|emotion-|jsx-|mui|u1st-|u1-)/i;

  // GENERATED ids (U1's own, Angular Material, framework uuids) — they change on
  // every reload, so a mapping built on one breaks silently.
  const VOLATILE_ID = /^(u1st-|u1-|cdk-|mat-(input|select|error|hint|option|autocomplete|dialog|tooltip|mdc)|ng-|ember\d|react-|:r[0-9a-z]+:)|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  // Which pseudo-classes may appear in a mapping.
  //
  // U1 resolves selectors through jQuery 3.7.1, so a great deal parses that
  // should not be relied on, and the grammar above accepts any `:name(...)`.
  // Two are worth allowing and the rest are not:
  //
  //   :nth-child / :nth-of-type  — standard CSS, and the ONLY way to name an
  //     element on a page whose markup carries no id, class or role. Without
  //     them such a page cannot be mapped at all.
  //   :not                       — standard, and U1 itself generates it
  //     (`activeDays: day:not(disabled)` in the datepicker fixer).
  //
  // Everything else is refused on purpose. `:eq()` and `:contains()` are jQuery
  // extensions that would work today and break the moment anything resolves the
  // selector with querySelectorAll — including U1's own future. `:has()` is
  // standard but not in every browser a client still supports. A selector that
  // works in the panel and fails in the field is the worst outcome available.
  const PSEUDO_OK = /^:(?:not|nth-child|nth-of-type|nth-last-child|nth-last-of-type|first-child|last-child|only-child)\b/;
  const pseudosOk = (compound) => {
    const found = compound.match(/::?[\w-]+(?:\([^()]*\))?/g);
    return !found || found.every(p => PSEUDO_OK.test(p));
  };

  const normalize = (s) => String(s == null ? '' : s).trim().replace(/\s*([>+~,])\s*/g, '$1');
  const isU1Valid = (s) => {
    const n = normalize(s);
    if (n === '') return true;
    return n.split(',').every(group =>
      group !== '' && group.split(/[>+~]/).every(c =>
        c !== '' && U1_COMPOUND_RE.test(c) && pseudosOk(c)));
  };
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
  // Graded in CSS specificity order — id, then class/attribute, then element —
  // but this is a meter of DURABILITY, not of which rule wins the cascade. Two
  // selectors of identical specificity are not equally dependable: [id="x"] and
  // [aria-label="Submit"] both score (0,1,0), and only one of them survives the
  // page being translated. Where the two disagree, durability decides.
  function gradeSegment(seg) {
    // Specificity 0 — contributes nothing at all, matches everything.
    if (/^\*$/.test(seg)) return 'weak';
    // (1,0,0) — an id, the strongest ordinary selector there is.
    if (/^#[\w-]+$/.test(seg)) return 'strong';
    // (0,1,0) by specificity, but these are identifiers a developer chose so the
    // element could be addressed, so they are as dependable as an id.
    if (/\[(data-testid|data-test|data-cy|data-qa|id|name)\s*[=~|^$*]?=?/.test(seg)) return 'strong';
    // Also (0,1,0), and this is where specificity and durability part company.
    // aria-label is USER-FACING TEXT, not an identifier. It gets translated, a
    // copywriter rewrites it, and on a multilingual site the same button reads
    // differently per locale — so a mapping anchored on it breaks without any
    // developer touching the markup. It is usable, not dependable.
    if (/\[aria-label\s*[=~|^$*]?=?/.test(seg)) return 'medium';
    // A role says what KIND of thing it is, not which one. Rarely unique.
    if (/\[role\s*[=~|^$*]?=?/.test(seg)) return 'weak';
    if (/\[[^\]]+\]/.test(seg)) return 'medium';   // (0,1,0) attribute
    if (/\.[\w-]+/.test(seg)) return 'medium';     // (0,1,0) class
    return 'weak';                                 // (0,0,1) bare tag
  }

  function selectorStrength(sel, opts) {
    opts = opts || {};
    const raw = String(sel == null ? '' : sel);
    const norm = normalize(raw);
    const reasons = [];
    if (/\[aria-label\s*[=~|^$*]?=?/.test(norm)) {
      reasons.push('Built on aria-label — that is text for the user, so it changes when the wording or the language changes.');
    }
    if (/\[role\s*[=~|^$*]?=?/.test(norm)) {
      reasons.push('Built on role — that says what kind of element it is, not which one.');
    }
    // A combinator joins segments; it adds no weight of its own. Worth saying,
    // because a long chain reads as precision and is not.
    if (/\*/.test(norm)) {
      reasons.push('Contains * — the universal selector matches anything and adds no weight.');
    }

    if (!norm) return { level: 'empty', label: '', reasons: [] };

    if (!isU1Valid(norm)) {
      return {
        level: 'invalid', label: 'Invalid',
        reasons: ['U1 only supports > + ~ combinators and :not / :nth-child — no spaces, no descendant combinator, no :eq or :has.'],
      };
    }

    // Position is a real answer on a page whose markup names nothing, and it is
    // the weakest one there is: it depends on the element's neighbours rather
    // than on anything about the element. One extra <div> above it and the
    // mapping quietly points somewhere else — no error, no warning.
    const positional = /:nth-(child|of-type|last-child|last-of-type)\b|:(first|last|only)-child\b/.test(norm);
    if (positional) {
      reasons.push('Counts position among siblings — adding an element above it silently repoints the mapping. Ask for a class or an id on this element if you can get one.');
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

    // Whatever anchors it, a selector that counts siblings is weak. An id at the
    // front makes it survive a re-render of the rest of the page; it does not
    // make it survive a sibling being inserted, which is the failure that
    // matters here.
    if (positional) level = 'weak';

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

  // A class emitted by a build tool rather than written by a person.
  //
  // NOISE catches the prefixes we know, but a hashed name has no prefix to
  // match: `.a7Fk2p` looks like an ordinary class and changes on the next
  // deploy, so a mapping built on it works today and breaks silently at the
  // next release. Judge the SHAPE — and be conservative, because throwing away
  // a real class (`col2`, `h1`) costs more than keeping a doubtful one.
  const looksGenerated = (c) =>
    // Known CSS-in-JS emitters.
    /^(css|sc|jsx|emotion|styled|chakra|mui)-/i.test(c)
    // mixedCase together with digits. Hand-written classes are kebab or snake
    // case, so the three together is essentially only ever a hash: a7Fk2p.
    || (/[a-z]/.test(c) && /[A-Z]/.test(c) && /\d/.test(c))
    // A hash suffix bolted onto a real name: btn_1a2b3, card-9f8e7d.
    || /[-_][0-9][a-z0-9]{3,}$/i.test(c)
    // All hash: ab1c2d3e4f.
    || /^[a-z]{0,3}[0-9a-f]{6,}$/i.test(c);

  function compound(node) {
    if (!node || node.nodeType !== 1) return '';
    // Only an id that is actually unique. Real pages duplicate ids — molina's
    // homepage carries #state-select-modal, #MedicareAlert and
    // #siteLeavingAlert TWICE each (a desktop and a mobile copy) — and U1
    // resolves selectors through jQuery, where a duplicated #id matches only
    // the first copy. A selector built on one can therefore never reach the
    // second element, and pointed at the first it may be decorating the copy
    // that is display:none at this breakpoint.
    if (node.id && idOk(node.id) && countOf('#' + node.id) === 1) return '#' + node.id;
    const testId = node.getAttribute('data-testid') || node.getAttribute('data-test');
    if (testId) return `[data-testid="${testId}"]`;
    const tag = node.tagName.toLowerCase();

    // Classes a person named, generated ones only if that is genuinely all
    // there is — a bad selector still beats no selector.
    const named = classesOf(node).filter(c => !NOISE.test(c));
    const handWritten = named.filter(c => !looksGenerated(c));
    const classes = handWritten.length ? handWritten : named;

    // A hand-written class that is unique on the page wins over EVERYTHING
    // below, aria-label included. `div[aria-label="Search modes"]` and
    // `.finder__tabs` pointed at the same tab strip, and the first is worse in
    // three ways: it breaks when the label is translated or reworded, it says
    // nothing to the person reading the mapping, and it made the sub-selectors
    // come back wrong — the same element, described by its label, produced a
    // tabList with no tabPanel beside it.
    //
    // Only a HAND-WRITTEN class, and only a unique one. A build-generated hash
    // is worse than a description, and so is a class shared by forty elements.
    for (const c of handWritten) {
      try { if (document.getElementsByClassName(c).length === 1) return '.' + c; } catch {}
    }

    const al = node.getAttribute('aria-label');
    if (al && al.length < 40 && !al.includes('"')) return `${tag}[aria-label="${al}"]`;
    const nm = node.getAttribute('name');
    if (nm && !nm.includes('"')) return `${tag}[name="${nm}"]`;

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
    // No '#'-shortcut past the uniqueness check anywhere here: compound only
    // emits an #id when it verified the id is unique, so the checks below are
    // redundant for ids — but keeping them uniform means nothing can slip a
    // duplicated id through a path that assumed ids never duplicate.
    let c = compound(node);
    if (uniqueOnPage(c)) return c;
    let chain = c, cur = node.parentElement, guard = 0;
    while (cur && cur !== document.body && guard++ < 6) {
      const pc = compound(cur);
      chain = pc + '>' + chain;
      if (uniqueOnPage(chain)) return chain;
      cur = cur.parentElement;
    }
    if (uniqueOnPage(chain)) return chain;
    // Nothing on this element or its ancestors identifies it. That is the
    // ordinary shape of a widget hand-rolled from bare <div>s, and everything
    // above has just produced something like "div>div>div" — syntactically fine
    // and matching four hundred elements, which is worse than useless because
    // it looks like an answer.
    //
    // Position is the only thing left to say about such an element, and it CAN
    // be said: U1 resolves selectors through jQuery, so :nth-child is available.
    // It is a genuinely weaker selector — inserting an element above it silently
    // repoints the mapping — so it is a last resort, and selectorStrength grades
    // it accordingly.
    return positionalSelector(node) || c;
  }

  /**
   * `<nearest identifiable ancestor>>tag:nth-child(n)`, or '' if even that
   * cannot be made unique.
   *
   * Anchored on the closest ancestor that has an identity of its own, so the
   * chain stays short: every extra `>` in it is another element whose position
   * has to stay put for the mapping to keep working.
   */
  function positionalSelector(node) {
    const step = (el) => {
      const parent = el.parentElement;
      if (!parent) return '';
      const n = Array.prototype.indexOf.call(parent.children, el) + 1;
      return n > 0 ? `${el.tagName.toLowerCase()}:nth-child(${n})` : '';
    };
    let chain = '';
    let el = node;
    for (let depth = 0; el && el !== document.documentElement && depth < 8; depth++) {
      const s = step(el);
      if (!s) return '';
      chain = chain ? s + '>' + chain : s;
      const parent = el.parentElement;
      if (!parent || parent === document.body) break;
      const anchor = compound(parent);
      // An ancestor that identifies itself ends the walk — anchoring there is
      // both shorter and steadier than counting all the way to <body>.
      if (uniqueOnPage(anchor)) {
        const full = anchor + '>' + chain;
        return uniqueOnPage(full) ? full : '';
      }
      el = parent;
    }
    return uniqueOnPage(chain) ? chain : '';
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

  // ── Open shadow roots ──────────────────────────────────────────────────────
  //
  // querySelectorAll does not cross a shadow boundary. A component inside one is
  // not hidden, not off-screen and not filtered out — it is simply not in the
  // answer, and every count, every drawn number and every selector behaves as
  // though that part of the page did not exist. Nothing said so, because from
  // the outside "there is nothing there" and "I cannot see in there" produce
  // identical output.
  //
  // Only OPEN roots. A closed one has no `shadowRoot` to read by design, and
  // there is no honest way around that — so it is reported rather than worked
  // around, below.
  //
  // Depth-limited: shadow roots nest, and a component library can nest them
  // several deep, but an unbounded walk over a page that puts a root on every
  // list item is a way to hang the panel on somebody's design system.
  const SHADOW_DEPTH = 6;

  /** Every open shadow root under `node`, outermost first. */
  function shadowRoots(node, depth) {
    if ((depth || 0) >= SHADOW_DEPTH) return [];
    const found = [];
    let hosts;
    try { hosts = Array.from((node.querySelectorAll ? node : document).querySelectorAll('*')); }
    catch { return []; }
    for (const el of hosts) {
      const sr = el.shadowRoot;          // null for closed roots, and for most elements
      if (!sr) continue;
      found.push(sr);
      found.push(...shadowRoots(sr, (depth || 0) + 1));
    }
    return found;
  }

  /**
   * querySelectorAll, but it also looks inside open shadow roots.
   *
   * Same signature and same return type as qsa, so it is a drop-in at the one
   * place that needs it — the candidate sweep. Everything else keeps the plain
   * one deliberately: a fixer measuring the shape of a component it already has
   * should stay inside that component.
   */
  function qsaDeep(root, sel) {
    const out = qsa(root, sel);
    const roots = shadowRoots(root, 0);
    if (!roots.length) return out;
    const seen = new Set(out);
    for (const sr of roots) {
      for (const el of qsa(sr, sel)) if (!seen.has(el)) { seen.add(el); out.push(el); }
    }
    return out;
  }

  /**
   * The chain of hosts you would have to go through to reach this element.
   *
   * "It is in a shadow root" is not actionable on its own; "it is inside
   * <my-header> → <nav-menu>" is something a developer can go and look at, and
   * it is the only thing we can honestly offer about an element no selector of
   * ours will ever reach.
   */
  function shadowHostPath(el) {
    const hops = [];
    let node = el;
    for (let i = 0; i < SHADOW_DEPTH + 1; i++) {
      const rootNode = node.getRootNode && node.getRootNode();
      if (!rootNode || rootNode === document || !rootNode.host) break;
      hops.unshift(rootNode.host.tagName.toLowerCase());
      node = rootNode.host;
    }
    return hops.join(' → ');
  }

  /** Open roots found, and hosts whose root is closed and cannot be read. */
  function shadowReport() {
    let closed = 0;
    try {
      for (const el of document.querySelectorAll('*')) {
        // A custom element with no open root is the usual shape of a closed one.
        // Not proof — plenty of custom elements have no shadow at all — so this
        // is worded as "may be" wherever it is shown.
        if (!el.shadowRoot && el.tagName.includes('-')) closed++;
      }
    } catch {}
    return { open: shadowRoots(document, 0).length, closedHosts: closed };
  }

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
  // Separate from the numbered layer on purpose — see showMark.
  const HILITE_LAYER = '__u1_mark_hilite__';

  // Viewport size read off the document rather than the bare globals, so the
  // module works anywhere `document` does.
  const vw = () => (root.innerWidth || document.documentElement.clientWidth || 0);
  const vh = () => (root.innerHeight || document.documentElement.clientHeight || 0);

  // Returns the rect, and reports whether the element travels with the viewport.
  // A page-wide scan visits the same sticky header at every scroll position, so
  // the caller has to be able to tell "I have already seen this" apart from
  // "this is a new element that happens to sit in the same place".
  let lastWasSticky = false;

  // Stickiness is almost never on the element being asked about. A designer pins
  // the HEADER; the nav, the links and the buttons inside it stay static and
  // ride along. Testing only the element itself therefore reported an entire
  // sticky header as ordinary content — and a page-wide scan counted all
  // twenty-seven of its elements again at every scroll position. On one real
  // page that was 405 of 706 counted elements: the same header, fifteen times.
  //
  // The question is "does anything above this pin it". Answers are cached per
  // element because getComputedStyle forces layout, and without the cache a
  // sixty-candidate screenful would ask it several hundred times.
  //
  // The cache is thrown away at the start of every collection, and that is not
  // an optimisation detail: a header that is static at the top of the page and
  // becomes fixed once you scroll is an extremely common pattern, so an answer
  // from the previous screenful is exactly the wrong one to reuse.
  let pinnedCache = new WeakMap();
  const resetPinned = () => { pinnedCache = new WeakMap(); };
  function travelsWithViewport(el) {
    const chain = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const known = pinnedCache.get(node);
      if (known !== undefined) {
        for (const n of chain) pinnedCache.set(n, known);
        return known;
      }
      let pos = '';
      try { pos = getComputedStyle(node).position; } catch { /* detached mid-walk */ }
      if (pos === 'fixed' || pos === 'sticky') {
        pinnedCache.set(node, true);
        for (const n of chain) pinnedCache.set(n, true);
        return true;
      }
      chain.push(node);
      node = node.parentElement;
    }
    for (const n of chain) pinnedCache.set(n, false);
    return false;
  }

  function visibleInViewport(el) {
    lastWasSticky = false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return null;
    if (r.bottom < 0 || r.top > vh() || r.right < 0 || r.left > vw()) return null;
    try {
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) < 0.05) return null;
      lastWasSticky = travelsWithViewport(el);
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

  /**
   * Which u1 component this element ANNOUNCES ITSELF as, if any.
   *
   * Grouping loose elements into components — "seven links and six drop-downs
   * are one menu" — is the model's job and is what a scan is paid for. But a
   * great deal of it needs no judgement at all, because the page already says
   * so: role="tablist" IS a tab strip, <form> IS a form, <nav> IS navigation.
   * Reading those here is free and instant, and it is the difference between a
   * survey that says "22 links, 19 buttons" and one that says "a nav, a
   * carousel and a tab strip" — which is what you actually choose screens by.
   *
   * A class-name match is a weaker signal than a role and is marked as such by
   * the caller: `.tab-content` matches /tab/ and is not a tab strip. This
   * proposes; the scan confirms.
   */
  // `tablist` says MENU, and that is a decision rather than a mistake. A tab
  // strip and a nav bar with drop-downs are the same shape by every test either
  // layer applies — several sibling controls, pressing one swaps what is shown —
  // and the tool was already half-agreeing: the class list checks "nav" before
  // it checks "tabs", so `class="nav nav-tabs"`, the commonest tab markup on the
  // web, has always come back as a menu. The separation existed on paper.
  //
  // The `tabs` TYPE still exists in the builder and still has its own engine.
  // This is what detection SUGGESTS, which is a different question from what a
  // specialist chooses to build.
  const COMPONENT_BY_ROLE = {
    tablist: 'menu', menu: 'menu', menubar: 'menu', navigation: 'menu',
    dialog: 'dialog', alertdialog: 'dialog', listbox: 'listbox',
    combobox: 'combobox', grid: 'grid', table: 'table', tree: 'menu',
    // `radio`, not "radio group". The builder's type is called `radio`, so the
    // longer name matched no type at all and the label led nowhere — one of the
    // four names the reader could produce that nothing could build.
    radiogroup: 'radio', toolbar: 'toolbar', search: 'form',
    // A tooltip that says so is a tooltip — the role was simply never listed,
    // so a hidden [role=tooltip] rode in on the edges and then had no name.
    tooltip: 'tooltip',
    // Parts, not components. `checkbox` and `radio` are named here explicitly
    // rather than left to fall through: without them a `<div role="checkbox">`
    // carrying a class like "switch-nav" was read by the class rules instead,
    // and a checkbox came back as a menu. `switch` is the same trap with the
    // same fix — a role=switch wearing class "switch-nav" is a checkbox
    // subtype, never a menu.
    tabpanel: '', tab: '', option: '', menuitem: '', checkbox: '', radio: '',
    switch: '',
  };
  // A control TAG is a part, not a component. button.menu-toggle is a button
  // that opens a menu somewhere; calling the BUTTON the menu flags the wrong
  // element and double-counts the right one. For these tags only a role may
  // speak — no class rule, no shape rule. (The two lone audit buttons wearing
  // menu-toggle / open-modal classes are the pinned proof.)
  const PART_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'SUMMARY', 'LABEL']);
  const COMPONENT_BY_TAG = {
    nav: 'menu', form: 'form', table: 'table', dialog: 'dialog',
    video: 'media player', audio: 'media player',
  };
  // Ordered: the first match wins, so "carousel" beats the "slider" inside it.
  //
  // These are the names people actually give things. A screenful that held a
  // recognisable widget and showed no box at all was usually one whose author
  // wrote `class="site-nav"` rather than `<nav>` — common enough that leaving it
  // out made the survey look broken rather than conservative.
  const COMPONENT_BY_CLASS = [
    // `ticker`, `marquee` and an announcement rail are the same component under
    // another name: a strip of items, one shown at a time, with previous and
    // next. STEP's `.ticker` carries an aria-live region and two arrow buttons
    // and was invisible here, so its parts arrived as six separate links and
    // two unexplained buttons.
    [/carousel|slideshow|gallery|\bslider\b|\bticker\b|marquee/i, 'carousel'],
    [/accordion|collapsible|\bfaq\b/i, 'accordion'],
    [/datepicker|calendar/i, 'datepicker'],
    [/\bmodal\b|lightbox|drawer|offcanvas|off-canvas/i, 'dialog'],
    [/dropdown|megamenu|mega-nav|navbar|navigation|\bnav\b|\bmenu\b/i, 'menu'],
    [/\btabs\b|tab-bar|tabbar|tablist/i, 'menu'],
    [/pagination|pager/i, 'pagination'],
    [/tooltip|popover/i, 'tooltip'],
    [/breadcrumb/i, 'breadcrumb'],

    // ── Library fingerprints ────────────────────────────────────────────────
    //
    // Everything above is a word a human chose. These are strings a FRAMEWORK
    // emitted, and they are worth having for the opposite reason: nobody types
    // `react-datepicker__input-container`, so when it appears it is not a
    // coincidence and not a false friend. A hand-written `class="calendar"` is
    // a guess about intent; `mat-datepicker` is a fact about what was rendered.
    //
    // Added AFTER the generic patterns on purpose — a site that says "carousel"
    // in its own words should be read in its own words first. These only decide
    // the cases the words above leave undecided.
    //
    // Kept to fingerprints that name a COMPONENT. The generic build artefacts
    // from the same libraries — `_ngcontent-`, `ng-star-inserted`, `sc-` and
    // the rest — are deliberately not here: they appear on every element a
    // framework renders, so they identify the framework and say nothing at all
    // about what any individual element is.
    [/react-datepicker|mat-datepicker|\bdatepicker__|-datepicker\b/i, 'datepicker'],
    [/mat-autocomplete|downshift|react-select|select2|choices__/i, 'combobox'],
    [/mat-tab\b|mat-tab-|data-reach-tab|react-tabs__/i, 'menu'],
    [/mat-expansion|MuiAccordion|chakra-accordion/i, 'accordion'],
    [/mat-menu|MuiMenu|headlessui-menu/i, 'menu'],
    [/mat-dialog|MuiDialog|headlessui-dialog|ReactModal/i, 'dialog'],
    [/swiper|slick-slider|glide__|embla/i, 'carousel'],

    // NOTE for anything added below: these run in order, and the generic
    // vocabulary above wins. `downshift-1-menu` contains the word "menu" and is
    // read as a menu, which for a combobox's popup list is a fair answer — the
    // fingerprints are here to name what the words leave unnamed, not to
    // overrule them.

    // `search` is deliberately absent. It matched NINETEEN elements on one page
    // — the overlay, the panel, the field, the button and every suggestion chip
    // — and a search box is usually just an input anyway. A combobox needs a
    // popup list of suggestions, which a class name cannot tell you and a
    // behavioural probe can.
  ];

  // Fingerprints a library writes as an ATTRIBUTE NAME, with no value and often
  // no class beside it. Matched against attribute names only.
  //
  // Deliberately short. `data-radix-*-trigger` and `data-headlessui-state` are
  // the obvious next entries and both are wrong: Radix and Headless UI put the
  // same attribute on dropdowns, dialogs, tooltips and popovers alike, so it
  // identifies the LIBRARY and not the component — exactly the mistake that
  // keeps `_ngcontent-` and `sc-` out of the class list above. An attribute
  // earns a place here only when it names one kind of thing.
  const COMPONENT_BY_ATTR = [
    [/^data-reach-tab-list$|^data-reach-tabs$/i, 'menu'],
  ];

  const FIELD = 'input:not([type="hidden"]),select,textarea';

  // What a page draws between the steps of a trail. Kept to characters that
  // mean "and then" — a comma or a bullet separates a LIST, which a row of tags
  // or a byline is, and neither is a breadcrumb.
  const SEPARATOR_RE = /^[\s>/\\|›»«‹→⟩›»\-–—]+$/;

  /**
   * A "you are here" trail, recognised by shape rather than by name.
   *
   * Two conditions, and BOTH are required:
   *   1. something separates each pair of links
   *   2. the text is smaller than the page's own body text
   *
   * Either alone matches far too much. Small text is everywhere, and a single
   * "·" between two links is how a byline is written. Together they are close
   * to specific: a short chain of links, in small type, with arrows in it.
   *
   * Cheap-first, because this runs on every collected element: the link count
   * and the length gate are free, the separator scan is one shallow pass, and
   * the computed style — the only expensive call — happens last and only for
   * the handful of elements that got that far.
   */
  function looksLikeBreadcrumb(el) {
    try {
      var links = el.querySelectorAll('a[href]');
      // Two is a real trail (Home › Shoes). More than eight is a nav, not a
      // trail — nobody is nine levels deep and rendering all of it.
      if (links.length < 2 || links.length > 8) return false;

      // The links must be the element's own content, not something it happens
      // to contain. Without this every wrapper up to <body> holds a trail.
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 160) return false;

      // A separator between the links: either an element whose entire text is
      // one, or the text left over between two links once the links themselves
      // are removed.
      var separated = false;
      for (var i = 0; i < el.children.length && !separated; i++) {
        var kid = el.children[i];
        if (kid.children.length || kid.matches('a,button')) continue;
        var t = (kid.textContent || '').trim();
        if (t && SEPARATOR_RE.test(t)) separated = true;
      }
      if (!separated) {
        // The bare-text case: <a>Home</a> / <a>Shoes</a>, with the slash as a
        // text node rather than an element of its own.
        var between = text;
        for (var j = 0; j < links.length; j++) {
          between = between.replace((links[j].textContent || '').trim(), ' ');
        }
        var gaps = between.split(' ').filter(function (g) { return g.trim(); });
        separated = gaps.length >= 1 && gaps.every(function (g) { return SEPARATOR_RE.test(g); });
      }
      if (!separated) return false;

      // …and smaller than the page's body text. Read last, because this is the
      // only call here that costs anything.
      var size = parseFloat((getComputedStyle(el) || {}).fontSize) || 0;
      var base = parseFloat((getComputedStyle(document.body) || {}).fontSize) || 16;
      return !!size && size < base;
    } catch (e) { return false; }
  }

  // Where a thing SITS, which detection had no notion of until now: it asked
  // only what an element was CALLED. Both of these are structural first —
  // jsdom has no layout, and neither does a page still painting — with the
  // geometric answer as a fallback rather than the basis.
  const HEADERISH = /(^|[^a-z])(header|masthead|topbar|top-bar)([^a-z]|$)/i;
  const FOOTERISH = /(^|[^a-z])(footer|colophon|site-info)([^a-z]|$)/i;

  function inRegion(el, tag, role, re) {
    for (var p = el; p; p = p.parentElement) {
      if (p.tagName === tag) return true;
      var r = (p.getAttribute && p.getAttribute('role') || '').toLowerCase();
      if (r === role) return true;
      if (re.test(typeof p.className === 'string' ? p.className : '')) return true;
    }
    return false;
  }

  /**
   * The bar across the top of the page.
   *
   * Structural only — a <header>, role="banner", or a name that says so. A
   * geometric test was written first and taken back out: "within 200px of the
   * top of the document" is true of a footer on a short page, and it would have
   * rescued exactly the elements the footer rule below exists to demote. A top
   * bar that says nothing in its tag, its role OR its class is rare enough not
   * to be worth a rule that fires on the wrong thing.
   */
  function inPageHeader(el) {
    try { return inRegion(el, 'HEADER', 'banner', HEADERISH); } catch (e) { return false; }
  }

  function inPageFooter(el) {
    try { return inRegion(el, 'FOOTER', 'contentinfo', FOOTERISH); } catch (e) { return false; }
  }

  /** Would anything below have called this a menu? Asked before location. */
  function menuish(el) {
    try {
      var role = (el.getAttribute('role') || '').toLowerCase();
      if (role === 'menu' || role === 'menubar' || role === 'navigation' || role === 'tablist') return true;
      if (el.tagName === 'NAV') return true;
      var cls = typeof el.className === 'string' ? el.className : '';
      if (!cls) return false;
      for (var i = 0; i < COMPONENT_BY_CLASS.length; i++) {
        var rule = COMPONENT_BY_CLASS[i];
        if (rule[0].test(cls) || rule[0].test(classWords(cls))) return rule[1] === 'menu';
      }
      return false;
    } catch (e) { return false; }
  }

  /**
   * A table used for LAYOUT, which is not a table at all.
   *
   * On an old site this is most of them: `<table>` as a positioning tool, with
   * a logo in one cell, the nav in another and the sidebar in a third. Mapping
   * one as a data table tells a screen reader there is a grid of records here
   * and invites its user to read across rows that mean nothing — worse than
   * leaving it alone, and the rules have said so all along. They said it only
   * to the model: the code named every `<table>` a table, and named it SURE, so
   * a page with forty layout tables produced forty rows to dismiss one by one.
   *
   * Deliberately conservative. Everything here is a reason to say NO — anything
   * that cannot be ruled out stays a table, because a real data table that is
   * skipped is a defect nobody is told about, while a layout table that slips
   * through is one row somebody deletes.
   */
  function looksLikeLayoutTable(el) {
    try {
      var rows = el.querySelectorAll('tr');
      // One row, or one column, is a strip. Nothing to read across or down.
      if (rows.length < 2) return true;

      var counts = [];
      for (var i = 0; i < rows.length; i++) {
        counts.push(rows[i].querySelectorAll('td,th').length);
      }
      var max = Math.max.apply(null, counts);
      if (max < 2) return true;

      // A cell holding a whole other part of the page. A data cell holds a
      // value; a layout cell holds the navigation.
      if (el.querySelector('table,nav,form,header,footer,aside')) return true;

      // Rows that do not agree how many cells they have are a layout, or a
      // table so broken that mapping it would be guesswork either way. One
      // ragged row is ordinary (a colspan footer); half of them is not.
      var ragged = counts.filter(function (n) { return n !== max; }).length;
      if (ragged > counts.length / 2) return true;

      return false;
    } catch (e) { return false; }
  }

  /**
   * A month of days, recognised by its shape rather than by its name.
   *
   * A datepicker was found by the words "datepicker" or "calendar" and by
   * nothing else, which leaves two whole cases unfound: one written in a
   * framework nobody named, and one that sits IN the page rather than opening
   * from a field — an inline calendar has no trigger to press and no popup to
   * watch, so neither the reader nor the behavioural layer had anything to go
   * on.
   *
   * A month is unmistakable when counted: twenty-eight to thirty-one boxes
   * whose entire text is a number between 1 and 31, sharing one parent, with
   * the numbers running up. Nothing else on a page looks like that — a
   * pagination strip is a dozen at most, and a price list does not start at 1
   * and climb by one.
   */
  function looksLikeCalendar(el) {
    try {
      var kids = el.querySelectorAll('td,th,li,button,span,div,a');
      var byParent = new Map();
      for (var i = 0; i < kids.length; i++) {
        var t = (kids[i].textContent || '').trim();
        if (!/^([1-9]|[12][0-9]|3[01])$/.test(t)) continue;
        var p = kids[i].parentElement;
        if (!p) continue;
        // The days of a month are usually a row of a table or a cell of a grid,
        // so climb one level when the parent is plainly a row wrapper.
        var key = /^(TR|LI)$/.test(p.tagName) && p.parentElement ? p.parentElement : p;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key).push(Number(t));
      }
      var hit = false;
      byParent.forEach(function (nums) {
        if (hit || nums.length < 28 || nums.length > 62) return;   // 62: two months shown
        // Running upwards, allowing the leading and trailing days of the
        // neighbouring months that every calendar shows.
        var rising = 0;
        for (var j = 1; j < nums.length; j++) if (nums[j] === nums[j - 1] + 1) rising++;
        if (rising >= nums.length * 0.7) hit = true;
      });
      return hit;
    } catch (e) { return false; }
  }

  /**
   * Did WE write on this element? The three injection markers are the tell.
   * Detection must never read the panel's own output back as the site's —
   * that loop manufactured "fixes the site runs" out of a specialist's own
   * experiments. Same three names authoredRoleConflict already trusts.
   */
  function isOurs(el) {
    try {
      return el.hasAttribute('u1st-avoid-change-detection') ||
             el.hasAttribute('data-u1-revert') ||
             el.hasAttribute('u1st-trigger-element');
    } catch (e) { return false; }
  }

  /**
   * The two carousel words that lie, and only those two — see the call site.
   * `evidence` = something that can actually cycle: arrows, a library
   * fingerprint, or a [hidden] slide waiting its turn. [hidden] only:
   * aria-hidden="true" is how decorative spans leave the accessibility tree
   * while staying fully visible, and a static grid of decorated cells is
   * exactly not a carousel.
   */
  function carouselClassVeto(el, cls) {
    try {
      const strong = /carousel|slideshow|\bticker\b|marquee|swiper|slick|glide__|embla/i.test(cls);
      if (strong) return false;
      if (/\bslider\b/i.test(cls) && el.querySelector('input[type="range"]')) return true;
      if (/gallery/i.test(cls)) {
        const btns = el.querySelectorAll('button,[role="button"],a[href]');
        for (const b of btns) {
          const face = (b.getAttribute('aria-label') || '') + ' ' + String(b.className || '') + ' ' + (b.textContent || '');
          if (/prev|next|back|forward|◄|►|‹|›|«|»|←|→|הקודם|הבא/i.test(face)) return false;
        }
        if (el.querySelector('[hidden]')) return false;
        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  function componentHint(el) {
    // A menu is a menu by WHERE IT SITS, not only by what it is called — the
    // rule agreed for this component. Five columns of links in the footer are
    // ordinary links: they are already links, already in the tab order, and a
    // menu mapping on them adds arrow-key navigation nobody is looking for and
    // a role that says this is the site's navigation when it is not.
    //
    // Demoted rather than renamed: what a footer nav IS depends on where its
    // links go, and that is the link/button rule's question, not this one's.
    // Answering `menu` here was the only wrong answer available.
    //
    // The footer is the one place this fires. A menu in the header, a menu a
    // hamburger opens and a vertical side menu are all menus, and between them
    // that is everywhere else a menu is found.
    if (menuish(el) && inPageFooter(el) && !inPageHeader(el)) return null;

    // Roles WE injected are not the site's testimony. A scan between apply
    // and delete used to read the panel's own handwriting back as the page's
    // — "aria-controls already wired to it" on markup that carries nothing.
    const ours = isOurs(el);

    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role && !ours && Object.prototype.hasOwnProperty.call(COMPONENT_BY_ROLE, role)) {
      return COMPONENT_BY_ROLE[role] ? { name: COMPONENT_BY_ROLE[role], sure: true } : null;
    }
    // The author said it out loud: role=presentation/none means "not a
    // component", and it outranks every shape test below — a 3×3 layout table
    // wearing the role was still being called a table.
    if (role === 'presentation' || role === 'none') return null;
    if (PART_TAGS.has(el.tagName)) return null;
    // Ahead of the tag rule, and only for this one case.
    //
    // A breadcrumb is written `<nav aria-label="Breadcrumb">` — that IS the
    // recommended markup — and `<nav>` means menu, decided and sure, before any
    // class or label is read. So the one trail on the page that followed the
    // pattern exactly was the one certain to be misnamed. Measured: a
    // `<nav class="breadcrumb">` came back as `menu`.
    //
    // Kept to unambiguous evidence. "crumb" appears in no other component's
    // vocabulary, so there is nothing for this to steal.
    if (/crumb/i.test(el.className || '') ||
        /crumb/i.test(el.getAttribute('aria-label') || '')) {
      return { name: 'breadcrumb', sure: true };
    }

    // Ahead of the table rule and ahead of the class words: a calendar is very
    // often a <table>, and answering "table" for a month of days is a mapping
    // that decorates a grid of records nobody is reading.
    if (looksLikeCalendar(el)) return { name: 'datepicker', sure: true };

    if (el.tagName === 'TABLE') {
      if (looksLikeLayoutTable(el)) return null;
      // A data table with no header cells anywhere is still a data table, and
      // the missing headers are the defect worth reporting rather than a reason
      // to skip it. Marked as a guess, because "rows and columns of values with
      // nothing naming them" is the one shape a layout table can still wear.
      var headed = false;
      try { headed = !!el.querySelector('th'); } catch (e) {}
      return { name: 'table', sure: headed };
    }

    const tag = el.tagName.toLowerCase();
    if (COMPONENT_BY_TAG[tag]) return { name: COMPONENT_BY_TAG[tag], sure: true };

    // A strip of role="tab" with no role="tablist" around it. Extremely common —
    // a developer labels the tabs and forgets the container — and it used to
    // report "6 tabs" in the element count while the component line said there
    // was nothing here. The parts were seen; the thing they add up to was not.
    try {
      if (el.querySelectorAll(':scope > [role="tab"]').length >= 2) {
        return { name: 'menu', sure: true };
      }
    } catch (e) { /* :scope is old enough to rely on, but never worth throwing for */ }

    // Some libraries put their fingerprint in a data- attribute and leave the
    // class empty — Reach UI's tab strip is `<div data-reach-tab-list>` and
    // nothing else, so no class pattern can ever see it however it is spelled.
    // Matched against the attribute NAMES: the name is the whole statement,
    // and it has no value at all.
    //
    // Ahead of the class patterns, because an attribute a library emitted is a
    // firmer statement than a word in a class list that may well be describing
    // something else on the same element.
    try {
      for (const attr of el.getAttributeNames()) {
        for (const [re, name] of COMPONENT_BY_ATTR) if (re.test(attr)) return { name, sure: true };
      }
    } catch (e) {}

    const cls = (el.className && typeof el.className === 'string') ? el.className : '';
    if (cls) {
      const flat = classWords(cls);
      for (const [re, name] of COMPONENT_BY_CLASS) {
        if (!(re.test(cls) || re.test(flat))) continue;
        // The CONTENT of tabs is not the tabs: tabs-content / tabs-panel /
        // tabs-pane name what the strip switches, not the strip.
        if (name === 'menu' && /tabs?[-_](content|panel|pane)\b/i.test(cls)) continue;
        // Two carousel words carry a known lie and only those two are gated —
        // "carousel"/"slideshow"/library fingerprints stay trusted words:
        //   · slider + input[type=range] inside = a VALUE slider, never a
        //     carousel (unless a real carousel word also appears);
        //   · gallery, when it is the ONLY carousel word, must show something
        //     that can cycle — arrows, a lib fingerprint, a [hidden] slide.
        if (name === 'carousel' && carouselClassVeto(el, cls)) continue;
        return { name, sure: false };
      }
    }

    // A trail of links with something drawn between them, in small type, is a
    // breadcrumb — whatever it is called.
    //
    // The class patterns above already catch a trail whose author wrote
    // "breadcrumb" somewhere. This is for the ones that did not, and it is a
    // SHAPE test rather than a name test for the same reason the probe exists:
    // a name can be absent, a shape cannot.
    //
    // Two conditions, both required, per the rule agreed for this component.
    // Either alone is far too loose — every row of links has small text
    // somewhere, and a "·" between two links is also how a byline is written.
    if (looksLikeBreadcrumb(el)) return { name: 'breadcrumb', sure: false };

    // A form is a real <form>, or a thing with more than one field and a way to
    // send them. That is the whole rule, and it replaces a longer one.
    //
    // What it replaces: three-or-more fields, plus a "packaging" test that
    // climbed for the tightest cluster, plus a links-versus-fields ratio. Those
    // existed because there was no submit requirement, so every wrapper up to
    // <body> qualified and the heuristics were there to pick which wrapper. Ask
    // for the SUBMIT and the ambiguity mostly goes: a wrapper holding two forms
    // holds two submits, and the tightest element holding both a field group and
    // one submit is the form.
    //
    // Two fields rather than three, also decided: a login box is an email, a
    // password and a button, and it was under the old floor.
    try {
      // A real <form> IS a form, and could never say so.
      //
      // The guard below is `!el.closest('form')`, there to stop every div INSIDE
      // a real form being called one too. But closest() starts at the element
      // itself, so a <form> matched its own guard — the one element on the page
      // that needs no heuristic at all was the only one the heuristic could not
      // name. Reported as, exactly: funny, it did not catch the form.
      if (el.tagName === 'FORM') return { name: 'form', sure: true };

      var fields = el.querySelectorAll(FIELD).length;
      if (fields >= 2 && !el.closest('form')) {
        var submits = countSubmits(el);
        // No submit, no form. A row of filter selects that applies on change is
        // a real thing and it is not this; it has no send — and a "Clear"
        // button beside them is not a send either, which is what countSubmits
        // now enforces.
        if (submits >= 1) {
          // Still the tightest answer: if a child already holds a whole form —
          // its own fields AND its own submit — then this element is the
          // wrapper around several, and each child is the form.
          var packaging = Array.prototype.some.call(el.children, function (ch) {
            return ch.querySelectorAll(FIELD).length >= 2 && countSubmits(ch) >= 1;
          });
          if (!packaging) return { name: 'form', sure: false };
        }
      }
    } catch (e) {}

    return null;
  }

  // Class fragments that suggest a widget. This list and COMPONENT_BY_CLASS are
  // two halves of one idea and MUST stay in step: the first decides what is even
  // looked at, the second decides what it is called. When they drifted apart —
  // `componentHint` knew "navbar" and this list did not — a real menu written as
  // `class="site-navbar"` was never collected, so nothing was drawn on its
  // screenful and the survey looked broken rather than conservative.
  /**
   * A class string with its word boundaries made real.
   *
   * The patterns below are written with \b — and \b treats `_` as a word
   * character, so `\btabs\b` does not match `finder__tabs`. BEM is not a
   * fringe convention: `block__element` is most of the class names on most of
   * the sites this runs on, and camelCase (`dealTabs`) fails the same way.
   *
   * STEP's own tab strip is `<div class="finder__tabs">`, and with its
   * role="tablist" stripped — which is what a real client's markup looks like —
   * it was invisible to every pattern here. Reported three times as "it did not
   * find the tabs".
   *
   *   finder__tabs -> finder tabs        dealTabs -> deal Tabs
   *
   * Tested ALONGSIDE the raw string, never instead of it, so a pattern that
   * deliberately matches a joined name (`react-datepicker__input`) still does.
   */
  const classWords = (cls) => cls
    .replace(/_+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  const CLASS_HINTS = [
    'modal', 'lightbox', 'drawer', 'offcanvas', 'off-canvas',
    'dropdown', 'megamenu', 'mega-nav', 'nav', 'menu',
    // `ticker` and `marquee` name a carousel; COMPONENT_BY_CLASS reads them and
    // could never see one, because this list decides what is LOOKED at and that
    // one only decides what a thing is CALLED. A word in one and not the other
    // is a rule that can never fire — see the check in verify-detect.
    'tab', 'carousel', 'slider', 'slideshow', 'gallery', 'ticker', 'marquee',
    'accordion', 'collapsible', 'faq',
    'datepicker', 'calendar', 'pagination', 'pager',
    'tooltip', 'popover', 'breadcrumb',
  ];

  // The library fingerprints from COMPONENT_BY_CLASS, as things to LOOK at.
  //
  // Kept as a second list rather than folded into the one above for two
  // reasons. They are matched case-insensitively — `MuiAccordion` and
  // `ReactModal` are camelCase, and a CSS substring match is case-sensitive
  // without the `i` flag, so they would be collected by nothing. And they are
  // fingerprints rather than words: if one of them ever needs removing, it
  // should be removable without touching the hand-written vocabulary that has
  // been tuned against the corpus.
  //
  // Only the names the first list does not already cover — `mat-datepicker`
  // contains "datepicker" and is collected by that.
  const LIB_HINTS = [
    'autocomplete', 'downshift', 'react-select', 'select2', 'choices__',
    'mat-expansion', 'MuiAccordion', 'MuiMenu', 'MuiDialog',
    'mat-dialog', 'ReactModal', 'headlessui',
    'swiper', 'glide__', 'embla',
  ];

  // Elements worth showing the model: anything interactive, plus the structural
  // landmarks and media that carry the most common accessibility defects.
  const CANDIDATE_SEL = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'summary', 'label',
    '[role]', '[tabindex]', '[onclick]', '[contenteditable="true"]',
    'nav', 'form', 'table', 'dialog', 'iframe', 'video', 'audio',
    'img', 'svg[aria-label]', 'h1', 'h2', 'h3',
    // ` i` — case-insensitive, on BOTH lists.
    //
    // It used to be on the library list only, and that left half of the
    // camelCase fix undone. `classWords` below teaches the NAMING stage to read
    // `dealTabs` as "deal Tabs" — but naming never runs on an element this
    // stage did not collect, and a CSS substring match is case-sensitive, so
    // `[class*="tab"]` does not match `dealTabs`. The rule existed and could
    // never fire, which is exactly the failure the two lists are supposed to be
    // kept in step to prevent. Measured: `<div class="dealTabs">` was named
    // nothing at all, while `<div class="tab-bar">` was named tabs.
    ...CLASS_HINTS.map(t => `[class*="${t}" i]`),
    // Without it MuiAccordion and ReactModal are collected by nothing, which is
    // the whole reason these are a separate list.
    ...LIB_HINTS.map(t => `[class*="${t}" i]`),
    // Reach UI names its tabs with a data- attribute and no class at all, so a
    // class hint cannot see it however it is spelled.
    '[data-reach-tab-list]', '[data-reach-tabs]',
  ].join(',');

  // CANDIDATE_SEL is ONE selector. If any fragment of it fails to parse, the
  // whole thing throws and qsa's catch returns an empty list — so an engine
  // that does not know the `i` flag would not degrade to "no library
  // fingerprints", it would degrade to "this page has nothing on it", silently,
  // everywhere. That is far too much to risk on a syntax addition, so it is
  // tried once and dropped if it does not parse.
  const CANDIDATES = (function () {
    try { document.querySelector(CANDIDATE_SEL); return CANDIDATE_SEL; }
    catch (e) {
      try {
        const plain = CANDIDATE_SEL.replace(/" i\]/g, '"]');
        document.querySelector(plain);
        return plain;
      } catch (e2) { return 'a[href],button,input,select,textarea,[role],nav,form,table'; }
    }
  })();

  // `within` confines the scan to one element's subtree. Scanning the whole
  // screen is the wrong tool for "this datepicker" — a widget with forty cells
  // blows past the candidate limit and gets summarised away, and the answer
  // covers the header instead of the thing being asked about.
  /**
   * The elements worth looking at, in document order.
   *
   * CANDIDATE_SEL finds anything that ANNOUNCES itself — a tag, a role, a class
   * that hints. It cannot find a menu built from bare <div>s that were given
   * click handlers in JavaScript, because such an element announces nothing: it
   * matches no tag we search for, carries no role, and its classes are either
   * absent or layout noise. That is not a rare shape; it is most hand-rolled
   * widgets.
   *
   * The event recorder knows exactly which elements took a click handler, and
   * that is the only evidence such a page offers. When it is installed, its list
   * is merged in — and the walk switches to matches() over the subtree so the
   * merged set still comes back in document order, which is what keeps the mark
   * numbers running down the screenshot rather than jumping about.
   *
   * The slow path is taken ONLY when the recorder is on, which is opt-in.
   */
  /**
   * Wrappers that hold a cluster of form fields and say nothing about it.
   *
   * CANDIDATE_SEL finds things that ANNOUNCE themselves — a tag, a role, a
   * class we recognise. A shop's filter panel announces nothing: five <select>s
   * and five checkboxes inside `<div class="finder__panel">`. Every field is
   * collected individually and the panel is not collected at all, so the form
   * rule in componentHint — which exists, and is exactly right for this — never
   * gets an element to run on.
   *
   * The same shape as the tab strip whose container was invisible while its six
   * buttons were all found: the parts were seen, the thing they add up to was
   * not. Reported by looking at the page beside the results and asking where
   * the form went.
   *
   * Not the tightest ancestor — the one holding the fields AND the control
   * that submits them.
   *
   * The tightest is what a first attempt reaches for, and on the real page it
   * returned TWO forms for one: `.finder__row` with the five selects and
   * `.finder__opts` with the five checkboxes, while the panel holding both of
   * them and the "Find my shoe" button was named nothing at all. Those are two
   * parts of one form, and u1.fix.form applied to each decorates two halves of
   * a thing.
   *
   * A submit control is what separates "a group of fields" from "a form". It is
   * also what separates one form whose fields are laid out in rows from a page
   * that happens to contain three different forms: the first has one submit,
   * the second has three, and the climb stops before it swallows them.
   *
   * Every wrapper up to <body> holds three fields somewhere below it, so
   * without a stop condition this is how "form?" lands on twenty sections in a
   * row — which it did, the last time this was tried.
   *
   * This decides what is LOOKED at. componentHint stays the only authority on
   * what it is CALLED.
   */
  const SUBMITISH = 'button,input[type="submit"],input[type="button"],[role="button"]';
  // What actually SENDS. A bare clickable next to fields is not it — three
  // filter selects with a type=button "Clear" were being called a form. A
  // button counts only when it says so: type=submit, a typeless <button>
  // inside a real <form> (the default nobody remembers), or an accessible
  // name that is a sending word. Word-bounded on purpose: "Logo" contains
  // "go" and submits nothing.
  // `find` is on the list beyond the agreed eight: "Find my shoe" / "Find
  // stores" is how a search submit is labelled on this very corpus, and find
  // is search wearing retail clothes.
  // Beyond the agreed eight: `find` ("Find my shoe" is search in retail
  // clothes), and the joining words — join / sign in / log in — because a
  // login box is two fields and a button, named after the act of entering.
  // What stays out is the rule's whole point: Clear, Reset, Cancel.
  const SUBMIT_NAME = /(^|\s)(submit|send|search|find|apply|go|join|sign ?in|log ?in|שלח|חפש|החל|התחבר|הצטרפ)(\s|$)/i;
  function countSubmits(root) {
    let n = 0;
    try {
      for (const b of root.querySelectorAll(SUBMITISH)) {
        const type = (b.getAttribute('type') || '').toLowerCase();
        if (b.tagName === 'INPUT') { if (type === 'submit' || type === 'image') n++; continue; }
        if (type === 'submit') { n++; continue; }
        if (b.tagName === 'BUTTON' && !type && b.closest('form')) { n++; continue; }
        const name = ((b.getAttribute('aria-label') || '') || b.textContent || '').trim().replace(/\s+/g, ' ');
        if (SUBMIT_NAME.test(name)) n++;
      }
    } catch (e) {}
    return n;
  }

  function fieldClusters(scope) {
    const out = [];
    let fields;
    try { fields = qsaDeep(scope, FIELD); } catch { return out; }
    if (fields.length < 3) return out;

    const count = (el, sel) => { try { return el.querySelectorAll(sel).length; } catch { return 0; } };
    const walked = new Set();

    for (const f of fields) {
      let tightest = null;
      for (let p = f.parentElement; p; p = p.parentElement) {
        if (p === document.body || p === document.documentElement) break;
        if (walked.has(p)) { tightest = null; break; }   // this chain is answered
        walked.add(p);
        if (count(p, FIELD) < 3) continue;
        if (!tightest) tightest = p;
        // Climb only while there is still no way to submit what is here. One
        // submit is a form; a second means the climb has left this form and
        // reached whatever contains several of them, so keep the tighter one.
        const submits = count(p, SUBMITISH);
        if (submits >= 1) {
          out.push(submits === 1 ? p : tightest);
          tightest = null;
          break;
        }
      }
      // Fields with no submit above them anywhere — a filter bar that applies
      // on change. Still a form; there is simply nothing better to anchor on.
      if (tightest) out.push(tightest);
    }
    return out;
  }

  /**
   * Trails that hold a chain of links and announce nothing.
   *
   * The same gap `fieldClusters` fills for forms, for the same reason: the
   * naming stage has a breadcrumb rule and it can never run, because a
   * `<div class="crumbs">` matches no tag, no role and no class hint, so it is
   * never collected. Measured before this existed — the rule was written, the
   * test passed on paper, and every trail came back unnamed.
   *
   * Deliberately narrow: only elements whose OWN children are the links, so
   * one trail yields one element rather than every wrapper above it.
   */
  function trailCandidates(scope) {
    const out = [];
    let links;
    try { links = qsaDeep(scope, 'a[href]'); } catch (e) { return out; }
    if (links.length < 2) return out;
    const seen = new Set();
    for (const a of links) {
      const p = a.parentElement;
      if (!p || seen.has(p) || p === document.body || p === document.documentElement) continue;
      seen.add(p);
      if (looksLikeBreadcrumb(p)) out.push(p);
    }
    return out;
  }

  // ── Declared edges: the control, and the thing it controls ────────────────
  //
  // THE GUIDING PRINCIPLE OF THIS BLOCK. Everywhere else, the collector's pool
  // is "what is visible right now". For half of what u1 fixes that is the
  // wrong pool, and wrong in a way that never shows up as an error — it shows
  // up as a component type scoring zero, every time, on every site.
  //
  // A dialog's defining element is the modal box, and it is display:none until
  // somebody presses the button. A listbox's is the option list, closed. A tab
  // set's is the panels that are not the current one. An accordion's is the
  // collapsed region. A drawer's is the drawer. None of them are on screen at
  // the moment anyone looks, so none of them were ever collected — not
  // mis-typed, not filtered, never seen. That is the whole of the gap between
  // what an automatic pass finds and what a person finds, because a person
  // does the one thing the pass never did: press things and look again.
  //
  // Pressing is expensive and has side effects. Reading is neither, and a page
  // that hides a container almost always says in the markup which control
  // reveals it. ARIA says it with aria-controls / aria-owns; the HTML popover
  // API with popovertarget; Bootstrap and its many imitators with data-target
  // and data-bs-target; and a plain in-page <a href="#panel"> has said it since
  // long before any of them. Reading those turns "invisible, therefore absent"
  // into "invisible, and here is the button that reveals it".
  //
  // Framework-agnostic on purpose. Nothing here knows what Bootstrap is; it
  // knows that an attribute whose name ends in `target` holds a selector, and
  // that ARIA's relationship attributes hold ID references. A framework that
  // spells its own attribute the same way is picked up for free.
  const REL_IDREF_ATTRS = ['aria-controls', 'aria-owns', 'popovertarget'];
  const REL_SELECTOR_ATTRS = [
    'data-target', 'data-bs-target', 'data-modal-target', 'data-drawer-target',
    'data-dropdown-target', 'data-menu-target', 'data-collapse-target',
    'data-dialog-target', 'data-panel-target', 'data-tab-target',
  ];
  const REL_SEL = REL_IDREF_ATTRS.concat(REL_SELECTOR_ATTRS)
    .map((a) => '[' + a + ']').concat(['a[href^="#"]']).join(',');
  // Anything a person can press. The generic data-* rule below is only allowed
  // to look at these, which is what stops it from turning a page's analytics
  // tags into a component list: a `data-modal="cart"` on a <div> that nobody
  // can click did not open anything.
  const PRESSABLE_SEL = 'button,summary,a[href],[role=button],[role=tab],[role=menuitem],[onclick],[tabindex]';
  // A page-wide ceiling. A site with fifty declared panels must not spend the
  // model's whole list on the ones nobody can see.
  const RELATED_CAP = 20;

  /**
   * Hidden elements that a VISIBLE control declares it opens.
   *
   * Returns Map(target -> { via, trigger }). The trigger is the element, not a
   * string, so the caller names it with the same selector builder as
   * everything else and the two names are guaranteed to agree.
   */
  // ── Naming the opener when the page never declared one ───────────────────
  //
  // The container is on the list now, and half the time that is all there is:
  // the button is wired in JavaScript and points at nothing. The remaining
  // signal is the one a person uses without noticing. A drawer called
  // `cart-drawer` is opened by the button that says Cart. An overlay called
  // `search-panel` is opened by the one that says Search. Authors name the two
  // halves of a pair after the same thing, because they have to think about
  // both while writing them.
  //
  // Deliberately timid, because a wrong trigger is worse than none — u1 would
  // wait on a control that never opens the thing. It answers only when exactly
  // ONE visible pressable control on the page shares a distinctive word with
  // the container, and generic furniture words are excluded, so the usual
  // outcome on a busy page is silence. It is also reported as `name` in
  // `openedVia`, so nothing downstream mistakes it for something the page said.
  const NAME_STOP = new Set([
    'panel', 'overlay', 'modal', 'dialog', 'drawer', 'popup', 'popover', 'flyout',
    'wrapper', 'container', 'content', 'inner', 'outer', 'body', 'main', 'root',
    'menu', 'list', 'item', 'items', 'group', 'block', 'box', 'area', 'view',
    'open', 'close', 'toggle', 'show', 'hide', 'button', 'btn', 'link', 'icon',
    'tool', 'nav', 'bar', 'header', 'footer', 'side', 'left', 'right', 'top',
    'active', 'hidden', 'window', 'form', 'field', 'input', 'text', 'title',
  ]);

  /** `cartDrawerOverlay` / `cart-drawer__inner` → Set{'cart','drawer'} */
  function nameTokens(el, deep) {
    const out = new Set();
    if (!el || el.nodeType !== 1) return out;
    const eat = (raw) => {
      String(raw || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9]+/)
        .forEach((w) => {
          const t = w.toLowerCase();
          if (t.length >= 4 && !NAME_STOP.has(t) && !/^\d+$/.test(t)) out.add(t);
        });
    };
    eat(el.id);
    eat(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className);
    // The label is a sentence written for a screen reader; the id and the class
    // are the author naming the thing. Reading both together is how "Search the
    // store" starts matching every visible control with the word store in it,
    // two answers become no answer, and a pair that was obvious goes unjoined.
    // So prose is the fallback, used only when the structural names said
    // nothing at all.
    if (!out.size) eat(el.getAttribute('aria-label'));
    if (deep && el.parentElement) for (const t of nameTokens(el.parentElement, false)) out.add(t);
    return out;
  }

  function guessOpener(target, pressables) {
    const want = nameTokens(target, true);
    if (!want.size) return null;
    let hit = null;
    for (const el of pressables) {
      if (target === el || target.contains(el)) continue;
      const mine = nameTokens(el, false);
      try { for (const t of nameTokens({ id: '', className: '', getAttribute: () => accName(el), nodeType: 1, parentElement: null }, false)) mine.add(t); } catch (e) {}
      let shared = false;
      for (const t of want) if (mine.has(t)) { shared = true; break; }
      if (!shared) continue;
      if (hit) return null;   // two answers is no answer
      hit = el;
    }
    return hit;
  }

  function relatedTargets(scope) {
    const map = new Map();
    // One tab strip is one component, not five.
    //
    // A five-tab finder declares five edges, and each one points at a hidden
    // panel. Admitted individually they are five candidates that look like five
    // components, they eat a quarter of the page's whole budget, and the strip
    // itself — the thing that actually gets mapped — is already on the list as
    // a visible element. The signature of "these are one repeated thing" needs
    // no framework knowledge: the triggers share a parent and so do the
    // targets. The first one stands for the set; the rest are its siblings and
    // whatever field selector names one will name them all.
    let uid = 0;
    const idOf = (el) => {
      if (!el) return '0';
      if (!el.__u1relId) { try { el.__u1relId = String(++uid); } catch (e) { return 'x'; } }
      return el.__u1relId;
    };
    const pairSeen = new Set();
    const add = (target, trigger, via) => {
      if (map.size >= RELATED_CAP) return;
      if (!target || target.nodeType !== 1 || target === trigger) return;
      if (map.has(target)) return;
      // Edges WE wrote are not the page's statements — see isOurs.
      if (isOurs(target) || (trigger && isOurs(trigger))) return;
      if (trigger) {
        const pair = idOf(trigger.parentElement) + '>' + idOf(target.parentElement) + '>' + via;
        if (pairSeen.has(pair)) return;
        pairSeen.add(pair);
      }
      // A control pointing inside itself is naming its own chevron, not a
      // component.
      try { if (trigger && trigger.contains(target)) return; } catch (e) {}
      // The entire value of an edge is the element you CANNOT see. One already
      // on screen is already a candidate, and recording an edge for it would
      // only rename a visible component after whatever happens to point at it
      // — a skip link's #main-content is not a dialog. Dropping visible
      // targets is also what keeps this list short without a single
      // framework-specific exception.
      if (visibleInViewport(target)) return;
      map.set(target, { via, trigger });
    };

    let host = document;
    try { if (scope && scope.querySelectorAll) host = scope; } catch (e) { host = document; }
    let triggers = [];
    try { triggers = qsaDeep(host, REL_SEL); } catch (e) { triggers = []; }
    try {
      for (const el of qsaDeep(host, PRESSABLE_SEL)) {
        if (triggers.indexOf(el) !== -1) continue;
        for (const at of Array.from(el.attributes || [])) {
          if (/^data-/.test(at.name) && DATA_TRIGGER.test(at.name) && (at.value || '').trim()) {
            triggers.push(el); break;
          }
        }
      }
    } catch (e) {}

    for (const trigger of triggers) {
      if (map.size >= RELATED_CAP) break;
      // A control nobody can reach cannot reveal anything. This one test is
      // what keeps a closed drawer's own menu out of the list: the menu is
      // hidden, and so is the button that opens it.
      if (!visibleInViewport(trigger)) continue;

      for (const attr of REL_IDREF_ATTRS) {
        const raw = trigger.getAttribute(attr);
        if (!raw) continue;
        // ARIA relationship attributes hold a space-separated ID list, not a
        // selector — `aria-controls="panel1 panel2"` is two elements.
        for (const id of raw.trim().split(/\s+/)) {
          if (!id) continue;
          try { add(document.getElementById(id), trigger, attr); } catch (e) {}
        }
      }
      // The named list above is a convenience, not the rule. The rule is this
      // loop, and it is the half that matters in the wild: the fixture page
      // this repo scores against opens its size guide with
      // `data-modal-open="sizeModal"` — a name no allowlist was ever going to
      // contain, holding a bare id rather than a selector. Bootstrap's spelling
      // is the minority case; every hand-rolled site invents its own.
      //
      // What makes this safe without an allowlist is that the VALUE has to
      // check out. `data-modal-open="sizeModal"` counts because this page
      // really does contain an element with that id and it really is hidden. A
      // `data-track="cart"` next to it counts for nothing unless the same is
      // true of it, in which case the hidden thing it named was worth looking
      // at anyway.
      for (const at of Array.from(trigger.attributes || [])) {
        if (map.size >= RELATED_CAP) break;
        if (!/^data-/.test(at.name)) continue;
        if (REL_SELECTOR_ATTRS.indexOf(at.name) !== -1) continue;
        if (!DATA_TRIGGER.test(at.name)) continue;
        const raw = (at.value || '').trim();
        // A value long enough to be prose, or carrying spaces or quotes, is a
        // label or a JSON blob — not a name for one element.
        if (!raw || raw.length > 120 || /[\s"'{}]/.test(raw)) continue;
        try {
          if (/^[#.\[]/.test(raw)) add(document.querySelector(raw), trigger, at.name);
          else add(document.getElementById(raw), trigger, at.name);
        } catch (e) {}
      }
      for (const attr of REL_SELECTOR_ATTRS) {
        const raw = (trigger.getAttribute(attr) || '').trim();
        if (!raw || raw === '#') continue;
        try { add(document.querySelector(raw), trigger, attr); } catch (e) {}
      }
      // The oldest edge of the lot, and still the one a hand-rolled tab strip
      // uses. It can only ever ADD a hidden element — an href pointing at
      // something on screen is dropped by `add` above.
      if (trigger.tagName === 'A') {
        const href = trigger.getAttribute('href') || '';
        if (href.length > 1 && href.charAt(0) === '#') {
          try { add(document.getElementById(decodeURIComponent(href.slice(1))), trigger, 'href'); } catch (e) {}
        }
      }
    }

    // ── The other half: revealable containers nothing points at ─────────────
    //
    // Everything above needs the page to have SAID what opens what. Plenty of
    // pages never say it — the button is wired in JavaScript, the attribute is
    // a listener key with no value, the whole thing is a click handler on a
    // class. The fixture this repo scores against is exactly that page: its
    // search overlay and its cart drawer are opened by two <button>s carrying
    // nothing but an id, and no amount of attribute reading will ever join them
    // up. Both are dialogs. Both were labelled by hand. Neither has ever been
    // collected.
    //
    // So the edge is a way in, not the only way in. A container can also earn
    // its place by what it IS, with no trigger at all:
    //
    //   — it declares a revealable role (dialog, menu, listbox, tabpanel,
    //     tooltip) or aria-modal, which is the page stating outright that this
    //     is a thing that gets shown; or
    //   — it is a hidden box sitting at the top of the document with something
    //     pressable inside it. Nothing is parked as a direct child of <body>
    //     and hidden except overlays, drawers, cookie bars and modals; page
    //     content lives in the layout.
    //
    // The trigger comes out empty for these, and that is honest — the mapping
    // gets a container it can fix and a blank the specialist or a probe fills,
    // rather than nothing at all.
    const REVEALABLE_ROLE = /^(dialog|alertdialog|menu|listbox|tabpanel|tooltip)$/;
    let overlays = [];
    try {
      overlays = qsaDeep(host, 'dialog,[aria-modal],[role],[hidden]');
    } catch (e) { overlays = []; }
    // Every direct child of <body>, whatever it declares. The selector above
    // asks the page to have said something — a role, the hidden attribute —
    // and the sites that need this most say nothing: the same fixture with its
    // roles stripped and `hidden` rewritten as a class loses both dialogs
    // outright. `display:none` set from a stylesheet is invisible to any
    // attribute selector, and it is how most overlays are actually hidden.
    // Body's own children are a handful of elements on any page, so this is
    // cheap, and being hidden is then MEASURED below rather than declared.
    try {
      const top = (host === document || host === document.body)
        ? Array.from(document.body ? document.body.children : [])
        : [];
      for (const el of top) if (overlays.indexOf(el) === -1) overlays.push(el);
    } catch (e) {}
    for (const el of overlays) {
      if (map.size >= RELATED_CAP) break;
      if (map.has(el)) continue;
      if (visibleInViewport(el)) continue;
      const role = (el.getAttribute('role') || '').toLowerCase();
      const byRole = el.tagName === 'DIALOG' || el.getAttribute('aria-modal') === 'true' ||
        REVEALABLE_ROLE.test(role);
      const atTop = el.parentElement &&
        (el.parentElement === document.body || el.parentElement === document.documentElement);
      let byPlacement = false;
      if (!byRole && atTop) {
        try { byPlacement = !!el.querySelector(PRESSABLE_SEL); } catch (e) {}
      }
      if (!byRole && !byPlacement) continue;
      // An overlay is usually a backdrop wrapping the box that matters, and it
      // is the box that gets fixed. When the wrapper holds exactly one element
      // the choice is not a guess, so the inner one is offered as well and the
      // reader picks — .cart-drawer-overlay is not the drawer.
      let inner = null;
      if (byPlacement && el.children.length === 1) inner = el.children[0];
      const viaOf = (x) => {
        const r = (x.getAttribute('role') || '').toLowerCase();
        if (x.tagName === 'DIALOG' || x.getAttribute('aria-modal') === 'true') return 'hidden dialog';
        return REVEALABLE_ROLE.test(r) ? 'hidden ' + r : 'hidden overlay';
      };
      add(el, null, viaOf(el));
      if (inner) add(inner, null, viaOf(inner));
      // When the pair went in together, the wrapper is the BACKDROP and the
      // inner box is the component. The wrapper stays collected — "there is a
      // veil here" is information — but flagged, so it is never offered as a
      // candidate in its own right beside the thing it veils.
      if (inner && map.has(el) && map.has(inner)) map.get(el).backdrop = true;
    }

    // One pass over the page's pressable controls, shared by every container
    // that came out of the block above without an opener.
    let pressables = null;
    for (const [target, edge] of map) {
      if (edge.trigger) continue;
      if (pressables === null) {
        try { pressables = qsaDeep(host, PRESSABLE_SEL).filter(visibleInViewport); } catch (e) { pressables = []; }
      }
      const opener = guessOpener(target, pressables);
      if (opener) { edge.trigger = opener; edge.via = edge.via + ' + name'; }
    }
    return map;
  }

  function candidateElements(scope, extras) {
    const rec = root.__u1EventMap;
    let recorded = null;
    try { recorded = rec && typeof rec.all === 'function' ? rec.all() : null; } catch { recorded = null; }
    // Wrappers that hold a cluster of fields and announce nothing. They are a
    // second source alongside the selector and the recorder, and they are
    // merged in DOCUMENT ORDER below rather than appended — the collector's
    // "a component inside a component of the same kind is the same component"
    // rule reads the outermost first and depends on that order.
    // `extras` are the hidden targets of declared edges. They are merged HERE
    // rather than appended, for the same reason the clusters are: the caller's
    // "a component inside a component of the same kind is the same component"
    // rule reads the outermost first and depends on document order holding.
    const clusters = fieldClusters(scope).concat(trailCandidates(scope), extras || []);
    const merge = (base) => {
      if (!clusters.length) return base;
      const set = new Set(base);
      let added = false;
      for (const el of clusters) if (!set.has(el)) { set.add(el); added = true; }
      if (!added) return base;
      const all = [...set];
      all.sort((a, b) => {
        const rel = a.compareDocumentPosition(b);
        if (rel & 2) return 1;        // b precedes a
        if (rel & 4) return -1;       // a precedes b
        return 0;
      });
      return all;
    };

    // qsaDeep, not qsa: this is the one place that asks "what is on this page",
    // and a component behind a shadow boundary is on the page.
    if (!recorded || !recorded.length) return merge(qsaDeep(scope, CANDIDATES));

    const extra = new Set();
    for (const el of recorded) {
      // A recorded element outside the scope is somebody else's problem.
      if (scope === document || (scope.contains && scope.contains(el))) extra.add(el);
    }
    if (!extra.size) return merge(qsaDeep(scope, CANDIDATES));

    const out = [];
    for (const el of qsaDeep(scope, '*')) {
      let hit = extra.has(el);
      if (!hit) { try { hit = el.matches(CANDIDATES); } catch { hit = false; } }
      if (hit) out.push(el);
    }
    return merge(out);
  }

  function collectCandidates(limit, within) {
    clearMarks();
    resetPinned();
    const max = limit || 60;
    const seen = new Set();
    const out = [];
    // A nav's wrapper, its list and each of its items all match `mega-nav`, so
    // one menu was reported as fourteen — and fourteen boxes were drawn over the
    // same strip. A component inside a component OF THE SAME KIND is the same
    // component. Document order means the outermost is always recorded first.
    const hinted = new WeakMap();

    let scope = document;
    if (within) {
      try { scope = document.querySelector(within) || document; } catch { scope = document; }
    }
    // Hidden descendants are only collected inside a named scope, and only a
    // few: a container holding thirty collapsed rows should not spend the
    // model's whole list on them.
    const HIDDEN_CAP = 12;
    let hiddenUsed = 0;
    // An element that a visible control declares it opens is admitted even on
    // a page-wide scan, and even though it is hidden — that is the entire
    // point of it. It has its own budget so it cannot be starved by, or starve,
    // the anonymous-hidden allowance above.
    const related = relatedTargets(scope);
    let relatedUsed = 0;
    // Names seen on the page, for telling a real selector from an invented one.
    const pageTokens = new Set();
    for (const el of candidateElements(scope, [...related.keys()])) {
      if (out.length >= max) break;
      if (seen.has(el)) continue;
      // Never mark our own overlay — either of them.
      if (el.closest('#' + MARK_LAYER) || el.closest('#' + HILITE_LAYER)) continue;
      // A CLOSED panel inside the container you pointed at is the interesting
      // element, not one to skip.
      //
      // A dropdown's <ul> is display:none until it opens, so it never became a
      // candidate — and the model is forbidden from naming a selector that is
      // not in the list, so it could not choose the list even while describing
      // it in prose. Pointing at `.click-nav` returned only the button, with
      // "the actual options list isn't available here" as the reason.
      //
      // Page-wide this would be wrong: every closed modal, tooltip and menu on
      // the site would flood the list. Inside a named scope it is exactly what
      // was asked for, so it is allowed only there, and capped.
      let r = visibleInViewport(el);
      let closed = false;
      const edge = related.get(el) || null;
      if (!r) {
        // Two ways in for something that is not on screen. An EDGE target is
        // admitted anywhere, because a visible control has named it and that
        // is a stronger statement than visibility: the page is telling us this
        // is a component and telling us how to reach it. Anything else is
        // admitted only inside a scope somebody pointed at, where "show me
        // what is in here" plainly includes the closed parts.
        if (edge) {
          if (relatedUsed >= RELATED_CAP) continue;
          relatedUsed++;
        } else {
          if (scope === document || hiddenUsed >= HIDDEN_CAP || el === scope) continue;
          hiddenUsed++;
        }
        r = el.getBoundingClientRect();
        closed = true;
      }
      // Skip a wrapper whose only content is a single already-listed child —
      // it produces two marks pointing at visually identical boxes.
      if (el.childElementCount === 1 && seen.has(el.firstElementChild)) continue;
      seen.add(el);

      // Every name this element actually carries, whether or not the selector
      // we generate ends up using it.
      //
      // robustSelector prefers #id, so for <div class="tab-bar" id="faqTabs">
      // it emits `#faqTabs` and `.tab-bar` appears in no produced selector at
      // all. checkAiSelector built its "known" set from produced selectors, so
      // a class plainly on the page was reported as invented — which is a
      // refusal to map something that is right there.
      try {
        if (el.id) pageTokens.add('#' + el.id);
        if (el.classList) for (const c of el.classList) if (c) pageTokens.add('.' + c);
        pageTokens.add(el.tagName.toLowerCase());
      } catch (e) {}

      const mark = out.length + 1;
      el.setAttribute(MARK_ATTR, String(mark));
      const sel = robustSelector(el);
      // Behind a shadow boundary. document.querySelector cannot reach it, and
      // neither can u1.fix.* — so a selector for it is not a selector, it is a
      // string that resolves to nothing on every page load.
      //
      // It is still COLLECTED, because "there is a menu in here I cannot touch"
      // is a real answer and far better than the element simply not existing in
      // the survey. But it carries no usable selector, so nothing downstream can
      // quietly build a mapping out of it that would fail in silence.
      const inShadow = !!(el.getRootNode && el.getRootNode() !== document);
      const usable = (!inShadow && isU1Valid(sel)) ? sel : '';
      const hint = componentHint(el);
      let nested = false;
      if (hint) {
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (hinted.get(p) === hint.name) { nested = true; break; }
        }
        hinted.set(el, hint.name);
      }

      // A menu's root has to be the DIRECT PARENT of the items — u1.fix.menu
      // reads the root's own children. The element that ANNOUNCES itself as a
      // menu is almost never that: on molinahealthcare.com the collector
      // reports `.navbar`, whose children are a brand link, a toggler button
      // and one <ul> — a menu of three, two of which are not menu items —
      // while `.mainNav` is the <ul> with the six real ones.
      //
      // prepareOne already descends, via this same menuItemsRoot, at the point
      // of building. That is far too late to be the only place: the survey
      // line, the labelling row, the card and the 👁 preview all name the
      // wrapper, so what you are asked to confirm is not the element that gets
      // mapped. Corrected here, once, where the candidate is made.
      let usableSel = usable;
      if (hint && hint.name === 'menu' && usableSel) {
        try {
          const inner = menuItemsRoot(usableSel);
          // Only when it resolves to exactly one element and is still U1-valid
          // — menuItemsRoot already checks both, and returns null otherwise.
          if (inner) usableSel = inner;
        } catch (e) {}
      }

      out.push({
        mark,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        name: accName(el),
        selector: usableSel,
        // Which u1 component this element says it is, where it says so at all.
        // `component` is from a role or a tag and is reliable; `maybe` is from a
        // class name and is a suggestion — `.tab-content` is not a tab strip.
        component: hint ? hint.name : '',
        maybe: hint ? !hint.sure : false,
        // Inside another component of the same kind, so it is a PART of that
        // one rather than a second one. Counted and drawn once, at the top.
        // A backdrop wrapper collected alongside its inner box is nested by
        // the same logic: one component, two elements.
        nested: nested || !!(edge && edge.backdrop),
        // A table taller than the window is on this screenful AND the next one,
        // and nothing else says they are the same table — so a specialist could
        // tick only the second and map its bottom half. These two flags say
        // which edge it runs past.
        spansAbove: r.top < 0,
        spansBelow: r.bottom > vh(),
        // Present in the DOM but not showing — a closed dropdown, a collapsed
        // panel. The model must know: it cannot see this one in the screenshot,
        // and "I could not see it" is not a reason to leave it out of the answer.
        closed,
        // The control that declares it opens this, and the attribute that said
        // so. Two stages need it and neither could have worked it out: the
        // survey, so it can answer "listbox" instead of "a button and a list it
        // cannot see", and the build, so `trigger` is filled from what the page
        // states rather than guessed from class names.
        openedBy: (edge && edge.trigger) ? (function () {
          try {
            const t = robustSelector(edge.trigger);
            return isU1Valid(t) ? t : '';
          } catch (e) { return ''; }
        })() : '',
        openedVia: edge ? edge.via : '',
        // Travels with the viewport, so a page-wide scan meets it again at every
        // scroll position. The panel drops these after the first stop.
        sticky: lastWasSticky,
        // Inside an open shadow root: visible, real, and unreachable from a
        // document-level selector. Said out loud rather than left to look like
        // a component whose selector mysteriously matches nothing.
        inShadow,
        shadowHost: inShadow ? shadowHostPath(el) : '',
        // How many elements this selector actually hits. >1 is fine for a field
        // meant to match many (menu items), and wrong for one meant to match a
        // single element — u1.fix.* decorates only one of them.
        matches: usableSel ? countOf(usableSel) : 0,
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
    // The heading outline, in document order. The screenshot shows how headings
    // LOOK, which is no guide to what level they are — a skipped level is
    // invisible until you read the markup. Rule 2 in a11y-rules.md needs this.
    const headings = qsa(scope, 'h1,h2,h3,h4,h5,h6,[role="heading"]')
      .filter(h => {
        const r = h.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(h).visibility !== 'hidden';
      })
      .slice(0, 60)
      .map(h => ({
        level: Number(h.getAttribute('aria-level')) || Number((h.tagName.match(/^H(\d)$/) || [])[1]) || null,
        text: (h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
        selector: robustSelector(h),
      }));

    // ── One component seen through its items ────────────────────────────────
    // Two or more DIRECT SIBLINGS wearing the same class-hint are not that
    // many components; they are one component's items — #faqPanel's rows each
    // said "accordion", and the survey drew four accordions inside a fifth.
    // The hint moves to their parent and the items become nested. Class hints
    // only (`maybe`): a row of role=dialog siblings really is several dialogs,
    // and a role is not overruled by arithmetic.
    try {
      const elOf = (c) => {
        try { return document.querySelector('[data-u1-mark="' + c.mark + '"]'); } catch (e) { return null; }
      };
      const byParent = new Map();
      for (const c of out) {
        if (!c.component || !c.maybe || c.nested) continue;
        const el = elOf(c);
        if (!el || !el.parentElement) continue;
        if (!byParent.has(el.parentElement)) byParent.set(el.parentElement, []);
        byParent.get(el.parentElement).push(c);
      }
      for (const [parent, kids] of byParent) {
        const same = kids.filter((k) => k.component === kids[0].component);
        if (same.length < 2) continue;
        const name = same[0].component;
        const parentCand = out.find((c) => elOf(c) === parent);
        if (!parentCand || parentCand.nested) continue;
        if (!parentCand.component) { parentCand.component = name; parentCand.maybe = true; }
        if (parentCand.component === name) for (const k of same) k.nested = true;
      }
    } catch (e) { /* a promotion that cannot run leaves the hints as found */ }

    return {
      candidates: out,
      // Hitting the cap and finding exactly that many are indistinguishable
      // from the outside, and they mean very different things — one is a count,
      // the other is "there was more and you cannot see it". Say which.
      truncated: out.length >= max,
      headings,
      scopedTo: within || null,
      viewport: { w: vw(), h: vh() },
      // Capped: this travels to the panel, and a page can hold thousands of
      // class names. The cap is generous enough that anything a model is
      // plausibly looking at is in it.
      tokens: [...pageTokens].slice(0, 4000),
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
    // Held so the numbers can be re-placed. They used to be written once at
    // fixed viewport coordinates, which is correct for exactly as long as the
    // page does not move — and the labelling pause exists to be scrolled
    // through. One flick of the wheel and every number was somewhere else.
    const boxes = [];
    document.querySelectorAll('[' + MARK_ATTR + ']').forEach(el => {
      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed', outline: '2px solid #ff2d95', outlineOffset: '-1px',
        boxSizing: 'border-box',
      });
      const tag = document.createElement('div');
      tag.textContent = el.getAttribute(MARK_ATTR);
      Object.assign(tag.style, {
        position: 'fixed', background: '#ff2d95', color: '#fff',
        font: 'bold 11px/1.2 monospace', padding: '1px 4px', borderRadius: '3px',
        whiteSpace: 'nowrap',
      });
      layer.appendChild(box);
      layer.appendChild(tag);
      boxes.push({ el, box, tag });
    });

    const place = () => {
      for (const b of boxes) {
        const r = b.el.getBoundingClientRect();
        // Off screen or collapsed: hidden rather than drawn at 0,0, which is
        // what put a stack of numbers in the top-left corner of the picture.
        if (r.width < 1 || r.height < 1) {
          b.box.style.display = 'none'; b.tag.style.display = 'none';
          continue;
        }
        b.box.style.display = ''; b.tag.style.display = '';
        b.box.style.left = r.left + 'px';
        b.box.style.top = r.top + 'px';
        b.box.style.width = r.width + 'px';
        b.box.style.height = r.height + 'px';
        b.tag.style.left = Math.max(0, r.left) + 'px';
        b.tag.style.top = Math.max(0, r.top - 14) + 'px';
      }
      markFollowRaf = 0;
    };

    document.body.appendChild(layer);
    place();
    // Only when something MOVES. This used to re-request a frame at the end of
    // every pass, unconditionally — so a section with two hundred and fifty
    // marks on it did two hundred and fifty getBoundingClientRect calls and as
    // many style writes sixty times a second, for as long as the marks were up.
    // The sweep leaves them up on purpose while you name things, so the page
    // the scan then has to read was being pinned at full load the whole time:
    // a section that takes a few seconds sat at fourteen minutes.
    //
    // Layout only changes on scroll or resize, and both are listened for. One
    // frame is coalesced per burst, which is what the rAF is still for.
    const onMove = () => {
      if (markFollowRaf) return;
      markFollowRaf = requestAnimationFrame(place);
    };
    markFollowFn = onMove;
    window.addEventListener('scroll', markFollowFn, true);
    window.addEventListener('resize', markFollowFn);
    return boxes.length;
  }

  /**
   * drawMarks' sibling, for the free survey rather than the model.
   *
   * The model needs numbers, because it answers with one. A person choosing
   * which screenfuls are worth paying to read needs the opposite: the NAME of
   * what was found, drawn on the thing itself. "22 links, 19 buttons" is a
   * measure of how busy a screenful is; a box round the nav labelled `menu` is
   * an answer to "is this worth reading".
   *
   * Takes the candidate list the collector just produced, so the boxes and the
   * text line can never disagree — they are the same data.
   */
  const COMPONENT_COLOUR = {
    menu: '#7c5cff', tabs: '#0ea5e9', 'tab strips': '#0ea5e9', carousel: '#f59e0b',
    form: '#10b981', table: '#ec4899', grid: '#ec4899', dialog: '#ef4444',
    listbox: '#8b5cf6', combobox: '#8b5cf6', accordion: '#14b8a6',
    datepicker: '#f97316', pagination: '#64748b', tooltip: '#a3a3a3',
    'media player': '#d946ef', toolbar: '#64748b', 'radio group': '#22c55e',
  };

  function drawComponentMarks(candidates) {
    clearOverlay();
    const layer = document.createElement('div');
    layer.id = MARK_LAYER;
    Object.assign(layer.style, {
      position: 'fixed', inset: '0', zIndex: '2147483646', pointerEvents: 'none',
    });

    for (const c of (candidates || [])) {
      // A recognised component with no usable selector used to be skipped here,
      // which drew nothing on exactly the screenfuls that most needed looking
      // at: the box is how you SEE what was found, and "found it, cannot address
      // it" is the finding. It is drawn, and the label says so.
      if (!c || !c.component || c.nested) continue;
      let el = null;
      try { el = document.querySelector(`[${MARK_ATTR}="${c.mark}"]`); } catch { el = null; }
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const colour = COMPONENT_COLOUR[c.component] || '#ff2d95';

      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px',
        width: r.width + 'px', height: r.height + 'px',
        boxSizing: 'border-box', borderRadius: '2px',
        // A guess from a class name is drawn as a guess. The dashes are the
        // same statement the trailing "?" makes in the text line.
        border: `2px ${c.maybe ? 'dashed' : 'solid'} ${colour}`,
        background: colour + '14',
      });
      // An element that runs past an edge is cut off in this picture and
      // continues in the next one. Flattening that edge says so without a word.
      if (c.spansAbove) { box.style.borderTop = 'none'; box.style.top = '0px'; box.style.height = (r.bottom) + 'px'; }
      if (c.spansBelow) { box.style.borderBottom = 'none'; }

      const tag = document.createElement('div');
      tag.textContent = c.component + (c.maybe ? '?' : '') +
        (c.selector ? '' : ' · no selector') +
        (c.spansAbove ? ' ↑ continues' : c.spansBelow ? ' ↓ continues' : '');
      Object.assign(tag.style, {
        position: 'fixed', left: Math.max(0, r.left) + 'px',
        top: Math.max(0, (c.spansAbove ? 0 : r.top) - 15) + 'px',
        background: colour, color: '#fff', font: 'bold 11px/1.3 system-ui,sans-serif',
        padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap',
      });

      layer.appendChild(box);
      layer.appendChild(tag);
    }
    document.body.appendChild(layer);
    return layer.childElementCount / 2;
  }

  // The overlay follows the page. Boxes are drawn at fixed coordinates measured
  // at one instant — and the very next thing highlightSelector does is a SMOOTH
  // scroll, which keeps moving for several hundred milliseconds after the boxes
  // are placed. So the outline ended up beside the element it was pointing at,
  // every single time the panel had to scroll to reach it.
  let followRaf = 0;
  let followFn = null;
  // The numbered layer keeps its own follow loop. It has to outlive the
  // single-element highlight — hovering a row in the panel must not be what
  // takes every number off the page — so the two cannot share one slot.
  let markFollowRaf = 0;
  let markFollowFn = null;
  const stopFollowing = () => {
    if (followFn) {
      window.removeEventListener('scroll', followFn, true);
      window.removeEventListener('resize', followFn);
      followFn = null;
    }
    if (followRaf) { cancelAnimationFrame(followRaf); followRaf = 0; }
  };
  const stopMarkFollowing = () => {
    if (markFollowFn) {
      window.removeEventListener('scroll', markFollowFn, true);
      window.removeEventListener('resize', markFollowFn);
      markFollowFn = null;
    }
    if (markFollowRaf) { cancelAnimationFrame(markFollowRaf); markFollowRaf = 0; }
  };
  const clearOverlay = () => {
    stopFollowing();
    stopMarkFollowing();
    const l = document.getElementById(MARK_LAYER);
    if (l) l.remove();
    clearHilite();
  };
  /** The single-element highlight, which is NOT the numbered layer. */
  const clearHilite = () => {
    const h = document.getElementById(HILITE_LAYER);
    if (h) h.remove();
  };

  function clearMarks() {
    clearOverlay();
    document.querySelectorAll('[' + MARK_ATTR + ']').forEach(e => e.removeAttribute(MARK_ATTR));
    return true;
  }

  /**
   * Pick one mark out of the numbered layer, without taking the layer down.
   *
   * This used to call clearOverlay(), which removes the numbers. Its caller is
   * the labelling pause's row hover — so the first time the mouse crossed the
   * list, all sixty numbers came off the page and nothing ever put them back.
   * The numbers ARE the binding between a row and an element; losing them makes
   * the whole pause unusable, and it looked like the marking had stopped
   * working.
   *
   * So the highlight gets a layer of its own, drawn over the numbers rather
   * than instead of them.
   */
  function showMark(mark) {
    clearHilite();
    const el = document.querySelector(`[${MARK_ATTR}="${mark}"]`);
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const layer = document.createElement('div');
    layer.id = HILITE_LAYER;
    Object.assign(layer.style, {
      position: 'fixed', outline: '3px solid #ff2d95',
      background: 'rgba(255,45,149,0.18)',
      zIndex: '2147483647', pointerEvents: 'none', boxSizing: 'border-box',
    });
    // scrollIntoView is smooth and asynchronous, so a rect read now is the rect
    // before the scroll. It follows for as long as it is up, which also covers
    // the user scrolling themselves.
    let raf = 0;
    const place = () => {
      raf = 0;
      if (!layer.isConnected) return;
      const r = el.getBoundingClientRect();
      layer.style.left = r.left + 'px';
      layer.style.top = r.top + 'px';
      layer.style.width = r.width + 'px';
      layer.style.height = r.height + 'px';
    };
    // scrollIntoView above is smooth, so the rect settles over several frames —
    // but a permanent frame loop for one box is a cost with no end, and this
    // sits on a page the scan then has to read.
    const follow = () => { if (!raf) raf = requestAnimationFrame(place); };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    const stop = setInterval(function () {
      if (layer.isConnected) { follow(); return; }
      clearInterval(stop);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    }, 120);
    document.body.appendChild(layer);
    place();
    return true;
  }

  /**
   * Outline whatever a selector matches, and scroll the first match into view.
   *
   * For hovering a saved mapping: the question being asked is "which thing on
   * the page IS this", and a selector string cannot answer it. Every match is
   * outlined, not just the first — a mapping whose selector has quietly widened
   * to catch fourteen elements looks identical in the list and unmistakable
   * here.
   *
   * Returns the number of matches, so the caller can say "matches nothing"
   * rather than silently drawing nothing.
   */
  function highlightSelector(sel, opts) {
    // Its OWN layer, not the numbered one.
    //
    // This used to clearOverlay() and then build its layer with MARK_LAYER's
    // id — so every use of it removed the numbers the labelling pause is built
    // on. That was fixed for showMark and walked straight back in the moment
    // hover started going through here instead.
    clearHilite();
    stopFollowing();
    let els;
    try { els = Array.prototype.slice.call(document.querySelectorAll(sel), 0, 40); }
    catch (e) { return -1; }          // -1: the selector itself is invalid
    if (!els.length) return 0;

    if (!(opts && opts.noScroll)) {
      els[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    const layer = document.createElement('div');
    layer.id = HILITE_LAYER;
    Object.assign(layer.style, {
      position: 'fixed', inset: '0', zIndex: '2147483646', pointerEvents: 'none',
    });

    // A dark halo under the purple. The accent alone disappears on a purple
    // header and on a photograph, and an outline you cannot see is the same as
    // no outline — which reads as "hovering does nothing".
    const RING = '#6c4cf1';
    const boxes = els.map((el, i) => {
      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed', boxSizing: 'border-box', pointerEvents: 'none',
        borderRadius: '3px',
        outline: i === 0 ? '2px solid ' + RING : '2px dashed ' + RING,
        outlineOffset: '1px',
        boxShadow: i === 0
          ? '0 0 0 1px rgba(0,0,0,.55), 0 0 0 5px rgba(108,76,241,.25)'
          : '0 0 0 1px rgba(0,0,0,.4)',
        background: i === 0 ? 'rgba(108,76,241,0.14)' : 'rgba(108,76,241,0.05)',
        transition: 'none',
      });
      layer.appendChild(box);
      return { el, box, first: i === 0 };
    });

    // How many it really matches, on the element itself. A selector that has
    // quietly widened to fourteen elements is the single most useful thing to
    // know while hovering, and counting boxes by eye is not a way to learn it.
    const tag = document.createElement('div');
    Object.assign(tag.style, {
      position: 'fixed', zIndex: '1', pointerEvents: 'none',
      font: '600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
      letterSpacing: '.02em', color: '#fff', background: RING,
      padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap',
      boxShadow: '0 1px 6px rgba(0,0,0,.45)',
    });
    tag.textContent = els.length === 1 ? 'the only match' : '1 of ' + els.length + ' matches';
    layer.appendChild(tag);

    const place = () => {
      for (const b of boxes) {
        const r = b.el.getBoundingClientRect();
        if (!r.width && !r.height) { b.box.style.display = 'none'; continue; }
        b.box.style.display = '';
        b.box.style.left = r.left + 'px';
        b.box.style.top = r.top + 'px';
        b.box.style.width = r.width + 'px';
        b.box.style.height = r.height + 'px';
      }
      const f = boxes[0] && boxes[0].el.getBoundingClientRect();
      if (f) {
        // Above the element, or below it when it is against the top edge.
        const above = f.top > 22;
        tag.style.left = Math.max(4, f.left) + 'px';
        tag.style.top = (above ? f.top - 21 : f.bottom + 5) + 'px';
      }
      followRaf = requestAnimationFrame(place);
    };

    document.body.appendChild(layer);
    place();
    // Scroll and resize both move things the animation frame would catch
    // anyway; listening as well means the first frame after a jump is right.
    followFn = () => { if (!followRaf) place(); };
    window.addEventListener('scroll', followFn, true);
    window.addEventListener('resize', followFn);
    return els.length;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  F2. A human's answer, turned into a component — with no model call.
  //
  //  The pipeline that turns a type and a selector into a working mapping is
  //  already local: buildTemplate → saveMappingEntry → applyMappingsBatch. The
  //  only thing the model supplies is the SUB-FIELDS, and several of those can
  //  be measured instead of asked. So a person saying "these six buttons are a
  //  tab strip" is enough, and it costs nothing.
  //
  //  It has to accept a GROUP, not one element. The collector sees six
  //  .tab-bar__btn as six buttons — which is correct, they are buttons — and the
  //  component is the strip they form. There is no single candidate to label.
  // ───────────────────────────────────────────────────────────────────────────

  // The field that holds the repeated parts, per type. Everything else is either
  // the root or something no measurement can supply.
  const ITEM_FIELD = {
    menu: 'items', tabs: 'tab', listbox: 'options', combobox: 'options',
    radio: 'radioButton', carousel: 'slide', pagination: 'pageButtons',
    table: 'row', grid: 'row', accordion: 'headerSelector',
  };
  // Roots too broad to be a component. A selection whose common ancestor is one
  // of these is spread across the page, not around a component, and building a
  // mapping on it quietly would be worse than refusing.
  const TOO_BROAD = { BODY: 1, HTML: 1, MAIN: 1 };

  /**
   * A field selector that means what it says GLOBALLY.
   *
   * commonSelectorFor answers for the container it is handed: given a <ul>, `a`
   * covers its links exactly and nothing more. U1 resolves against the whole
   * document, where `a` is every link on the site. This is the same fault that
   * was fixed for listbox options earlier, and it belongs here once rather than
   * in each branch — a bare tag is refused even when it matches the right count
   * today, because it is right only by accident of what else is on the page.
   */
  function scopedField(rootEl, rootSel, els) {
    if (!els.length) return null;
    const got = commonSelectorFor(rootEl, els, rootSel);
    if (!got || !got.selector) return null;
    const bare = got.selector;
    const countOf = (sel) => { try { return document.querySelectorAll(sel).length; } catch (e) { return -1; } };
    const isTagOnly = /^[a-z][a-z0-9]*$/i.test(bare);
    if (!isTagOnly && countOf(bare) === els.length && isU1Valid(bare)) return bare;
    // Anchor it on the root. `>` is a legal U1 combinator; a descendant space is
    // not, and neither is `*` — so the chain has to be built out of the real
    // structure rather than wildcarded. The overwhelmingly common shape is one
    // level of wrapper: <ul> > <li> > <a>. Ask what the parents have in common
    // and put that in the middle.
    const cands = [rootSel + '>' + bare];
    const parents = [];
    for (const el of els) {
      const p = el.parentElement;
      if (p && p !== rootEl && rootEl.contains(p) && parents.indexOf(p) === -1) parents.push(p);
    }
    if (parents.length) {
      const mid = commonSelectorFor(rootEl, parents, rootSel);
      if (mid && mid.selector) {
        // mid may already come back anchored on the root; do not anchor twice.
        const midBare = mid.selector.indexOf(rootSel + '>') === 0
          ? mid.selector.slice(rootSel.length + 1) : mid.selector;
        cands.push(rootSel + '>' + midBare + '>' + bare);
      }
    }
    for (const cand of cands) {
      const n = normalize(cand);
      if (isU1Valid(n) && countOf(n) === els.length) return n;
    }
    if (!isTagOnly && isU1Valid(bare)) return bare;   // wider than asked, but honest
    return null;
  }

  /** The nearest element containing all of them. */
  function commonAncestor(els) {
    if (!els.length) return null;
    let node = els[0];
    for (let i = 1; i < els.length; i++) {
      while (node && !node.contains(els[i])) node = node.parentElement;
      if (!node) return null;
    }
    // A single element is its own answer, not its parent's.
    return node;
  }

  /**
   * Resolve marks to elements. The mark attribute is the only binding there is,
   * and it is stripped by clearMarks — so a caller that wants to use this after
   * a capture has to have asked for the marks to be left up.
   */
  function elementsForMarks(marks) {
    const out = [];
    for (const m of marks || []) {
      const el = document.querySelector('[' + MARK_ATTR + '="' + String(m) + '"]');
      if (el && out.indexOf(el) === -1) out.push(el);
    }
    return out;
  }
  function elementForMark(mark) {
    return document.querySelector('[' + MARK_ATTR + '="' + String(mark) + '"]');
  }

  /**
   * `type` plus the marks a person ticked → the selectors a mapping needs.
   *
   * Returns { root, fields, why } or { err }. Nothing here calls a model, and
   * every selector is checked against U1's own validator before it is returned:
   * a field that would be rejected at runtime is worse than an absent one,
   * because it fails silently.
   */
  function describeComponent(type, marks, fallbackSel) {
    let els = elementsForMarks(marks);
    // Marks are an attribute written onto the page, and the first line of
    // collectCandidates is clearMarks() — so anything that re-reads the page
    // between the list being drawn and a component being built takes them all
    // away. The element is still there; only the label for it is gone.
    //
    // A selector is not destroyed by any of that, and the row that proposes a
    // component carries one. Falling back to it turns "None of those marks are
    // on the page any more" — which reads as "your component has vanished" and
    // is untrue — into a build that simply works.
    if (!els.length && fallbackSel) {
      try {
        const found = document.querySelector(fallbackSel);
        if (found) els = [found];
      } catch (e) { /* an invalid selector is reported below, as before */ }
    }
    if (!els.length) {
      return { err: fallbackSel
        ? 'Nothing on this page matches ' + fallbackSel + ' any more.'
        : 'None of those marks are on the page any more.' };
    }

    const single = els.length === 1;
    // One element ticked: it IS the component's root. Several: the component is
    // whatever contains them all, and they are its parts.
    let rootEl = single ? els[0] : commonAncestor(els);
    if (!rootEl) return { err: 'Those elements have no common parent.' };
    if (!single && TOO_BROAD[rootEl.tagName]) {
      return { err: 'Those elements only share <' + rootEl.tagName.toLowerCase() +
                    '> as a parent, so they are spread across the page rather than ' +
                    'forming one component. Tick a tighter group.' };
    }

    let rootSel = robustSelector(rootEl);
    if (!rootSel || !isU1Valid(rootSel)) {
      return { err: 'No selector U1 will accept could be built for that container.' };
    }

    const fields = {};
    const why = [];
    const itemField = ITEM_FIELD[type];

    if (!single && itemField) {
      const got = scopedField(rootEl, rootSel, els);
      if (got) {
        fields[itemField] = got;
        why.push(itemField + ' from the ' + els.length + ' elements you ticked');
      }
    }

    // Type-specific measurements, the same ones the tool already trusts over
    // the model elsewhere.
    if (type === 'menu' && !fields.items) {
      // menuItemsRoot DESCENDS to the item level, so handed the item level
      // itself it answers null — correctly, there is nowhere further down. When
      // a person ticks the <ul> directly that is the answer already, so fall
      // back to the element itself rather than treating null as failure.
      const root = menuItemsRoot(rootSel);
      const rsel = (root && (root.selector || root)) || rootSel;
      if (isU1Valid(rsel)) {
        const holder = document.querySelector(rsel);
        // The items are what a person ACTIVATES, which is the rule that already
        // governs listbox options: where every row holds exactly one link or
        // button, that is the item — role on a wrapper puts the focus on one
        // element and the action on another.
        const kids = holder ? Array.prototype.slice.call(holder.children) : [];
        const inner = kids.map((k) => {
          const hits = k.querySelectorAll('a[href],button');
          return hits.length === 1 ? hits[0] : k;
        });
        const use = inner.every((x, i) => x !== kids[i]) ? inner : kids;
        const got = use.length ? scopedField(holder, rsel, use) : null;
        if (got) {
          fields.items = got;
          why.push('items measured from the item level inside ' + rsel);
        }
      }
    }
    if (type === 'tabs') {
      const panels = tabPanelsFor(rootSel, fields.tab || 'button');
      const psel = panels && (panels.selector || panels);
      if (psel && isU1Valid(psel)) {
        fields.tabPanel = psel;
        why.push('tabPanel measured from what the tabs control');
      }
    }
    if (type === 'listbox' || type === 'combobox') {
      const shape = listboxShape(rootSel);
      if (shape) {
        // The listbox is the LIST — not the wrapper that also holds the button.
        // Ticking the wrapper is the natural thing to do and the wrong root, and
        // the measurement already knows which is which.
        if (shape.listbox && isU1Valid(shape.listbox) && shape.listbox !== rootSel) {
          rootSel = shape.listbox;
          why.push('rooted on the list itself, not the wrapper around it');
        }
        if (shape.options && isU1Valid(shape.options)) fields.options = shape.options;
        if (shape.trigger && isU1Valid(shape.trigger)) fields.trigger = shape.trigger;
        why.push('the list, its trigger and its options measured from the shape');
      }
    }
    if (type === 'dialog') {
      const t = openedBy(rootSel);
      const tsel = t && (t.selector || t);
      if (tsel && isU1Valid(tsel)) {
        fields.trigger = tsel;
        why.push('trigger measured from what opens it');
      }
    }

    return {
      root: rootSel,
      fields,
      // The count is what tells you a selector has quietly widened past the
      // elements you actually ticked.
      counts: Object.keys(fields).reduce((a, k) => {
        try { a[k] = document.querySelectorAll(fields[k]).length; } catch (e) { a[k] = -1; }
        return a;
      }, {}),
      picked: els.length,
      why: why.join(' · '),
    };
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
    const HINTED = 'a,button,input,select,textarea,summary,[role],[tabindex],[onclick],[class*="trigger"],[class*="toggle"],li,[aria-haspopup],[aria-expanded],[aria-controls]';
    let all = qsa(c, HINTED);
    // The recorder exists to find controls that give no hint, and asking it only
    // about elements that already gave one made it useless for exactly the case
    // it was written for: an anonymous <div> with a real click handler was never
    // in `all`, so its recorded handler was collected and never read.
    if (rec && typeof rec.all === 'function') {
      try {
        const known = new Set(all);
        for (const el of rec.all()) {
          if (el !== c && c.contains(el) && !known.has(el)) all.push(el);
        }
        // Document order, so the model reads the component the way it is built.
        all.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
      } catch { /* keep the hinted list as it stands */ }
    }
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

  // ───────────────────────────────────────────────────────────────────────────
  //  H. menuItemsRoot — the element whose own children are the menu items.
  //
  //  u1.fix.menu walks the root's CHILDREN looking for items. Given
  //  <nav><ul><li><a>…, the <nav> is the wrong root: its children are a logo, a
  //  search box and one <ul>, so the menu it builds has one item. The right root
  //  is the <ul> — the direct parent of the items.
  //
  //  Named containers get picked too high constantly, because <nav> is the
  //  obvious-looking answer and it is the one with the aria-label on it. This
  //  descends from whatever was chosen to the list itself, and returns null when
  //  there is nothing better, so the caller keeps what it had.
  // ───────────────────────────────────────────────────────────────────────────
  const MENU_ITEM = 'a[href],button,[role="menuitem"],[role="link"]';

  function menuItemsRoot(containerSel) {
    var start;
    try { start = document.querySelector(containerSel); } catch (e) { return null; }
    if (!start) return null;

    if (!start.querySelector(MENU_ITEM)) return null;

    // The list is the shallowest level whose children are HOMOGENEOUS — two or
    // more of them, all the same tag, each holding an item. That last test is
    // what separates <ul> from <nav>: a nav's children are a logo link and a
    // list, two different tags, and counting "children that contain an item"
    // alone scores that 2 and stops there. Breadth-first, so a mega-menu picks
    // the top-level list rather than one of the panels' own lists inside it.
    var queue = [start], best = null, seen = 0;
    while (queue.length && seen++ < 400) {
      var node = queue.shift();
      var kids = node.children;
      if (kids.length >= 2) {
        var tag = kids[0].tagName, same = true, hits = 0;
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].tagName !== tag) { same = false; break; }
          if (kids[i].matches(MENU_ITEM) || kids[i].querySelector(MENU_ITEM)) hits++;
        }
        if (same && hits === kids.length) { best = node; break; }
      }
      for (var j = 0; j < kids.length; j++) queue.push(kids[j]);
    }
    if (!best || best === start) return null;

    var sel = robustSelector(best);
    // A selector that cannot be reached, or that now matches something else as
    // well, is worse than the container we were given.
    if (!sel || !isU1Valid(sel)) return null;
    try { if (document.querySelector(sel) !== best) return null; } catch (e) { return null; }
    return sel;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  I. tabPanelsFor — the panels a tab strip switches between.
  //
  //  u1.fix.tabs without a tabPanel is a tab strip that announces itself as tabs
  //  and controls nothing: no aria-controls is written, arrow keys move between
  //  the tabs and the content never follows. It is required by the schema and
  //  the model still leaves it out, so it is worked out here instead of asked
  //  for — this is mechanical, and mechanical beats a second paid call.
  //
  //  Three ways, in order of how much they prove:
  //    1. The tabs SAY so — aria-controls / data-controls holding an element id.
  //    2. A role says so — [role="tabpanel"] near the strip.
  //    3. The shape says so — a set of same-class siblings the size of the tab
  //       count, of which exactly one is showing.
  // ───────────────────────────────────────────────────────────────────────────
  /**
   * An accordion, measured from whatever element was pointed at.
   *
   * u1.fix.accordion is rooted on the HEADER BUTTON — `headerSelector` is its
   * PRIMARY — and `contentSelector` is required. Detection points at the
   * container, because that is what carries the `accordion` class, so the
   * mapping came out as
   *
   *     fix.accordion('#faqPanel', { selectors: { headerSelector: '#faqPanel' } })
   *
   * a container in the button's place and the required content missing. That is
   * why implementing it did nothing.
   *
   * Accepts the container OR one of the triggers, since both are things a
   * person or a model plausibly points at. Returns null when it cannot see an
   * accordion, and then the caller keeps what it had.
   */
  function accordionShape(rootSel) {
    var root;
    try { root = document.querySelector(rootSel); } catch (e) { return null; }
    if (!root) return null;

    // Pointed at a trigger? Climb to whatever holds its siblings.
    var TRIGGERISH = 'button,[role="button"],summary,[aria-expanded],[data-expanded]';
    var isTrigger = false;
    try { isTrigger = root.matches(TRIGGERISH); } catch (e) {}
    if (isTrigger) {
      var up = root;
      for (var g = 0; g < 4 && up.parentElement; g++) {
        up = up.parentElement;
        if (up.querySelectorAll(TRIGGERISH).length >= 2) { root = up; break; }
      }
    }

    var triggers = [];
    try { triggers = Array.prototype.slice.call(root.querySelectorAll(TRIGGERISH)); } catch (e) { return null; }
    // One header is a disclosure, not an accordion, and u1 wants at least the
    // pattern. Two is the smallest thing that behaves like one.
    if (triggers.length < 2) return null;

    // The panel each trigger operates. Same three sources tabPanelsFor uses —
    // aria-controls, data-controls, then any data-* naming a real element —
    // then the structural fallback, which is what an unlabelled accordion is.
    var panels = [];
    for (var i = 0; i < triggers.length; i++) {
      var t = triggers[i], id = t.getAttribute('aria-controls') || t.getAttribute('data-controls'), panel = null;
      if (!id) {
        var at = t.attributes;
        for (var a = 0; a < at.length; a++) {
          if (at[a].name.indexOf('data-') !== 0) continue;
          var v = at[a].value;
          if (v && /^[A-Za-z][\w-]*$/.test(v) && document.getElementById(v)) { id = v; break; }
        }
      }
      if (id) panel = document.getElementById(id);
      if (!panel) {
        // The region after the header, inside the same item. A trigger wrapped
        // in an <h3> has its panel as the heading's sibling, not its own.
        var from = t;
        if (from.parentElement && /^H[1-6]$/.test(from.parentElement.tagName)) from = from.parentElement;
        panel = from.nextElementSibling;
      }
      if (panel && panels.indexOf(panel) === -1) panels.push(panel);
    }
    if (!panels.length) return null;

    var header = commonSelectorFor(root, triggers, robustSelector(root));
    var content = commonSelectorFor(root, panels, robustSelector(root)) ||
                  commonSelectorFor(document.body, panels, null);
    var hSel = header && header.selector, cSel = content && content.selector;
    if (!hSel || !cSel || !isU1Valid(hSel) || !isU1Valid(cSel)) return null;

    // The level u1 should announce. The wrapping heading is the site's own
    // statement about it; 3 is only a guess when it does not make one.
    var level = 0;
    var wrap = triggers[0].closest ? triggers[0].closest('h1,h2,h3,h4,h5,h6') : null;
    if (wrap) level = Number((wrap.tagName.match(/^H(\d)$/) || [])[1]) || 0;
    if (!level) {
      var ar = triggers[0].getAttribute('aria-level');
      level = Number(ar) || 0;
    }

    // Does opening one shut the others?
    //
    // Ask the TRIGGERS first. A panel closed by a class — `accordion__panel
    // is-hidden` — is only closed if the stylesheet says so, and reading its
    // height gets the answer wrong wherever CSS is not applied. The trigger's
    // own aria-expanded/data-expanded is the page stating the fact, and it is
    // true with or without a stylesheet.
    var open = 0, said = false;
    for (var e = 0; e < triggers.length; e++) {
      var st = triggers[e].getAttribute('aria-expanded');
      if (st === null) st = triggers[e].getAttribute('data-expanded');
      if (st === null) continue;
      said = true;
      if (st === 'true') open++;
    }
    // Only when nothing says: fall back to whether the panel is showing.
    if (!said) {
      for (var k = 0; k < panels.length; k++) {
        var p = panels[k];
        if (!p.hasAttribute('hidden') && p.getAttribute('aria-hidden') !== 'true' &&
            (p.offsetHeight || p.getClientRects().length)) open++;
      }
    }

    return {
      root: robustSelector(root),
      headerSelector: hSel,
      contentSelector: cSel,
      headingLevel: String(level || 3),
      collapsesOthers: open === 1 && panels.length > 1,
      headers: triggers.length,
      panels: panels.length,
    };
  }

  /**
   * Is a modal open on the page right now?
   *
   * "Scan the whole page" begins with window.scrollTo(0, 0) and then walks the
   * page a screenful at a time. That is exactly what closes a modal — and on a
   * page where one was open when the run started, the survey reads the page
   * BEHIND it and reports, truthfully and uselessly, that it found no dialog.
   * Reported as: I opened a dialog so it would scan it, and it did not.
   *
   * Nothing here can make that route work; scrolling is what it does. But the
   * conflict is detectable before a penny is spent, and saying so is the whole
   * difference between a wrong answer and a redirected one.
   *
   * Returns the modal's selector, or ''.
   */
  function openModalNow() {
    var seen = [];
    try {
      seen = Array.prototype.slice.call(document.querySelectorAll(
        'dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"],' +
        '.modal.show,.modal.in,.modal--open,.is-modal-open'));
    } catch (e) { return ''; }
    for (var i = 0; i < seen.length; i++) {
      var el = seen[i];
      // Visible, and big enough to be the thing in front of the page rather
      // than a hidden template of it — every site ships closed modals in the
      // markup, and those are not what this is asking about.
      var r;
      try { r = el.getBoundingClientRect(); } catch (e) { continue; }
      if (r.width < 80 || r.height < 60) continue;
      try {
        var st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.05) continue;
      } catch (e) {}
      return robustSelector(el);
    }
    return '';
  }

  /**
   * A dialog's close control and heading, measured rather than asked for.
   *
   * u1.fix.dialog's closeBtn is optional in the schema, so the model treats it
   * as optional in fact — and the general instruction "leave a field out
   * rather than guess" makes leaving it out the safe-looking answer every
   * time. The result was dialog after dialog shipped with no close control
   * bound, which is the one thing a keyboard user most needs from a modal.
   *
   * It is not a guess: an ✕, a "Close" or "Cancel" button, an
   * [aria-label*="close"], a .close/.modal-close class are all readable off
   * the markup. So read them.
   *
   * Returns null when the dialog genuinely has no closing control — which is
   * a real state, and then the caller leaves the field empty and says so.
   */
  function dialogShape(rootSel) {
    var root;
    try { root = document.querySelector(rootSel); } catch (e) { return null; }
    if (!root) return null;

    var out = {};

    // Ordered by how explicit the statement is. An aria-label naming "close"
    // is the author saying it outright; a class called .close is convention;
    // text content is the last resort because "Close" also appears in prose.
    var BY_ATTR = '[aria-label*="close" i],[title*="close" i],[data-dismiss],[data-close],' +
                  '[data-bs-dismiss="modal"],[aria-label*="dismiss" i]';
    var BY_CLASS = '.close,.close-btn,.closeBtn,.modal-close,.btn-close,.ssm-close-btn,' +
                   '[class*="close" i]';
    var close = null;
    try { close = root.querySelector(BY_ATTR) || root.querySelector(BY_CLASS); } catch (e) {}
    if (!close) {
      // Text, but only on something that is actually pressable, and only when
      // the whole label is the word — "Close" alone, not "Close your account".
      var CLICKY = 'button,a[href],[role="button"],input[type="button"],input[type="submit"]';
      var list = [];
      try { list = Array.prototype.slice.call(root.querySelectorAll(CLICKY)); } catch (e) {}
      for (var i = 0; i < list.length; i++) {
        var t = (list[i].textContent || '').trim().toLowerCase();
        if (t === 'close' || t === 'cancel' || t === '×' || t === '✕' || t === 'x') {
          close = list[i];
          break;
        }
      }
    }
    // The dialog itself is not its own close button.
    if (close && close !== root) out.closeBtn = robustSelector(close);

    // While we are reading the markup: the heading is the accessible name, and
    // it is just as readable and just as often left empty.
    var head = null;
    try {
      head = root.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]') ||
             root.querySelector('[class*="title" i],[class*="heading" i]');
    } catch (e) {}
    if (head && head !== root) out.heading = robustSelector(head);

    return (out.closeBtn || out.heading) ? out : null;
  }

  /**
   * An autocomplete, measured from whatever was pointed at.
   *
   * u1.fix.combobox wants four things — the wrapper, the input, the list and
   * the options — and until now every one of them had to be typed by hand,
   * because nothing detects an autocomplete at all: no class pattern matches
   * one, no role path finds one on a site that never wrote the roles, and the
   * probe's classifier can only ever answer tabs, menu, accordion or dialog.
   *
   * So it is measured by SHAPE instead, which is what an autocomplete is: a
   * single-line text input with a list of options beside it, under a common
   * parent. That holds whether or not the page says so.
   *
   * Accepts the wrapper, the input, or the list. Returns null when it does not
   * see one, and the caller keeps whatever it had.
   */
  function comboboxShape(rootSel) {
    var el;
    try { el = document.querySelector(rootSel); } catch (e) { return null; }
    if (!el) return null;

    var TEXTY = 'input:not([type]),input[type="text"],input[type="search"],' +
                'input[type="email"],input[type="tel"],input[type="url"],[contenteditable="true"]';
    var LISTY = 'ul,ol,[role="listbox"],[role="menu"],[role="grid"],[data-options],[class*="option" i],' +
                '[class*="suggest" i],[class*="result" i],[class*="dropdown" i],[class*="autocomplete" i]';

    // Climb until one element holds both halves. An autocomplete is exactly
    // "these two things belong together", and its wrapper is the smallest thing
    // that contains both.
    var wrap = el, input = null, list = null;
    for (var up = 0; up < 6 && wrap; up++) {
      try {
        input = wrap.querySelector(TEXTY);
        var lists = Array.prototype.slice.call(wrap.querySelectorAll(LISTY));
        list = null;
        for (var i = 0; i < lists.length; i++) {
          // A list is only the popup if it is not the input's own ancestor and
          // it holds more than one child — a single <li> is a result, not a
          // list of suggestions.
          if (input && lists[i].contains(input)) continue;
          if (lists[i].children.length < 1) continue;
          list = lists[i]; break;
        }
      } catch (e) { return null; }
      if (input && list) break;
      wrap = wrap.parentElement;
      // A combobox's wrapper is the smallest element holding the input and its
      // list. Once the climb reaches the page itself it has stopped finding a
      // component and started pairing whatever it can see: on a shop page it
      // matched the header's search field with an unrelated list of util-bar
      // links and reported `combobox: body`, which is a mapping that would
      // decorate the whole document.
      if (!wrap || wrap === document.body || wrap === document.documentElement) return null;
    }
    if (!input || !list || !wrap) return null;
    // The two halves have to be near each other. A suggestions list is beside
    // its input, not four sections away with half the page in between.
    if (wrap.querySelectorAll(TEXTY).length > 3) return null;

    var opts = Array.prototype.slice.call(list.children).filter(function (c) {
      return c.nodeType === 1;
    });
    if (!opts.length) return null;

    // The thing pointed at has to BELONG to what was found. Climbing six levels
    // from an unrelated element would otherwise walk up to <body> and report
    // whatever autocomplete happens to be elsewhere on the page — a confident
    // answer about something you were not looking at.
    if (el !== wrap && !input.contains(el) && el !== input &&
        !list.contains(el) && el !== list && !el.contains(input)) {
      return null;
    }

    var optSel = commonSelectorFor(list, opts, robustSelector(list));
    var sels = {
      combobox: robustSelector(wrap),
      textbox: robustSelector(input),
      listbox: robustSelector(list),
      options: (optSel && optSel.selector) || '',
    };
    // A label, if the page has one. Optional in the schema, so its absence is
    // not a reason to refuse the whole shape.
    var lab = null;
    try {
      lab = (input.id && document.querySelector('label[for="' + input.id + '"]')) ||
            (input.closest ? input.closest('label') : null) ||
            wrap.querySelector('label');
    } catch (e) {}
    if (lab) sels.label = robustSelector(lab);

    for (var k in sels) {
      if (k === 'label') continue;
      if (!sels[k] || !isU1Valid(sels[k])) return null;
    }
    return sels;
  }

  /**
   * A filter field and the list it filters, measured from either.
   *
   * NOT a combobox, and calling it one would make the page worse. An ARIA
   * combobox has a popup that opens and closes; this list is always there and
   * typing narrows it. Giving it role="combobox" and aria-expanded describes a
   * control that does not exist, and a screen reader then waits for a popup
   * that never comes.
   *
   * What it actually needs is WCAG 4.1.3: type a letter, the list changes, and
   * nothing says so. The branch locator on the shop page is exactly this —
   * fourteen results narrowing to two in silence.
   *
   * The shape: a text or search input, and a container of three or more
   * sibling items that is visible right now, close enough to be its results.
   */
  function filterListShape(rootSel) {
    var el;
    try { el = document.querySelector(rootSel); } catch (e) { return null; }
    if (!el) return null;

    // A FIELD, not only a text box.
    //
    // This required a text input, so a filter bar built out of five dropdowns —
    // which is most of the filter bars there are — matched nothing and fell
    // between every rule in the tool: not a form (no submit), not a combobox
    // (no popup), and not this. Somebody picks "Haifa", four branches become
    // one, and nothing says so.
    //
    // The need is identical whichever control does the narrowing; only the
    // event differs, and the corrector listens for both now.
    var TEXTY = 'input[type="search"],input[type="text"],input:not([type]),' +
                'select,input[type="checkbox"],input[type="radio"]';
    var input = null, list = null, wrap = el;

    for (var up = 0; up < 5 && wrap; up++) {
      try {
        input = wrap.matches(TEXTY) ? wrap : wrap.querySelector(TEXTY);
        list = null;
        if (input) {
          var kids = Array.prototype.slice.call(wrap.querySelectorAll('*'));
          for (var i = 0; i < kids.length; i++) {
            var c = kids[i];
            if (c === input || c.contains(input)) continue;
            // Three or more element children that look alike is a list of
            // results. Two is a pair of buttons.
            var items = Array.prototype.slice.call(c.children).filter(function (x) { return x.nodeType === 1; });
            if (items.length < 3) continue;
            var first = items[0].tagName + '|' + (items[0].className || '');
            var alike = items.filter(function (x) { return x.tagName + '|' + (x.className || '') === first; });
            if (alike.length < 3) continue;
            list = c; break;
          }
        }
      } catch (e) { return null; }
      if (input && list) break;
      wrap = wrap.parentElement;
      if (!wrap || wrap === document.body || wrap === document.documentElement) return null;
    }
    if (!input || !list) return null;

    var items2 = Array.prototype.slice.call(list.children).filter(function (x) { return x.nodeType === 1; });
    var itemSel = commonSelectorFor(list, items2, robustSelector(list));
    // Every control that narrows the list, not just the first one found. Five
    // selects need five listeners; a selector matching one of them announces
    // for one of them and stays silent for the other four.
    var fieldSel = robustSelector(input);
    try {
      var siblings = Array.prototype.slice.call(wrap.querySelectorAll(TEXTY))
        .filter(function (f) { return !list.contains(f); });
      if (siblings.length > 1) {
        var common = commonSelectorFor(wrap, siblings, robustSelector(wrap));
        if (common && common.selector && isU1Valid(common.selector)) fieldSel = common.selector;
      }
    } catch (e) {}

    var sels = {
      field: fieldSel,
      results: robustSelector(list),
      item: (itemSel && itemSel.selector) || '',
    };
    for (var k in sels) if (!sels[k] || !isU1Valid(sels[k])) return null;
    sels.count = items2.length;
    // Its own label, if the page gave it one — the field needs a name whatever
    // else is done to it.
    try {
      var lab = (input.id && document.querySelector('label[for="' + input.id + '"]')) ||
                (input.closest ? input.closest('label') : null);
      sels.labelled = !!(lab || input.getAttribute('aria-label') || input.getAttribute('aria-labelledby'));
    } catch (e) { sels.labelled = false; }
    return sels;
  }

  function tabPanelsFor(tabListSel, tabSel) {
    var listEl, tabs = [];
    try {
      listEl = document.querySelector(tabListSel);
      tabs = listEl ? Array.prototype.slice.call(listEl.querySelectorAll(tabSel)) : [];
    } catch (e) { return null; }
    if (!listEl || tabs.length < 2) return null;

    var scope = listEl.parentElement || document.body;
    var byId = [];
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var id = t.getAttribute('aria-controls') || t.getAttribute('data-controls');
      if (!id) {
        // Any data-* holding the id of a real element. A site wiring its own
        // tabs through data-finder-tab="finderSport" is entirely ordinary, and
        // it is the same statement as aria-controls with the ARIA left off.
        var at = t.attributes;
        for (var a = 0; a < at.length; a++) {
          if (at[a].name.indexOf('data-') !== 0) continue;
          var v = at[a].value;
          if (v && /^[A-Za-z][\w-]*$/.test(v) && document.getElementById(v)) { id = v; break; }
        }
      }
      var el = id ? document.getElementById(id) : null;
      if (el) byId.push(el);
    }
    // commonSelectorFor answers with a record, not a string.
    var pick = function (r) { return r && r.selector && isU1Valid(r.selector) ? r.selector : null; };

    if (byId.length >= 2) {
      var sel = pick(commonSelectorFor(scope, byId, null)) ||
                pick(commonSelectorFor(document.body, byId, null));
      if (sel) return sel;
    }

    // ── One region, re-rendered per tab ──────────────────────────────────────
    // Every strategy above needs TWO panels, and a great many tab strips have
    // one: six buttons over a single region the site re-renders. Measured on a
    // live page — six tabs, `data-controls="dealPanel"` naming an id that does
    // not exist, and one `.deal-grid` — where all four strategies returned null
    // and the strip could not be mapped at all.
    //
    // What does answer it is the link running the OTHER way. The panel names
    // the tab whose content it is showing, which is what the APG requires of a
    // one-panel strip and is the same signal u1-patch:tabs already reads at
    // runtime to decide which tab is selected. Reading it here too costs
    // nothing and is the only evidence such a strip offers.
    var tabIds = [];
    for (var ti = 0; ti < tabs.length; ti++) if (tabs[ti].id) tabIds.push(tabs[ti].id);
    if (tabIds.length) {
      var named = [];
      var hunt = scope;
      for (var up = 0; up < 3 && hunt; up++) {
        var all;
        try { all = hunt.querySelectorAll('*'); } catch (e) { all = []; }
        for (var n = 0; n < all.length; n++) {
          var cand = all[n];
          if (cand === listEl || listEl.contains(cand) || cand.contains(listEl)) continue;
          var ats = cand.attributes, hit = false;
          for (var b = 0; b < ats.length && !hit; b++) {
            // aria-labelledby, data-labelledby, data-labelled-by — the same
            // statement with the ARIA filed off, which is what this whole
            // family of sites does.
            if (!/labell?edby|labelled-by/i.test(ats[b].name)) continue;
            var toks = String(ats[b].value).split(/\s+/);
            for (var q = 0; q < toks.length; q++) {
              if (tabIds.indexOf(toks[q]) !== -1) { hit = true; break; }
            }
          }
          if (hit && named.indexOf(cand) === -1) named.push(cand);
        }
        if (named.length) break;
        hunt = hunt.parentElement;
      }
      if (named.length) {
        var nsel = pick(commonSelectorFor(named[0].parentElement || document.body, named, null)) ||
                   pick(commonSelectorFor(document.body, named, null));
        if (nsel) return nsel;
      }
    }

    var roled = [];
    try { roled = Array.prototype.slice.call(scope.querySelectorAll('[role="tabpanel"]')); } catch (e) {}
    if (roled.length >= 2) {
      var rsel = pick(commonSelectorFor(scope, roled, null));
      if (rsel) return rsel;
    }

    // Shape. Walk up from the strip looking for a level holding a run of
    // same-class siblings as numerous as the tabs, with exactly one of them
    // visible — which is what a tab panel set looks like with the ARIA off.
    var node = listEl.parentElement, guard = 0;
    while (node && guard++ < 4) {
      var groups = {};
      var kids = node.children;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k] === listEl || kids[k].contains(listEl)) continue;
        var cls = classesOf(kids[k]).filter(function (c) { return !NOISE.test(c); })[0];
        if (!cls) continue;
        (groups[cls] = groups[cls] || []).push(kids[k]);
      }
      for (var key in groups) {
        var g = groups[key];
        if (g.length < 2 || Math.abs(g.length - tabs.length) > 1) continue;
        var shown = g.filter(function (el) {
          if (el.hidden) return false;
          var cs = window.getComputedStyle(el);
          return cs.display !== 'none' && cs.visibility !== 'hidden';
        }).length;
        if (shown !== 1) continue;
        var gsel = pick(commonSelectorFor(node, g, null));
        if (gsel) return gsel;
      }
      node = node.parentElement;
    }
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  J. openedBy — what a trigger opens.
  //
  //  A listbox, a datepicker and a tooltip are all rooted on the thing that
  //  APPEARS, not on the control that summons it, and the schema requires both.
  //  A whole-page sweep has nobody to ask: it finds "Sign In drop-down trigger",
  //  holds only the trigger, and the mapping was dropped for want of the other
  //  half — silently, which is how six components became five.
  //
  //  Same ladder as everywhere else: what the page states, then what it shows.
  // ───────────────────────────────────────────────────────────────────────────
  const POPUP_ROLE = '[role="menu"],[role="listbox"],[role="dialog"],[role="grid"],[role="tree"]';

  function openedBy(triggerSel) {
    var t;
    try { t = document.querySelector(triggerSel); } catch (e) { return null; }
    if (!t) return null;

    var pick = function (el) {
      if (!el || el === t || el.contains(t)) return null;
      var sel = robustSelector(el);
      if (!sel || !isU1Valid(sel)) return null;
      try { if (document.querySelector(sel) !== el) return null; } catch (e) { return null; }
      return sel;
    };

    // 1. The page states it.
    var id = t.getAttribute('aria-controls') || t.getAttribute('aria-owns');
    if (!id) {
      var at = t.attributes;
      for (var a = 0; a < at.length; a++) {
        if (at[a].name.indexOf('data-') !== 0) continue;
        var v = at[a].value;
        if (v && /^[A-Za-z][\w-]*$/.test(v) && document.getElementById(v)) { id = v; break; }
      }
    }
    if (id) {
      var byId = pick(document.getElementById(id));
      if (byId) return byId;
    }

    // 2. A role says so, in the trigger's own neighbourhood — a popup is a
    //    sibling or a cousin of its trigger, never the far side of the page.
    var node = t, guard = 0;
    while (node && guard++ < 4) {
      var scope = node.parentElement;
      if (!scope) break;
      var roled = null;
      try { roled = scope.querySelector(POPUP_ROLE); } catch (e) {}
      var byRole = pick(roled);
      if (byRole) return byRole;
      node = scope;
    }

    // 3. The shape says so: the nearest following sibling of the trigger, or of
    //    an ancestor close to it, holding several links or options rather than
    //    a piece of text. That is what a drop-down IS with the ARIA left off,
    //    which is the ordinary case and the one that matters.
    node = t; guard = 0;
    while (node && guard++ < 3) {
      var sib = node.nextElementSibling;
      while (sib) {
        var items = 0;
        try { items = sib.querySelectorAll('a[href],button,li,[role="option"],[role="menuitem"]').length; } catch (e) {}
        if (items >= 2) {
          var byShape = pick(sib);
          if (byShape) return byShape;
        }
        sib = sib.nextElementSibling;
      }
      node = node.parentElement;
    }
    return null;
  }

  /**
   * The list a listbox mapping should actually be rooted on.
   *
   * u1.fix.listbox looks for the options INSIDE the container, so the container
   * has to be the list that appears — not the button that opens it and not the
   * wrapper holding both. That mistake has now been made twice by the model in
   * a row, in both directions:
   *
   *   listbox: ".clicker"    the button          → no options inside a button
   *   listbox: ".click-nav"  the wrapper         → contains the trigger too
   *
   * A prompt can ask for the right element; only a check can establish it. This
   * is the check: if what was chosen already holds option-shaped children, keep
   * it. Otherwise ask what it opens.
   *
   * Returns null when the choice was already right, or when there is nothing
   * better to offer — the caller keeps what it had.
   */
  function listboxRoot(rootSel) {
    var root;
    try { root = document.querySelector(rootSel); } catch (e) { return null; }
    if (!root) return null;

    var OPTION = 'li,[role="option"],[role="menuitem"],a[href],button';
    var direct = 0, kids = root.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].matches(OPTION)) direct++;
    }
    // Two or more option-shaped CHILDREN means this really is the list. Counting
    // descendants instead would accept the wrapper, which contains the list.
    if (direct >= 2) return null;

    var opened = openedBy(rootSel);
    if (!opened || opened === rootSel) return null;
    return opened;
  }

  /**
   * The whole listbox, read off the structure. No model involved.
   *
   * Given the container a specialist pointed at, this is not a judgement call:
   *
   *   something clickable inside it            → the trigger, it has the event
   *   something that CONTAINS several things   → the listbox, that is the shape
   *
   * The model has now been asked three times and answered wrong three times, in
   * three different arrangements — the button as the listbox, the wrapper as the
   * listbox, and finally the two swapped outright. Each answer had a fluent
   * explanation and every field resolved. That is the signature of a question
   * that should not be asked: the shape is mechanical, so it is measured.
   *
   * Returns { listbox, trigger, options } or null when the container does not
   * have this shape at all — in which case the caller keeps what it had.
   */
  const LB_ITEM = 'li,[role="option"],[role="menuitem"],a[href],button';
  const LB_ACTIVATES = 'a[href],button,[role="option"],[role="menuitem"],[tabindex]';

  /**
   * Within one row of a list, the element a person actually activates.
   *
   * Order is by strength of evidence, not by tag:
   *
   *   1. the event recorder saw a click handler on it — an OBSERVATION, and the
   *      only source here that is not an inference. It is already what picks
   *      the trigger; it belongs on the options for the same reason.
   *   2. the row's single interactive descendant — <a href> or <button>.
   *   3. nothing better: the row itself.
   *
   * Returns null when the row IS the activatable thing already, so a caller can
   * tell "descend to this" from "stay where you are".
   */
  function optionInside(row) {
    if (!row) return null;
    var rec = root.__u1EventMap;
    if (rec && rec.has) {
      var watched = Array.prototype.slice.call(row.querySelectorAll('*'));
      for (var i = 0; i < watched.length; i++) {
        if (rec.has(watched[i])) return watched[i];
      }
      // The handler is on the row itself — a delegated list, and the row is
      // genuinely the option. Say so by refusing to descend.
      if (rec.has(row)) return null;
    }
    var hits;
    try { hits = row.querySelectorAll(LB_ACTIVATES); } catch (e) { return null; }
    return hits.length === 1 ? hits[0] : null;
  }

  function listboxShape(containerSel) {
    var box;
    try { box = document.querySelector(containerSel); } catch (e) { return null; }
    if (!box) return null;

    // THE LIST: the shallowest descendant with two or more item-shaped children
    // of its own. Whether it is a <ul> or a <div> is irrelevant — what makes it
    // the list is that it holds the items.
    var queue = [box], panel = null, seen = 0;
    while (queue.length && seen++ < 400) {
      var node = queue.shift();
      var kids = node.children, hits = 0;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].matches(LB_ITEM) || kids[i].querySelector(LB_ITEM)) hits++;
      }
      // `node !== box` matters: the container itself holds the trigger AND the
      // list, so it always scores 2 and would win every time.
      if (hits >= 2 && node !== box) { panel = node; break; }
      for (var j = 0; j < kids.length; j++) queue.push(kids[j]);
    }
    if (!panel) return null;

    // THE TRIGGER: the clickable thing that is NOT inside the list. A <button>
    // first, because that is what it almost always is; then anything carrying a
    // popup attribute; then anything the event recorder saw a click handler on.
    var trigger = null;
    var pool = Array.prototype.slice.call(
      box.querySelectorAll('button,[role="button"],a[href],[aria-haspopup],[tabindex]'));
    var rec = root.__u1EventMap;
    for (var p = 0; p < pool.length; p++) {
      var el = pool[p];
      if (panel.contains(el) || el === panel) continue;
      if (el.tagName === 'BUTTON') { trigger = el; break; }
      if (!trigger) trigger = el;
      if (rec && rec.has && rec.has(el)) { trigger = el; break; }
    }
    if (!trigger) return null;

    var lbSel = robustSelector(panel);
    var trSel = robustSelector(trigger);
    if (!lbSel || !trSel || !isU1Valid(lbSel) || !isU1Valid(trSel)) return null;

    // THE OPTIONS: the list's own children, named by what they share.
    // THE OPTIONS: the element a person actually ACTIVATES, which is not always
    // the row that holds it.
    //
    // A list of <li><a>…</a></li> returns the <li> if you stop at the panel's
    // children, and `role="option"` on a wrapper containing a link is a broken
    // pair — the focus lands on one element and the action is on the other.
    //
    // Evidence first, tag second. Descending is only allowed when EVERY row
    // agrees on the same level: one row holding two links means there is no
    // common level to descend to, and the wrappers are the honest answer.
    var rows = Array.prototype.slice.call(panel.children)
      .filter(function (c) { return c.matches(LB_ITEM) || c.querySelector(LB_ITEM); });

    var items = rows;
    var inner = rows.map(function (row) { return optionInside(row); });
    if (inner.every(function (el) { return !!el; })) items = inner;

    // commonSelectorFor answers for the CONTAINER it is given: inside this
    // panel, plain `a` covers every option and nothing else. U1 resolves the
    // selector against the whole document, where `a` is every link on the site.
    //
    // So the answer is checked globally and scoped under the list if it is
    // wider there. Descending to the links is what exposed this — while the
    // options were `li` the short form happened to be unique anyway.
    var opt = commonSelectorFor(panel, items, lbSel);
    var optSel = (opt && opt.selector && isU1Valid(opt.selector)) ? opt.selector : '';
    // A bare tag — `a`, `li`, `button` — is refused even when it happens to
    // match the right number today. It is right by accident of what else is on
    // the page, and gains a wrong match the moment the page gains a link. The
    // count check below cannot tell the two apart, because on this page they
    // look identical.
    if (/^[a-z][a-z0-9]*$/i.test(optSel)) optSel = '';
    if (optSel && countOf(optSel) !== items.length) {
      var scoped = lbSel + ' ' + optSel;                 // for the count only
      var direct = lbSel + '>' + optSel;
      // U1 takes no descendant spaces, so only the child form is usable — and
      // it is right whenever the items are the list's own children.
      optSel = (countOf(direct) === items.length) ? direct : '';
      void scoped;
    }
    if (!optSel) {
      // Last resort: name them by position under the list, which is always
      // exact even when nothing about them is nameable.
      var tag = items[0].tagName.toLowerCase();
      var viaRow = lbSel + '>' + panel.children[0].tagName.toLowerCase() + '>' + tag;
      optSel = countOf(viaRow) === items.length ? viaRow : lbSel + '>' + tag;
    }

    return { listbox: lbSel, trigger: trSel, options: optSel };
  }

  /**
   * A role the SITE wrote, which this mapping is about to write over.
   *
   * Molina's dropdown ships `<ul class="signin-dropdown" role="menu">`. Mapped
   * as a listbox, u1 is asked to put `role="listbox"` over an author's role.
   * The trigger was decorated and the list was not, and nothing anywhere said
   * why — the two statements simply disagreed and one of them lost.
   *
   * The distinction that matters is WHO wrote it. A role u1 has already written
   * is our own and is not news; a role that was in the markup first is the
   * author's opinion about what this element is, and overruling it is a
   * decision for a person, not a default.
   *
   * Returns { role, willWrite } when there is a genuine conflict, else null.
   */
  // What u1.fix.<type> writes on the PRIMARY element. Only types where the
  // repo can say so from its own record — test-engine.js asserts each of these
  // roles after an apply — so a question here is never a guess.
  //
  // accordion's primary is the header, which U1 makes a button; heading's is
  // the element it promotes. Types absent from this list either write no role
  // on the primary or write one this tool has not verified, and asking about a
  // role we are not sure we will write is worse than not asking.
  const ROLE_BY_TYPE = {
    listbox: 'listbox', combobox: 'combobox', menu: 'menu', tabs: 'tablist',
    dialog: 'dialog', grid: 'grid', table: 'table', radio: 'radiogroup',
    tooltip: 'tooltip', button: 'button', checkbox: 'checkbox',
    accordion: 'button', heading: 'heading', link: 'link',
  };

  /**
   * A form's required fields, read off the page. No model involved.
   *
   * Every other component type has one of these — listboxShape, dialogShape,
   * accordionShape, comboboxShape, tabPanelsFor. `form` had none, and the
   * consequence was not a worse answer, it was no answer: u1.fix.form requires
   * submitButton, inputField and invalidField, nothing on this side ever looked
   * for them, so the model was asked, and a model looking at a screenshot
   * cannot see which control submits or what class the page adds to a field it
   * rejects. It returned empty strings, the save guard correctly refused, and
   * the card said "could not be mapped" on a plain search box with a Go button
   * sitting in the markup.
   *
   * Two of the three are mechanical. The third needs explaining.
   *
   * `invalidField` is not a thing on the page — it is what the page WILL put
   * there once somebody submits something wrong, and nothing is wrong yet. So
   * it is looked for in this order: a field already marked invalid; then the
   * page's own stylesheet, which has to contain a rule for the state before the
   * page can show it; then `[aria-invalid="true"]`, which is the standard and
   * is what an accessible form is supposed to set regardless. A wrong guess
   * here costs nothing at load — the selector simply matches nothing until a
   * field goes bad — which is why a fallback is honest here and would not be
   * for, say, a trigger.
   */
  const INVALID_CLASS_RE = /(^|[.\s>+~,:[])((is-)?invalid|has-error|is-error|error|ng-invalid|field-error|input-error)\b/i;

  function formShape(containerSel) {
    let c;
    try { c = document.querySelector(containerSel); } catch (e) { return null; }
    if (!c) return null;

    const pick = (els, why) => {
      const r = commonSelectorFor(c, uniq(els), containerSel);
      return r && r.selector && isU1Valid(r.selector) ? { selector: r.selector, count: r.count, why } : null;
    };

    // Every control a person fills. Hidden inputs are not fields, and a submit
    // is a control but not something anyone types into.
    const inputs = qsa(c, 'input,select,textarea').filter((el) => {
      const t = (el.getAttribute('type') || '').toLowerCase();
      return t !== 'hidden' && t !== 'submit' && t !== 'button' && t !== 'image' && t !== 'reset';
    });

    // What submits. `<button>` inside a form defaults to type=submit, which is
    // why a bare <button> counts — the Go control on a search box usually is
    // one and declares nothing.
    let submits = qsa(c, 'button[type="submit"],input[type="submit"],input[type="image"]');
    if (!submits.length) {
      submits = qsa(c, 'button').filter((b) => {
        const t = (b.getAttribute('type') || '').toLowerCase();
        return t === '' || t === 'submit';
      });
    }
    if (!submits.length) {
      // A search box built out of divs still has one control that runs it, and
      // it is the clickable thing that is not one of the fields.
      submits = qsa(c, '[role="button"],a[href]').filter((el) => inputs.indexOf(el) === -1);
    }
    // "Exactly one", per the schema. Several means the last one is as good a
    // guess as any, and a guess is worse than the narrower first match.
    if (submits.length > 1) submits = [submits[0]];

    let invalid = null;
    const marked = qsa(c, '[aria-invalid="true"],.is-invalid,.has-error,.error,.invalid');
    if (marked.length) {
      invalid = pick(marked, 'A field on the page is already marked invalid, so this is the page\'s own marker.');
    }
    if (!invalid) {
      // The page cannot show an error state it has no rule for. Reading the
      // rule is how the marker is learnt without submitting anything.
      let cls = '';
      try {
        outer:
        for (const sheet of Array.from(document.styleSheets || [])) {
          let rules = [];
          try { rules = Array.from(sheet.cssRules || []); } catch (e) { continue; }  // cross-origin
          for (const rule of rules) {
            const sel = rule && rule.selectorText;
            if (!sel || !INVALID_CLASS_RE.test(sel)) continue;
            for (const part of sel.split(',')) {
              const m = part.match(/\.((?:is-)?invalid|has-error|is-error|error|field-error|input-error)\b/i);
              if (m) { cls = '.' + m[1]; break outer; }
            }
          }
        }
      } catch (e) {}
      if (cls && isU1Valid(cls)) {
        invalid = { selector: cls, count: countOf(cls),
          why: 'The page\'s own stylesheet has a rule for this class, which is how it shows a bad field.' };
      }
    }
    if (!invalid) {
      invalid = { selector: '[aria-invalid="true"]', count: countOf('[aria-invalid="true"]'),
        why: 'Nothing is marked invalid yet and the stylesheet names no class for it, so the standard attribute is used. It matches nothing until a field goes bad, which is the point.' };
    }

    const inputField = inputs.length ? pick(inputs, `${inputs.length} field${inputs.length === 1 ? '' : 's'} a person fills in.`) : null;
    const submitButton = submits.length ? pick(submits, 'The control that submits this form.') : null;
    if (!inputField && !submitButton) return null;

    const out = { invalidField: invalid };
    if (inputField) out.inputField = inputField;
    if (submitButton) out.submitButton = submitButton;

    // Optional, and free once the rest is being read.
    const err = qsa(c, '[role="alert"],[class*="error-message"],[class*="errorMessage"],[class*="help-block"]');
    if (err.length) {
      const r = pick(err, 'The element the message for a bad field goes in.');
      if (r) out.errorMsg = r;
    }
    const req = qsa(c, '[required],[aria-required="true"]');
    if (req.length && req.length !== inputs.length) {
      const r = pick(req, `${req.length} field${req.length === 1 ? '' : 's'} the form will not go without.`);
      if (r) out.requiredField = r;
    }
    return out;
  }

  /**
   * Rename an element that was named in a way U1 cannot resolve.
   *
   * U1 puts every selector through jQuery, which refuses a descendant space and
   * a pseudo-class — silently. So `#state-select-modal h2` is a perfectly good
   * CSS selector, resolves in one line in the console, points at exactly the
   * right heading, and would decorate nothing forever. The save guard catches
   * it and refuses, which is right, and then says "give the element a class if
   * it has nothing else to point at" — to a person, about an element the tool
   * is looking straight at.
   *
   * There is nothing to ask. The selector RESOLVES; the browser has no trouble
   * with it. So resolve it, take the elements it points at, and name them again
   * with the same builder every other selector in this tool comes from —
   * robustSelector walks up adding `>` compounds until the name is unique, and
   * every name it emits is U1-valid by construction. `#state-select-modal h2`
   * becomes `.modal-header>h2`.
   *
   * The repair is only accepted if the new name points at the SAME elements, in
   * the same order. A rename that quietly widens or moves the target would be
   * worse than the refusal it replaces — that is the failure this whole guard
   * exists to prevent, and it must not be reintroduced by the repair.
   */
  function repairForU1(sel) {
    if (typeof sel !== 'string' || !sel.trim() || isU1Valid(sel)) return null;
    let els;
    try { els = Array.from(document.querySelectorAll(sel)); } catch (e) { return null; }
    if (!els.length) return null;   // names nothing; a rename cannot help it

    let out = '';
    if (els.length === 1) {
      const r = robustSelector(els[0]);
      if (r && isU1Valid(r)) out = r;
    } else {
      const anc = commonAncestor(els);
      const ancSel = anc && anc !== document.body ? robustSelector(anc) : null;
      const r = commonSelectorFor(anc || document.body, els, ancSel);
      if (r && r.selector && isU1Valid(r.selector)) out = r.selector;
    }
    if (!out) return null;

    let now;
    try { now = Array.from(document.querySelectorAll(out)); } catch (e) { return null; }
    if (now.length !== els.length) return null;
    for (let i = 0; i < els.length; i++) if (now[i] !== els[i]) return null;
    return out;
  }

  // ── Two questions about a component that should be measured, not asked ────

  /**
   * Is this already accessible without u1?
   *
   * A native `<a href>` and a native `<button>` carry their role and their
   * place in the tab order from the browser, for free. A u1.fix.link on one
   * adds nothing — it re-announces an element that already announces itself,
   * which is the double-fixing a specialist would never do by hand and which
   * has been the single biggest source of padding in an automatic pass: of
   * twenty-one components produced across two sites in one day, most were
   * links and buttons that were already links and buttons.
   *
   * The prompt has said not to do this in plain words for a long time. It is
   * still the commonest row on the list, which is the signature of a question
   * that should be measured instead of asked.
   *
   * Three things keep it on the list, and they are the cases u1.fix.link and
   * u1.fix.button were actually written for:
   *   — it is NOT native: a <div> or <span> wired with a click handler, which
   *     the browser gives no role and no tab stop;
   *   — an <a> with no href, which is not a link at all however it looks;
   *   — it has no accessible name, so it is announced as "link" and nothing else.
   */
  function alreadyNative(sel) {
    let el;
    try { el = document.querySelector(sel); } catch (e) { return null; }
    if (!el) return null;
    const tag = el.tagName;
    const role = (el.getAttribute('role') || '').toLowerCase();
    const isLink = tag === 'A' && el.hasAttribute('href');
    const isBtn = tag === 'BUTTON' ||
      (tag === 'INPUT' && /^(button|submit|reset|image)$/i.test(el.getAttribute('type') || ''));
    if (!isLink && !isBtn) return null;
    // A role that contradicts the tag is a real defect and stays on the list.
    if (role && !((isLink && role === 'link') || (isBtn && role === 'button'))) return null;
    if (el.getAttribute('aria-hidden') === 'true') return null;
    const name = accName(el);
    if (!name) return null;
    // Taken out of the tab order by hand — the browser's free tab stop is gone.
    const ti = el.getAttribute('tabindex');
    if (ti != null && parseInt(ti, 10) < 0) return null;
    return { tag: tag.toLowerCase(), name };
  }

  /**
   * A `menu` that is really a listbox.
   *
   * u1 draws the line by BEHAVIOUR, not by the word in the markup. fix.menu is
   * for a standing bar of navigation — several items, arrow keys across them,
   * usually drop-downs beneath. fix.listbox is for one control that opens one
   * flat list of options and closes again when you pick one.
   *
   * The Sign In drop-down on a real site is the second, and it says
   * `role="menu"` in its HTML, so it was read as a menu and mapped with
   * fix.menu — which on that shape does nothing useful and, with submenus,
   * throws outright. The specialist mapping the same site by hand wrote it as a
   * listbox with overwriteRole:"menu". The markup's word lost to the shape,
   * which is the right way round.
   *
   * Guarded so a real navigation menu can never fall in here:
   *   — anything in a <nav> or role="navigation" is left alone. This codebase
   *     already treats <nav> as deciding for `menu`, and a hamburger revealing
   *     the site nav is the case that would otherwise be caught;
   *   — the list must be FLAT. One nested item-list and it is a menu with
   *     submenus, which is exactly what fix.listbox cannot express;
   *   — the control must declare or behave like a disclosure: the list hidden
   *     right now, or aria-haspopup / aria-expanded on the trigger. A list
   *     standing open with no control over it is not a listbox.
   */
  function menuIsReallyListbox(containerSel) {
    let el;
    try { el = document.querySelector(containerSel); } catch (e) { return null; }
    if (!el) return null;
    try {
      if (el.closest('nav,[role="navigation"]')) return null;
    } catch (e) {}

    // The survey names the component, which for this shape is as often the list
    // as the wrapper holding the list and its button. listboxShape needs the
    // wrapper, so try both.
    let shape = listboxShape(containerSel);
    if (!shape && el.parentElement) {
      const up = robustSelector(el.parentElement);
      if (up && isU1Valid(up)) shape = listboxShape(up);
    }
    if (!shape || !shape.listbox || !shape.trigger) return null;

    let panel, trigger;
    try {
      panel = document.querySelector(shape.listbox);
      trigger = document.querySelector(shape.trigger);
    } catch (e) { return null; }
    if (!panel || !trigger) return null;

    // Flat: no row of this list contains a list of its own.
    for (const row of Array.from(panel.children)) {
      let nested = [];
      try { nested = Array.from(row.querySelectorAll('ul,ol,[role="menu"],[role="listbox"]')); } catch (e) {}
      for (const n of nested) {
        let items = 0;
        for (const k of Array.from(n.children)) if (k.matches(LB_ITEM)) items++;
        if (items >= 2) return null;
      }
    }

    const declares = trigger.hasAttribute('aria-haspopup') || trigger.hasAttribute('aria-expanded');
    if (!declares && visibleInViewport(panel)) return null;

    // A drop-down whose rows are REAL links is a menu wherever it lives —
    // "My account" outside <nav> included. Only rows that navigate count:
    // href="#" and javascript: are buttons wearing <a>. Half or more linky
    // rows means the items lead somewhere, and things that lead somewhere
    // are a menu, not a value picker.
    try {
      const panelEl = document.querySelector(shape.listbox);
      if (panelEl) {
        const rows = Array.prototype.filter.call(panelEl.children, (r) => r.nodeType === 1);
        const linky = rows.filter((r) => {
          const a = r.matches && r.matches('a[href]') ? r : r.querySelector && r.querySelector('a[href]');
          if (!a) return false;
          const href = a.getAttribute('href') || '';
          return href && !/^#/.test(href) && !/^javascript:/i.test(href);
        });
        if (rows.length && linky.length * 2 >= rows.length) return null;
      }
    } catch (e) {}

    return { listbox: shape.listbox, trigger: shape.trigger, options: shape.options,
      why: 'One control opening one flat list of options — that is a listbox, whatever the role attribute says. fix.menu on this shape decorates nothing.' };
  }

  /**
   * The page's own words for what a component is, for the description fields.
   *
   * `menuDescription: "Sign in options"` was written by a model looking at a
   * picture. It is announced to a screen reader user as the name of the thing,
   * so it should be what the page calls it — the control's own label, the
   * nav's aria-label, the heading above it — not a phrase composed for it.
   */
  function componentWording(containerSel, triggerSel) {
    const pick = (el) => (el ? accName(el) : '');
    let el = null, trig = null;
    try { el = document.querySelector(containerSel); } catch (e) {}
    try { if (triggerSel) trig = document.querySelector(triggerSel); } catch (e) {}
    if (!el && !trig) return '';

    // The control that opens it names it better than anything inside it does.
    if (trig) {
      const t = (trig.getAttribute('aria-label') || trig.getAttribute('title') || '').trim() ||
        (trig.textContent || '').trim().replace(/\s+/g, ' ');
      if (t) return t.slice(0, 60);
    }
    if (el) {
      const own = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      if (own) return own.slice(0, 60);
      const by = el.getAttribute('aria-labelledby');
      if (by) {
        const parts = by.trim().split(/\s+/).map((id) => {
          try { return pick(document.getElementById(id)); } catch (e) { return ''; }
        }).filter(Boolean);
        if (parts.length) return parts.join(' ').slice(0, 60);
      }
      // A heading immediately above is how a section names itself.
      let prev = el.previousElementSibling;
      for (let i = 0; i < 3 && prev; i++, prev = prev.previousElementSibling) {
        if (/^H[1-6]$/.test(prev.tagName)) {
          const h = pick(prev);
          if (h) return h.slice(0, 60);
        }
      }
    }
    return '';
  }

  function authoredRoleConflict(sel, type) {
    var want = ROLE_BY_TYPE[type];
    if (!want) return null;
    var el;
    try { el = document.querySelector(sel); } catch (e) { return null; }
    if (!el) return null;

    var have = el.getAttribute('role');
    if (!have || have === want) return null;

    // u1 has been here, so the role on it is ours and there is nothing to ask.
    if (el.hasAttribute('u1st-avoid-change-detection') ||
        el.hasAttribute('data-u1-revert') ||
        el.hasAttribute('u1st-trigger-element')) return null;

    return { role: have, willWrite: want };
  }

  /**
   * Every heading on the page, in reading order, with what is wrong beside it.
   *
   * For the review a person actually does: walk the outline, see each heading
   * for what it is, and leave alone the ones that are right. Nothing here
   * changes anything — it reports, and a level is only rewritten when somebody
   * asks for one.
   *
   * `should` is the level the outline implies, and it is a SUGGESTION, never an
   * action: a page's own author knows things about their structure that reading
   * order does not show. The rules have always said not to renumber a page's
   * headings to make them tidy, and this is the shape that keeps that true —
   * the tool proposes, the specialist decides, and approving costs nothing
   * because approving writes nothing.
   */
  function headingOutline() {
    var out = [], prev = 0, seenH1 = false;
    var nodes;
    try {
      nodes = qsaDeep(document, 'h1,h2,h3,h4,h5,h6,[role="heading"]');
    } catch (e) { return out; }

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!visibleInViewport && !visible(el)) continue;
      var tag = /^H([1-6])$/.exec(el.tagName);
      var lvl = tag ? Number(tag[1])
              : Number(el.getAttribute('aria-level')) || 0;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();

      var problem = null, should = lvl;
      if (!text) problem = 'empty';
      else if (lvl === 1 && seenH1) problem = 'second h1';
      else if (!lvl) { problem = 'no level'; should = prev ? prev + 1 : 2; }
      else if (prev && lvl > prev + 1) { problem = 'skips ' + (lvl - prev - 1); should = prev + 1; }

      if (lvl === 1) seenH1 = true;
      if (lvl) prev = lvl;

      out.push({
        selector: robustSelector(el),
        level: lvl || null,
        text: text.slice(0, 80),
        problem: problem,
        should: problem && should !== lvl ? should : null,
      });
    }
    // A page with no top-level heading at all is a fact about the OUTLINE
    // rather than about any one heading, so it rides along rather than being
    // pinned on whichever heading happens to be first.
    out.noH1 = out.length > 0 && !seenH1;
    return out;
  }

  // What a link says when it says nothing: the text that is identical on every
  // card and describes none of them.
  // Trailing punctuation is part of the pattern, not a disqualifier — the
  // Molina cards write "Learn more." with the full stop in the anchor.
  const VAGUE = /^(?:(?:read|learn|find out|see|view|discover)\s*(?:more|all)?|more|details|continue|go|here|click here|(?:קרא|קראו)\s*עוד|עוד|פרטים|המשך|לחצו כאן|לפרטים)\s*[.…!]?$/i;

  /**
   * Cards: a heading, a picture, some text, and a link that says "Read more".
   *
   * Every one of those links is announced identically, so a screen reader's
   * list of links on a news page reads "Read more, Read more, Read more" —
   * twelve times, describing nothing. It is the commonest defect on any site
   * with a grid of articles, and no scan rule finds it, because nothing is
   * malformed: the markup is correct and the words are useless.
   *
   * The fix already exists in the builder — a name built from the link's own
   * text plus the heading in its card. What was missing was finding them.
   */
  function cardDescriptions() {
    var out = [];
    var links;
    try { links = qsaDeep(document, 'a[href],button'); } catch (e) { return out; }

    var vague = links.filter(function (el) {
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return t && VAGUE.test(t);
    });
    // One "read more" on a page is a link somebody should rename by hand. A
    // repeated one is a pattern, and a pattern is what a mapping is for.
    if (vague.length < 2) return out;

    // Group by the shape of the card each one sits in, so a page with articles
    // AND products produces one row per KIND rather than one per card.
    var groups = new Map();
    vague.forEach(function (el) {
      var card = null, heading = null;
      for (var p = el.parentElement, up = 0; p && up < 5; p = p.parentElement, up++) {
        var h = p.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]');
        if (h && (h.textContent || '').trim()) { card = p; heading = h; break; }
      }
      if (!card || !heading) return;
      var key = (card.className || card.tagName) + '|' + heading.tagName;
      if (!groups.has(key)) groups.set(key, { cards: [], links: [], headings: [] });
      var g = groups.get(key);
      g.cards.push(card); g.links.push(el); g.headings.push(heading);
    });

    groups.forEach(function (g) {
      if (g.links.length < 2) return;
      var linkSel = commonSelectorFor(document.body, g.links, null);
      // Across ALL the headings, not the first card's.
      //
      // Taking it from one card produced `div>article:nth-child(1)>h3`, which
      // is pinned to that card — and the code that applies this walks up from
      // each link looking for the heading selector, falls back to the FIRST
      // match in the document when it finds none, and would therefore have
      // named every card on the page after the first one. Twelve links reading
      // "Read more Winter boots" is worse than twelve reading "Read more",
      // because it is confidently wrong instead of merely useless.
      var headSel = commonSelectorFor(document.body, g.headings, null);
      if (!linkSel || !linkSel.selector || !headSel || !headSel.selector) return;
      if (!isU1Valid(linkSel.selector) || !isU1Valid(headSel.selector)) return;
      // It has to reach every card's heading, or it is the same bug in a
      // different shape.
      var reaches = 0;
      try { reaches = document.querySelectorAll(headSel.selector).length; } catch (e) { return; }
      if (reaches < g.headings.length) return;
      out.push({
        target: linkSel.selector,
        heading: headSel.selector,
        count: g.links.length,
        says: (g.links[0].textContent || '').replace(/\s+/g, ' ').trim(),
        example: (g.headings[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      });
    });
    return out;
  }

  /**
   * ONE ambiguous link, worked out for the aria-label mapping.
   *
   * cardDescriptions handles the repeated kind — two or more alike links,
   * grouped by card shape. But by the time the AI has picked out a single
   * "Learn more" as a component, "rename it by hand" is the wrong answer:
   * the page already wrote the name on the card's own heading, and every
   * field of the mapping is measurable. The heading selector is the GENERIC
   * form (tag, or tag.class) because the apply engine climbs from each
   * target to the nearest ancestor that holds a match — an absolute path
   * would name every card after this one.
   */
  function ambiguousLink(sel) {
    var el;
    try { el = document.querySelector(sel); } catch (e) { return null; }
    if (!el) return null;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || !VAGUE.test(text)) return null;

    var node = el.parentElement, guard = 0;
    while (node && node !== document.body && guard++ < 6) {
      var h = null;
      try { h = node.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]'); } catch (e) {}
      if (h && !h.contains(el) && (h.textContent || '').trim()) {
        var tag = h.tagName.toLowerCase();
        var cls = Array.prototype.slice.call(h.classList || []).filter(function (c) {
          return /^[A-Za-z][\w-]*$/.test(c) && !/^(js-|is-|has-)/.test(c) && !NOISE.test(c);
        })[0];
        var hSel = cls ? tag + '.' + cls : tag;
        try { if (!node.querySelector(hSel)) hSel = tag; } catch (e) { hSel = tag; }
        return {
          text: text,
          headingSelector: hSel,
          headingText: (h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        };
      }
      node = node.parentElement;
    }
    return null;
  }

  const api = {
    // pure
    selectorStrength, normalize, isU1Valid, U1_COMPOUND_RE, NOISE, VOLATILE_ID,
    // menu root correction
    menuItemsRoot, tabPanelsFor, accordionShape, dialogShape, openModalNow, comboboxShape, filterListShape, openedBy, listboxRoot, listboxShape,
    formShape, repairForU1, alreadyNative, menuIsReallyListbox, componentWording,
    authoredRoleConflict,
    // DOM
    robustSelector, commonSelectorFor, clickSignals, analyze, clearStamps, AUTO_RULES,
    // set-of-mark (AI review)
    collectCandidates, drawMarks, drawComponentMarks, clearMarks, showMark, clearHilite, extractComponent,
    highlightSelector,
    // a human's answer, without a model
    describeComponent, elementForMark, elementsForMarks, commonAncestor, ITEM_FIELD,
    // the headings review, and the "Read more" cards beside it
    headingOutline, cardDescriptions, ambiguousLink,
    // "there is nothing there" and "I cannot see in there" are different
    // answers, and this is the only honest source of the second one
    shadowReport,
  };

  root.__u1SelectorIntel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  void hasDom;
})(typeof globalThis !== 'undefined' ? globalThis : this);

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
    if (node.id && idOk(node.id)) return '#' + node.id;
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
    let c = compound(node);
    if (c.charAt(0) === '#' || uniqueOnPage(c)) return c;
    let chain = c, cur = node.parentElement, guard = 0;
    while (cur && cur !== document.body && guard++ < 6) {
      const pc = compound(cur);
      chain = pc + '>' + chain;
      if (pc.charAt(0) === '#' || uniqueOnPage(chain)) return chain;
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
      if (anchor.charAt(0) === '#' || uniqueOnPage(anchor)) {
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
  const COMPONENT_BY_ROLE = {
    tablist: 'tabs', menu: 'menu', menubar: 'menu', navigation: 'menu',
    dialog: 'dialog', alertdialog: 'dialog', listbox: 'listbox',
    combobox: 'combobox', grid: 'grid', table: 'table', tree: 'menu',
    radiogroup: 'radio group', toolbar: 'toolbar', search: 'form',
    tabpanel: '', tab: '', option: '', menuitem: '',   // parts, not components
  };
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
    [/carousel|slideshow|gallery|\bslider\b/i, 'carousel'],
    [/accordion|collapsible|\bfaq\b/i, 'accordion'],
    [/datepicker|calendar/i, 'datepicker'],
    [/\bmodal\b|lightbox|drawer|offcanvas|off-canvas/i, 'dialog'],
    [/dropdown|megamenu|mega-nav|navbar|navigation|\bnav\b|\bmenu\b/i, 'menu'],
    [/\btabs\b|tab-bar|tabbar|tablist/i, 'tabs'],
    [/pagination|pager/i, 'pagination'],
    [/tooltip|popover/i, 'tooltip'],
    [/breadcrumb/i, 'breadcrumb'],
    // `search` is deliberately absent. It matched NINETEEN elements on one page
    // — the overlay, the panel, the field, the button and every suggestion chip
    // — and a search box is usually just an input anyway. A combobox needs a
    // popup list of suggestions, which a class name cannot tell you and a
    // behavioural probe can.
  ];

  const FIELD = 'input:not([type="hidden"]),select,textarea';

  function componentHint(el) {
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role && Object.prototype.hasOwnProperty.call(COMPONENT_BY_ROLE, role)) {
      return COMPONENT_BY_ROLE[role] ? { name: COMPONENT_BY_ROLE[role], sure: true } : null;
    }
    const tag = el.tagName.toLowerCase();
    if (COMPONENT_BY_TAG[tag]) return { name: COMPONENT_BY_TAG[tag], sure: true };

    // A strip of role="tab" with no role="tablist" around it. Extremely common —
    // a developer labels the tabs and forgets the container — and it used to
    // report "6 tabs" in the element count while the component line said there
    // was nothing here. The parts were seen; the thing they add up to was not.
    try {
      if (el.querySelectorAll(':scope > [role="tab"]').length >= 2) {
        return { name: 'tabs', sure: true };
      }
    } catch (e) { /* :scope is old enough to rely on, but never worth throwing for */ }

    const cls = (el.className && typeof el.className === 'string') ? el.className : '';
    if (cls) {
      for (const [re, name] of COMPONENT_BY_CLASS) if (re.test(cls)) return { name, sure: false };
    }

    // Three or more fields gathered under one element is a form, whatever the
    // tag says. The newsletter sign-up — name, email, phone, date, size, eight
    // checkboxes and a submit — was reported as "14 inputs" and no component,
    // which is exactly backwards: it is the most mappable thing on the page.
    //
    // Counting fields ALONE said every wrapper up to <body> was a form, because
    // every one of them contains three inputs somewhere below. Two conditions
    // narrow it to the thing a person would point at:
    //
    //   · nothing INSIDE it already holds them all — otherwise the answer is
    //     that tighter element, and this is just its packaging
    //   · it is not mostly navigation — a form is fields with a few links in
    //     it, not a page of links that happens to contain a search box
    try {
      const fields = el.querySelectorAll(FIELD).length;
      if (fields >= 3 && !el.closest('form')) {
        // Descend to the tightest cluster. Asking only whether a child holds
        // ALL of them is not enough: a page with three separate forms has them
        // split across three children, so their common ancestor is the page —
        // which is how "form?" ended up on twenty screenfuls in a row. If ANY
        // child is itself a group of fields, this element is packaging.
        const packaging = Array.prototype.some.call(el.children,
          (ch) => ch.querySelectorAll(FIELD).length >= 3);
        const links = el.querySelectorAll('a[href]').length;
        if (!packaging && links <= fields) return { name: 'form', sure: false };
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
  const CLASS_HINTS = [
    'modal', 'lightbox', 'drawer', 'offcanvas', 'off-canvas',
    'dropdown', 'megamenu', 'mega-nav', 'nav', 'menu',
    'tab', 'carousel', 'slider', 'slideshow', 'gallery',
    'accordion', 'collapsible', 'faq',
    'datepicker', 'calendar', 'pagination', 'pager',
    'tooltip', 'popover', 'breadcrumb',
  ];

  // Elements worth showing the model: anything interactive, plus the structural
  // landmarks and media that carry the most common accessibility defects.
  const CANDIDATE_SEL = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'summary', 'label',
    '[role]', '[tabindex]', '[onclick]', '[contenteditable="true"]',
    'nav', 'form', 'table', 'dialog', 'iframe', 'video', 'audio',
    'img', 'svg[aria-label]', 'h1', 'h2', 'h3',
    ...CLASS_HINTS.map(t => `[class*="${t}"]`),
  ].join(',');

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
  function candidateElements(scope) {
    const rec = root.__u1EventMap;
    let recorded = null;
    try { recorded = rec && typeof rec.all === 'function' ? rec.all() : null; } catch { recorded = null; }
    if (!recorded || !recorded.length) return qsa(scope, CANDIDATE_SEL);

    const extra = new Set();
    for (const el of recorded) {
      // A recorded element outside the scope is somebody else's problem.
      if (scope === document || (scope.contains && scope.contains(el))) extra.add(el);
    }
    if (!extra.size) return qsa(scope, CANDIDATE_SEL);

    const out = [];
    for (const el of qsa(scope, '*')) {
      let hit = extra.has(el);
      if (!hit) { try { hit = el.matches(CANDIDATE_SEL); } catch { hit = false; } }
      if (hit) out.push(el);
    }
    return out;
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
    for (const el of candidateElements(scope)) {
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
      const hint = componentHint(el);
      let nested = false;
      if (hint) {
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (hinted.get(p) === hint.name) { nested = true; break; }
        }
        hinted.set(el, hint.name);
      }
      out.push({
        mark,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        name: accName(el),
        selector: usable,
        // Which u1 component this element says it is, where it says so at all.
        // `component` is from a role or a tag and is reliable; `maybe` is from a
        // class name and is a suggestion — `.tab-content` is not a tab strip.
        component: hint ? hint.name : '',
        maybe: hint ? !hint.sure : false,
        // Inside another component of the same kind, so it is a PART of that
        // one rather than a second one. Counted and drawn once, at the top.
        nested,
        // A table taller than the window is on this screenful AND the next one,
        // and nothing else says they are the same table — so a specialist could
        // tick only the second and map its bottom half. These two flags say
        // which edge it runs past.
        spansAbove: r.top < 0,
        spansBelow: r.bottom > vh(),
        // Travels with the viewport, so a page-wide scan meets it again at every
        // scroll position. The panel drops these after the first stop.
        sticky: lastWasSticky,
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

    return {
      candidates: out,
      // Hitting the cap and finding exactly that many are indistinguishable
      // from the outside, and they mean very different things — one is a count,
      // the other is "there was more and you cannot see it". Say which.
      truncated: out.length >= max,
      headings,
      scopedTo: within || null,
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
    clearOverlay();
    let els;
    try { els = Array.prototype.slice.call(document.querySelectorAll(sel), 0, 40); }
    catch (e) { return -1; }          // -1: the selector itself is invalid
    if (!els.length) return 0;

    if (!(opts && opts.noScroll)) {
      els[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    const layer = document.createElement('div');
    layer.id = MARK_LAYER;
    Object.assign(layer.style, {
      position: 'fixed', inset: '0', zIndex: '2147483646', pointerEvents: 'none',
    });
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;   // hidden — nothing to draw round
      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px',
        width: r.width + 'px', height: r.height + 'px',
        boxSizing: 'border-box', pointerEvents: 'none',
        // The first match is the one the panel scrolled to; the rest are
        // evidence that the selector is wider than it looks.
        outline: i === 0 ? '3px solid #6c4cf1' : '2px dashed #6c4cf1',
        outlineOffset: '1px',
        background: i === 0 ? 'rgba(108,76,241,0.16)' : 'rgba(108,76,241,0.07)',
        borderRadius: '2px',
      });
      layer.appendChild(box);
    });
    document.body.appendChild(layer);
    return els.length;
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

  const api = {
    // pure
    selectorStrength, normalize, isU1Valid, U1_COMPOUND_RE, NOISE, VOLATILE_ID,
    // menu root correction
    menuItemsRoot, tabPanelsFor, openedBy, listboxRoot,
    // DOM
    robustSelector, commonSelectorFor, clickSignals, analyze, clearStamps, AUTO_RULES,
    // set-of-mark (AI review)
    collectCandidates, drawMarks, drawComponentMarks, clearMarks, showMark, extractComponent,
    highlightSelector,
  };

  root.__u1SelectorIntel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  void hasDom;
})(typeof globalThis !== 'undefined' ? globalThis : this);

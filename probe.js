// ─────────────────────────────────────────────────────────────────────────────
//  probe.js — find out what a component IS by operating it.
//
//  Everything else in this tool reads the page: a tag, a role, a class name.
//  That works on a page that labels itself and returns nothing at all on one
//  that does not — measured, not guessed: the same page scores 100% with its
//  labels and 0% with them stripped, and no further list of class names can
//  close that, because there are no names left to list.
//
//  So this asks a different question. Not "what are you called" — which a page
//  can decline to answer — but "what do you do", which it cannot. Press a thing;
//  watch what appears. The element that opened is the panel, the element pressed
//  is the trigger, and neither fact needed a name.
//
//  That also produces, for free, the part that is most often wrong today: the
//  FIELD MAPPING. `triggers` and `submenus` are guessed from class names now,
//  and a wrong guess is what "applied, and nothing happened" actually is.
//
//  ── This clicks things on somebody's live site, so: ────────────────────────
//
//  Three layers, and the second one is the one that matters, because it does
//  not depend on the first being right:
//
//    1. A blocklist — never press a submit, a real link, or anything whose
//       words suggest it deletes, pays or sends.
//    2. A net under the whole run: while probing, a capture-phase listener
//       cancels navigation and form submission for EVERY element, and
//       window.open is stubbed. The page's own handlers still run, so the
//       widget still opens; only leaving the page is prevented. If layer 1
//       misjudges something, this still holds.
//    3. Put it back: press again, then Escape. If the page did not return to
//       the state it started in, that is recorded and probing of that
//       component stops. Nothing is ever reloaded behind your back.
// ─────────────────────────────────────────────────────────────────────────────
(function (root) {
  'use strict';
  if (root.__u1Probe) return;

  var doc = root.document;

  // ── Layer 1: what must never be pressed ────────────────────────────────────
  //
  // Words in the user's language, not the developer's — this is read off the
  // button's face, which is the only place a "Delete account" announces itself
  // when the class is called `c4b`.
  var DANGER = new RegExp([
    'delete', 'remove', 'discard', 'destroy', 'clear all',
    'pay', 'buy', 'checkout', 'order now', 'place order', 'purchase',
    'add to cart', 'add to bag', 'subscribe', 'sign up', 'register',
    'log ?out', 'sign ?out', 'confirm', 'send', 'submit', 'apply',
    'unsubscribe', 'cancel (order|subscription)', 'download',
    // Hebrew — the sites this runs on are as often in Hebrew as English.
    'מחק', 'הסר', 'שלם', 'תשלום', 'לתשלום', 'הזמן', 'קנה', 'רכישה',
    'הוסף לסל', 'לסל', 'הרשמה', 'הירשם', 'התנתק', 'יציאה', 'אשר',
    'שלח', 'שליחה', 'בטל', 'הורד',
  ].join('|'), 'i');

  function faceOf(el) {
    return ((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) ||
            el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  }

  /**
   * May this element be pressed? Returns a reason when not, so a component that
   * is skipped can say why rather than silently going missing.
   */
  function safeToClick(el) {
    if (!el || el.nodeType !== 1) return { ok: false, why: 'not an element' };
    var tag = el.tagName.toLowerCase();

    if (tag === 'a') {
      var href = el.getAttribute('href') || '';
      // An in-page anchor or a JS hook is fine. A real destination is not: the
      // net below would cancel it, but a link is a link and there is nothing
      // to learn by pressing one.
      if (href && !/^#/.test(href) && !/^javascript:/i.test(href)) {
        return { ok: false, why: 'a link to another page' };
      }
      if (el.hasAttribute('download') || el.getAttribute('target') === '_blank') {
        return { ok: false, why: 'opens or downloads elsewhere' };
      }
    }

    var type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'submit' || type === 'reset' || type === 'file') {
      return { ok: false, why: 'a ' + type + ' control' };
    }
    // A <button> inside a form with no type IS a submit — the default nobody
    // remembers, and the single likeliest way to post a stranger's form.
    if (tag === 'button' && !type && el.closest && el.closest('form')) {
      return { ok: false, why: 'an untyped button in a form, which submits' };
    }
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
      return { ok: false, why: 'disabled' };
    }
    if (DANGER.test(faceOf(el))) {
      return { ok: false, why: 'its label reads as an action, not a disclosure' };
    }
    return { ok: true, why: '' };
  }

  // ── Layer 2: the net ───────────────────────────────────────────────────────
  //
  // Installed for the duration of a run, removed after. It does NOT stop the
  // page's own handlers — the widget must still open, or there is nothing to
  // observe. It stops the page LEAVING.
  var net = null;

  function armNet() {
    if (net) return net;
    var onClick = function (e) {
      // EVERY link, including an in-page one. A `href="#deals"` does not leave
      // the page, but it does move it — and a sweep that is walking the page a
      // screenful at a time works from the current scroll position, so one
      // anchor jump sends it wandering. It revisited the same screens and
      // reported forty-two of them on a page that has twenty.
      //
      // The page's own handler still runs; only the jump is cancelled.
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (a && a.getAttribute('href')) e.preventDefault();
    };
    var onSubmit = function (e) { e.preventDefault(); };
    var onLeave = function (e) { e.preventDefault(); e.returnValue = ''; return ''; };

    // Capture phase and LAST argument true: this runs before the page's own
    // listeners, and preventDefault survives whatever they do afterwards
    // because it is the default action being cancelled, not the dispatch.
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('submit', onSubmit, true);
    root.addEventListener('beforeunload', onLeave, true);

    var openWas = root.open;
    try { root.open = function () { return null; }; } catch (e) {}

    net = {
      disarm: function () {
        doc.removeEventListener('click', onClick, true);
        doc.removeEventListener('submit', onSubmit, true);
        root.removeEventListener('beforeunload', onLeave, true);
        try { root.open = openWas; } catch (e) {}
        net = null;
      },
    };
    return net;
  }

  // ── Snapshots ──────────────────────────────────────────────────────────────
  //
  // Not the HTML — a fingerprint of the things that change when something
  // opens. Comparing markup would flag every re-rendered price and every
  // animation frame; this flags appearing and disappearing, which is what a
  // disclosure actually does.
  var STATE_ATTRS = ['hidden', 'aria-expanded', 'aria-selected', 'aria-hidden',
                     'aria-current', 'open', 'checked'];

  /**
   * The classes on a set of elements, read separately from `fingerprint`.
   *
   * A class toggle is how most sites actually say open/closed — `.is-open`,
   * `.active`, `.expanded` — and the state fingerprint above does not watch
   * `class` at all, so a panel that changes nothing but its class was invisible
   * to the whole behavioural layer.
   *
   * Kept OUT of the fingerprint on purpose rather than added to it. The
   * fingerprint is what the run-wide restore check compares, and pages add and
   * drop transition classes on their own — folding class into it would make
   * "the page is back where it started" fail on animation, which stops probing
   * and, worse, teaches us to distrust a check that exists for the client's
   * sake.
   */
  function classesOf(all) {
    var out = new Map();
    for (var i = 0; i < all.length; i++) {
      var c = all[i].className;
      out.set(all[i], typeof c === 'string' ? c : '');
    }
    return out;
  }

  /** Which classes appeared on an element, and which went away. */
  function classDelta(before, after, el) {
    var was = (before.get(el) || '').split(/\s+/).filter(Boolean);
    var now = (after.get(el) || '').split(/\s+/).filter(Boolean);
    var added = now.filter(function (c) { return was.indexOf(c) === -1; });
    var removed = was.filter(function (c) { return now.indexOf(c) === -1; });
    return (added.length || removed.length) ? { added: added, removed: removed } : null;
  }

  /**
   * Where things ARE, which is the half the visibility fingerprint cannot see.
   *
   * A rail that only scrolls hides nothing: every item keeps its box, and what
   * moves is the window onto them. So the whole behavioural layer found
   * NOTHING on a swipe gallery built the way swipe galleries are actually
   * built — measured, both ways round: the same gallery written with hidden
   * came back as a carousel and written as a scroller came back as an empty
   * page.
   *
   * Kept out of `fingerprint` for the same reason `class` is: the restore check
   * compares fingerprints, and a page that scrolls a pixel on its own would
   * start reporting itself as never restored.
   */
  function geometry(all) {
    var out = new Map();
    for (var i = 0; i < all.length; i++) {
      var el = all[i], r = null;
      try { r = el.getBoundingClientRect(); } catch (e) {}
      out.set(el, r ? (Math.round(r.left) + '|' + Math.round(r.top)) : '');
    }
    return out;
  }

  /**
   * What slid sideways.
   *
   * HORIZONTAL on purpose. Opening an accordion pushes everything below it
   * down, and counting that as movement would make every accordion on the page
   * a carousel — so a shift only counts when it is sideways and more sideways
   * than it is vertical.
   */
  function shifted(before, after) {
    var out = [];
    after.forEach(function (now, el) {
      var was = before.get(el);
      if (!was || !now || was === now) return;
      var a = was.split('|'), b = now.split('|');
      var dx = Math.abs(Number(b[0]) - Number(a[0])), dy = Math.abs(Number(b[1]) - Number(a[1]));
      if (dx > 8 && dx > dy) out.push(el);
    });
    return out;
  }

  function shown(el) {
    if (el.hasAttribute('hidden')) return false;
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (r && (r.width > 0 || r.height > 0)) return true;
    // jsdom and display:contents both give a zero box to things that are
    // genuinely there, so absence of a box is not absence of the element.
    return !!(el.offsetParent || (el.getClientRects && el.getClientRects().length));
  }

  /**
   * Which elements to watch while something is pressed.
   *
   * The neighbourhood of the trigger, plus — anywhere in the document —
   * everything currently hidden. A cart drawer and a modal are children of
   * <body>, nowhere near the button that opens them, so a purely local watch
   * reported "pressed 8, nothing opened" while the drawer was visibly sliding
   * open on screen. Whatever appears must have been hidden a moment ago, which
   * makes that set exactly the right one to add and keeps it small.
   */
  function watched(scope, limit) {
    var els = Array.prototype.slice.call(scope.querySelectorAll('*'), 0, limit || 1200);
    try {
      var far = doc.querySelectorAll('[hidden],[aria-hidden="true"],dialog');
      for (var i = 0; i < far.length && i < 200; i++) {
        if (els.indexOf(far[i]) === -1) els.push(far[i]);
      }
    } catch (e) {}
    return els;
  }

  // Takes the LIST, not the scope. Rebuilding it after the click was the bug
  // that hid every drawer and modal: the watch list includes everything
  // currently [hidden], so the moment a panel opened it left the selector, was
  // missing from the second reading, and counted as VANISHED rather than
  // appeared. The comparison has to be of the same elements, both times.
  function fingerprint(all) {
    var out = new Map();
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var s = (shown(el) ? '1' : '0') + '|' + el.children.length;
      for (var a = 0; a < STATE_ATTRS.length; a++) {
        s += '|' + (el.getAttribute(STATE_ATTRS[a]) || '');
      }
      out.set(el, s);
    }
    return out;
  }

  /** What became visible, what vanished, and what merely changed state. */
  function diff(before, after) {
    var appeared = [], vanished = [], changed = [];
    after.forEach(function (now, el) {
      var was = before.get(el);
      if (was === undefined) { if (now.charAt(0) === '1') appeared.push(el); return; }
      if (was === now) return;
      if (was.charAt(0) === '0' && now.charAt(0) === '1') appeared.push(el);
      else if (was.charAt(0) === '1' && now.charAt(0) === '0') vanished.push(el);
      else changed.push(el);
    });
    before.forEach(function (was, el) {
      if (!after.has(el) && was.charAt(0) === '1') vanished.push(el);
    });
    return { appeared: appeared, vanished: vanished, changed: changed };
  }

  // An element that appeared only because its parent did is not a second
  // finding. The outermost one is the panel; the rest is its contents.
  function outermost(els) {
    return els.filter(function (el) {
      for (var i = 0; i < els.length; i++) {
        if (els[i] !== el && els[i].contains(el)) return false;
      }
      return true;
    });
  }

  var raf = function () {
    return new Promise(function (r) {
      if (root.requestAnimationFrame) root.requestAnimationFrame(function () { root.requestAnimationFrame(r); });
      else setTimeout(r, 32);
    });
  };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /**
   * The region a press could plausibly affect.
   *
   * Fingerprinting the whole page four times per press is what a first version
   * did, and on a four-thousand-element page that is a hundred and sixty full
   * scans per screenful — slow enough that the run never finished.
   *
   * A disclosure's panel is a sibling or a cousin of its trigger, never the far
   * side of the document, so climbing a few levels from the trigger both bounds
   * the work and keeps the answer. The climb stops when the subtree is big
   * enough to contain the panel, or when it would get expensive.
   */
  function localScope(el, outer, cap) {
    cap = cap || 600;
    var node = el, best = el;
    for (var i = 0; i < 8 && node && node !== outer; i++) {
      var p = node.parentElement;
      if (!p) break;
      var n = p.querySelectorAll('*').length;
      if (n > cap) break;
      best = p;
      node = p;
    }
    return best === el ? (el.parentElement || outer) : best;
  }

  /**
   * Press one element and report what it did.
   *
   * `scope` bounds both the fingerprint and the answer: a click that changes
   * something on the other side of the page is not this component's doing.
   */
  async function probeOne(el, opts) {
    opts = opts || {};
    var scope = opts.scope || doc.body;
    var settle = opts.settle == null ? 120 : opts.settle;

    var safe = safeToClick(el);
    if (!safe.ok) return { skipped: true, why: safe.why };

    var els = watched(scope, opts.limit);
    var before = fingerprint(els);
    var classBefore = classesOf(els);
    var whereBefore = geometry(els);
    var focusBefore = doc.activeElement;
    try { el.click(); } catch (e) { return { skipped: true, why: 'could not be pressed' }; }
    await raf();
    if (settle) await wait(settle);
    var after = fingerprint(els);
    var classAfter = classesOf(els);
    var d = diff(before, after);
    var slid = outermost(shifted(whereBefore, geometry(els)));

    // Is what opened a LAYER OVER THE PAGE? Measured HERE, while it is open.
    //
    // This used to be asked in classify(), which runs after every press has
    // been undone — so it measured a CLOSED panel, and a panel closed with
    // `hidden` has no box at all. The test read `width >= 60% of the viewport`
    // against a width of zero and answered no, every time. A modal was
    // therefore reported as an accordion: "it revealed and hid a region", which
    // is true, and useless.
    //
    // It only ever appeared to work on drawers that stay laid out while closed
    // — translated off-screen rather than hidden — which is why it survived.
    var panel = panelOf(d);
    var isLayer = panel ? isOverlay(panel) : false;

    // Did focus follow what opened?
    //
    // Recorded as a FINDING, never as a condition for recognising anything. A
    // panel that covers the page is a dialog whether or not the site moved
    // focus into it — and most sites do not, which is the entire reason the
    // accessibility layer exists. Requiring correct focus behaviour before
    // agreeing something is a dialog would mean the broken ones, the only ones
    // worth mapping, are the ones we decline to find.
    //
    // So this answers "does this one already need the fix", which is the
    // specialist's next question anyway.
    var focusEntered = null;
    if (panel) {
      var landed = doc.activeElement;
      focusEntered = !!(landed && landed !== focusBefore && panel.contains(landed));
    }


    // Put it back before reporting, so a caller that stops reading here still
    // leaves the page as it found it.
    //
    // EVERYTHING about the OPEN state has to be measured above this line. Both
    // things that ask "what was it like while it was open" — is it a layer over
    // the page, did focus go into it — were written below it first, and both
    // answered no every single time, because by then it was shut.
    var restored = false;
    try {
      el.click();
      await raf();
      if (settle) await wait(settle);
      restored = same(before, fingerprint(els));
      if (!restored) {
        doc.dispatchEvent(new root.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await raf();
        restored = same(before, fingerprint(els));
      }
    } catch (e) { restored = false; }

    // The state class, which is the answer to "how does this page SAY open".
    // Read off the trigger and off whatever it opened, because sites put it on
    // either one and about as often on both.
    var stateClass = null;
    var onTrigger = classDelta(classBefore, classAfter, el);
    var marked = panel || d.changed[0] || null;
    var onPanel = marked ? classDelta(classBefore, classAfter, marked) : null;
    if (onTrigger || onPanel) {
      stateClass = { trigger: onTrigger, panel: onPanel };
    }

    return {
      skipped: false,
      opened: outermost(d.appeared),
      closed: outermost(d.vanished),
      moved: slid,
      touched: d.changed.length,
      focusEntered: focusEntered,
      overlay: isLayer,
      stateClass: stateClass,
      restored: restored,
    };
  }

  /** The thing a press revealed, if it revealed one. */
  function panelOf(d) {
    var opened = outermost(d.appeared);
    return opened.length ? opened[0] : null;
  }

  function same(a, b) {
    if (a.size !== b.size) return false;
    var eq = true;
    a.forEach(function (v, k) { if (b.get(k) !== v) eq = false; });
    return eq;
  }

  // ── Which elements are worth pressing ──────────────────────────────────────
  //
  // On a page that labels itself this is easy. On one that does not, the only
  // honest signal is that something registered a click handler — which is
  // precisely what the event recorder knows and nothing else does.
  // Pressed already, this session. The sticky header travels with the viewport,
  // so a sweep met the same Search and Cart buttons on all twenty-eight
  // screenfuls and pressed them twenty-eight times — which is why the cart kept
  // opening. A component only has to be operated once.
  var everPressed = new WeakSet();

  function pressable(scope, opts) {
    opts = opts || {};
    var out = [], seen = new Set();
    // A sweep probes one screenful at a time, so the question is not "is it on
    // the page" but "is it on THIS screen". Without this the same menu is
    // pressed again at every scroll position.
    var vh = root.innerHeight || 768, vw = root.innerWidth || 1024;
    var onScreen = function (el) {
      if (!opts.inViewport) return true;
      try {
        var r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
      } catch (e) { return false; }
    };
    var add = function (el) {
      if (!el || seen.has(el) || !scope.contains(el)) return;
      if (!opts.repeat && everPressed.has(el)) return;
      if (!shown(el) || !onScreen(el)) return;
      if (!safeToClick(el).ok) return;
      seen.add(el); out.push(el);
    };

    var rec = root.__u1EventMap;
    if (rec && typeof rec.all === 'function') {
      try { rec.all().forEach(add); } catch (e) {}
    }
    // Plus the ones that announce themselves, for pages that do.
    try {
      scope.querySelectorAll(
        'button,[role="button"],[role="tab"],[aria-expanded],[aria-haspopup],summary,[tabindex]'
      ).forEach(add);
    } catch (e) {}

    // And, when neither of those found anything, the one signal a page cannot
    // help giving: `cursor: pointer`.
    //
    // A page of bare <div>s carries no tag, no role and no useful class — but
    // whoever built it still had to make the thing LOOK clickable, and there is
    // one way to do that. It is not proof, which is why it is a last resort and
    // why the probe then presses it and watches rather than believing it.
    //
    // Without this the probe needed the event recorder, which is opt-in and
    // needs a page reload — so on exactly the pages it was written for it had
    // nothing to press and reported nothing at all.
    // Always, not only when nothing else was found. Three stray [tabindex]
    // elements on a page were enough to make `out` non-empty, and the sweep
    // that finds the ACTUAL controls never ran — the probe reported nothing on
    // the one kind of page it was written for.
    if (out.length < (opts.max || 40)) {
      try {
        var all = scope.querySelectorAll('div,span,li,td');
        for (var i = 0; i < all.length && out.length < (opts.max || 40) * 3; i++) {
          var el = all[i];
          if (seen.has(el) || !onScreen(el)) continue;
          // A pointer cursor INHERITED from a clickable ancestor is that
          // ancestor's, not this element's — otherwise every word inside a
          // button becomes a candidate.
          var p = el.parentElement;
          var mine = root.getComputedStyle(el).cursor === 'pointer';
          if (!mine) continue;
          if (p && root.getComputedStyle(p).cursor === 'pointer') continue;
          add(el);
        }
      } catch (e) {}
    }
    return out.slice(0, opts.max || 40);
  }

  var commonAncestor = function (els) {
    if (!els.length) return null;
    var a = els[0];
    for (var i = 1; i < els.length; i++) {
      var b = els[i];
      while (a && !a.contains(b)) a = a.parentElement;
    }
    return a;
  };

  /**
   * Is this panel nothing but links?
   *
   * The rule was "two or more links makes it a menu", and that is too crude:
   * an FAQ answer with a "read more" link in it, or a product panel with a
   * link at the bottom, was called a menu on the strength of the links while
   * being mostly prose.
   *
   * What separates them is what is there BESIDES the links. A menu panel is
   * links and whitespace. An accordion panel is text that happens to contain
   * some. So the links' own text is subtracted and what is left is weighed.
   */
  var mostlyLinks = function (el) {
    try {
      var links = el.querySelectorAll('a[href]');
      if (links.length < 2) return false;
      var all = (el.textContent || '').replace(/\s+/g, ' ').trim();
      var inLinks = 0;
      for (var i = 0; i < links.length; i++) {
        inLinks += (links[i].textContent || '').replace(/\s+/g, ' ').trim().length;
      }
      // Forty characters is about a sentence. Below that, whatever is around
      // the links is a heading or a "see all", not content.
      return (all.length - inLinks) < 40;
    } catch (e) { return true; }
  };

  /**
   * The run of siblings a set of revealed elements belongs to.
   *
   * A carousel and a tab strip are the same observation up to here — press a
   * control, something is shown and something else is hidden — and they were
   * not being told apart at all: a hero carousel with prev/next arrows came
   * back as a strip of two controls "each revealing the same region", which is
   * a menu. Measured, not supposed.
   *
   * What separates them is COUNTING. A tab strip has as many panels as it has
   * tabs, because each tab owns one. A carousel has two arrows and five slides:
   * the controls cycle a set that is bigger than they are. So: find the run of
   * siblings the revealed elements sit in, and compare its size to the number
   * of controls.
   */
  var siblingRun = function (els, controls, touched) {
    if (!els.length) return null;
    var parent = els[0].parentElement;
    if (!parent) return null;
    for (var i = 1; i < els.length; i++) if (els[i].parentElement !== parent) return null;
    var kids = Array.prototype.slice.call(parent.children);
    // Only the ones that look like peers of what was revealed — a track with
    // five slides and a stray caption should count five, not six.
    var tag = els[0].tagName;
    var peers = kids.filter(function (k) { return k.tagName === tag; });
    var items = peers.length >= els.length ? peers : kids;

    // Anything holding a CONTROL is not a slide.
    //
    // Slides are inert: a track holds pictures and text, and the arrows live
    // outside it. So a peer that is, or contains, something this run pressed is
    // another component's container and must not be counted.
    //
    // Excluding only the strip's own controls was not enough, and the case that
    // proved it is worth keeping: on a page written flat — tab panels as direct
    // children of the page, beside the nav and the accordion — the run came
    // back as five, the strip had three controls, and an ordinary tab strip was
    // reported as a carousel. It then stopped being pressed back afterwards,
    // because only a strip gets pressed back, so the page was left on the wrong
    // panel. A misread that also breaks the promise to put the page back is the
    // expensive kind.
    if (controls && controls.length) {
      items = items.filter(function (k) {
        for (var c = 0; c < controls.length; c++) {
          if (k === controls[c] || k.contains(controls[c])) return false;
        }
        return true;
      });
    }
    // Slides take TURNS. Whatever is showing and was never shown or hidden by
    // anything this run did is not one of them — it is the caption beside the
    // track, or the paragraph below it.
    //
    // The case that needed this: a two-control strip whose panels sat flat
    // beside a paragraph of prose. The prose counted as a third item, three
    // beat two controls, and the strip was called a carousel. A slide that has
    // never once been hidden is not a slide.
    //
    // Slides not yet reached are kept — they are hidden, not showing, which is
    // exactly what an untouched slide looks like. That is what lets two arrows
    // over five slides still read as five.
    if (touched && touched.length) {
      items = items.filter(function (k) {
        return !shown(k) || touched.indexOf(k) !== -1;
      });
    }
    return items.length ? { parent: parent, items: items } : null;
  };

  /** Prev / next, when the control says so on its face. */
  var arrowRole = function (el) {
    var face = faceOf(el).toLowerCase() + ' ' +
               ((el.getAttribute && el.getAttribute('class')) || '').toLowerCase();
    if (/prev|back|◄|‹|«|←|הקודם|אחורה/.test(face)) return 'prevButton';
    if (/next|forward|►|›|»|→|הבא|קדימה/.test(face)) return 'nextButton';
    return null;
  };

  /**
   * A layer over the page — which is what makes something a dialog.
   *
   * TWO shapes, because "covers most of the screen" was only one of them and
   * the other is extremely common:
   *
   *   · a MODAL: a box over the middle of the page, most of the screen wide
   *     and half of it tall.
   *   · a BANNER: a cookie bar, a coupon strip, a consent notice. Pinned to the
   *     top or bottom edge, nearly the full width, and DELIBERATELY short — it
   *     covers a sliver, and the height test alone threw every one of them out.
   *     Decided that these are dialogs like any other, which they are: they
   *     appear over the page, they demand an answer, and the ones that trap you
   *     without a reachable close button are a genuine trap.
   *
   * `fixed` is required for the banner and not for the modal. A short strip
   * that merely happens to be absolutely positioned inside some section is
   * ordinary page furniture; one pinned to the viewport edge is a layer.
   */
  var isOverlay = function (el) {
    try {
      var pos = root.getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'absolute') return false;
      var r = el.getBoundingClientRect();
      var vw = root.innerWidth || 1024, vh = root.innerHeight || 768;
      if (r.width >= vw * 0.6 && r.height >= vh * 0.5) return true;

      if (pos !== 'fixed') return false;
      var wide = r.width >= vw * 0.8;
      var atEdge = r.top <= 4 || Math.abs(r.bottom - vh) <= 4;
      // Not a hairline: a progress bar and a coloured rule are also wide, fixed
      // and against an edge, and neither is asking anybody anything.
      var tall = r.height >= 40;
      return wide && atEdge && tall;
    } catch (e) { return false; }
  };

  /**
   * Turn "pressing A revealed B" into a component.
   *
   * This is the whole point of the exercise: every one of these decisions is a
   * description of something that was observed, not a reading of a name. The
   * same code answers correctly on a page built with role="tablist" and on the
   * same page with every attribute stripped, because it never looked at either.
   */
  function classify(results, pressed) {
    pressed = pressed || [];
    var comps = [];
    var used = new Set();

    // Siblings that each reveal a DIFFERENT panel are a tab strip. One panel
    // shared between them is the same thing — a strip over one re-rendered
    // region — and both are far commoner than a page that says so.
    // Grouped by PRESSED siblings, not by siblings that revealed something.
    // The tab that is already selected reveals nothing when pressed, so a
    // two-tab strip produces exactly one observation — and requiring two
    // observations classified it as an accordion. A row of sibling controls
    // where pressing one swaps what is visible is a strip, and the already-open
    // one is a member of it.
    var byParent = new Map();
    pressed.forEach(function (el) {
      var p = el.parentElement;
      if (!p) return;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(el);
    });

    byParent.forEach(function (siblings) {
      if (siblings.length < 2) return;
      var group = results.filter(function (r) {
        return siblings.indexOf(r.trigger) !== -1 && r.opened.length;
      });
      if (!group.length) return;
      // Siblings that each reveal something are not automatically a tab strip.
      // A header toolbar is exactly that shape — Search, Wishlist and Cart each
      // open their own overlay — and it was being reported as tabs.
      //
      // What makes a strip a strip is that its panels are MUTUALLY EXCLUSIVE:
      // showing one hides another. A toolbar's overlays are independent, and
      // pressing one closes nothing.
      var exclusive = group.some(function (r) { return r.closed && r.closed.length; });
      if (!exclusive) return;
      var panels = [];
      group.forEach(function (r) { r.opened.forEach(function (el) { if (panels.indexOf(el) === -1) panels.push(el); }); });
      if (!panels.length) return;
      // A CAROUSEL, if the controls are cycling a set bigger than themselves.
      var revealed = [];
      group.forEach(function (r) { r.opened.forEach(function (el) {
        if (revealed.indexOf(el) === -1) revealed.push(el); }); });
      var swapped = [];
      group.forEach(function (r) {
        r.opened.forEach(function (el) { if (swapped.indexOf(el) === -1) swapped.push(el); });
        (r.closed || []).forEach(function (el) { if (swapped.indexOf(el) === -1) swapped.push(el); });
      });
      var run = siblingRun(revealed, pressed.concat(siblings), swapped);
      if (run && run.items.length > siblings.length) {
        group.forEach(function (r) { used.add(r.trigger); });
        siblings.forEach(function (el) { used.add(el); });
        var parts = { slide: run.items };
        siblings.forEach(function (el) {
          var role = arrowRole(el);
          if (role && !parts[role]) parts[role] = [el];
        });
        comps.push({
          type: 'carousel',
          root: commonAncestor(siblings.concat(run.items)),
          parts: parts,
          why: siblings.length + ' controls cycling ' + run.items.length +
               ' items — more items than controls, so they are not tabs',
        });
        return;
      }

      group.forEach(function (r) { used.add(r.trigger); });
      // The tab that was ALREADY selected reveals nothing when pressed, so it
      // never appears in `results` — and a three-tab strip was reported as two
      // tabs with the current one missing. Its siblings that were pressed and
      // did nothing belong to the same strip.
      var tabs = group.map(function (r) { return r.trigger; });
      siblings.forEach(function (el) {
        if (tabs.indexOf(el) === -1) { tabs.push(el); used.add(el); }
      });
      // Back into document order, so `tab` reads left to right as it looks.
      tabs.sort(function (a, b) {
        return (a.compareDocumentPosition(b) & 4) ? -1 : 1;   // 4 = FOLLOWING
      });
      // A MENU, not a tab strip. The two are one shape — several sibling
      // controls, pressing one swaps what is shown — and detection stopped
      // trying to tell them apart by which word the developer happened to use.
      //
      // `shape: 'strip'` is kept because the RESTORE below needs it, and that
      // is a mechanical fact rather than a name: a control that cannot undo
      // itself by being pressed again has to be pressed back deliberately.
      // Keying the restore on the type name would have broken it the moment
      // the name changed — silently, on somebody's live site.
      //
      // Rooted on the DIRECT PARENT of the controls, per the menu rules, not on
      // the common ancestor of the controls AND their panels: that reaches up
      // past the strip and u1.fix.menu walks the root's own children looking
      // for items.
      comps.push({
        type: 'menu',
        shape: 'strip',
        root: siblings[0].parentElement || commonAncestor(tabs.concat(panels)),
        parts: { items: tabs, submenus: panels },
        why: tabs.length + ' sibling controls, each revealing ' +
             (panels.length === 1 ? 'the same region' : 'a different panel'),
      });
    });

    // A rail that SLIDES. No counting needed and no hiding involved: if
    // pressing a control moved a run of siblings sideways, that is a carousel,
    // however many controls it has. A shelf of twenty products with two arrows
    // is one; so is a swipe gallery with no arrows at all, found below by
    // watching it move on its own.
    results.forEach(function (r) {
      if (used.has(r.trigger) || !r.moved || !r.moved.length) return;
      var run = siblingRun(r.moved, pressed, r.moved);
      if (!run || run.items.length < 2) return;
      used.add(r.trigger);
      var parts = { slide: run.items };
      var role = arrowRole(r.trigger);
      if (role) parts[role] = [r.trigger];
      // The other arrow, when there is one: its sibling that was also pressed.
      pressed.forEach(function (el) {
        if (el === r.trigger || el.parentElement !== r.trigger.parentElement) return;
        var other = arrowRole(el);
        if (other && !parts[other]) { parts[other] = [el]; used.add(el); }
      });
      comps.push({
        type: 'carousel',
        root: commonAncestor([r.trigger].concat(run.items)),
        parts: parts,
        why: 'pressing it slid a rail of ' + run.items.length + ' items sideways',
      });
    });

    results.forEach(function (r) {
      if (used.has(r.trigger) || !r.opened.length) return;
      var panel = r.opened[0];
      // `r.overlay` was measured while the panel was open. See probeOne.
      var type = r.overlay ? 'dialog'
        : (mostlyLinks(panel) ? 'menu' : 'accordion');
      var why = type === 'dialog' ? 'it opened a layer over the page'
        : type === 'menu' ? 'it revealed a panel of links and nothing else'
        : 'it revealed and hid a region';
      // How the page SAYS open, when it says it with a class. Worth reporting
      // even for a dialog: it is the same answer to the same question, and a
      // mapping that has it does not need a person to go and find it.
      if (r.stateClass) {
        var added = (r.stateClass.panel && r.stateClass.panel.added) ||
                    (r.stateClass.trigger && r.stateClass.trigger.added) || [];
        if (added.length) why += ', and marks it open with .' + added[0];
      }
      // The work this one needs, said plainly. Not a reason to doubt it is a
      // dialog — the reason to map it.
      if (type === 'dialog' && r.focusEntered === false) {
        why += '. Focus stayed outside it when it opened';
      }
      comps.push({
        type: type,
        root: type === 'dialog' ? panel : commonAncestor([r.trigger, panel]),
        parts: { trigger: [r.trigger], panel: [panel] },
        stateClass: r.stateClass || null,
        focusEntered: r.focusEntered,
        why: why,
      });
    });

    return comps;
  }

  /**
   * What the page does when nobody touches it.
   *
   * Everything else here presses something and watches. This watches while
   * pressing NOTHING, and it answers two questions at once:
   *
   *   · a carousel that advances on its own is a carousel even when it has no
   *     arrows to press — a swipe-only gallery announces itself no other way.
   *   · a thing that moves by itself and cannot be stopped is a WCAG 2.2.2
   *     failure in its own right, and it is the kind nobody reports because
   *     nothing on the page looks broken.
   *
   * It costs real time — a slide sits for seconds — so the window is a
   * parameter and the whole thing is skipped when it is zero.
   */
  async function watchIdle(scope, ms, limit) {
    if (!ms) return null;
    var els = watched(scope, limit);
    var before = fingerprint(els);
    var whereBefore = geometry(els);
    // SAMPLED, not just start-and-end. A carousel of three slides on a cycle
    // that divides the window lands back where it started and a two-point
    // comparison sees nothing at all — found by a test whose timing happened
    // to do exactly that, and reported as "no carousel here" with complete
    // confidence. Any sample differing from the start is movement.
    var step = Math.max(250, Math.round(ms / 4));
    for (var waited = 0; waited < ms; waited += step) {
      await wait(Math.min(step, ms - waited));
      var d = diff(before, fingerprint(els));
      var moved = outermost(d.appeared);
      if (moved.length) return { moved: moved, gone: outermost(d.vanished), ms: waited + step };
      // A ticker that scrolls itself hides nothing at all, so the visibility
      // comparison above will never see it however long it watches.
      var slid = outermost(shifted(whereBefore, geometry(els)));
      if (slid.length) return { moved: slid, gone: [], slid: true, ms: waited + step };
    }
    return null;
  }

  /**
   * Press everything worth pressing inside `scope`, and say what is there.
   *
   * The net is armed for the whole run and disarmed in `finally`, so an
   * exception halfway through cannot leave a page that refuses to navigate.
   */
  async function probeAll(scope, opts) {
    opts = opts || {};
    scope = scope || doc.body;
    var net = armNet();
    var results = [], pressed = [], skipped = 0, comps = [];
    // The state to come back to, taken once for the whole run. Restoring after
    // each individual press is not possible for a tab strip — pressing a tab a
    // second time re-selects it, it does not undo it — and treating that as a
    // failure aborted the run at the first tab and left the strip undiscovered.
    var wholeScope = watched(scope, opts.limit);
    var start = fingerprint(wholeScope);
    try {
      var list = pressable(scope, opts);
      for (var i = 0; i < list.length; i++) {
        // Each press is measured in its own neighbourhood, not across the whole
        // page — see localScope. The run-wide restore check below still uses
        // the full scope, because that is a guarantee about the page.
        var near = localScope(list[i], scope, opts.near);
        var r = await probeOne(list[i], { scope: near, settle: opts.settle, limit: opts.limit });
        if (r.skipped) { skipped++; continue; }
        everPressed.add(list[i]);
        pressed.push(list[i]);
        if (r.opened.length || r.moved.length) {
          results.push({ trigger: list[i], opened: r.opened, closed: r.closed,
                         moved: r.moved, stateClass: r.stateClass,
                         focusEntered: r.focusEntered, overlay: r.overlay });
        }
      }

      // Put the whole scope back.
      //
      // Only a STRIP needs this. A toggle was already closed by probeOne —
      // pressing it a second time is what closed it — so pressing the first
      // trigger of every group re-OPENED every menu and accordion on the page,
      // which is the exact opposite of restoring. Classify first, then press
      // back only the thing that cannot undo itself.
      // CONCAT, not assign. Twice now something pushed onto `comps` before this
      // line was silently thrown away by it — the idle watch's carousel, then
      // the self-opening dialog — each time looking exactly like "the detection
      // does not work", each time costing a debugging session. Appending
      // removes the trap rather than remembering to avoid it.
      comps = comps.concat(classify(results, pressed));

      // Something that put ITSELF over the page: a coupon, a cookie notice, a
      // newsletter box that waits five seconds. Nobody pressed anything, so
      // pressing can never find it. Decided that these are dialogs like any
      // other, and they are the ones a person is most likely to be trapped by.
      //
      // Compared against the state at the START OF THE RUN, not against the
      // start of the idle window. A watch that only sees what appears after it
      // begins misses anything that arrived while the pressing was going on —
      // which on a page whose coupon fires at three seconds is most of the
      // time. Found by a test where the coupon appeared 60ms in and the watch,
      // starting later, reported an empty page with complete confidence.
      var opened = [];
      results.forEach(function (r) { opened = opened.concat(r.opened); });
      var uninvited = outermost(diff(start, fingerprint(wholeScope)).appeared)
        .filter(function (el) { return opened.indexOf(el) === -1 && isOverlay(el); });
      uninvited.forEach(function (el) {
        comps.push({
          type: 'dialog',
          root: el,
          parts: { panel: [el] },
          openedItself: true,
          why: 'it put itself over the page with nobody touching anything',
        });
      });



      // What moves on its own. Done AFTER pressing, so a panel this run opened
      // is closed again and cannot be mistaken for something that moved by
      // itself — and so the cost is only paid on a section worth reading.
      var idle = await watchIdle(scope, opts.idle == null ? 2000 : opts.idle, opts.limit);
      if (idle) {
        var run = siblingRun(idle.moved, pressed, idle.moved.concat(idle.gone || []));
        if (run) {
          var already = comps.some(function (c) {
            return c.parts && c.parts.slide && c.parts.slide.indexOf(run.items[0]) !== -1;
          });
          if (already) {
            // A carousel already found by its arrows. Say that it also moves on
            // its own, which is the part with a WCAG requirement attached.
            comps.forEach(function (c) {
              if (c.type !== 'carousel') return;
              c.autoAdvances = true;
              c.why += ', and it advances on its own';
            });
          } else {
            comps.push({
              type: 'carousel',
              root: run.parent.parentElement || run.parent,
              parts: { slide: run.items },
              autoAdvances: true,
              why: 'it changed which of ' + run.items.length +
                   ' items is showing with nobody touching it',
            });
          }
        }
      }

      if (!same(start, fingerprint(wholeScope))) {
        for (var g = 0; g < comps.length; g++) {
          if (comps[g].shape !== 'strip') continue;
          try { comps[g].parts.items[0].click(); } catch (e) {}
        }
        await raf();
        if (!same(start, fingerprint(wholeScope))) {
          try {
            doc.dispatchEvent(new root.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          } catch (e) {}
          await raf();
        }
      }
    } finally {
      net.disarm();
    }
    var restored = same(start, fingerprint(wholeScope));
    return { components: comps, pressed: pressed.length, skipped: skipped, restored: restored };
  }

  root.__u1Probe = {
    safeToClick: safeToClick,
    fingerprint: fingerprint,
    diff: diff,
    outermost: outermost,
    probeOne: probeOne,
    probeAll: probeAll,
    pressable: pressable,
    classify: classify,
    armNet: armNet,
    DANGER: DANGER,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

'use strict';

// The one third-party static-analysis engine, run in the page and normalised
// into the shape the scan list already speaks.
//
// The built-in rules in panel.js are hand-written and stay: they know things
// about THIS product that a general engine cannot — an auto-advancing carousel
// with no pause control, a U1 mapping whose selector went stale. What they are
// not is a complete WCAG ruleset, and colour contrast in particular needs a
// rendered page and a mature algorithm nobody should rewrite.
//
// One engine: axe-core (Deque, MIT), the de-facto standard, ~100 rules. It runs
// UNDER our wording: every axe rule is translated in panel.js's AXE_RULES into
// the same plain title / why / fix a hand-written rule carries, and filed under
// the same checklist question. The reader never sees an axe message.
//
// Deliberately NOT here:
//   · IBM Equal Access. Ran here for a while; removed on request. Its raw
//     messages were written for the person who wrote the HTML, it flagged
//     duplicate ids on <script> tags as accessibility failures, and everything
//     it checked that is static and worth checking is now either an axe rule or
//     a hand-written one — see scan-coverage.md for the rule-by-rule account.
//   · Lighthouse. Its accessibility category IS axe-core, so it contributes
//     nothing but a second copy of the same findings and a much larger runtime.
//   · WAVE. Genuinely different, but there is no local engine — only a paid
//     per-page API, and the browser extension cannot be driven from here.
//   · HTML_CodeSniffer. Its published build contains no rules at all; they are
//     fetched at run time from a path relative to its own <script src>, which
//     inside an extension resolves against the client's origin. Not shipped
//     rather than shipped dead.
//
// Runs in the ISOLATED world: full DOM access, and not subject to the client
// site's CSP — which matters, because the sites that most need scanning are the
// ones most likely to forbid an inline script.

(function () {
  if (window.__u1ScanEngines) return;

  /**
   * The same short selector panel.js's own rules use (`#id`, `tag.class`,
   * `tag`), plus the index among that selector's matches — together they name
   * THIS element, and they are what lets an axe finding and a hand-written one
   * on the same element fold into one row.
   */
  var selOf = function (el) {
    if (!el || el.nodeType !== 1) return '';
    var ident = function (s) { return /^[A-Za-z][\w-]*$/.test(s); };
    if (el.id && ident(el.id)) return '#' + el.id;
    var cls = (el.className && typeof el.className === 'string')
      ? el.className.trim().split(/\s+/).filter(ident) : [];
    if (cls.length) return el.tagName.toLowerCase() + '.' + cls.slice(0, 2).join('.');
    return el.tagName.toLowerCase();
  };
  var idxOf = function (el, sel) {
    try { return Math.max(0, Array.prototype.indexOf.call(document.querySelectorAll(sel), el)); }
    catch (e) { return 0; }
  };

  // ── axe ──────────────────────────────────────────────────────────────────
  //
  // Impact maps straight onto the severities the list already sorts by. axe's
  // own "incomplete" results are NOT included: they mean "a human must look",
  // and mixing them into a list of faults is how a scan starts crying wolf.
  var AXE_SEVERITY = { critical: 'Critical', serious: 'High', moderate: 'Medium', minor: 'Low' };

  var runAxe = function () {
    if (!window.axe) return Promise.resolve([]);
    return window.axe
      .run(document, { resultTypes: ['violations'], reporter: 'v2' })
      .then(function (res) {
        var out = [];
        (res.violations || []).forEach(function (v) {
          (v.nodes || []).forEach(function (n) {
            var target = (n.target || [])[0] || '';
            // axe's target is a unique CSS path — precise for highlighting,
            // unreadable as a name. Resolve the element and name it our way.
            var el = null;
            if (typeof target === 'string') { try { el = document.querySelector(target); } catch (e) {} }
            var sel = el ? selOf(el) : (typeof target === 'string' ? target : '');
            out.push({
              engine: 'axe',
              ruleId: 'axe.' + v.id,
              issue: v.help,
              why: v.description,
              // failureSummary is the only part that names what is wrong with
              // THIS element rather than the rule in general.
              fix: (n.failureSummary || '').replace(/^Fix any of the following:\s*/i, '').trim() || v.help,
              severity: AXE_SEVERITY[v.impact] || 'Medium',
              wcag: (v.tags || []).filter(function (t) { return /^wcag\d/.test(t); })
                .map(function (t) { return t.replace(/^wcag/, '').split('').join('.'); })[0] || '',
              selector: sel,
              idx: el ? idxOf(el, sel) : 0,
              target: typeof target === 'string' ? target : '',
              text: el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) : '',
              tag: el ? el.tagName.toLowerCase() : '',
              // Where a link goes — the text alone ("here", "Learn more.") does
              // not say which of forty links this is.
              href: el && el.closest ? ((el.closest('a[href]') || {}).getAttribute ? el.closest('a[href]').getAttribute('href') : '') : '',
              // The colour pair behind a contrast finding: what it is, what it
              // needs. Lets the panel group "these 12 are all #009ea0 on white".
              data: (function () {
                var d = ((n.any || [])[0] || {}).data || {};
                return d && d.fgColor ? { fgColor: d.fgColor, bgColor: d.bgColor, contrastRatio: d.contrastRatio, expectedContrastRatio: d.expectedContrastRatio, fontSize: d.fontSize, fontWeight: d.fontWeight } : null;
              })(),
              detail: n.html || '',
              helpUrl: v.helpUrl || '',
            });
          });
        });
        return out;
      })
      .catch(function () { return []; });
  };

  window.__u1ScanEngines = function () {
    return runAxe().then(function (findings) {
      return {
        findings: findings,
        // Whether the engine actually answered. A missing engine is not zero
        // findings from it, and a scan that half-ran must not look like a
        // clean page.
        ran: window.axe ? ['axe'] : [],
      };
    });
  };
})();

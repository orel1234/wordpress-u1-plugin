'use strict';

// Third-party static-analysis engines, run in the page and normalised into the
// shape the scan list already speaks.
//
// The built-in rules in panel.js are hand-written and stay: they know things
// about THIS product that a general engine cannot — an auto-advancing carousel
// with no pause control, a U1 mapping whose selector went stale. What they are
// not is a complete WCAG ruleset, and a client asking "what does axe say" was
// getting our answer to a different question.
//
// Two engines, chosen because they disagree:
//   · axe-core (Deque, MIT) — the de-facto standard, ~90 rules.
//   · IBM Equal Access (Apache 2.0) — a separate ruleset, stronger on ARIA
//     relationships and document structure.
//
// Deliberately NOT here:
//   · Lighthouse. Its accessibility category IS axe-core, so it contributes
//     nothing but a second copy of the same findings and a much larger runtime.
//   · WAVE. Genuinely different, but there is no local engine — only a paid
//     per-page API, and the browser extension cannot be driven from here.
//   · HTML_CodeSniffer. Its published build contains no rules at all; they are
//     fetched at run time from a path relative to its own <script src>, which
//     inside an extension resolves against the client's origin. Bundling all 98
//     standards and bridging them into its private registry got them loaded and
//     it still never called back, with no error raised. Not shipped rather than
//     shipped dead.
//
// Runs in the ISOLATED world: full DOM access, and not subject to the client
// site's CSP — which matters, because the sites that most need scanning are the
// ones most likely to forbid an inline script.

(function () {
  if (window.__u1ScanEngines) return;

  /** A CSS path good enough to find the element again, and to read. */
  var selOf = function (el) {
    if (!el || el.nodeType !== 1) return '';
    var ident = function (s) { return /^[A-Za-z][\w-]*$/.test(s); };
    if (el.id && ident(el.id)) return '#' + el.id;
    var cls = (el.className && typeof el.className === 'string')
      ? el.className.trim().split(/\s+/).filter(ident) : [];
    if (cls.length) return el.tagName.toLowerCase() + '.' + cls.slice(0, 2).join('.');
    return el.tagName.toLowerCase();
  };

  var snippet = function (el) {
    if (!el) return '';
    var html = (el.outerHTML || '').replace(/\s+/g, ' ');
    return html.length > 160 ? html.slice(0, 157) + '…' : html;
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
              selector: typeof target === 'string' ? target : '',
              detail: n.html || '',
              helpUrl: v.helpUrl || '',
            });
          });
        });
        return out;
      })
      .catch(function () { return []; });
  };

  // ── IBM Equal Access ─────────────────────────────────────────────────────
  //
  // Its results carry every PASS as well, which is the bulk of them, so the
  // filter is not cosmetic — an unfiltered run reports thousands of "findings".
  var IBM_SEVERITY = { violation: 'High', potentialviolation: 'Medium', recommendation: 'Low' };

  var runIbm = function () {
    if (!window.ace || !window.ace.Checker) return Promise.resolve([]);
    var checker;
    try { checker = new window.ace.Checker(); } catch (e) { return Promise.resolve([]); }
    return checker.check(document, ['IBM_Accessibility'])
      .then(function (res) {
        var out = [];
        (res.results || []).forEach(function (r) {
          var level = (r.value || [])[1];
          if (!level || level === 'PASS') return;
          var kind = level === 'FAIL' ? 'violation'
            : level === 'POTENTIAL' ? 'potentialviolation' : 'recommendation';
          var el = null;
          try { el = r.node || (r.path && document.querySelector(r.path.dom)); } catch (e) {}
          out.push({
            engine: 'ibm',
            ruleId: 'ibm.' + r.ruleId,
            issue: (r.message || r.ruleId || '').split('.')[0],
            why: r.message || '',
            fix: r.message || '',
            severity: IBM_SEVERITY[kind] || 'Medium',
            wcag: '',
            selector: el ? selOf(el) : ((r.path && r.path.dom) || ''),
            detail: el ? snippet(el) : '',
            helpUrl: r.help || '',
          });
        });
        return out;
      })
      .catch(function () { return []; });
  };

  window.__u1ScanEngines = function (which) {
    var wanted = which && which.length ? which : ['axe', 'ibm'];
    var jobs = [];
    if (wanted.indexOf('axe') !== -1) jobs.push(runAxe());
    if (wanted.indexOf('ibm') !== -1) jobs.push(runIbm());
    return Promise.all(jobs).then(function (lists) {
      var flat = [];
      lists.forEach(function (l) { flat = flat.concat(l); });
      return {
        findings: flat,
        // Which engines actually answered. A missing engine is not zero
        // findings from it, and reporting the two as one thing is how a scan
        // that half-ran looks like a clean page.
        ran: wanted.filter(function (n) {
          return n === 'axe' ? !!window.axe : !!(window.ace && window.ace.Checker);
        }),
      };
    });
  };
})();

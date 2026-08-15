(function () {
  if (typeof U1_SETTINGS === "undefined") return;

  // Missing/unknown scope is treated as 'global' so pre-existing mappings
  // (saved before page-scoping existed) keep working everywhere, unchanged.
  function matchesScope(item) {
      if (!item || !item.scope || item.scope === 'global') return true;
      if (item.scope === 'page') {
          var norm = function (p) { return (p || '').replace(/\/+$/, '') || '/'; };
          return norm(item.originPage) === norm(window.location.pathname);
      }
      return true;
  }

  // Applies fix() jobs in small idle-scheduled chunks so a large mapping set
  // doesn't block the main thread in one synchronous burst. Bounded by a hard
  // watchdog cap so it can never add more than ~HARD_CAP ms of extra latency.
  function applyJobs(jobs) {
      var idx = 0;
      var CHUNK = 15, IDLE_TIMEOUT = 30, HARD_CAP = 200;
      var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
      var start = now();
      var ric = window.requestIdleCallback || function (cb) {
          return setTimeout(function () {
              cb({ timeRemaining: function () { return 8; }, didTimeout: true });
          }, 1);
      };
      function runOne(job) {
          try {
              window.u1.fix[job.g](job.it.element || job.it.container || job.it.trigger || job.it.slide || job.it.menu, { selectors: job.it });
          } catch (e) {}
      }
      function step(deadline) {
          if (now() - start > HARD_CAP) {
              while (idx < jobs.length) runOne(jobs[idx++]);
              return;
          }
          var n = 0;
          while (idx < jobs.length && n < CHUNK && (deadline.didTimeout || deadline.timeRemaining() > 0)) {
              runOne(jobs[idx++]);
              n++;
          }
          if (idx < jobs.length) ric(step, { timeout: IDLE_TIMEOUT });
      }
      ric(step, { timeout: IDLE_TIMEOUT });
  }

  // --- QA validation mode ---
  // Activated via ?u1qa=1 only — completely inert for real visitors, no
  // console output otherwise. For every mapping that should apply on this
  // page (per matchesScope), checks whether its selector actually resolves
  // to an element and logs one console.error per broken one, in a fixed,
  // greppable format a daily external monitor can parse. See
  // monitoring-system/PROMPT.md for the full system this feeds.
  //
  // Note: this uses the *correct* primary-selector field per type (matching
  // CORE_DEFS in js/u1-step-components.js), not the `it.element || it.container
  // || it.trigger || it.slide || it.menu` fallback used by applyJobs()'s
  // runOne() above — that fallback has no 'form' branch, so it never actually
  // reads a form mapping's primary selector. Validation needs the accurate
  // field per type, or 'form' mappings would falsely report as broken.
  var MAIN_FIELD_BY_TYPE = {
      button: 'element', link: 'element', menu: 'menu', form: 'form',
      accordion: 'container', tabs: 'container', dialog: 'trigger', carousel: 'carouselContainer'
  };

  function isQaMode() {
      try {
          return new URLSearchParams(window.location.search).get('u1qa') === '1';
      } catch (e) { return false; }
  }

  // `id` is a stable per-mapping identifier (assigned by the wizard, see
  // U1W.utils.generateId / U1W.ensureIds) that survives reordering/deleting
  // other mappings — unlike `index`, which is just this item's current
  // position and can shift. Mappings saved before this existed won't have
  // one until the wizard is opened once (it backfills on boot); until then
  // this falls back to 'legacy-no-id' and `index` is the only way to locate it.
  function logValidationError(type, index, field, selector, id) {
      console.error(
          'U1-VALIDATION-ERROR | domain=' + window.location.hostname +
          ' | type=' + type +
          ' | id=' + (id || 'legacy-no-id') +
          ' | index=' + (index + 1) +
          ' | field=' + field +
          ' | selector=' + selector +
          ' | page=' + window.location.pathname
      );
  }

  function selectorMissing(selector) {
      try { return !document.querySelector(selector); }
      catch (e) { return true; } // invalid selector -> also worth flagging
  }

  function runQaValidation() {
      Object.keys(MAIN_FIELD_BY_TYPE).forEach(function (type) {
          (U1_SETTINGS[type] || []).forEach(function (it, i) {
              if (!matchesScope(it)) return;
              var field = MAIN_FIELD_BY_TYPE[type];
              var selector = it[field];
              if (!selector) return;
              if (selectorMissing(selector)) logValidationError(type, i, field, selector, it.id);
          });
      });
      (U1_SETTINGS.static_fixes || []).forEach(function (fix, i) {
          if (!fix.selector || !matchesScope(fix)) return;
          if (selectorMissing(fix.selector)) logValidationError('static_fixes', i, 'selector', fix.selector, fix.id);
      });
  }

  function init() {
      if (isQaMode()) runQaValidation();

      // 1. Static Fixes
      if (U1_SETTINGS.static_fixes) {
          U1_SETTINGS.static_fixes.forEach(function (fix) {
              if (!fix.selector || !matchesScope(fix)) return;
              try {
                  document.querySelectorAll(fix.selector).forEach(function (el) {
                      if (fix.attr === 'alt') {
                          el.alt = fix.val;
                      } else {
                          el.setAttribute(fix.attr, fix.val);
                      }
                  });
              } catch (e) {}
          });
      }

      // --- Helper: מחיקת Skip Links של וורדפרס / התבנית ---
      function removeThemeSkipLinks() {
          var selectors =
              '.ulst-skip-link, .skip-link, .skiplink, #ast-skip-link, .screen-reader-text a,' +
              'a[class*="skip-link"],' +
              'a[href="#primary-site-navigation"], a[href="#secondary-site-navigation"],' +
              'a[href="#primary-site-navigation-mobile"], a[href="#content"], a[href="#main"],' +
              'a.screen-reader-shortcut, a[aria-label*="Skip"][aria-label*="navigation"]';

          document.querySelectorAll(selectors).forEach(function (el) {
              var parent = el.closest('#u1-wizard-skiplinks-wrapper');
              if (!parent) el.remove(); // לא נוגעים בלינקים של U1
          });
      }

      // תמיד מוחקים Skip Links של וורדפרס
      removeThemeSkipLinks();
      var removeObserver = new MutationObserver(removeThemeSkipLinks);
      removeObserver.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { removeObserver.disconnect(); }, 5000);

          // 2. Skip Links – כפתורים שמופיעים רק בטאב ראשון, בתוך האתר (#page)
      if (U1_SETTINGS.init && U1_SETTINGS.init.skiplinks_enabled &&
          Array.isArray(U1_SETTINGS.skiplinks) && U1_SETTINGS.skiplinks.length) {

          var WRAPPER_ID = 'u1-wizard-skiplinks-wrapper';

          // מחיקת wrapper קודם אם יש
          var old = document.getElementById(WRAPPER_ID);
          if (old) {
              try { old.remove(); } catch (e) {}
          }

          // מיכל האתר: קודם #page, אם אין – .hfeed.site, ואם גם זה אין – body
          var host = document.getElementById('page') ||
                     document.querySelector('.hfeed.site') ||
                     document.body;

          // An explicit window.u1.dir (set by the generated implementation
          // snippet from the panel's Direction control) always wins; otherwise
          // fall back to reading the page's own dir/lang.
          function computeIsRtl() {
              if (window.u1 && window.u1.dir === 'rtl') return true;
              if (window.u1 && window.u1.dir === 'ltr') return false;
              return document.documentElement.dir === 'rtl' ||
                  document.body.dir === 'rtl' ||
                  ((document.documentElement.lang || '').toLowerCase().indexOf('he') === 0);
          }

          var isRtl = computeIsRtl();
          var skipLinkAnchors = [];

          // dir/lang can change after load (a language switcher, WPML/Polylang,
          // or a client-side i18n toggle) — reposition already-built skip links
          // instead of leaving them stuck with the direction computed at init.
          function repositionSkipLinks(rtl) {
              skipLinkAnchors.forEach(function (a) {
                  if (rtl) {
                      a.style.right = '80px';
                      a.style.left = '';
                  } else {
                      a.style.left = '80px';
                      a.style.right = '';
                  }
              });
          }

          // טופ מתחת ל-WP Admin Bar (רק לפוקוס, כדי שלא ייחתך)
          var wpAdminBar = document.getElementById('wpadminbar');
          var skipTopOffset = 16;
          if (wpAdminBar) {
              skipTopOffset += wpAdminBar.offsetHeight || 0;
          }

          // מעטפת קישורי דילוג – יושבת בראש ה-container של האתר
          var wrapper = document.createElement('div');
          wrapper.id = WRAPPER_ID;
          wrapper.className = 'u1-skiplinks';
          wrapper.setAttribute('role', 'navigation');
          wrapper.setAttribute('aria-label', 'Accessibility Links');
          wrapper.style.position = 'fixed';
          wrapper.style.top = '0';
          wrapper.style.left = '0';
          wrapper.style.width = '100%';
          wrapper.style.zIndex = '2147483647';
          wrapper.style.pointerEvents = 'none';

          // מנקה Skip Links של וורדפרס/תבנית, אבל לא שלנו
          function removeThemeSkipLinks() {
              var selectors =
                  '.ulst-skip-link, .skip-link, .skiplink, #ast-skip-link, .screen-reader-text a,' +
                  'a[class*="skip-link"],' +
                  'a[href="#primary-site-navigation"], a[href="#secondary-site-navigation"],' +
                  'a[href="#primary-site-navigation-mobile"], a[href="#content"], a[href="#main"],' +
                  'a.screen-reader-shortcut, a[aria-label*="Skip"][aria-label*="navigation"]';

              document.querySelectorAll(selectors).forEach(function (el) {
                  var parent = el.closest('#' + WRAPPER_ID);
                  if (!parent) el.remove();
              });
          }
          removeThemeSkipLinks();

          var firstLinkElement = null;

          function buildLink(cfg, index) {
              var sel = (cfg.target_selector || cfg.target || '').trim();
              if (!sel) return;

              var target;
              try {
                  target = document.querySelector(sel);
              } catch (e) { return; }
              if (!target) return;

              // ID בטוח – לא דורכים על ID אמיתי
              var id = target.id;
              if (!id || /^u1-/.test(id) || /^skip-target-/.test(id)) {
                  id = 'u1-skip-target-' + index;
                  target.id = id;
              }

              target.setAttribute('tabindex', '-1');
              target.style.outline = 'none';

              var a = document.createElement('a');
              a.href = '#' + id;
              a.textContent = cfg.text || ('Skip to ' + (cfg.type || 'section'));

              // עיצוב: כפתור צד חבוי, מופיע רק בפוקוס
                a.style.position = 'absolute';
                a.style.top = '-999px';          // חבוי עד לפוקוס

                // להצמיד לקצה המסך ולעגל לכיוון האמצע
                if (isRtl) {
                    a.style.right = '80px';
                    a.style.borderRadius = '10%';   // עיגול בצד השמאלי, צמוד לימין
                } else {
                    a.style.left = '80px';
                    a.style.borderRadius = '10%';   // עיגול בצד הימני, צמוד לשמאל
                }

                a.style.pointerEvents = 'auto';
                a.style.background = '#000';
                a.style.color = '#fff';
                a.style.padding = '8px 16px';
                a.style.fontSize = '14px';
                a.style.fontWeight = 'bold';
                a.style.textDecoration = 'none';
                a.style.border = '2px solid transparent';
                a.style.boxShadow = '0 4px 10px rgba(0,0,0,0.35)';
                a.style.fontFamily = 'sans-serif';
                a.style.outline = 'none';
                a.style.transition = 'top 0.15s ease-out, background 0.15s ease-out';

              a.addEventListener('focus', function () {
                  a.style.top = skipTopOffset + 'px';   // מתחת ל-admin bar אם יש
                  a.style.background = '#222';
                  a.style.borderColor = '#fff';
              });

              a.addEventListener('blur', function () {
                  a.style.top = '-999px';
                  a.style.background = '#000';
                  a.style.borderColor = 'transparent';
              });

              a.addEventListener('click', function (e) {
                  e.preventDefault();
                  try {
                      target.focus({ preventScroll: true });
                  } catch (err) {
                      target.focus();
                  }
                  try {
                      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } catch (err2) {
                      target.scrollIntoView(true);
                  }
              });

              if (!firstLinkElement) firstLinkElement = a;
              skipLinkAnchors.push(a);
              wrapper.appendChild(a);
          }

          // כפתור לכל שורה שהגדרת ב-STEP 3
          U1_SETTINGS.skiplinks.forEach(function (cfg, idx) {
              buildLink(cfg, idx);
          });

          if (wrapper.hasChildNodes()) {
              // **הזרקה לתוך האתר** – כילד הראשון של #page / .hfeed.site
              if (host.firstChild) {
                  host.insertBefore(wrapper, host.firstChild);
              } else {
                  host.appendChild(wrapper);
              }

              // TAB ראשון מתוך הדף → הסקיפ-לינק הראשון של U1
              window.addEventListener('keydown', function (e) {
                  if (e.key === 'Tab' && !e.shiftKey && !e.altKey) {
                      var active = document.activeElement;
                      // רק כשהפוקוס עוד לא נכנס לאתר – body/html
                      if (active === document.body || active === document.documentElement) {
                          var first = firstLinkElement || wrapper.querySelector('a');
                          if (first) {
                              e.preventDefault();
                              first.focus();
                          }
                      }
                  }
              });

              // אם התבנית מוסיפה שוב skip-links – לנקות כמה שניות
              var obs = new MutationObserver(removeThemeSkipLinks);
              obs.observe(document.body, { childList: true, subtree: true });
              setTimeout(function () { obs.disconnect(); }, 5000);

              // Kept alive for the life of the page — unlike the cleanup
              // observers above, a language switch can happen at any point in
              // the session, not just in the first few seconds after load.
              var dirObserver = new MutationObserver(function () {
                  var rtl = computeIsRtl();
                  if (rtl !== isRtl) {
                      isRtl = rtl;
                      repositionSkipLinks(isRtl);
                  }
              });
              dirObserver.observe(document.documentElement, {
                  attributes: true,
                  attributeFilter: ['lang', 'dir']
              });
          }
      }


      // 3. U1 Engine Legacy
      var pollAttempts = 0;
      var MAX_POLL_ATTEMPTS = 60; // ~30s at 500ms — give up if the engine never loads
      var check = setInterval(function () {
          pollAttempts++;
          if (window.u1 && window.u1.setConfiguration) {
              clearInterval(check);
              var i = U1_SETTINGS.init || {};
              window.u1.setConfiguration({
                  visualFocus: {
                      style: {
                          color: i.focus_color,
                          secondaryColor: i.focus_secondary_color,
                          doubleBorder: !!i.focus_double
                      }
                  }
              });
              var groups = ['button', 'link', 'menu', 'form', 'accordion', 'tabs', 'dialog', 'carousel'];
              var jobs = [];
              groups.forEach(function (g) {
                  (U1_SETTINGS[g] || []).forEach(function (it) {
                      if (!matchesScope(it)) return;
                      jobs.push({ g: g, it: it });
                  });
              });
              applyJobs(jobs);
          } else if (pollAttempts >= MAX_POLL_ATTEMPTS) {
              clearInterval(check);
          }
      }, 500);
  }

  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
  } else {
      init();
  }
})();

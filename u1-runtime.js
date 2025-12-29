(function () {
  if (typeof U1_SETTINGS === "undefined") return;

  function init() {
      // 1. Static Fixes
      if (U1_SETTINGS.static_fixes) {
          U1_SETTINGS.static_fixes.forEach(function (fix) {
              if (!fix.selector) return;
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

          var isRtl =
              document.documentElement.dir === 'rtl' ||
              document.body.dir === 'rtl' ||
              ((document.documentElement.lang || '').toLowerCase().indexOf('he') === 0);

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
          }
      }


      // 3. U1 Engine Legacy
      var check = setInterval(function () {
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
              groups.forEach(function (g) {
                  (U1_SETTINGS[g] || []).forEach(function (it) {
                      try {
                          window.u1.fix[g](it.element || it.container || it.trigger || it.slide || it.menu, { selectors: it });
                      } catch (e) {}
                  });
              });
          }
      }, 500);
  }

  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
  } else {
      init();
  }
})();

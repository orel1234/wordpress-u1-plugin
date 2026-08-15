/**
 * STEP | i18n.js — live language switching, no page reload.
 * Loads before real-script.js/real-mega.js so window.T exists when their
 * render functions run. Static text is marked with data-i18n (translate
 * textContent) or data-i18n-attr="attr1,attr2" (translate those attributes),
 * looked up against window.STEP_TRANSLATIONS[lang][originalEnglishText].
 * Dynamic (JS-rendered) content re-renders itself: modules that build DOM
 * from data call T() at render time and register a refresh callback via
 * STEP_I18N.onLanguageChange so a language switch re-runs them in place.
 */
'use strict';

(function () {
  var RTL_LANGS = ['he', 'ar', 'fa', 'ur'];

  var LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'he', name: 'עברית' },
    { code: 'ar', name: 'العربية' },
    { code: 'ru', name: 'Русский' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'de', name: 'Deutsch' },
    { code: 'pt', name: 'Português' },
    { code: 'it', name: 'Italiano' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'fa', name: 'فارسی' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'ur', name: 'اردو' },
    { code: 'pl', name: 'Polski' },
    { code: 'nl', name: 'Nederlands' },
    { code: 'uk', name: 'Українська' },
    { code: 'vi', name: 'Tiếng Việt' }
  ];

  var STORAGE_KEY = 'step_lang';
  var callbacks = [];
  var currentLang = 'en';

  function savedLang() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return LANGUAGES.some(function (l) { return l.code === v; }) ? v : 'en';
    } catch (e) { return 'en'; }
  }

  function T(s) {
    if (currentLang === 'en') return s;
    var dict = (window.STEP_TRANSLATIONS || {})[currentLang];
    if (dict && Object.prototype.hasOwnProperty.call(dict, s)) return dict[s];
    return s;
  }

  function originalText(el) {
    if (el.dataset.i18nSrc === undefined) el.dataset.i18nSrc = el.textContent;
    return el.dataset.i18nSrc;
  }

  function toPascalCase(attr) {
    return attr.split('-').map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join('');
  }

  function originalAttr(el, attr) {
    var key = 'i18nSrcAttr' + toPascalCase(attr);
    if (el.dataset[key] === undefined) el.dataset[key] = el.getAttribute(attr) || '';
    return el.dataset[key];
  }

  function translateStaticDom() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.textContent = T(originalText(el));
    }
    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var el2 = attrNodes[j];
      var attrs = el2.getAttribute('data-i18n-attr').split(',');
      for (var k = 0; k < attrs.length; k++) {
        var attr = attrs[k].trim();
        if (!attr) continue;
        el2.setAttribute(attr, T(originalAttr(el2, attr)));
      }
    }
  }

  function populateSwitcher(select) {
    if (!select || select.dataset.i18nPopulated) return;
    select.dataset.i18nPopulated = 'true';
    select.innerHTML = LANGUAGES.map(function (l) {
      return '<option value="' + l.code + '">' + l.name + '</option>';
    }).join('');
    select.addEventListener('change', function () {
      applyLanguage(select.value);
    });
  }

  function syncSwitchers() {
    var selects = document.querySelectorAll('#langSelect');
    for (var i = 0; i < selects.length; i++) {
      populateSwitcher(selects[i]);
      selects[i].value = currentLang;
    }
  }

  function applyLanguage(lang) {
    if (!LANGUAGES.some(function (l) { return l.code === lang; })) lang = 'en';
    currentLang = lang;
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}

    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.indexOf(lang) !== -1 ? 'rtl' : 'ltr';

    translateStaticDom();
    syncSwitchers();

    callbacks.forEach(function (fn) {
      try { fn(lang); } catch (e) { console.error('[i18n] refresh callback failed', e); }
    });

    document.dispatchEvent(new CustomEvent('step:languagechange', { detail: { lang: lang } }));
  }

  window.T = T;
  window.STEP_I18N = {
    LANGUAGES: LANGUAGES,
    RTL_LANGS: RTL_LANGS,
    getLang: function () { return currentLang; },
    isRtl: function () { return RTL_LANGS.indexOf(currentLang) !== -1; },
    applyLanguage: applyLanguage,
    onLanguageChange: function (fn) { callbacks.push(fn); }
  };

  function init() {
    applyLanguage(savedLang());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

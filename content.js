'use strict';

let pickerActive = false;
let lastHighlighted = null;
const OUTLINE_STYLE = '2px solid #8B5CF6';

// Classes we skip when building a selector: Tailwind arbitrary values,
// pseudo-prefixed responsive variants, transient state classes, very long
// generated class names (CSS modules, etc.).
const SPECIAL_CHARS_RE = /[\[\]():%<>\/]/;
const PREFIXED_VARIANT_RE = /^(hover|focus|active|open|visible|hidden|show|collapse|sm|md|lg|xl|xxl|2xl):/i;

function isCleanClass(c) {
  if (!c || typeof c !== 'string') return false;
  if (c.length > 30) return false;
  if (SPECIAL_CHARS_RE.test(c)) return false;
  if (PREFIXED_VARIANT_RE.test(c)) return false;
  if (/^(js-|is-)/.test(c)) return false; // state-prefixed
  return true;
}

function buildSelector(el) {
  if (!el || el === document.documentElement || el === document.body) return '';

  if (el.id) {
    return '#' + CSS.escape(el.id);
  }

  const parts = [];
  let current = el;

  while (current && current !== document.documentElement && current !== document.body) {
    if (current.id) {
      parts.unshift('#' + CSS.escape(current.id));
      break;
    }

    let seg = current.tagName.toLowerCase();

    if (current.classList && current.classList.length > 0) {
      const cls = Array.from(current.classList)
        .filter(isCleanClass)
        .slice(0, 2)
        .map(c => '.' + CSS.escape(c))
        .join('');
      if (cls) seg += cls;
    }

    // Add :nth-of-type only if needed to disambiguate among siblings
    const parent = current.parentElement;
    if (parent && parent !== document.documentElement) {
      const siblings = Array.from(parent.children).filter(s => s.tagName === current.tagName);
      if (siblings.length > 1) {
        // Only use :nth-of-type if the class-based selector alone isn't unique
        let unique = true;
        if (seg !== current.tagName.toLowerCase()) {
          try {
            const matches = parent.querySelectorAll(':scope > ' + seg);
            unique = matches.length === 1;
          } catch { unique = false; }
        } else {
          unique = false;
        }
        if (!unique) {
          const idx = siblings.indexOf(current) + 1;
          seg += `:nth-of-type(${idx})`;
        }
      }
    }

    parts.unshift(seg);
    current = current.parentElement;

    if (parts.length >= 3) break;
  }

  return parts.join(' > ');
}

function getElementInfo(el) {
  if (!el) return {};
  const classList = el.classList ? Array.from(el.classList).slice(0, 12) : [];
  return {
    tag: el.tagName ? el.tagName.toLowerCase() : '',
    role: el.getAttribute ? el.getAttribute('role') : null,
    inputType: el.tagName === 'INPUT' ? (el.getAttribute('type') || 'text') : null,
    hasHref: el.tagName === 'A' && !!el.getAttribute('href'),
    ariaExpanded: el.getAttribute ? el.getAttribute('aria-expanded') : null,
    ariaHaspopup: el.getAttribute ? el.getAttribute('aria-haspopup') : null,
    ariaModal: el.getAttribute ? el.getAttribute('aria-modal') : null,
    dataToggle: el.getAttribute ? (el.getAttribute('data-toggle') || el.getAttribute('data-bs-toggle')) : null,
    classes: classList,
    parentTag: el.parentElement ? el.parentElement.tagName.toLowerCase() : null,
    parentRole: el.parentElement && el.parentElement.getAttribute ? el.parentElement.getAttribute('role') : null,
  };
}

function onMouseOver(e) {
  if (!pickerActive) return;
  const target = e.target;
  if (target === document.documentElement || target === document.body) return;

  if (lastHighlighted && lastHighlighted !== target) {
    lastHighlighted.style.removeProperty('outline');
    lastHighlighted.style.removeProperty('outline-offset');
  }

  target.style.outline = OUTLINE_STYLE;
  target.style.outlineOffset = '2px';
  lastHighlighted = target;
  e.stopPropagation();
}

function onMouseOut(e) {
  if (!pickerActive) return;
  const target = e.target;
  target.style.removeProperty('outline');
  target.style.removeProperty('outline-offset');
}

function onClick(e) {
  if (!pickerActive) return;
  e.preventDefault();
  e.stopPropagation();

  const selector = buildSelector(e.target);
  const info = getElementInfo(e.target);

  if (lastHighlighted) {
    lastHighlighted.style.removeProperty('outline');
    lastHighlighted.style.removeProperty('outline-offset');
    lastHighlighted = null;
  }

  deactivatePicker();

  // Storage fallback (for when side panel reopens later)
  chrome.storage.local.set({
    pickerActive: false,
    pickedSelector: selector,
    pickedInfo: info,
  });

  // Direct message to side panel (which stays open)
  try { chrome.runtime.sendMessage({ action: 'elementPicked', selector, info }); } catch {}
}

function activatePicker() {
  if (pickerActive) return;
  pickerActive = true;
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);
  document.documentElement.style.cursor = 'crosshair';
}

function deactivatePicker() {
  if (!pickerActive) return;
  pickerActive = false;
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('mouseout', onMouseOut, true);
  document.removeEventListener('click', onClick, true);
  document.documentElement.style.removeProperty('cursor');

  if (lastHighlighted) {
    lastHighlighted.style.removeProperty('outline');
    lastHighlighted.style.removeProperty('outline-offset');
    lastHighlighted = null;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'startPicker') {
    activatePicker();
    sendResponse({ ok: true });
  } else if (msg.action === 'cancelPicker') {
    deactivatePicker();
    chrome.storage.local.set({ pickerActive: false });
    sendResponse({ ok: true });
  } else if (msg.action === 'ping') {
    sendResponse({ ok: true });
  }
  return false;
});

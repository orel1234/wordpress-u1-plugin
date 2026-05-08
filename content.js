'use strict';

let pickerActive = false;
let lastHighlighted = null;
const OUTLINE_STYLE = '2px solid #007bff';

function buildSelector(el) {
  if (!el || el === document.documentElement || el === document.body) return '';

  if (el.id) {
    return '#' + CSS.escape(el.id);
  }

  const parts = [];
  let current = el;

  while (current && current !== document.documentElement) {
    if (current.id) {
      parts.unshift('#' + CSS.escape(current.id));
      break;
    }

    let seg = current.tagName.toLowerCase();

    if (current.classList && current.classList.length > 0) {
      const cls = Array.from(current.classList)
        .filter(c => c && !c.match(/^(hover|focus|active|open|visible|hidden|show|collapse)/i))
        .slice(0, 3)
        .map(c => '.' + CSS.escape(c))
        .join('');
      if (cls) seg += cls;
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(s => s.tagName === current.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        seg += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(seg);
    current = current.parentElement;

    if (parts.length >= 4) break;
  }

  return parts.join(' > ');
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

  if (lastHighlighted) {
    lastHighlighted.style.removeProperty('outline');
    lastHighlighted.style.removeProperty('outline-offset');
    lastHighlighted = null;
  }

  deactivatePicker();

  chrome.storage.local.set({
    pickerActive: false,
    pickedSelector: selector
  });
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

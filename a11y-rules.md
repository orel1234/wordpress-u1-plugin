# Rules for the scan

Loaded verbatim into the AI's system prompt for the "find what's on this screen"
pass. **Edit this file to change what the scan flags — no code change needed.**

Keep each rule short and testable. Say what to do, not what to consider. If a
rule is about *not* flagging something, say so plainly: the failure mode we care
about is a scan that lists things a specialist then has to dismiss one by one.

---

## 1. Native semantics are already accessible — do not flag them

An element that is natively the right thing needs no u1 mapping. Set
`needsWork: false` and do not propose a component type for:

- `<a href="…">` with visible text, or an `aria-label`. It is already a link,
  already focusable, already announced. A `link` mapping on it adds nothing.
- `<button>`, `<input type="button|submit|reset">` with visible text or a label.
  Already a button, already keyboard-operable.
- `<input>`, `<select>`, `<textarea>` that have a real `<label for>`, or are
  wrapped in a `<label>`, or carry `aria-label` / `aria-labelledby`.
- `<table>` that already has `<th>` cells with `scope`.
- Real headings `<h1>`–`<h6>` — unless rule 2 applies.

**Flag one of these only when the native semantics are actually broken**, for
example: an `<a>` with no `href` used as a button, a `<button>` whose only
content is an icon with no accessible name, or an input whose "label" is a
neighbouring `<div>` that is not associated with it.

## 2. Heading order

If the page has an `<h1>`, check the heading outline in document order. Report a
component with type `heading` when a level is **skipped going down** — `h1` then
`h3`, or `h2` then `h4`. Going back up any distance is normal and correct
(`h3` → `h2` → `h2` ends a section; it is not a defect).

Say which heading is wrong and what it should be, e.g. *"'Categories' is an h3
directly under the h1 — it should be an h2."*

If the page has **no** `<h1>` at all, report that as its own row: a page needs
one top-level heading.

Do not report heading order when the outline is already correct.

## 3. One row per component

A nav bar with seven links and six drop-downs is ONE `menu`, not thirteen rows.
A table is one `table`, not one row per cell. If two candidate elements belong to
the same widget, they belong on the same row.

## 4. Only what is on screen

Skip anything not visible in the screenshot. Do not infer components from markup
you cannot see — a closed drop-down's contents, a modal that has not opened, a
tab panel that is not selected.

## 5. Do not pad the list

A short, correct list is worth more than a long one. Every row costs the
specialist a decision. If a screen genuinely has three things worth fixing, list
three.

---

<!-- Add new rules below. Number them, keep them short, and prefer a concrete
     example over a general principle. -->

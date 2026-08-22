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

## 2a. A tab strip is a menu

Do not report `tabs` for a strip of controls that swaps what is shown below it.
Report it as `menu`. A tab strip and a nav bar with drop-downs are the same
shape — several sibling controls, pressing one swaps what is visible — and the
two were being told apart by which word the developer happened to use in a class
name, which is not a distinction worth making.

## 2b. What makes a row of links a menu

Several items under one parent are a `menu` when ANY ONE of these holds:

- they sit inside the page header
- they open from a hamburger button — including when the panel itself is
  rendered outside the header, which is the usual arrangement
- they are a vertical side menu

They do NOT have to open anything. A flat row with no drop-downs is a full menu.

The same row of links **outside** all three is not a menu. Footer link columns in
particular are ordinary links — do not report them. Root a menu on the DIRECT
parent of the items, never on a wrapper that also holds a logo or a search box.

## 2c. Breadcrumbs

Report `breadcrumb` for a trail of links with a separator between each pair
(`/ › » →` or a small icon) AND text smaller than the page's body text. Both
conditions, not one: a row of links with no separator is a menu if it is in the
header and ordinary links if it is not.

## 2d. Anything else that was pressed

For a control that is not part of a component above, decide by what it does, not
by what it is called:

- it navigates to another page → `link`
- it opens something on screen → `button`, and then what opened decides the
  component: a layer over most of the screen is a `dialog`, a region that opens
  and closes in place is an `accordion`, a list under the control is a `listbox`

Rule 1 still wins over this one: a native `<a href>` or `<button>` that already
has a name needs no mapping at all.

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

## 6. Never build a selector on a machine-generated class

Build tools emit class names that change on every deploy — `css-1x2y3z`,
`sc-bdVaJa`, `jsx-2841`, `_btn_1a2b3`, `a7Fk2p`. A mapping built on one works
today and breaks at the next release, silently.

Prefer, in this order: `#id` · `[data-testid]` or any deliberate `data-*` ·
`[aria-label]` · `[name]` · a **meaningful** class the developers named
(`.main-nav__link`) · a structural chain (`nav>div>a`).

A class is machine-generated if it mixes letters and digits with no word you
could say aloud, or carries a hash-looking suffix. When in doubt, prefer
structure — a chain of tags is ugly but it survives a deploy.

## 7. Say when you had nothing good to work with

If the only thing available was a generated class or a deep structural chain,
say so in the row's reason. The specialist can then add a `data-*` attribute to
the site and re-map, which is the durable fix.

---

<!-- Add new rules below. Number them, keep them short, and prefer a concrete
     example over a general principle. -->

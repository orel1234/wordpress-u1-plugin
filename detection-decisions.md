# Detection decisions — what each component IS

A running record of the rules Orel approved, component by component, so nothing
has to be re-derived from a conversation nobody can search. `a11y-rules.md`
governs the SCAN and `component-rules.md` the BUILD; this file is the reasoning
behind both, including the cases that were considered and rejected.

Status per component: **decided** · **open** · **not yet reviewed**.

---

## menu — decided

**Tabs are a menu.** A tab strip and a nav bar with drop-downs are the same
shape by every test either layer applies: several sibling controls, pressing one
swaps what is shown. Detection stops trying to tell them apart.

This was measured before it was agreed, and the tool already half-behaved that
way: the class list checks the word "nav" BEFORE the word "tabs", so the
commonest tab-strip markup on the web — `class="nav nav-tabs"` — was already
being named `menu?`. The separation existed on paper.

**A menu does not need drop-downs.** A flat row of items with nothing that opens
is a full menu. (This reverses a first draft of this file, which said a row of
plain links with nothing nested was "not a menu, just links".)

**Three ways to be a menu — any one is enough:**

1. it sits inside the page header
2. it opens from a hamburger button — including when the panel itself is
   rendered outside the header in the markup, which is the usual arrangement
3. it is a vertical side menu

Anything else with the same shape is NOT a menu. Footer link columns in
particular are not a menu; they are ordinary links.

**Root:** the DIRECT parent of the items, never the wrapper. A frame holding a
logo, a search box and one list is a menu of one item — descend to the list.

**Not yet in the code:** there is no notion of "inside the page header" anywhere
in detection today. The reader asks only what an element is CALLED, never where
it SITS. The one existing piece of header logic — `travelsWithViewport` — is
about not counting a sticky header fifteen times in a page-wide scan, and is not
this.

Proposed test for "the page header", any one sufficient: a `<header>` element ·
`role="banner"` · a name containing header / masthead / topbar · a bar at the
top of the page that sticks on scroll.

---

## breadcrumb — decided, and it becomes a real type

**Two conditions, both required:**

1. a separator between each pair of links — arrow, slash, chevron, dot, pipe
2. text noticeably smaller than the page's body text

Neither alone is enough. A chain of links with no separator that is not in the
header is not a breadcrumb — it falls to the link/button rule below.

**It must be buildable, not just nameable.** Before this, the reader could
answer "breadcrumb" and the builder had no such type, so the label led nowhere:
seventeen names can be produced, twenty-three types can be built, and four of
the names — breadcrumb, toolbar, media player, radio group — matched nothing.
Breadcrumb is now one of the types.

### How a breadcrumb is made accessible

From the WAI-ARIA Authoring Practices breadcrumb pattern and the WCAG technique
G65, confirmed against several independent sources:

- the trail is wrapped in a `<nav>` landmark carrying `aria-label="Breadcrumb"`.
  The label matters because a page has several navigation landmarks and they are
  otherwise indistinguishable in a screen reader's landmark list.
- the links sit in an ordered list — `<ol>` / `<li>`, or `role="list"` and
  `role="listitem"` where the markup is divs. Order is meaningful here, which is
  why it is an ordered list and not a plain one.
- the LAST item — the current page — carries `aria-current="page"`. It may stay
  a link or be plain text; `aria-current` is what makes it the current one
  either way.
- the visual separators must not be announced. A separator that lives in the
  markup gets `aria-hidden="true"`; one drawn in CSS is already silent and needs
  nothing.
- it satisfies WCAG 2.4.8 Location (AAA). Nothing here is required at AA, which
  is worth saying plainly rather than implying a breadcrumb is a compliance
  failure.

---

## link and button — decided

The rule that catches everything the menu rule drops.

**Native and already correct → nothing to fix.** A real `<a href>` with visible
text, or a real `<button>` with a name, is already a link or a button: it has
the role, it is in the tab order, and a mapping adds nothing. Only a broken one
is worth a row — an `<a>` with no `href`, an icon-only button with no name.
(This was already rule 1 of `a11y-rules.md`; it is repeated here because it is
the single most common way a scan gets padded.)

**Otherwise, decide by what pressing it does:**

- it goes to another page → **link**
- it opens something on screen → **button**, and then what opened decides:
  - a layer over most of the screen → dialog
  - a region that opens and closes in place → accordion
  - a list under the control → listbox

The first half is free: the behavioural layer already REFUSES to press a link
that leads elsewhere, on the stated grounds that a link is a link and there is
nothing to learn from pressing one. So "it navigates" is known without pressing.

**Never pressed:** anything whose face reads delete, pay, checkout, add to cart,
submit, send, subscribe, sign up, log out — in Hebrew and English both. These
come back unanswered rather than pressed.

---

## Open questions

- **breadcrumb, both-conditions rule** — should separators alone, or small text
  alone, be enough? Currently both are required.
- **toolbar, media player, radio group** — three more names the reader can
  produce that no type can build. Breadcrumb was the fourth and is now fixed;
  these are still dead ends.
- **the corpus conflict** — `fixtures/step.labels.json` labels the breadcrumb
  as `menu`, reasoning "not a drop-down, but it is navigation". Under the rules
  above it is a breadcrumb. The label has to move, or the score will fall for a
  reason that has nothing to do with detection getting worse.
- **the case-sensitivity gap** — a class written in joined-capital style
  (`dealTabs`) is never COLLECTED, because the collection list compares case
  exactly while the naming stage does not. The two lists are supposed to stay in
  step and here they do not.

## Not yet reviewed

accordion · carousel · datepicker · dialog · listbox · combobox · checkbox ·
radio · form · table · grid · pagination · loading · tooltip · heading

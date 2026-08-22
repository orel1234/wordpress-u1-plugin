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

**Done:** the reader now says `menu` wherever it used to say `tabs` — role
`tablist`, a bare strip of `role="tab"`, the class words, the library
fingerprints and the Reach UI attribute. The behavioural layer says `menu` too,
and roots the strip on the DIRECT PARENT of its controls rather than on the
common ancestor of the controls and their panels, which reached up past the
strip. The corpus moved with it: the three components labelled `tabs` are
labelled `menu`, with `items` / `submenus` for what were `tab` / `tabPanel`.
Accuracy held at 8/8 found, 8/8 named.

The `tabs` TYPE is untouched — it is still in the builder, still has its own
engine, still ships its own corrections. Detection suggesting `menu` and a
specialist choosing to build `tabs` are different questions, and only the first
was decided.

One thing deliberately left alone: the element INVENTORY line still counts "5
tabs, 1 tab strip". That counts elements the page itself declares, one by one,
and `tab` is still the ARIA name of a part whatever we call the whole. Renaming
it there would turn a count into a claim.

**Location is in the code now.** It was not before — detection asked what an
element was CALLED and never where it SAT, so five columns of links in the
footer came back as a menu exactly like the bar at the top.

The header is recognised structurally: a `<header>`, `role="banner"`, or a name
containing header / masthead / topbar. A geometric test was written first and
taken back out — "within 200px of the top of the document" is also true of a
footer on a short page, and it would have rescued exactly what the rule exists
to demote.

What fires is the FOOTER case, which is the one that was named explicitly: a
menu inside a `<footer>`, `role="contentinfo"`, or a footer-ish name is demoted
to nothing. Demoted rather than renamed, because what a footer nav IS depends on
where its links go — that is the link/button rule's question. `menu` was simply
the only wrong answer available.

Only menus are placed. A carousel in the footer is still a carousel.

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

---

# The rest, distilled — PROPOSED, not yet approved

Everything below is written from what the code already does plus the three rules
already agreed, and is waiting on a yes / no / correction each. The format is
the same throughout: what it is · how it is recognised · what it is confused
with · when NOT to report it.

## accordion — decided

A heading or a piece of text that, pressed, opens a panel inside the page, and
closes it again when pressed a second time. **Two or more** — one is a
disclosure, not an accordion.

- **Root:** the HEADER BUTTON, not the container. Counter-intuitive and worth
  repeating, because the class named "accordion" usually sits on the container
  and that is the wrong answer. The content selector is required.
- **A class must be seen to change.** This is how a page actually says open —
  `.is-open`, `.active`, `.expanded` — and it is also the state selector a
  mapping needs. Now observed on both the trigger and the panel, since sites use
  either and about as often both.
- **A link in the panel does not make it a menu.** What decides is what is there
  BESIDES the links: an FAQ answer with a "read more" in it is prose that
  contains a link. Measured by subtracting the links' own text and weighing what
  is left — under about a sentence means the panel is links and whitespace, and
  that is a menu.
- **"FAQ" is an assumption, and assumptions are not made.** A name may raise it
  to the level of a guess — never to a finding. It stays marked with a `?` and
  must be confirmed by pressing it, which is what the `?` has always meant.
- **Confused with:** a dialog (covers the page rather than pushing it down) and
  a strip (pressing one closes another).

Already in the code before this: the shape logic climbs up to four levels from
a single trigger to find what holds its siblings; finds each panel by an
explicit reference, then any data-attribute naming a real element, then the
next sibling; and takes the sibling of the wrapping HEADING rather than of the
button, when the button is wrapped in one.

## carousel — decided

A strip of items showing one at a time, with a way to move between them.

- **Read:** carousel, slideshow, gallery, slider, ticker, marquee, or a library
  fingerprint. A ticker, a marquee and an announcement rail are all this.
- **Pressed:** controls that cycle a set BIGGER THAN THEMSELVES. This is the
  whole discriminator against a tab strip, which has as many panels as tabs
  because each tab owns one. A carousel has two arrows and five slides.
  Measured first: a hero carousel with prev/next was coming back as a strip of
  two controls "each revealing the same region" — a menu.
- **A swipe-only gallery with no arrows is still a carousel.** It has nothing to
  press, so the only way to find it is to watch it move.
- **It advances on its own:** watched with nothing pressed. Reported as its own
  fact, because a thing that moves and cannot be stopped is WCAG 2.2.2 in its
  own right — the kind nobody reports, since nothing on the page looks broken.
- **Any horizontal rail that moves is a carousel.** A shelf of twenty products
  with two arrows and no "current item" is one. So is a swipe gallery.

"A row that merely scrolls is not a carousel" was written here first and was
never a rule — it was a LIMIT OF THE CODE presented as a decision. Measured
both ways round: the same gallery written with `hidden` came back as a
carousel, and written as a scroller came back as an empty page. Movement is
watched now, not only appearing and disappearing.

Only SIDEWAYS movement counts. Opening an accordion pushes everything below it
down, and counting that would make every accordion on the page a carousel.

Three things had to be got right for the counting rule not to swallow tab
strips, each found by a test rather than by reasoning:

- anything holding a CONTROL is not a slide — slides are inert, the arrows live
  outside the track. On a page written flat, a strip's own panels sat beside the
  nav and the accordion and the run counted five against three controls.
- anything that never once took its turn is not a slide either. A paragraph of
  prose beside a two-control strip counted as a third item and made it a
  carousel.
- but a slide nobody reached IS one. Untouched slides are hidden, which is what
  an unreached slide looks like, so two arrows over five slides still counts
  five.

And the idle watch SAMPLES rather than comparing start to end: a cycle that
divides the window lands back on the first slide and a two-point comparison
sees nothing. Found by a test whose timing did exactly that and then reported
"no carousel here" with complete confidence.

## dialog — decided

Something that opens over the page and takes it over until dismissed.

- **Read:** modal, lightbox, drawer, offcanvas, or the dialog role.
- **Pressed:** what opened covers most of the screen and sits in a layer over
  it. Needs no name at all.
- **Also this:** a drawer and an off-canvas panel.
- **Root:** the thing that APPEARS, never what opens it. A dialog with no
  trigger is still a real mapping.
- **Not:** a panel that pushes the page down rather than covering it.

**A banner is a dialog.** A cookie bar, a coupon strip, a consent notice: pinned
to the top or bottom edge, nearly full width, and deliberately SHORT. "Covers
most of the screen" was only one shape of layer and the height test alone threw
every banner out. They appear over the page, they demand an answer, and one you
cannot close by keyboard is a real trap. Guarded so a 3px progress rule and a
strip sitting in the middle of the page are not swept in.

**One that opens ITSELF is a dialog too.** A coupon after five seconds, a cookie
notice on load. Nobody pressed anything, so pressing can never find it — it is
found by comparing the page against how it looked at the START of the run, not
against the start of the idle window. A watch that only sees what appears after
it begins misses anything that arrives while the pressing is going on, which on
a real page is most of the time.

**Focus behaviour is a FINDING, never a condition.** A first draft of this file
proposed checking that focus is really trapped and returned. That is backwards:
a site's developer often does not build that, focus often is not trapped, and
that is the whole reason the accessibility layer exists. Requiring correct focus
behaviour before agreeing something IS a dialog would mean the broken ones — the
only ones worth mapping — are the ones detection declines to find.

So it is recorded instead: did focus follow what opened. A dialog that leaves
focus outside says so in its own line, as the work it needs.

**A bug this uncovered, older than any of these decisions:** "does it cover the
page" was being asked AFTER every press had been undone, so it measured a
CLOSED panel. A panel closed with `hidden` has no box, the test compared a width
of zero against 60% of the viewport, and answered no — every time. Modals were
being reported as accordions: "it revealed and hid a region", true and useless.
It only ever appeared to work on drawers that stay laid out while closed, which
is why it survived. Everything about the open state is now measured while it is
open, and there is a line in the code saying so.

## listbox and combobox

The pair that gets swapped most often. The rule is mechanical: **if the options
are not inside what you chose, you chose wrong.**

- **listbox** — one button opens one list. The LIST is the root; the button is
  the trigger. Never the wrapper, never the button.
- **combobox** — typing filters a list of suggestions. An autocomplete is this,
  and usually carries no roles at all: recognise it by shape, an input with a
  list beside it under one parent.
- **The distinction:** typing filters → combobox. A button opens a fixed list →
  listbox. No single trigger, it just stands there → menu.
- **NOT a combobox:** a field that filters a list already visible on the page — a
  branch locator, "filter by city". There is no popup, so those roles describe a
  control that does not exist. What is missing there is a status message saying
  how many results are showing.

## form

- **Read:** a real `<form>` is a form and needs no heuristic — that was a bug
  once, because the guard against naming every div inside a form also caught the
  form itself.
- **Shape:** three or more fields under one element, where nothing tighter
  already holds them all, and there are no more links than fields.
- **One submit is one form.** Several means this is the wrapper around several,
  and the tighter answer was right — a filter panel of five selects, five
  checkboxes and one button is ONE form, not two rows.

## table and grid

- **table** — a data table you read. Needs headers to be worth mapping.
- **grid** — a table you move around with the arrow keys. That is the whole
  difference: focus moves between cells.
- **Not:** a layout table. One row, or one column, or no headers anywhere, is
  not a data table and must not be mapped as one.

## datepicker

- **Read:** datepicker or calendar, or a library fingerprint.
- **Root:** the calendar that APPEARS, with the control that opens it as the
  trigger. Both required.
- **The day cells are the point.** Without them there is nothing for the arrow
  keys to move between, and the mapping does nothing.

## checkbox and radio

- **checkbox** — an on/off choice. A SWITCH is mapped as a checkbox; there is no
  switch type.
- **radio** — one of a set, only one chosen at a time.
- **The state classes are the point.** These are the classes the page already
  toggles to say on/off — read off the markup, never invented. Without them the
  library has no way to know which state the control is in and announces the
  wrong one.
- **Not:** a native checkbox or radio with a real label. Already accessible.

## pagination

Numbered controls that move through pages of one result list.

- **Read:** pagination or pager.
- **Against menu:** pagination leads to the same content in pages; a menu leads
  to different places.
- The current page is usually a class, not an attribute.

## tooltip

Extra text shown beside a control.

- **Read:** tooltip or popover.
- A tooltip nothing opens is half a mapping — the trigger matters.

## loading

An indicator that must be announced rather than silently appearing.

- Recognised by name; there is no shape to read, and nothing to press.

## heading

- **Report only when the outline is BROKEN**: a level skipped going down (h1 then
  h3), or no top-level heading at all on the page.
- Going back up any distance is normal and correct.
- **Never renumber a page's headings to make them tidy.** Say so in notes.

## tabs — the type, not the name

Detection no longer suggests this: a strip reads as a menu. The type stays in the
builder for a specialist who decides a real tab pattern is what a widget needs.

---

## Open questions

- **breadcrumb, both-conditions rule** — DECIDED: leave it. Both a separator and
  small text are required.
- **toolbar, media player, radio group** — three more names the reader can
  produce that no type can build. Breadcrumb was the fourth and is now fixed;
  these are still dead ends.
- **everything under "The rest, distilled"** — proposed, awaiting a yes, a no or
  a correction each.

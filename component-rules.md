# Rules for building a mapping, component by component

These are the rules the model is given when it works out the selectors for one
component. `a11y-rules.md` is the other half — it governs the page SCAN, which
decides what is wrong. This file governs the BUILD, which decides what to do
about it.

Kept here rather than in code so it can be corrected without a release, and
checked against `COMPONENT_SCHEMAS` by `scripts/verify-mappings.mjs` so it
cannot quietly drift from the fields the builder actually accepts.

---

## The rules that hold for every component

1. **Every selector must resolve on the markup you were shown.** Not a class you
   would expect a site like this to use — one that is in front of you. A
   selector that matches nothing is worse than an empty field: the field is
   visibly unanswered, the wrong selector looks finished and fails silently.

2. **Sub-selectors describe DIFFERENT elements.** If `tabList`, `tab` and
   `tabPanel` come back as the same selector, that is not a mapping — it is the
   root repeated three times, and U1 will decorate one element and do nothing
   else. When you cannot tell the parts apart, say so in `notes` and leave the
   field empty.

3. **No descendant spaces and no pseudo-classes.** U1 resolves selectors itself
   and rejects `.a .b`, `:hover`, `:nth-of-type`. Use `>`, `,` and attribute
   selectors. `.a>.b` is fine; `.a .b` is not.

4. **Never build on a machine-generated class.** `css-1x9dz2p`, `sc-bdVaJa`,
   `_3kFg2` change on the next deploy. Prefer an id, a `data-*` hook, or a
   readable class. If the only thing available is generated, say so.

5. **One element per single-element field.** `u1.fix.*` decorates ONE element
   per selector — the last match — so a field meant for one thing must not
   match six. Fields meant for many (`items`, `options`, `slide`) must.

6. **The state selectors are classes the page really toggles.** `checkedState`
   and `uncheckedState` are how the page already says on/off. Read them off the
   markup; do not invent `.is-checked` because it is conventional.

---

## menu

Root on the element that is the DIRECT PARENT of the items — `u1.fix.menu`
reads the root's own children. A `<nav>` with a logo, a search box and one
`<ul>` inside it is a menu of one item; descend to the list.

- `menu` / `horizontalMenu` — the list itself
- `items` — every item, including the ones inside submenus
- `triggers` — the items that open a submenu
- `submenus` — the panels those open

`menubar: true` gives items `role="menuitem"`. With `menubar: false` the
triggers become `role="button"` and the submenus `role="menu"`. Do not set
`menubar: true` together with `submenus` — U1 rejects the combination.

## tabs

The PRIMARY is the tab, not the strip.

- `tabList` — the strip that contains the tabs
- `tab` — the individual tabs, all of them
- `tabPanel` — the panels, which usually live OUTSIDE the strip

The commonest failure is all three being the strip's selector. If the panels
are not inside the strip, `tabPanel` must be rooted somewhere that reaches
them. A site that wires its tabs with `data-*` instead of `aria-controls` is
ordinary — follow the attribute to the element it names.

## accordion

The PRIMARY is the HEADER BUTTON, not the container the accordion class sits
on. `contentSelector` is REQUIRED.

- `headerSelector` — the buttons that expand and collapse
- `contentSelector` — the regions they open
- `headingLevel` — from the heading wrapping the button, if there is one
- `collapsesOthers` — true only when opening one really does shut the rest

## carousel

- `carouselContainer` — the whole thing
- `slide` — every slide
- `prevButton` / `nextButton` — the arrows
- `slidePickerButtons` — the dots, when there are any
- `activeSlides` — the class the page puts on the slide currently shown

A ticker, a marquee and an announcement rail are carousels. So is anything with
prev/next that swaps what is visible.

## dialog

Rooted on the thing that APPEARS, not on what opens it. The trigger is a
separate field, and a dialog with no trigger is a real mapping.

- `dialog` — the panel or overlay
- `trigger` — what opens it, when there is one
- `closeBtn` — the close control. Optional to U1, not optional to the person
  using it: a dialog you cannot close by keyboard is a trap
- `heading` — the dialog's own title, for its accessible name

A drawer and an off-canvas panel are dialogs.

## listbox and combobox

The clickable thing is the TRIGGER because it has the event. The thing that
CONTAINS several things is the list, because that is the shape. These two get
swapped constantly — measure, do not reason about which looks more important.

- listbox: `listbox` (the list), `trigger`, `options`
- combobox: `combobox` (the wrapper), `textbox` (the input), `listbox`,
  `options`, `label`

An **autocomplete** is a combobox: a text input whose typing reveals a list of
suggestions. It usually carries no roles at all — no `role="combobox"`, no
`aria-expanded` — so recognise it by shape: an input, and a list of options
beside it under a common parent. `.search-suggestions`, `.autocomplete__list`,
`.results`, `ul` next to an input are all the same thing.

## filter with live results — NOT a combobox

A field that narrows a list which is **already on the page**: a branch locator,
a "filter by city" box, a search that rewrites the results below it as you type.

**Do not map this as a combobox, and do not give it `role="combobox"` or
`aria-expanded`.** An ARIA combobox has a popup that opens and closes. This list
is always there. Those roles describe a control that does not exist and leave a
screen reader waiting for a popup that never comes — worse than leaving it
alone.

What is actually missing is **WCAG 4.1.3 Status Messages**. You type a letter,
fourteen branches become two, and nothing says so: the change is purely visual.

- `field` — the input that filters
- `results` — the container holding the results
- `item` — one result
- `noun` — what a result IS, for the announcement: "branch", "product", "flight"

The fix:

1. `aria-controls` on the field, naming the results container
2. a visually hidden `role="status" aria-live="polite"` element **beside** the
   list, saying how many are showing
3. never `aria-live` on the list itself — that re-reads every result on every
   keystroke, which is worse than silence

Telling the two apart: if the list is visible before anyone types, it is this.
If typing makes a list appear that was not there, it is a combobox.

## form

- `form` — the form element
- `inputField` — every field, all of them
- `submitButton` — the submit
- `invalidField` — the class the page puts on a field it has rejected

## table

- `table` — the table itself
- `row` — the rows
- `cell` — the cells
- `columnheader` — the header cells along the top, when the table has them
- `rowheader` — the header cells down the first column, when it has those

A layout table — one row, or one column, or no headers anywhere — is not a data
table and should not be mapped as one.

## grid

A grid is a table you can move around with the arrow keys. A table you only read
is a `table`.

- `grid` — the grid itself
- `row` — the rows
- `cell` — the cells
- `columnheader` / `rowheader` — the header cells, when it has them

## datepicker

Rooted on the calendar that APPEARS, with the control that opens it as the
trigger. Both are required.

- `container` — the calendar panel
- `trigger` — the field or button that opens it
- `days.table` — the grid of days
- `days.day` — an individual day cell
- `year` / `month` — the year and month controls, when there are any

The day cells are the point: without `days.day` there is nothing to move
between with the arrow keys.

## checkbox, radio

There is no `switch` type — a switch is mapped as a checkbox, and U1 gives it
`role="switch"` from the markup where the page says so.

The state classes are the point. `checkedState` and `uncheckedState` are the
classes the page toggles, read off the markup. Without them U1 has no way to
know which state the control is in, and announces the wrong one.

## heading

Only `heading` and a `level`. The level comes from the tag it is written in, or
the visual hierarchy where there is no tag. Do not renumber a page's headings
to make them contiguous — say so in `notes` instead.

## link and button

The element itself, and nothing else. If a mapping of these needs a second
selector, the type is wrong.

`button`'s `focusTo` is for scroll-to behaviour and is almost never wanted.

## tooltip

- `tooltip` — the bubble
- `trigger` — what shows it

Optional to U1; a tooltip nothing opens is half a mapping.

## pagination

- `container`, `pageButtons`, `prevButton`, `nextButton`, `currentPage`

The current page is usually a class, not an attribute.

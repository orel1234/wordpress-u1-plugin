# `data-a11y-*` — naming your components for User1st

User1st attaches keyboard and screen-reader behaviour to your components by
CSS selector. On a site whose class names change with every release, a
selector built on a class is broken by the next deploy. A `data-a11y-*`
attribute is not: it is part of the markup, it says what the element is, and
it stays.

Put the attributes below in your templates once. From then on, every page that
carries them is picked up and wired automatically — no selectors are written
by hand on our side, and a release that renames every class changes nothing.

## The rule

- One attribute on the component's **container**: `data-a11y-<type>`
- One attribute on each **part** inside it: `data-a11y-<type>-<part>`
- They are boolean — no value is needed. Just the attribute.
- Keep them in production markup. They are inert: no CSS or JS of yours reads
  them, and they are invisible to users.

```html
<nav data-a11y-menu>
  <ul>
    <li><a href="/hotels" data-a11y-menu-item>Hotels</a></li>
    <li>
      <button data-a11y-menu-item data-a11y-menu-trigger>Deals</button>
      <div data-a11y-menu-submenu>
        <a href="/deals/weekend" data-a11y-menu-item>Weekend</a>
      </div>
    </li>
  </ul>
</nav>
```

An element can carry more than one part (the button above is both an item and
a trigger).

### Two of the same component on one page

Give the container a value, and put the same value on its parts:

```html
<div data-a11y-dialog="signin"> … <button data-a11y-dialog-close="signin">×</button> … </div>
<div data-a11y-dialog="filters"> … <button data-a11y-dialog-close="filters">×</button> … </div>

<button data-a11y-dialog-trigger="signin">Sign in</button>   <!-- outside the dialog: the value says whose it is -->
```

With a single instance of a type on the page no value is needed anywhere,
including for a part that sits outside the container (a dialog's trigger, a
tab strip's panels).

Values: letters, digits, `-` and `_`. No quotes.

## The vocabulary

Required parts are marked **bold**. A component whose required part is missing
is reported, not mapped.

| Component | Container | Parts |
|---|---|---|
| Button (custom element with a click handler) | `data-a11y-button` | `-focus-to` — element to focus after the click (scroll-to buttons) |
| Link (custom element that navigates) | `data-a11y-link` | — |
| Menu / navigation | `data-a11y-menu` | **`-item`** every clickable item, top level and inside drop-downs · `-trigger` items that open a drop-down · `-submenu` the drop-down panels |
| Accordion | `data-a11y-accordion` (wrapper) | **`-header`** each header button · **`-content`** each content panel · `-disabled` disabled headers |
| Tabs | `data-a11y-tabs` (wrapper around strip and panels) | **`-list`** the strip holding the tabs only · **`-tab`** each tab · **`-panel`** each panel |
| Dialog / modal | `data-a11y-dialog` (the box that opens) | `-trigger` what opens it · `-close` the close button · `-heading` its heading · `-text` its description · `-focus-to` where focus returns instead of the trigger |
| Listbox / dropdown (one control opens one flat list) | `data-a11y-listbox` (the list that appears) | **`-trigger`** the control that opens it · **`-option`** each option · `-label` its label |
| Combobox / autocomplete | `data-a11y-combobox` (the input's wrapper) | **`-input`** the text input · **`-list`** the suggestions list · **`-option`** each suggestion · `-label` its label |
| Carousel / slider | `data-a11y-carousel` | **`-slide`** each slide · `-prev` · `-next` · `-picker` the dot buttons · `-label` text describing the carousel · `-active-slide` the visible slides when several show at once |
| Date picker | `data-a11y-datepicker` (the calendar popup) | **`-trigger`** the input or button that opens it · **`-days`** the grid of days · **`-day`** each day cell · `-day-selected` · `-day-disabled` · `-month-label` · `-month-prev` · `-month-next` · `-year-label` · `-year-prev` · `-year-next` |
| Form | `data-a11y-form` (the `<form>`) | **`-submit`** · **`-input`** every field (inputs, selects, textareas) · **`-invalid`** fields in error after submit · `-required` · `-error` error messages · `-success` the success message · `-label` the form's title |
| Table (data) | `data-a11y-table` | **`-row`** · **`-cell`** body cells · `-column-header` · `-row-header` |
| Grid (interactive table) | `data-a11y-grid` | **`-row`** · **`-cell`** · `-column-header` · `-row-header` |
| Pagination | `data-a11y-pagination` | **`-page`** the numbered page buttons · `-prev` · `-next` · `-prev-skip` · `-next-skip` · `-result` each result shown |
| Radio group (custom) | `data-a11y-radio` (the group) | **`-button`** each option · **`-checked`** the selected option · `-unchecked` · `-exclude` a hidden native input to keep out of the tab order |
| Checkbox (custom) | `data-a11y-checkbox` (the element with the click handler) | **`-checked`** · **`-unchecked`** · `-disabled` · `-exclude` a hidden native input · `-label` its label when outside the element |
| Breadcrumb | `data-a11y-breadcrumb` (the trail) | `-item` each link · `-current` the current page · `-separator` the `/` or `›` between them |
| Tooltip | `data-a11y-tooltip` (the tooltip content) | `-trigger` what shows it |
| Loading indicator | `data-a11y-loading` | — |
| Heading (an element that acts as a heading but is not an `<h1>`–`<h6>`) | `data-a11y-heading` | — |

### State parts change with the state

`-checked` / `-unchecked` (checkbox, radio), `-invalid` (form), `-day-selected`
/ `-day-disabled` (date picker) and `-active-slide` (carousel) describe a
state, so they have to be added and removed as the state changes — the same
way a `.is-checked` class would be. Everything else is static.

### What you do not need to do

- No ARIA roles, `aria-expanded`, `aria-selected`, `tabindex` or key handling
  — that is what the library adds once it knows which element is which.
- No values, unless the same component appears twice on one page.
- No attributes on wrappers that are not part of a component.

## Questions

Anything the table does not cover — a component that does not fit a row, a
part that is in two places at once — send us the markup and we will say which
attributes to put where.

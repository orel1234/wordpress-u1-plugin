# What the static scan checks — and how it compares to axe and IBM

The Scan tab asks a page a fixed list of plain questions and answers each one
**passed**, **N to fix**, **N notes**, **none on page** or **not checked**.
This file is the account of where each answer comes from, and of what the two
general-purpose engines check that we do not (and why).

Two sources feed the questions:

- **Our own checks** — hand-written in `panel.js` (`scanPageStatic`). They read
  the page's markup and stylesheets directly. Always run.
- **axe-core** — runs invisibly inside the page (`scan-engines.js`). Needed for
  the two things nobody should hand-write: colour contrast (needs the rendered
  page) and the ARIA grammar (which attribute is allowed on which role). Every
  axe rule is translated into our wording in `AXE_RULES`; the reader never sees
  an axe message. If axe cannot run on a page, the questions only it answers
  show **not checked** rather than passed.

**IBM Equal Access was removed** (September 2026). Its messages were written
for the person who wrote the HTML, it failed pages for duplicate ids on
`<script>` tags, and everything it checked that is static and worth checking
is covered below — by an axe rule or by one of ours. Its rule-by-rule fate is
in the last section.

`scripts/verify-scan-engines.mjs` fails when an axe rule has no translation and
when a rule produces a concept no question claims, so this table cannot drift
silently.

---

## The questions, and what answers them

| Question | Our checks | axe rules (shown in our words) |
|---|---|---|
| **Page title** — does the tab title say what this page is? | missing title; title that is a file name / URL / “Untitled” | document-title |
| **Page language** — declared and valid? | missing `lang` | html-has-lang, html-lang-valid, valid-lang, html-xml-lang-mismatch |
| **Heading structure** — one H1, levels in order, none empty, nothing bold pretending? | no H1; several H1; skipped level (with **Map it → H3** / **Map all N headings**); empty heading | heading-order, empty-heading, page-has-heading-one, p-as-heading |
| **Images** — every meaningful image, icon and SVG has alt text, and is it right? | missing alt; alt that is a bare file-name token (real words pass); every alt listed for a person to **approve** — approved ones stop being findings | image-alt, input-image-alt, role-img-alt, svg-img-alt, object-alt, area-alt, server-side-image-map, image-redundant-alt |
| **Link text** — says where it goes on its own, and warns about new tabs? | empty link; vague link (“here”, “read more” — with **Map it → name from card**); opens a new tab without saying so (**Fix all**: “(opens in a new tab)” added to the name, in the page's language) | link-name, label-content-name-mismatch |
| **Button names** — every button, including icon-only and custom ones? | unnamed button | button-name, input-button-name, aria-command-name, summary-name, aria-toggle-field-name |
| **Form fields** — labelled visibly, once, correctly; option groups named? | unlabelled field; placeholder as the only label; radio/checkbox group with no name; `<label for>` pointing at nothing | label, select-name, aria-input-field-name, form-field-multiple-labels, label-title-only, autocomplete-valid |
| **Colour contrast** — text readable, links told apart by more than colour? | — (needs the rendered page) | color-contrast, link-in-text-block |
| **Landmarks** — main, navigation, header, footer? | no main/nav at all; two or more unnamed `role="form"`/`role="region"` (a **note**, not a failure — one unnamed form is simply not a landmark; a form that is a U1 mapping is never counted) | region, landmark-one-main, landmark-no-duplicate-main/banner/contentinfo, landmark-*-is-top-level, landmark-unique |
| **Skip link** — can the keyboard skip the menu? | no skip link at the top | bypass, skip-link |
| **Keyboard reach and focus order** — everything reachable in order, nothing hidden-but-focusable? | positive tabindex; role with no focus; clickable div/span; focusable content inside aria-hidden | tabindex, aria-hidden-focus, focus-order-semantics, nested-interactive, scrollable-region-focusable, frame-focusable-content, accesskeys |
| **ARIA used correctly** — roles and attributes real, allowed, complete, in the right container? | — (the grammar lives in axe) | aria-roles, aria-allowed-role, aria-deprecated-role, aria-valid-attr, aria-valid-attr-value, aria-allowed-attr, aria-prohibited-attr, aria-conditional-attr, aria-required-attr, aria-required-children, aria-required-parent, aria-roledescription, aria-text, aria-braille-equivalent, aria-hidden-body, presentation-role-conflict |
| **Lists and text structure** — are lists real lists? | stray `<br>`/spacer inside a list (**Fix all**: aria-hidden on it); non-item content in a list with no roles (a list carrying roles — a menu on `<ul>`, role=listitem items — passes) | definition-list, dlitem (axe's list/listitem are skipped in favour of ours) |
| **Iframes** — titled, each differently? | untitled iframe | frame-title, frame-title-unique |
| **Data tables** — header cells, tied to the right rows and columns? | table with no `<th>` | th-has-data-cells, td-has-header, td-headers-attr, scope-attr-valid, table-fake-caption, table-duplicate-name, empty-table-header |
| **Zoom and text spacing** — enlarge, respace, rotate? | zoom disabled in the viewport meta | meta-viewport, meta-viewport-large, css-orientation-lock, avoid-inline-spacing |
| **Media and motion** — nothing autoplays, blinks or reloads without a stop; carousels pausable; captions and controls? | autoplay with sound and no controls; **auto-advancing carousel with no pause control** (the control is looked for beside the carousel too, by title / class / text / icon alt); video without captions; video or audio with no controls | no-autoplay-audio, video-caption, audio-caption, blink, marquee, meta-refresh |
| **Custom widgets** — state and name announced? | switch / checkbox / slider / meter / combobox missing its state | aria-meter-name, aria-progressbar-name, aria-dialog-name, aria-tooltip-name, aria-treeitem-name |
| **IDs and ARIA references** — references point at something? | broken aria-labelledby / describedby / controls; **duplicate ids — a note**, listed in full, weighing nothing, flagged louder only when a label or ARIA reference points at the id | duplicate-id, duplicate-id-active, duplicate-id-aria (same note) |
| **Touch targets** — big enough? | target under 24×24 px | target-size |

### axe rules deliberately not shown

| Rule | Why |
|---|---|
| frame-tested | about axe itself (did it run inside every iframe), not about the page |
| hidden-content | informational — “there is hidden content”, which every page has |
| color-contrast-enhanced | WCAG AAA (7:1) — beyond the AA target |
| identical-links-same-purpose | WCAG AAA, and it guesses at intent |
| meta-refresh-no-exceptions | WCAG AAA — the AA rule (meta-refresh) is shown |

---

## What IBM Equal Access checked, and where it went

174 rules in the bundled build. Grouped by what happened to each.

### Covered — by one of our checks

| IBM rule | Ours |
|---|---|
| page_title_exists, page_title_valid | Page title missing / looks like a file name |
| html_lang_exists | Page language missing |
| html_skipnav_exists, skip_main_exists | Skip link |
| heading_content_exists | Empty heading |
| img_alt_valid, img_alt_decorative | Missing alt |
| img_alt_misuse, media_alt_brief | Alt that is just the file name (misuse); brevity is a judgement call — the evidence list shows every alt for a person to read |
| a_text_purpose | Empty link / vague link |
| a_target_warning | Link opens a new tab without saying so |
| aria_accessiblename_exists, aria_widget_labelled | Unnamed button / unlabelled field / landmark with no name (IBM filed a nameless `role="form"` under *button names*; it is a landmark) |
| input_label_exists, label_content_exists | Unlabelled field |
| input_placeholder_label_visible | Placeholder as the only label |
| input_checkboxes_grouped, fieldset_label_valid, fieldset_legend_valid | Radio/checkbox group with no name |
| label_ref_valid | `<label for>` pointing at nothing |
| frame_title_exists | Untitled iframe |
| table_headers_exists | Table with no `<th>` |
| element_id_unique, aria_id_unique | Duplicate id (note) / broken ARIA reference |
| aria_hidden_nontabbable | Focusable content inside aria-hidden |
| element_tabbable_role_valid, aria_eventhandler_role_valid, element_mouseevent_keyboard, script_onclick_misuse, script_onclick_avoid | Clickable div/span with no role; role with no focus |
| meta_viewport_zoomable, style_viewport_resizable | Zoom disabled |
| media_autostart_controllable | Autoplay with sound and no controls |
| media_keyboard_controllable | Video or audio with no controls |
| caption_track_exists | Video without captions |
| aria_attribute_required, combobox_* (design_valid, haspopup_valid, popup_reference, active_descendant, autocomplete_valid, focusable_elements) | Combobox missing its state (ours) + ARIA required-attribute / value rules (axe) |
| target_spacing_sufficient | Touch target too small |
| aria_form_label_unique, aria_region_labelled | Form / region landmark with no name |

### Covered — by an axe rule, in our words

| IBM rule | axe rule |
|---|---|
| html_lang_valid, element_lang_valid | html-lang-valid, valid-lang |
| text_contrast_sufficient | color-contrast |
| aria_role_valid, aria_role_allowed | aria-roles, aria-allowed-role |
| aria_attribute_valid, aria_attribute_allowed, aria_attribute_value_valid, aria_attribute_exists | aria-valid-attr, aria-allowed-attr, aria-valid-attr-value, aria-required-attr |
| aria_attribute_deprecated | aria-deprecated-role |
| aria_attribute_conflict | aria-conditional-attr |
| aria_child_valid, aria_parent_required, aria_descendant_valid, list_children_valid | aria-required-children, aria-required-parent |
| aria_content_in_landmark | region |
| aria_banner_single, aria_contentinfo_single, aria_contentinfo_misuse | landmark-no-duplicate-banner / contentinfo, landmark-*-is-top-level |
| aria_landmark_name_unique, aria_*_label_unique (main, navigation, banner, complementary, contentinfo, region, search, form, article, application, document, toolbar) | landmark-unique |
| aria_complementary_labelled, aria_application_labelled | landmark-unique (unnamed duplicates); a single unnamed aside is not a fault |
| aria_img_labelled, aria_graphic_labelled | role-img-alt, svg-img-alt |
| area_alt_exists, imagemap_alt_exists | area-alt |
| img_ismap_misuse | server-side-image-map |
| imagebutton_alt_exists | input-image-alt |
| object_text_exists, embed_alt_exists | object-alt |
| img_alt_redundant | image-redundant-alt |
| form_label_unique | form-field-multiple-labels |
| input_label_visible, label_name_visible | label-title-only, label-content-name-mismatch |
| input_autocomplete_valid | autocomplete-valid |
| list_markup_review, list_structure_proper | list, listitem |
| text_block_heading, heading_markup_misuse | p-as-heading |
| table_headers_ref_valid, table_headers_related | td-headers-attr, td-has-header |
| table_scope_valid | scope-attr-valid |
| table_caption_empty, table_caption_nested, table_summary_redundant | table-fake-caption, table-duplicate-name |
| table_aria_descendants, table_structure_misuse | presentation-role-conflict, aria-required-children |
| element_scrollable_tabbable | scrollable-region-focusable |
| iframe_interactive_tabbable | frame-focusable-content |
| element_accesskey_unique | accesskeys |
| element_orientation_unlocked | css-orientation-lock |
| text_spacing_valid | avoid-inline-spacing |
| meta_refresh_delay, meta_redirect_optional | meta-refresh |
| blink_elem_deprecated, blink_css_review, marquee_elem_avoid | blink, marquee |
| media_alt_exists, media_audio_transcribed | audio-caption |
| aria_activedescendant_valid, aria_activedescendant_tabindex_valid | aria-valid-attr-value |
| dir_attribute_valid | (invalid `dir` is ignored by browsers; no user impact) |
| aria_role_redundant, aria_attribute_redundant | (redundant, not wrong — noise) |

### Not covered on purpose — needs a person, or is not static

| IBM rule | Why it is not in the scan |
|---|---|
| application_content_accessible, canvas_content_described, style_before_after_review, style_background_decorative, img_alt_background | whether decoration carries meaning is a human judgement |
| form_interaction_review, form_submit_review, input_onchange_review, script_select_review, script_focus_blur_review | “review” rules — they fire on every form and say *check this*; the Dynamic scan drives the mappings instead |
| element_tabbable_visible, element_tabbable_unobscured, style_hover_persistent, style_focus_visible | need focus moved and layout measured — the Dynamic scan's territory, not a static read |
| aria_keyboard_handler_exists, aria_child_tabbable, widget_tabbable_exists, widget_tabbable_single | keyboard behaviour of custom widgets — mapping the component is the fix, and the Dynamic scan tests it |
| draggable_alternative_exists, download_keyboard_controllable | behaviour, not markup |
| text_sensory_misuse, style_color_misuse, form_font_color, text_quoted_correctly, blockquote_cite_exists, text_whitespace_valid, asciiart_alt_exists, emoticons_alt_exists | reads meaning out of prose; too many false alarms for a list that must stay countable |
| error_message_exists | fires only when a form is in an error state |
| select_options_grouped, form_submit_button_exists, input_label_before, input_label_after, input_fields_grouped, table_layout_linearized | conventions, not failures |
| media_live_captioned, media_track_available | need the media's content |
| style_highcontrast_visible | Windows high-contrast mode — cannot be measured from the page |
| skip_main_described | the skip link's evidence line shows its text for a person to read |
| element_attribute_deprecated, applet_alt_exists, embed_noembed_exists, noembed_content_exists, frame_src_valid, img_longdesc_misuse | obsolete HTML; not seen on the sites this tool serves |
| element_accesskey_labelled, input_haspopup_conflict, figure_label_exists | rare and low impact |
| debug_paths, detector_tabbable | IBM's own diagnostics |

---

## How a finding becomes a row

1. Our checks and axe each name the element the same way: a short selector
   (`h4`, `a.externalLink`, `img`) **plus its index** among that selector's
   matches. The index is what makes it *this* link — clicking or hovering a row
   scrolls to the right element, not the first one that shares the class.
2. A finding from axe is translated (`AXE_RULES`): if it is the same fault one
   of our rules describes, it takes that rule's title, why, fix and severity;
   otherwise it has its own wording in the table.
3. Findings on the same element about the same thing fold into one row
   (`mergeScanFindings`); the more severe verdict wins.
4. Each row is filed under its question. Rows marked **note** (duplicate ids)
   are listed but do not fail the question and do not lower the score.

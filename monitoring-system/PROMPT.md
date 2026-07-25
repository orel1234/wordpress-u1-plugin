# Build: Automated Accessibility-Mapping Validator + Daily Site Monitor

## Background

There's a WordPress plugin ("U1 Accessibility Wizard") that lets an admin map CSS
selectors to accessibility fixes (buttons, menus, forms, dialogs, etc. — via a
third-party engine's `window.u1.fix[type](selector, {selectors})` calls) plus
plain attribute fixes (`static_fixes`: `{selector, attr, val}`). Config is one
JSON blob with these top-level arrays: `button`, `link`, `menu`, `form`,
`accordion`, `tabs`, `dialog`, `carousel`, `static_fixes`, `skiplinks`.

Each mapping item (in the component arrays and in `static_fixes`) carries:
- `originPage` (string, a URL path like `/flights`) — the page it was created on.
- `scope`: `'global'` | `'page'` | missing. Missing/`'global'` means "should
  apply on every page of the site." `'page'` means "should only apply when the
  current page's path matches `originPage`."
- `scopeManual` (bool) — true if an admin explicitly set the scope; an
  auto-classifier promotes items to `'global'` when the same selector is seen
  from 2+ different `originPage` values, but never auto-demotes to `'page'`
  (an over-broad global mapping is harmless; a wrongly-narrowed one silently
  drops accessibility fixes on other pages — bad for an a11y tool).

The frontend runtime script already computes, for any given page load, "which
mappings should apply here" via this predicate (duplicate it, don't rediscover
it — it must match exactly):

    function matchesScope(item) {
        if (!item || !item.scope || item.scope === 'global') return true;
        if (item.scope === 'page') {
            const norm = p => (p || '').replace(/\/+$/, '') || '/';
            return norm(item.originPage) === norm(window.location.pathname);
        }
        return true;
    }

The runtime already has a precedent for a debug/admin URL flag: the wizard UI
activates via `?u1wizard=1`. Follow the same pattern for the new validation mode.

## Part 1 — Add a "QA validation mode" to the plugin's frontend runtime

File: the plugin's `u1-runtime.js` (or wherever the per-page apply logic lives).

1. Add a mode gated by a URL parameter, e.g. `?u1qa=1` — inert for every normal
   visitor, only active when a monitoring tool explicitly requests it. Do not
   log anything to a normal visitor's console.
2. When active: after the existing apply logic runs, iterate every mapping
   across all component types (`button`/`link`/`menu`/`form`/`accordion`/
   `tabs`/`dialog`/`carousel`) and `static_fixes` for which `matchesScope(item)`
   is true on the current page. For each, resolve its primary selector with
   `document.querySelector` (component items: the first field's value per
   their type, e.g. `element` for button/link, `menu` for menu, `form` for
   form; static_fixes: `selector`). Skip `skiplinks` — explicitly out of scope.
3. If the selector does NOT resolve to an element, emit exactly one
   `console.error` per broken mapping, in a single-line, greppable, stable
   format — this is what the daily monitor parses, so keep the shape exact:

       U1-VALIDATION-ERROR | domain=<hostname> | type=<mapping type> | index=<1-based position within its type's array> | field=<the selector field name> | selector=<the selector string> | page=<location.pathname>

   Example: `U1-VALIDATION-ERROR | domain=elal.com | type=menu | index=2 | field=menu | selector=".site-nav" | page=/flights`

   (`index` is positional — 1-based index within `cfg[type]` at the time of
   the check. It's not a stable ID; if mappings are reordered/deleted between
   runs the number can shift. That's an accepted, known limitation — surface
   it in the dashboard/report as "type + index", not as a permanent ID.)

4. Never throw and never break the page even if `window.u1` failed to load or
   a mapping is malformed — wrap each check in try/catch.

## Part 2 — Site-management web app (persistent, needs real hosting)

A small internal tool, NOT a Claude Artifact (no persistent storage capability
available there) — build it with whatever stack this project already uses
(reuse existing hosting/auth/DB rather than introducing a new one).

Needs:
- **Storage**: one row per monitored site — domain/label (e.g. "elal.com"),
  and a list of page paths on that site to check (a domain typically needs
  more than just its homepage checked, to cover both global mappings and the
  various page-specific ones — e.g. `/`, `/flights`, `/booking`, ...).
- **CRUD UI**: add / edit / remove a monitored site and its page list. Clean,
  readable — this is the "nice interface" the client explicitly asked for, so
  don't ship a bare unstyled form.
- **Results view**: last-check timestamp and status (pass/fail) per site, and
  the raw list of `U1-VALIDATION-ERROR` lines from the most recent failing run
  — so the client can see history without waiting for the next email.

## Part 3 — Daily automated check (Node + Playwright)

Chromium + Playwright are commonly available in this kind of environment —
confirm what's already set up in this project and reuse it rather than adding
a redundant browser install.

For each site in the Part 2 storage, for each of its configured page paths:
1. Launch headless Chromium, navigate to `<page_url>?u1qa=1`.
2. Listen for `page.on('console', ...)`, collect every message whose text
   starts with `U1-VALIDATION-ERROR`.
3. After visiting all pages for a site, if any errors were collected: mark
   that site's latest check as failed and store the full log (for Part 2's
   results view).

Schedule this to run once a day (cron / hosting platform's scheduler /
whatever this project already uses for scheduled jobs).

## Part 4 — Email notification

When a site's daily check finds one or more errors: send an email containing
the site's name/domain and the full `U1-VALIDATION-ERROR` log for that site.
Send nothing when a site is clean — don't notify on every run, only on
problems (avoid alert fatigue).

The email-sending mechanism (SMTP creds, a transactional-email API like
SendGrid/Mailgun/Resend, or a connected mail account) is an open decision —
use whatever this project already has configured for sending mail. Do not
hardcode credentials in source; read them from this project's existing
secrets/config mechanism.

## Explicitly out of scope

- `skiplinks` mappings — not part of validation.
- Auto-demoting a mapping's scope from global to page-only — stays a manual,
  explicit admin action in the wizard, never automatic.
- Don't touch the plugin's existing wizard UI/config-save flow beyond adding
  the new QA-mode branch in the runtime script.

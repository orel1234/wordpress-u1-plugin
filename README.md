# U1 Studio

Chrome side-panel extension for implementing accessibility fixes with the
User1st (u1) library. Pick an element, choose a component type, verify the
selector, test it with real keyboard simulation, and export the result as a
platform-specific implementation guide, a close-out report, or a JSON backup.

The extension source lives at the repo root. `u1-accessibility-wizard/` is a
separate, older WordPress plugin and is not part of this product.

## Build

```bash
npm run verify                       # static checks (see below)
npm run build                        # dist/u1-studio-<version>.zip
npm run build -- --server=https://your-portal.example.com
```

`package.json` is the single source of truth for the version; the build refuses
to package if `manifest.json` or the badge in `panel.html` disagrees with it.

`--server` points the build at a licence server, rewriting **both** `config.js`
(what the code calls) and the manifest's `connect-src` (what Chrome permits).
Those two must never disagree — a build that updates only one fails at runtime
with an opaque CSP error, so the build does them together or not at all. Plain
HTTP is rejected for anything but localhost, because Chrome won't allow it.

`npm run verify` catches the failures that don't throw at build time: a
`getElementById` with no matching markup, a script missing from `panel.html`, a
CSP that forbids the configured server, and session data leaking into a backup
file.

## Licensing

The extension is gated: a worker must be signed in **and** assigned to the site
they're on. Accounts, sites and assignments are managed in the User1st CRM
portal (`user1st_project`, `src/modules/studio` — see that module's README).

Three rules are enforced in code, not just in the UI:

1. **No internet doesn't stop the work.** If the server is unreachable but this
   site was verified within `GRACE_PERIOD_DAYS` (7), the tool keeps working. The
   grace period only ever extends a previous *yes* — it never invents one.
2. **An expired licence is read-only, not a lockout.** Every mapping, report and
   export still works; only creating new work is switched off.
3. **Local work is never deleted.** Not on sign-out, not on expiry, not on
   revoke. Mappings live in `chrome.storage.local` and stay there.

Credentials are stored under `__studioAuth`. The `__` prefix is load-bearing:
`sanitizeImport()` rejects those keys on import and the backup export strips
them, so a refresh token can never travel inside a backup file.

## Layout

| File | Purpose |
|---|---|
| `panel.js` | The tool — picker, mappings, scan, export, licence gate |
| `panel.html` / `styles.css` | Side-panel UI |
| `config.js` | Build-time server address and grace period |
| `auth.js` | Licence client: sign-in, refresh, assignment check |
| `test-engine.js` | ARIA + real keyboard-simulation testing |
| `docx-gen.js` / `report-gen.js` | Implementation guide and close-out report |
| `grid-nav.js` | Keyboard grid/datepicker engine |
| `background.js` | Service worker |

## Notes

The standalone accessibility monitor that used to live in
`u1-accessibility-wizard/monitoring-system/` was migrated into the CRM portal
(`src/modules/monitoring`) and removed from this repo.

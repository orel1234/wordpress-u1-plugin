# U1 Studio — working notes

## The mistake that cost a whole session: editing source is not editing the extension

Chrome does **not** load this extension from the repo root. `chrome://extensions`
→ the U1 Studio card → Details → **Source** shows the real answer:

```
Unpacked extension
Loaded from: ~/git/wordpress-u1-plugin-1/dist/u1-studio-<version>
```

`dist/u1-studio-<version>/` is a **staged copy** — `scripts/build.mjs` deletes
it and re-`cpSync`s a fixed file list into it from the repo root. Nothing
watches the source tree. Editing `panel.js`, `docx-gen.js`, `u1-patch.js`,
`panel.html` etc. and clicking the reload icon in `chrome://extensions`
reloads the **same stale `dist/` copy** — the click does nothing wrong, it's
just reloading the wrong files, silently and indistinguishably from a real
reload.

**Symptom:** a fix is made, described, verified with a standalone script — and
then reported back as "no change" or "nothing happens." That is not a failed
fix. It is a fix that was never loaded. Ask "was `dist/` rebuilt after this
edit?" before re-debugging the source.

**The fix, every time source changes and needs to be tested in the browser:**

```bash
node scripts/build.mjs --server=https://user1stproject-production.up.railway.app
```

This rewrites `dist/u1-studio-<version>/` in place (same path Chrome already
has loaded), so a plain reload in `chrome://extensions` — then close and
reopen the side panel, since an already-open panel can keep its old DOM/JS
alive across a package reload — is enough afterward. No re-pointing "Loaded
from" needed.

**Never build `--dev`** for this project. `--dev` points the extension at
`http://localhost:3001`; the real target is the CRM Backend Railway service
above (see `user1st_project`'s CLAUDE.md, §2, for that service). A `--dev`
build shows "Working offline — verified access is being used" in the panel,
which reads as an extension bug, not as a build-target mistake.

`npm run build` runs `npm run verify` first and refuses to build if any check
fails — useful normally, but it means one unrelated failing check can block a
build you need right now. `node scripts/build.mjs --server=...` run directly
skips that gate. Run `npm run verify` (or the individual `scripts/verify-*.mjs`
you touched) separately, on its own, so a real regression doesn't slip through
silently just because the gate was bypassed once.

**How to tell, without guessing, whether the loaded extension is current:**
`dist/u1-studio-<version>/manifest.json`'s `version_name` is stamped with the
git commit the build was made from (`3.1.0 (2d638d8+)` — the `+` means the
working tree had uncommitted changes when built). Compare that short SHA
against `git log --oneline -1`. `chrome://extensions`'s Details page shows
this same string.

## What this is

Chrome side-panel extension for implementing accessibility fixes with the
User1st (u1) library — see `README.md` for the full picture (build flags,
licensing model, file layout). `u1-accessibility-wizard/` is a separate, older
WordPress plugin, not part of this product. `sites/step-a11y` and
`sites/step-plain` are demo sites for testing the plugin against; see
`DEPLOYMENT.md` for their (currently manual) Railway deploy.

## The extension and the backend ship as a pair for auth changes

`auth.js` here and `user1st_project`'s `src/modules/studio/*` (a sibling repo,
see its own CLAUDE.md §2) are two halves of one login protocol — the
`/api/studio/auth/refresh` contract in particular. As of the 2026-09 security
pass, refresh tokens ROTATE on every call: the server hands back a new
`refreshToken` in every `/auth/refresh` response, the old one stops working
the instant that response is sent, and presenting it again revokes every
session the client holds (theft is assumed, not raced). `auth.js`'s
`refresh()` persists the new token from that response — if a build of this
extension predates that change, its `refresh()` keeps reusing the same
(now-dead) token and gets logged out on its first refresh after the backend
deploys. Not data-destructive (mappings stay local and re-sync on next
login), but it reads as "the extension broke" to whoever hits it. Deploy the
backend and roll out a rebuilt extension together, not the backend alone
days ahead of specialists updating.

## Conventions

- Every correction in `u1-patch.js` is verified by reading the real, external
  `u1_vanilla-js-a11y.js` engine (closed-source, fetched at runtime from
  `dev.oreltest.user1st.com`) — not guessed. Each region documents the exact
  defect it corrects and the line of reasoning that found it.
- `scripts/verify-*.mjs` are this repo's test suite (no jest/vitest). They lift
  real functions out of `panel.js`/`docx-gen.js` by brace-matching rather than
  importing, since the files touch `document` at the top level and can't be
  imported directly — see the top of any `verify-*.mjs` for the pattern.

# Vendored scan engine

`axe.min.js` is injected into the page's isolated world on a scan
(`panel.js` → `chrome.scripting.executeScript`) and never loaded from a CDN —
the extension CSP is `script-src 'self'`, so a scan on a locked-down site
would otherwise fail exactly where scanning matters most. Nothing here is
built or transformed; the file is the vendor's own release output, copied in
as-is. What the reader sees is never axe's message: `panel.js`'s `AXE_RULES`
translates every rule into our own wording (see `scan-coverage.md`).

| File | Library | Version | SHA-256 |
|---|---|---|---|
| `axe.min.js` | [axe-core](https://github.com/dequelabs/axe-core) (Deque Systems, MPL-2.0) | 4.10.2 (from the file's own header comment) | `b511cd9dec01c76f4b2ad1723b66b6db37d4c2eb4ed199076e1829d9ee7b75e3` |

`ace.js` (IBM Equal Access) lived here until September 2026 and was removed on
request — its raw messages were unreadable to the audience, and everything it
checked that is static and worth checking is now an axe rule or a hand-written
one. `scan-coverage.md` has the rule-by-rule account.

## Updating the file

1. Download the release build from the upstream project (not a fork, not a
   CDN mirror) and diff it against what's here before replacing it.
2. Recompute the hash (`shasum -a 256 vendor/axe.min.js`) and update the table
   above — that's what makes a future silent substitution visible.
3. Run `node scripts/verify-scan-engines.mjs`: it fails when the new version
   ships a rule `AXE_RULES` has no wording for, so nothing reaches the reader
   in axe's words.

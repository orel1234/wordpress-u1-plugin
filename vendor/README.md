# Vendored scan engines

Both files are injected into the page's isolated world on a scan
(`panel.js` → `chrome.scripting.executeScript`) and never loaded from a CDN —
the extension CSP is `script-src 'self'`, so a scan on a locked-down site
would otherwise fail exactly where scanning matters most. Nothing here is
built or transformed; each file is the vendor's own release output, copied in
as-is.

| File | Library | Version | SHA-256 |
|---|---|---|---|
| `axe.min.js` | [axe-core](https://github.com/dequelabs/axe-core) (Deque Systems, MPL-2.0) | 4.10.2 (from the file's own header comment) | `b511cd9dec01c76f4b2ad1723b66b6db37d4c2eb4ed199076e1829d9ee7b75e3` |
| `ace.js` | [IBM Equal Access Accessibility Checker engine](https://github.com/IBMa/equal-access) | not embedded in the bundle — record it here when it's next updated | `c8b56619a62b2c4fcf5421efc377df838d036827482a79aa0cf32305ec34e85d` |

## Updating either file

1. Download the release build from the upstream project (not a fork, not a
   CDN mirror) and diff it against what's here before replacing it.
2. Recompute the hash (`shasum -a 256 vendor/<file>`) and update the table
   above — that's what makes a future silent substitution visible.
3. Record the version you pulled, even for `ace.js` where the minified
   bundle doesn't say it — the upstream release tag is the source of truth.

## The missing `ace.js.LICENSE.txt`

`ace.js`'s own header says `/*! For license information please see
ace.js.LICENSE.txt */`, and that file isn't in this folder. IBM Equal Access
ships under Apache-2.0, which requires the license text to travel with the
code. Don't fabricate one — pull the real `ace.js.LICENSE.txt` from the same
upstream release the current `ace.js` came from (or from whichever release
replaces it) and add it here alongside this README.

# The 24 mappings, recovered

These are the mappings from the implementation guide exported on 13 Aug 2026,
turned back into the shape the panel's importer accepts. Sixteen of them were
lost when a pull replaced the local copy with a server copy that had only ever
received eight — see `reconcilePulled` in panel.js for the fix that stops it
happening again.

Recovered by RUNNING `../mappings.js` with a `u1.fix.*` that records its calls,
not by parsing it. Parsing generated JavaScript with a regular expression is how
you get twenty-three of twenty-four and never find out which one is missing.

    carousel x2 · menu x1 · tabs x3 · form x1 · link x9 · heading x3
    button x4 · accordion x1                                   = 24

All three tab strips are here — `.finder__tabs`, `#dealTabs`, `#faqTabs` — which
is the set that "it did not find the second one" was really about.

## Which file

- `step-shoe-store-mappings.json` — the original domain, which now serves the
  accessible build
- `step-shoe-store-clean-mappings.json` — the same mappings keyed to the clean
  domain, if you want to carry on there with the work already done

## Importing

Export tab → Import, and pick the file. Every entry was checked against the
importer's own rules (`VALID_MAPPING_TYPES`, `IMPORT_KEY_RE`, `SAFE_IMG`) and
passes unchanged — nothing is silently dropped.

Screenshots are deliberately null: they are re-captured the moment you look at
the page, they are not configuration, and they are what made two mappings on
elal.com too large for the server to accept. Push no longer sends them at all.

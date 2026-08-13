# step-shoe-store — the plain copy

An exact mirror of the live site with NO accessibility work on it. This is the
one to WORK on: point U1 Studio at its domain and map it from nothing.

Its twin, `sites/step-a11y`, is the same site with the User1st implementation
already in place. The only difference between the two is three lines per page —
verified, not asserted: strip the injected `<link id="u1-css">` and the two
`<script>` tags from the a11y copy and you get this one byte for byte.

## Deploying it (Railway)

1. Railway → your project → **+ Add** → **GitHub Repo** → this repo
2. Settings → **Root Directory**: `sites/step-plain`
3. Settings → Networking → **Generate Domain**

`server.js` has no dependencies; Railway reads `package.json` and runs
`npm start`.

## Why a separate domain matters here

U1 Studio keys everything — mappings, dismissals, settings — by **hostname**.
A new domain is a clean workspace: nothing is filtered out of a scan as
"already mapped", which is what makes components you have not touched yet
silently disappear from a section's list on a site you have already worked on.

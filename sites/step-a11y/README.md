# step-shoe-store — the accessible twin

An exact mirror of https://step-shoe-store-production.up.railway.app/ with the
User1st implementation added. The original stays untouched; this deploys as a
SECOND Railway service on its own domain, so the two can be compared side by
side — and so the panel treats it as a separate site with a clean workspace.

## Deploying it (Railway)

1. Railway → your project → **+ Add** → **GitHub Repo** → this repo
2. Settings → **Root Directory**: `sites/step-a11y`
3. Settings → Networking → **Generate Domain**

Railway reads `package.json`, runs `npm start`, and `server.js` serves
`public/` with no dependencies to install.

## What was added to the site

Nothing in the site's own markup, CSS or JavaScript was changed. Three lines
per page, exactly as the U1 Studio guide specifies:

    <head>   <link id="u1-css" href="https://dev.oreltest.user1st.com/u1.css">
    </body>  <script id="u1-js" src="…/u1_vanilla-js-a11y.js"></script>
             <script src="u1-implementation.js"></script>

`public/u1-implementation.js` holds, in order: the configuration, the library
corrections, the 24 component mappings, the responsive re-apply, and the
monitoring hook.

Two parts of it were NOT retyped from the guide, on purpose:

  - the library corrections come from `u1-patch.js` in this repo, which is what
    the guide was generated from. Only the regions these mappings need are
    included — core, form, tabs, menu, carousel, link, button.
  - the monitoring hook's CHECKS list is generated from the mappings above it.
    The two must agree, and a hand-copied list is exactly how they drift apart
    without anyone noticing.

## Checking it

Open the deployed copy with `?u1qa=1` and watch the console. The hook resolves
all 24 mapped selectors and logs `U1-VALIDATION-ERROR` for any that stop
matching — which is what catches the site changing under the mappings.

Verified against a snapshot of the live page with its JavaScript run: 24/24
mapping roots and 20/20 sub-selectors resolve. That check matters here because
most of this site is built at runtime — the ticker, the mega menu, the hero
slides, the deal tabs and the FAQ do not exist in the served HTML at all.

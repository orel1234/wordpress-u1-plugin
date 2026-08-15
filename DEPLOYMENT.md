# Deploying the demo sites

## The auto-deploy problem

The `step-shoe-store-clean` Railway project (service `step-shoe-store-clean`,
domain `step-shoe-store-clean-production.up.railway.app`) runs the code in
`sites/step-plain`. It is **not wired to auto-deploy on push** — pushing to
`main` on GitHub does nothing here. Discovered 2026-08-15: the service's only
deployment was from 2026-08-13, two days and several pushes stale, with zero
new builds triggered in between.

Until that's fixed on the Railway side (Settings → the service → check the
Source/GitHub connection — as of this writing there may not be one at all),
**every change to `sites/step-plain` needs a manual deploy.**

There is currently no separate Railway service for `sites/step-a11y` — only
`step-shoe-store-clean` (`step-plain`) and `step-shoe-store` (the original,
untouched client site step-a11y/step-plain mirror) exist as deployed projects.

## How to deploy step-plain manually

```bash
railway login                 # once, opens a browser
cd sites/step-plain
railway link -p step-shoe-store-clean   # once per machine/session
railway up --service step-shoe-store-clean
```

Confirm it landed:

```bash
railway deployment list       # newest entry should be SUCCESS, just now
curl -sI https://step-shoe-store-clean-production.up.railway.app/i18n/i18n.js
# should be 200, not 404, once the i18n switcher work is deployed
```

`railway up` uploads whatever is in the current directory as the build
context, so it must be run from `sites/step-plain` itself (matching the
service's configured Root Directory) — running it from the repo root would
try to deploy the whole monorepo instead.

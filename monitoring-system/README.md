# U1 Accessibility Monitor

Implements the system described in `PROMPT.md`: a dashboard for managing which
client sites/pages to watch, a daily Playwright check that visits each one
with `?u1qa=1` and reads the `U1-VALIDATION-ERROR` console lines the plugin's
`u1-runtime.js` now emits (see the "QA validation mode" section added there),
and an email report when a site comes back broken.

This is a small standalone Node app — it does **not** run inside WordPress. It
needs its own place to live (see "Hosting" below).

## What's already done

- ✅ Plugin-side validation (`u1-runtime.js`, gated by `?u1qa=1`, silent for
  real visitors).
- ✅ Dashboard (`public/`) — add/edit/remove monitored sites, see last-check
  status and the raw error log per site, trigger an on-demand check.
- ✅ Daily check (`lib/check.js` + the cron job in `server.js`, default
  `0 6 * * *` — 06:00 server time, configurable via `CHECK_CRON`).
- ✅ Email report on failure only (`lib/mailer.js`) — **falls back to writing
  the report to `data/reports/` instead of crashing if SMTP isn't configured
  yet** (see below).
- ✅ Storage: a JSON file (`data/sites.json`), created automatically on first
  run — no external database needed.

## Run it locally (to try it out)

```bash
cd monitoring-system
npm install
cp .env.example .env
npm start
# → http://localhost:3300
```

`npm install` will also pull Playwright's own Chromium if one isn't already
on the machine (in this dev environment `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` is
already set, so it reuses the pre-installed browser — on a fresh host you may
need `npx playwright install chromium` once).

## What I still need from you before this is "live"

1. **Email credentials.** Without them, failure reports are written to
   `data/reports/*.txt` instead of being sent — the system still works, you'd
   just have to check that folder instead of your inbox. To get real emails,
   fill in `.env`:
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_TO` (and
     optionally `MAIL_FROM`) — works with Gmail's SMTP (with an app password),
     SendGrid/Mailgun's SMTP endpoints, or any other SMTP provider.
   - Tell me which you'd rather use and I'll wire up the exact values, or just
     drop real credentials into `.env` yourself (it's git-ignored, won't get
     committed).

2. **Hosting.** This needs to run continuously somewhere for the daily cron
   and the dashboard to actually be reachable — it can't live only in this
   Claude Code session (the container here is reclaimed after inactivity). Do
   you have a server/VPS or a platform (Render, Railway, Fly.io, etc.) you
   want this deployed to? Once I know where, I'll adjust anything
   host-specific (e.g. `PORT`, process manager config) and can walk through
   the deploy.

3. **The actual site list.** No sites are pre-loaded — add them yourself via
   the dashboard, or tell me the initial list (domain + which pages) and I'll
   seed `data/sites.json` for you.

4. **Before exposing this publicly**: there's currently no login/auth on the
   dashboard or its API — anyone who can reach the URL can add/remove
   monitored sites. Fine for `localhost` or an internal network; if you're
   putting this on the public internet, it needs at least a shared-secret
   gate or your host's own access control in front of it. Say the word and
   I'll add basic auth.

## How the pieces fit together

```
Browser (dashboard) ──CRUD──▶ server.js ──▶ data/sites.json
                                  │
                    cron (daily) │  POST /api/sites/:id/check (manual)
                                  ▼
                          lib/check.js (Playwright)
                                  │  visits <page>?u1qa=1, reads console
                                  ▼
                     u1-runtime.js's QA validation mode
                     (lives in the WordPress plugin itself)
                                  │
                     U1-VALIDATION-ERROR lines, if any
                                  ▼
                          lib/mailer.js → email (or data/reports/*.txt)
```

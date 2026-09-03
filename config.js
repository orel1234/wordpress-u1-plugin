// Build-time configuration. scripts/build.mjs rewrites SERVER_URL when packaging
// (--server=https://… or --dev), so the address is never hardcoded into
// application code for a real build.
//
// The checked-in default below is the REAL production target, not localhost —
// on purpose. This file is what an accidental "Load unpacked" straight from
// the repo root runs with (see CLAUDE.md's "editing source is not editing the
// extension"), and manifest.json's checked-in connect-src only allows this
// one production host plus api.anthropic.com — no wildcard, no localhost —
// for the same reason (a shared PaaS wildcard let anyone's *.up.railway.app
// receive login credentials the panel had no reason to distrust). The two
// must always name the same host, or Chrome silently blocks every request;
// verify.mjs checks that they do. Local development against localhost is
// `node scripts/build.mjs --dev`, never the source tree's own default.
const U1_CONFIG = {
  SERVER_URL: 'https://user1stproject-production.up.railway.app',

  // How long the tool keeps working without being able to reach the server.
  // An accessibility worker on bad client wifi must not be stopped mid-session;
  // they re-verify whenever the network comes back.
  GRACE_PERIOD_DAYS: 7,
};

// Build-time configuration. scripts/build.mjs rewrites SERVER_URL when packaging
// (--server=https://…), so the address is never hardcoded into application code
// and a dev build can't accidentally ship pointing at localhost.
//
// Whatever value ends up here must ALSO be listed in manifest.json's
// connect-src, or every request dies at the content-security policy.
const U1_CONFIG = {
  SERVER_URL: 'http://localhost:3001',

  // How long the tool keeps working without being able to reach the server.
  // An accessibility worker on bad client wifi must not be stopped mid-session;
  // they re-verify whenever the network comes back.
  GRACE_PERIOD_DAYS: 7,
};

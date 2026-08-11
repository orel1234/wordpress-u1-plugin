// Licensing client for U1 Studio.
//
// Talks to the portal's /api/studio/* endpoints (backend: user1st_project,
// src/modules/studio) to answer two questions: who is this worker, and are they
// allowed to work on this site?
//
// Three rules govern everything here, and they're the reason for the complexity:
//
//   1. No internet must never stop the work. If the server is unreachable but
//      we verified this site recently, the tool keeps going (GRACE_PERIOD_DAYS).
//   2. An expired licence is read-only, not a lockout. The worker keeps every
//      mapping, report and export; they just can't create new work.
//   3. Nothing here ever deletes local work. Not on logout, not on revoke.
//      Mappings live in chrome.storage.local and stay there.

const U1Auth = (() => {
  // The leading "__" matters: sanitizeImport() in panel.js rejects keys starting
  // with "__", so tokens can never travel inside an exported backup file.
  const AUTH_KEY = '__studioAuth';
  const CACHE_KEY = '__studioSiteCache';

  // Well under the server's idle window, so an active session is renewed several
  // times before it could lapse.
  const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

  let accessToken = null;      // memory only — never persisted
  let refreshPromise = null;   // de-dupes concurrent refreshes

  const api = (path) => `${U1_CONFIG.SERVER_URL}/api/studio${path}`;

  async function readAuth() {
    const stored = await U1Store.get(AUTH_KEY);
    return stored[AUTH_KEY] || null;
  }

  async function writeAuth(auth) {
    await U1Store.set({ [AUTH_KEY]: auth });
  }

  /** Signing out clears credentials only. Mappings are the worker's, not ours. */
  async function clearAuth() {
    accessToken = null;
    refreshPromise = null;
    await U1Store.remove(AUTH_KEY);
  }

  // --- Site verification cache -------------------------------------------
  // What makes rule 1 possible: the last known answer per hostname, with the
  // time we learned it. Consulted only when the server can't be reached.

  async function readCache() {
    const stored = await U1Store.get(CACHE_KEY);
    return stored[CACHE_KEY] || {};
  }

  async function cacheSiteResult(hostname, result) {
    const cache = await readCache();
    cache[hostname] = { ...result, verifiedAt: Date.now() };
    await U1Store.set({ [CACHE_KEY]: cache });
  }

  function withinGracePeriod(entry) {
    if (!entry || !entry.verifiedAt) return false;
    const ageDays = (Date.now() - entry.verifiedAt) / 86400000;
    return ageDays <= U1_CONFIG.GRACE_PERIOD_DAYS;
  }

  // --- Requests -----------------------------------------------------------

  /**
   * Distinguishes "the server said no" from "we couldn't ask". Callers must
   * treat those differently — the first is an answer, the second is grounds for
   * the grace period.
   */
  async function request(path, options = {}, retryOn401 = true) {
    let res;
    try {
      res = await fetch(api(path), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(options.headers || {}),
        },
      });
    } catch (e) {
      const err = new Error('offline');
      err.offline = true;
      throw err;
    }

    if (res.status === 401 && retryOn401) {
      const refreshed = await refresh();
      if (refreshed) return request(path, options, false);
    }

    // Not every studio endpoint answers in JSON — a screenful's thumbnail comes
    // back as image bytes. Parsing that as JSON returns {} and the caller sees
    // "no picture" for a request that succeeded, so the response type is the
    // caller's to state.
    if (options.asDataUrl) {
      if (!res.ok) {
        const err = new Error(`http_${res.status}`);
        err.status = res.status;
        throw err;
      }
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(blob);
      });
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || `http_${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  /** Swaps the stored refresh token for a new access token. */
  async function refresh() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      const auth = await readAuth();
      if (!auth?.refreshToken) return false;

      try {
        const res = await fetch(api('/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });
        if (!res.ok) {
          // A refused refresh is a real answer: revoked, suspended or expired.
          // Anything else (network failure) throws above and leaves auth alone.
          if (res.status === 401) await clearAuth();
          return false;
        }
        const body = await res.json();
        accessToken = body.accessToken;
        await writeAuth({ ...auth, client: body.client || auth.client });
        return true;
      } catch {
        return false; // offline — keep the stored refresh token for later
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  // --- Public API ---------------------------------------------------------

  async function login(email, password) {
    let res;
    try {
      res = await fetch(api('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (e) {
      // Name the server, and say what actually failed. "Check your connection"
      // sent people to look at their wi-fi when the answer was almost always
      // that this build points somewhere other than they think: an unpacked
      // load of the repo root still says localhost, and now that the extension
      // id is pinned it is indistinguishable from the packaged build in
      // chrome://extensions.
      throw new Error(
        `Could not reach the licence server at ${U1_CONFIG.SERVER_URL} — ${e?.message || 'network error'}. ` +
        `If that is not the address you expect, this copy was built for a different server.`,
      );
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (body.error === 'too_many_attempts') throw new Error('Too many attempts. Wait 15 minutes and try again.');
      throw new Error('Wrong email or password.');
    }

    accessToken = body.accessToken;
    await writeAuth({ refreshToken: body.refreshToken, client: body.client });
    return body.client;
  }

  async function logout() {
    await clearAuth();
  }

  async function getStoredClient() {
    return (await readAuth())?.client || null;
  }

  async function isLoggedIn() {
    return Boolean((await readAuth())?.refreshToken);
  }

  /**
   * The question the product is built on: may this worker work on this host?
   *
   * Returns { allowed, accessLevel, stale, reason }:
   *   allowed    — is the tool usable here at all
   *   accessLevel— 'full' or 'readonly' (an expired licence, not a lockout)
   *   stale      — answered from cache because the server was unreachable
   */
  async function checkSiteAccess(hostname) {
    if (!hostname || hostname === 'unknown') {
      return { allowed: false, reason: 'no_site', accessLevel: 'readonly', stale: false };
    }

    if (!accessToken && !(await refresh())) {
      if (!(await isLoggedIn())) {
        return { allowed: false, reason: 'not_logged_in', accessLevel: 'readonly', stale: false };
      }
      // Logged in but couldn't refresh — could be offline, could be revoked.
      // Fall through to the request so the two cases separate themselves.
    }

    try {
      const body = await request(`/sites/${encodeURIComponent(hostname)}`);
      const result = { allowed: true, accessLevel: body.accessLevel || 'full', label: body.label };
      await cacheSiteResult(hostname, result);
      return { ...result, stale: false };
    } catch (e) {
      if (e.offline) {
        // Rule 1: the server is unreachable, so the last answer stands for a
        // while. Deliberately only extends a previous YES — never invents one.
        const entry = (await readCache())[hostname];
        if (entry?.allowed && withinGracePeriod(entry)) {
          return { ...entry, stale: true };
        }
        return { allowed: false, reason: 'offline', accessLevel: 'readonly', stale: true };
      }
      if (e.status === 403) {
        await cacheSiteResult(hostname, { allowed: false, reason: 'not_assigned' });
        return { allowed: false, reason: 'not_assigned', accessLevel: 'readonly', stale: false };
      }
      if (e.status === 401) {
        return { allowed: false, reason: 'not_logged_in', accessLevel: 'readonly', stale: false };
      }
      return { allowed: false, reason: 'error', message: e.message, accessLevel: 'readonly', stale: false };
    }
  }

  // --- Keeping an in-use session alive -------------------------------------

  let lastTouch = 0;

  /**
   * Tells the server the worker is still here.
   *
   * The session closes after a period of inactivity, but the server only sees
   * activity when the extension happens to call it — and someone mapping fixes
   * on a single page for half an hour makes no calls at all. Without this they
   * would be signed out mid-job, which is not inactivity by any useful
   * definition. Driven by real interaction with the panel, and throttled hard so
   * it costs one request every few minutes rather than one per click.
   */
  async function touch() {
    if (Date.now() - lastTouch < TOUCH_INTERVAL_MS) return;
    if (!(await isLoggedIn())) return;
    lastTouch = Date.now();
    await refresh();
  }

  async function requestAccess(hostname, note) {
    return request('/access-requests', {
      method: 'POST',
      body: JSON.stringify({ hostname, note: note || undefined }),
    });
  }

  // `request` is exported so the sync layer speaks to the server through the
  // SAME path as everything else: one place that attaches the bearer token, one
  // place that refreshes it on a 401, one definition of what "offline" means.
  // A second fetch helper would be a second thing to get those wrong in.
  return { login, logout, isLoggedIn, getStoredClient, checkSiteAccess, requestAccess, touch, request };
})();

// The single place the extension talks to storage.
//
// Every read and write of a worker's saved data goes through here — the panel,
// the service worker and the report generator alike. Before this module those
// calls were scattered across three files, which meant there was nowhere to put
// a decision that had to apply to all of them.
//
// Two constraints shaped it:
//
//   1. It must load in both worlds. background.js is an MV3 service worker with
//      no DOM and no <script> tags, so this is a classic script that attaches a
//      global — the panel loads it with <script src>, the worker with
//      importScripts(). An ES module would have worked in only one of them.
//
//   2. The surface mirrors chrome.storage.local exactly — same method names,
//      same argument shapes, same return shapes. That is what made replacing 42
//      call sites a rename rather than a rewrite, and it keeps every stored key
//      name identical, so a backup taken before this change still imports after.

(function (root) {
  'use strict';

  // Keys that belong to one site, namespaced as `<prefix>_<hostname>`. This is
  // the set that will eventually be served from the licence server; everything
  // else stays local forever.
  // 'dismissed' holds selectors the specialist skipped in a scan, so scanning
  // the same page again — which is the normal way to reach things that only
  // exist while open — does not put them straight back on the list.
  const SITE_PREFIXES = ['mappings', 'config', 'skipLinks', 'autoApply', 'platform', 'manualInject', 'u1Links', 'dismissed'];

  // Session and scratch data. The "__" prefix is load-bearing: sanitizeImport()
  // rejects it and the backup export strips it, so a credential can never ride
  // inside a backup file. Anything private MUST keep the prefix.
  const PRIVATE_PREFIX = '__';

  /** `mappings_example.com` → `{ prefix: 'mappings', hostname: 'example.com' }` */
  function parseKey(key) {
    if (typeof key !== 'string') return null;
    const i = key.indexOf('_');
    if (i < 1) return null;
    const prefix = key.slice(0, i);
    if (!SITE_PREFIXES.includes(prefix)) return null;
    const hostname = key.slice(i + 1);
    return hostname ? { prefix, hostname } : null;
  }

  const isPrivate = (key) => typeof key === 'string' && key.startsWith(PRIVATE_PREFIX);

  const U1Store = {
    SITE_PREFIXES,
    PRIVATE_PREFIX,
    parseKey,
    isPrivate,

    /** @param keys string | string[] | object | null — exactly as chrome.storage.local.get */
    get(keys) {
      return chrome.storage.local.get(keys);
    },

    /**
     * Write, and make a failure impossible to miss.
     *
     * chrome.storage.local rejects when the quota is exhausted, and every
     * mapping carries a screenshot as a data URL — so this is reachable, not
     * theoretical. The rejection used to travel up as an unhandled error: the
     * save silently did nothing and the work looked like it had vanished.
     */
    /**
     * Called after every successful local write, with the site-scoped keys that
     * changed. Registered by panel.js, which owns what a mapping's key is.
     *
     * A hook rather than a call inside each of the fifteen places that save
     * something: the whole point of putting sync here is that it cannot be
     * forgotten at a call site, and a second choke point would be a second
     * thing to forget. store.js still knows nothing about mappings.
     */
    onSiteWrite: null,

    /**
     * Write WITHOUT telling the server.
     *
     * Exactly one caller should ever want this: the code that has just read
     * from the server and is putting the answer into the local cache. Going
     * through set() there would fire onSiteWrite and push what was just pulled
     * straight back — stamping this machine's name on a colleague's work and
     * racing anything they saved in between.
     *
     * A named method rather than a raw chrome.storage call at the call site, so
     * the exception is visible, greppable, and explained where it lives.
     */
    setLocalOnly(items) {
      return chrome.storage.local.set(items);
    },

    async set(items) {
      let res;
      try {
        res = await chrome.storage.local.set(items);
      } catch (e) {
        const msg = String((e && e.message) || e);
        if (/quota|QUOTA_BYTES/i.test(msg)) {
          const used = await this.bytesInUse().catch(() => 0);
          throw new Error(
            `Storage is full (${(used / 1e6).toFixed(1)} MB used) — nothing was saved. ` +
            `Delete mappings you no longer need, or export a backup and clear old sites.`);
        }
        throw new Error('Could not save to local storage: ' + msg);
      }

      // The local write has happened. Anything that fails from here is the
      // SERVER refusing, which is a different fact and used to be reported as
      // the same one: "Could not save it: Could not save to local storage:
      // http_413" on a mapping that was sitting safely in chrome.storage.
      try {
        if (this.onSiteWrite) {
          const siteKeys = Object.keys(items).filter((k) => parseKey(k));
          // Awaited, not fired and forgotten. The server is the truth for
          // SHARED work, so the caller is told when it did not get there.
          if (siteKeys.length) await this.onSiteWrite(siteKeys, items);
        }
        return res;
      } catch (e) {
        const msg = String((e && e.message) || e);
        // What actually happens, not a promise of a retry there isn't one of.
        // Nothing here queues, backs off or tries again on a timer: the only
        // thing that pushes is the next write. That write sends the WHOLE list
        // — a row that stops being mentioned is how a deletion is expressed —
        // so the next mapping you save carries this one up with it. Saying "it
        // will sync" implied a background retry and there is none.
        const err = new Error(
          `Saved on this computer, but not shared with the team: ${msg}. ` +
          `It works here and it exports. Nothing retries on its own — the next ` +
          `mapping you save sends the whole list again and takes this one with it.`);
        // So a caller can tell "this did not happen" from "this happened and
        // has not travelled yet", and not count the second as a failure.
        err.localOnly = true;
        throw err;
      }
    },

    /** Bytes currently held, for showing how close to the limit we are. */
    bytesInUse(keys) {
      return chrome.storage.local.getBytesInUse(keys ?? null);
    },

    remove(keys) {
      return chrome.storage.local.remove(keys);
    },

    /**
     * Everything that belongs in a backup: all stored data minus private keys.
     *
     * Built here rather than at the call site because "which keys are safe to
     * hand out" is a property of the store, and getting it wrong once already
     * put a refresh token into an exported file.
     */
    async getExportable() {
      const all = await chrome.storage.local.get(null);
      for (const key of Object.keys(all)) {
        if (isPrivate(key)) delete all[key];
      }
      return all;
    },

    /** Hostnames that have any saved work, newest-agnostic, sorted. */
    async listSites() {
      const all = await chrome.storage.local.get(null);
      const hosts = new Set();
      for (const key of Object.keys(all)) {
        const parsed = parseKey(key);
        if (parsed) hosts.add(parsed.hostname);
      }
      return [...hosts].sort();
    },
  };

  root.U1Store = U1Store;
})(typeof self !== 'undefined' ? self : this);

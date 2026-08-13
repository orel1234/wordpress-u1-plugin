// Shared work: the site's mappings, settings and scans live on the server.
//
// Until this file existed, every mapping sat in one browser's
// chrome.storage.local. A colleague opening the same client saw an empty panel
// and a reinstalled laptop lost the lot — while the module README had described
// site-owned mappings as though it were already true.
//
// ── The one rule that shapes everything here ────────────────────────────────
//
// THE SERVER IS THE TRUTH. Local storage is a cache of it, nothing more.
//
// That was a decision, not an accident. The alternative — letting the panel
// work offline and reconciling later — means an edit queue, a merge on
// reconnect, and a class of bug where two people's afternoons interleave into
// something neither of them wrote. The tool already refuses to run on an
// unassigned site; refusing to run with no connection is the same shape of
// answer, and it keeps "what will my colleague see" answerable at all times.
//
// So: no write is considered done until the server has it, and a failed write
// is reported rather than swallowed. What is cached locally exists to make the
// panel open fast and to survive a reload — never to be authoritative.
//
// ── What merging means here ─────────────────────────────────────────────────
//
// Mappings merge PER MAPPING, because two workers on one site is the whole
// point of the assignment model. Each carries the `updatedAt` the client
// believed the server held; if the row moved on in between, the server refuses
// that row and says whose it now is. Every other row still lands. A conflict is
// reported to the person who caused it — never resolved silently, in either
// direction.

const U1Sync = (() => {
  const path = (hostname, tail) =>
    `/sites/${encodeURIComponent(hostname)}${tail || ''}`;

  /**
   * The server's `updatedAt` per mapping key, as of the last read.
   *
   * This is what makes a conflict detectable. Without it every save would claim
   * to be based on nothing, and the server would have to accept it — which is
   * last-write-wins wearing a merge's clothes.
   */
  let baseVersions = new Map();

  /** Cleared whenever the panel changes site, so one site's versions cannot vouch for another's. */
  function forget() {
    baseVersions = new Map();
  }

  /**
   * Everything for a site, in one round trip.
   *
   * Throws with `.offline = true` when the server could not be reached at all —
   * the caller must show that rather than fall through to a cache, because a
   * cache shown silently is indistinguishable from live data and that is
   * exactly the confusion this design exists to avoid.
   */
  async function pull(hostname) {
    const data = await U1Auth.request(path(hostname, '/data'), { method: 'GET' });
    baseVersions = new Map();
    for (const m of data.mappings || []) baseVersions.set(m.key, m.updatedAt);

    // Tombstones are the server saying "a colleague deleted this", which is not
    // the same as the row being absent. They are filtered out here — the panel
    // wants the live list — but only AFTER their versions were recorded above,
    // or re-saving a deleted mapping would look like a first write and quietly
    // resurrect it.
    const mappings = (data.mappings || [])
      .filter((m) => !m.deletedAt)
      .map((m) => m.payload);

    // Has the server ever held anything for this site at all?
    //
    // This is NOT the same question as "does it hold anything now", and the
    // difference is somebody's work. Zero live mappings can mean two opposite
    // things: nobody has ever synced this site, or a colleague deliberately
    // deleted everything on it. Tombstones and stored settings are what tell
    // them apart — the second case leaves traces, the first leaves none.
    const virgin =
      (data.mappings || []).length === 0 &&
      !data.settings &&
      !data.sweep;

    return {
      mappings,
      settings: data.settings || null,
      sweep: data.sweep || null,
      deleted: (data.mappings || []).filter((m) => m.deletedAt).map((m) => m.key),
      virgin,
    };
  }

  /**
   * Save mappings. Returns `{ saved, conflicts }` — conflicts are rows a
   * colleague changed since this panel last read them, and they are NOT saved.
   *
   * @param {Array<{key: string, payload: object, deleted?: boolean}>} rows
   */
  /**
   * Every mapping the site has, in batches the server will accept.
   *
   * This sends the WHOLE list on every save — it has to, because a row that
   * merely stops being mentioned is how a deletion is expressed. On a site with
   * a few dozen mappings, each carrying its generated code, the body outgrew
   * the server's limit and came back 413. One save failing that way took the
   * whole build down with "Could not save it: http_413" on a mapping that had
   * in fact been written locally a moment before.
   *
   * Batched by measured JSON size rather than by count: mappings differ by an
   * order of magnitude in length, so "twenty at a time" is either wasteful or
   * still too big depending on the site.
   */
  const PUSH_BYTES = 400 * 1024;   // comfortably inside a 1MB body limit

  async function pushMappings(hostname, rows) {
    if (!rows.length) return { saved: 0, conflicts: [] };
    const all = rows.map((r) => ({
      key: r.key,
      payload: r.payload,
      deleted: !!r.deleted,
      baseUpdatedAt: baseVersions.get(r.key) || null,
    }));

    const batches = [];
    let cur = [], size = 0;
    for (const m of all) {
      const n = JSON.stringify(m).length + 1;
      // A single mapping bigger than the budget still goes, alone — refusing it
      // here would lose it silently, and the server is entitled to say no.
      if (cur.length && size + n > PUSH_BYTES) { batches.push(cur); cur = []; size = 0; }
      cur.push(m); size += n;
    }
    if (cur.length) batches.push(cur);

    const merged = { saved: 0, conflicts: [], keys: [] };
    for (const batch of batches) {
      const out = await U1Auth.request(path(hostname, '/mappings'), {
        method: 'PUT',
        body: JSON.stringify({ mappings: batch }),
      });
      merged.saved += out.saved || 0;
      if (out.conflicts) merged.conflicts.push(...out.conflicts);
      if (out.keys) merged.keys.push(...out.keys);
    }
    // Anything that landed is now based on what we just wrote. Leaving the old
    // version in place would make the NEXT save of the same mapping look stale
    // and conflict with this panel's own work.
    if (merged.keys.length) {
      const stamp = new Date().toISOString();
      for (const k of merged.keys) baseVersions.set(k, stamp);
    }
    return merged;
  }

  /** Config / skip links / library URLs. Only the fields passed are touched. */
  async function pushSettings(hostname, fields) {
    return U1Auth.request(path(hostname, '/settings'), {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
  }

  /**
   * The survey, replaced whole — and its pictures, one request each.
   *
   * The pictures go separately because a 28-screen sweep is roughly a megabyte
   * of JPEG: one request carrying all of it is a request that times out on a
   * slow connection and loses the whole survey with it. Sent one at a time, a
   * failure costs one thumbnail and the survey itself still lands.
   *
   * The stops are stripped of their `thumb` before being sent, so the document
   * stays small and well clear of Mongo's 16MB ceiling.
   */
  async function pushSweep(hostname, sweep, onProgress) {
    const stops = (sweep.stops || []).map((s) => {
      const copy = { ...s };
      delete copy.thumb;
      return copy;
    });
    await U1Auth.request(path(hostname, '/sweep'), {
      method: 'PUT',
      body: JSON.stringify({
        url: sweep.url || '',
        phase: sweep.phase || 'screens',
        cost: sweep.cost || 0,
        stops,
      }),
    });

    const withShots = (sweep.stops || []).filter((s) => s.thumb);
    let done = 0;
    for (const s of withShots) {
      try {
        await U1Auth.request(path(hostname, `/sweep/${s.n}/thumb`), {
          method: 'PUT',
          body: JSON.stringify({ dataUrl: s.thumb }),
        });
      } catch (err) {
        // One picture is worth far less than the survey it belongs to. Report
        // it and carry on rather than failing the whole upload for a thumbnail.
        console.warn(`[u1] screen ${s.n} thumbnail not uploaded: ${err.message}`);
      }
      if (onProgress) onProgress(++done, withShots.length);
    }
  }

  /**
   * One screenful's picture. Returns a data URL, or null.
   *
   * Fetched on demand rather than with the survey: opening the panel on a large
   * site should not pull a megabyte of images nobody has asked to look at.
   */
  async function fetchThumb(hostname, n) {
    try {
      return await U1Auth.request(path(hostname, `/sweep/${n}/thumb`),
        { method: 'GET', asDataUrl: true });
    } catch {
      return null;   // a missing picture must never break the list it sits in
    }
  }

  async function deleteSweep(hostname) {
    return U1Auth.request(path(hostname, '/sweep'), { method: 'DELETE' });
  }

  return { pull, pushMappings, pushSettings, pushSweep, fetchThumb, deleteSweep, forget };
})();

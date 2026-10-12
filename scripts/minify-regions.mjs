// Minifies the code a customer's page actually loads, one region at a time.
//
// u1-patch.js, grid-nav.js and urs-compat.js are each a set of independent
// regions (`//#region <prefix>:<name>` … `//#endregion`), and the export ships
// only the regions a site's mappings use. So each region is minified on its
// own and the build writes a JSON of them; the panel slices that exactly the
// way it slices the source. The shipped file used to be the source with its
// comments stripped — readable, and two to three times the size.
//
// Deliberately conservative, because a region is a fragment of a larger
// script, not a program:
//   - toplevel: false   names declared at a region's top level are shared with
//                       other regions (core defines what the rest call), so
//                       they are never renamed or dropped;
//   - no property mangling, no unsafe transforms.
// Function and class names are NOT kept: nothing in these files reads a
// function's .name (checked 2026-10-11 — grep before relying on one), and
// keeping them left every `var helper = function` unmangled.
// Only local variables get short names and whitespace and comments go.
// A region that fails to minify is left out of the JSON, and the panel falls
// back to its comment-stripped source for that region alone.
import { minify } from 'terser';

const OPTIONS = {
  ecma: 2020,
  module: false,
  toplevel: false,
  compress: {
    toplevel: false,
    keep_fargs: true,
    passes: 3,
    unsafe: false,
    hoist_funs: false,
    hoist_vars: false,
  },
  mangle: { toplevel: false },
  format: { comments: false, ascii_only: false },
};

export function regionsOf(src, prefix) {
  const re = new RegExp(`//#region ${prefix}:([a-z-]+)\\r?\\n([\\s\\S]*?)\\r?\\n//#endregion`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push({ name: m[1], code: m[2] });
  return out;
}

/**
 * { regions: { name: minifiedCode }, failed: [name], bytes: { name: [before, after] } }
 * `keep` names regions to ship untouched (an already-minified vendor library).
 */
export async function minifyRegions(src, prefix, { keep = [] } = {}) {
  const regions = {};
  const failed = [];
  const bytes = {};
  for (const { name, code } of regionsOf(src, prefix)) {
    if (keep.includes(name)) { regions[name] = code; bytes[name] = [code.length, code.length]; continue; }
    try {
      const r = await minify(code, OPTIONS);
      // A region of comments only (a placeholder) minifies to nothing — that is
      // its correct shipped form, not a failure.
      if (typeof r.code !== 'string') throw new Error('no output');
      regions[name] = r.code;
      bytes[name] = [code.length, r.code.length];
    } catch (e) {
      failed.push(`${name}: ${e.message}`);
    }
  }
  return { regions, failed, bytes };
}

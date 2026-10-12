// Runs the panel's REAL export builder (buildDeployableCode) in Node.
//
// panel.js cannot be imported — its top level wires up the side panel's DOM.
// So it is parsed with acorn and only its declarations are evaluated: every
// top-level function, and every top-level const/let/var whose initialiser runs
// without a browser (the rest are skipped). Event-listener statements and
// other top-level code never run. The few platform calls the export path
// makes — fetching the shipped engine files — are answered from the repo, or
// from dist/ when `fromDir` points there (the minified regions the build
// writes).
//
//   import { loadExportBuilder } from './export-harness.mjs';
//   const { buildDeployableCode } = loadExportBuilder();
//   const built = await buildDeployableCode(mappings, 'example.com');
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadAcorn() {
  const m = { exports: {} };
  new Function('module', 'exports', 'define', readFileSync(join(ROOT, 'vendor/acorn.js'), 'utf8'))(m, m.exports, undefined);
  return m.exports;
}

export function loadExportBuilder({ fromDir = ROOT, panelPath = join(ROOT, 'panel.js') } = {}) {
  const acorn = loadAcorn();
  const src = readFileSync(panelPath, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true });

  const fileFor = (url) => {
    const name = String(url).replace(/^chrome-extension:\/\/[^/]+\//, '');
    const inDir = join(fromDir, name);
    return existsSync(inDir) ? inDir : join(ROOT, name);
  };
  const sandbox = {
    console,
    URL, URLSearchParams, TextEncoder, TextDecoder, setTimeout, clearTimeout,
    chrome: { runtime: { getURL: (p) => `chrome-extension://harness/${p}` } },
    fetch: async (url) => {
      const path = fileFor(url);
      if (!existsSync(path)) return { ok: false, status: 404, text: async () => '', json: async () => null };
      const body = readFileSync(path, 'utf8');
      return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  const skipped = [];
  for (const node of ast.body) {
    const code = src.slice(node.start, node.end);
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
      vm.runInContext(code, ctx);
    } else if (node.type === 'VariableDeclaration') {
      try { vm.runInContext(code, ctx); } catch (e) { skipped.push(code.slice(0, 60)); }
    }
  }
  const get = (name) => vm.runInContext(`typeof ${name} === 'undefined' ? undefined : ${name}`, ctx);
  return { buildDeployableCode: get('buildDeployableCode'), get, skipped, ctx };
}

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'sites.json');

// Single-process JSON file store. Writes are serialized through this queue so
// concurrent API calls can't interleave and corrupt the file — fine for the
// scale this tool is built for (tens of monitored sites, not a real DB).
let writeQueue = Promise.resolve();

async function ensureDb() {
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
    if (!existsSync(DB_FILE)) await writeFile(DB_FILE, JSON.stringify({ sites: [] }, null, 2));
}

async function readDb() {
    await ensureDb();
    const raw = await readFile(DB_FILE, 'utf8');
    try { return JSON.parse(raw); } catch (e) { return { sites: [] }; }
}

async function writeDb(data) {
    await writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

function withWrite(fn) {
    writeQueue = writeQueue.then(async () => {
        const data = await readDb();
        const result = await fn(data);
        await writeDb(data);
        return result;
    });
    return writeQueue;
}

export async function listSites() {
    return (await readDb()).sites;
}

export async function getSite(id) {
    const db = await readDb();
    return db.sites.find((s) => s.id === id) || null;
}

export async function addSite({ label, pages }) {
    return withWrite((db) => {
        const site = {
            id: crypto.randomUUID(),
            label: label.trim(),
            pages: pages.map((p) => p.trim()).filter(Boolean),
            createdAt: new Date().toISOString(),
            lastCheck: null
        };
        db.sites.push(site);
        return site;
    });
}

export async function updateSite(id, { label, pages }) {
    return withWrite((db) => {
        const site = db.sites.find((s) => s.id === id);
        if (!site) return null;
        if (label !== undefined) site.label = label.trim();
        if (pages !== undefined) site.pages = pages.map((p) => p.trim()).filter(Boolean);
        return site;
    });
}

export async function deleteSite(id) {
    return withWrite((db) => {
        const idx = db.sites.findIndex((s) => s.id === id);
        if (idx === -1) return false;
        db.sites.splice(idx, 1);
        return true;
    });
}

export async function recordCheckResult(id, result) {
    return withWrite((db) => {
        const site = db.sites.find((s) => s.id === id);
        if (!site) return null;
        site.lastCheck = result;
        return site;
    });
}

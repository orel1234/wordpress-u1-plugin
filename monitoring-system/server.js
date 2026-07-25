import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './lib/db.js';
import { checkSite } from './lib/check.js';
import { sendFailureReport } from './lib/mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/sites', async (req, res) => {
    res.json(await db.listSites());
});

app.post('/api/sites', async (req, res) => {
    const { label, pages } = req.body || {};
    if (!label || !Array.isArray(pages) || !pages.length) {
        return res.status(400).json({ error: 'label and a non-empty pages[] array are required' });
    }
    res.status(201).json(await db.addSite({ label, pages }));
});

app.put('/api/sites/:id', async (req, res) => {
    const site = await db.updateSite(req.params.id, req.body || {});
    if (!site) return res.status(404).json({ error: 'not found' });
    res.json(site);
});

app.delete('/api/sites/:id', async (req, res) => {
    const ok = await db.deleteSite(req.params.id);
    if (!ok) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
});

async function runCheckForSite(id) {
    const site = await db.getSite(id);
    if (!site) throw new Error('site not found');
    const result = await checkSite(site);
    await db.recordCheckResult(id, result);
    if (result.status === 'fail') {
        await sendFailureReport(site, result).catch((err) => console.error('[mailer] failed:', err));
    }
    return result;
}

app.post('/api/sites/:id/check', async (req, res) => {
    try {
        res.json(await runCheckForSite(req.params.id));
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

app.post('/api/check-all', async (req, res) => {
    const sites = await db.listSites();
    const results = [];
    for (const site of sites) {
        try {
            results.push({ id: site.id, result: await runCheckForSite(site.id) });
        } catch (e) {
            results.push({ id: site.id, error: String(e.message || e) });
        }
    }
    res.json(results);
});

const CRON_EXPR = process.env.CHECK_CRON || '0 6 * * *';
cron.schedule(CRON_EXPR, async () => {
    console.log(`[cron] running daily check (${CRON_EXPR})`);
    const sites = await db.listSites();
    for (const site of sites) {
        try {
            await runCheckForSite(site.id);
        } catch (e) {
            console.error(`[cron] check failed for ${site.label}:`, e);
        }
    }
});

const PORT = process.env.PORT || 3300;
app.listen(PORT, () => {
    console.log(`U1 monitoring dashboard running at http://localhost:${PORT}`);
    console.log(`Daily check scheduled: ${CRON_EXPR}`);
});

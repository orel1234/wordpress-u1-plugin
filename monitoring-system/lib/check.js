import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const ERROR_PREFIX = 'U1-VALIDATION-ERROR';

// Appends ?u1qa=1 (see u1-runtime.js) so the plugin's frontend logs one
// U1-VALIDATION-ERROR console line per mapping whose selector doesn't
// resolve on that page. Preserves any existing query string.
function withQaFlag(url) {
    const u = new URL(url);
    u.searchParams.set('u1qa', '1');
    return u.toString();
}

// Playwright's bundled-revision auto-download is disabled in some hosting/dev
// setups in favor of a pre-installed Chromium at a fixed path. Use it when
// present; otherwise fall back to Playwright's own managed browser.
const PREINSTALLED_CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

async function launchChromium() {
    if (existsSync(PREINSTALLED_CHROMIUM)) {
        return chromium.launch({ executablePath: PREINSTALLED_CHROMIUM });
    }
    return chromium.launch();
}

export async function checkSite(site) {
    const errors = [];
    const browser = await launchChromium();
    try {
        const context = await browser.newContext();
        for (const pageUrl of site.pages) {
            const page = await context.newPage();
            const pageErrors = [];
            page.on('console', (msg) => {
                const text = msg.text();
                if (text.startsWith(ERROR_PREFIX)) pageErrors.push(text);
            });
            try {
                await page.goto(withQaFlag(pageUrl), { waitUntil: 'networkidle', timeout: 30000 });
                // Give the runtime's DOMContentLoaded-triggered validation a beat to run.
                await page.waitForTimeout(500);
            } catch (e) {
                pageErrors.push(
                    `${ERROR_PREFIX} | domain=(unreachable) | type=navigation | index=0 | field=url | selector=${pageUrl} | page=${pageUrl} | note=${String(e.message || e).slice(0, 200)}`
                );
            } finally {
                errors.push(...pageErrors);
                await page.close();
            }
        }
        await context.close();
    } finally {
        await browser.close();
    }
    return {
        at: new Date().toISOString(),
        status: errors.length ? 'fail' : 'pass',
        errors
    };
}

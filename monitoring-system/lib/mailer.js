import nodemailer from 'nodemailer';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_DIR = path.join(__dirname, '..', 'data', 'reports');

function isConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_TO);
}

let transporter = null;
function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
    }
    return transporter;
}

// Sends a report only for a failing check (by design — no email on a clean
// run, to avoid alert fatigue). If SMTP isn't configured yet, writes the
// report to disk instead of throwing, so the dashboard/cron keep working.
export async function sendFailureReport(site, result) {
    const subject = `U1 Accessibility Monitor: ${site.label} — ${result.errors.length} broken mapping(s)`;
    const body = [
        `Site: ${site.label}`,
        `Checked: ${result.at}`,
        `Pages: ${site.pages.join(', ')}`,
        '',
        'Errors:',
        ...result.errors
    ].join('\n');

    if (!isConfigured()) {
        if (!existsSync(FALLBACK_DIR)) await mkdir(FALLBACK_DIR, { recursive: true });
        const file = path.join(FALLBACK_DIR, `${site.id}-${Date.now()}.txt`);
        await writeFile(file, `Subject: ${subject}\n\n${body}`);
        console.warn(`[mailer] SMTP not configured — wrote report to ${file} instead of emailing.`);
        return { sent: false, fallbackFile: file };
    }

    await getTransporter().sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: process.env.MAIL_TO,
        subject,
        text: body
    });
    return { sent: true };
}

/**
 * emailProvider.js — Phase 1A. Provider-agnostic email sending.
 *
 * Why a provider abstraction:
 *   - Dev: nodemailer with a local SMTP (or just log to stdout).
 *   - Prod: Resend (the recommended transactional email service).
 *
 * The provider is chosen at boot from env:
 *   - EMAIL_PROVIDER=resend  +  RESEND_API_KEY=re_xxx  → use Resend
 *   - anything else          → fall back to nodemailer
 *
 * If neither is configured, the helper logs to stdout and resolves
 * with `{ ok: true, dev: true }` — this preserves the dev experience
 * of "send a vendor-approval email" without requiring a real SMTP
 * server. Routes that need real email can check `isConfigured()` and
 * 503 if not.
 *
 * This file replaces the old `sendEmail.js` contract. The old file
 * stays as a thin re-export so existing imports keep working.
 */

const nodemailer = require('nodemailer');

const FROM = process.env.EMAIL_FROM || 'DRYP <no-reply@dryp.store>';

let _resendModule = null;
function getResend() {
  if (_resendModule) return _resendModule;
  // Lazy require so the module is optional at install time.
  try {
    _resendModule = require('resend');
    return _resendModule;
  } catch (e) {
    return null;
  }
}

function nodemailerTransport() {
  if (process.env.SMTP_URL) {
    return nodemailer.createTransport(process.env.SMTP_URL);
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

function isConfigured() {
  if (process.env.EMAIL_PROVIDER === 'resend' && process.env.RESEND_API_KEY) return true;
  if (process.env.SMTP_HOST || process.env.SMTP_URL) return true;
  return false;
}

/**
 * Send an email.
 *   to, subject, text, html? — same shape as nodemailer
 *
 * Returns:
 *   { ok: true, provider, id? }
 *   { ok: false, provider, error }
 *
 * In dev (no provider configured), logs to stdout and returns
 * { ok: true, provider: 'console', dev: true }. Routes that need
 * real delivery should call `isConfigured()` first.
 */
async function sendEmail({ to, subject, text, html }) {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  if (provider === 'resend') {
    if (!process.env.RESEND_API_KEY) {
      return { ok: false, provider, error: 'RESEND_API_KEY not set' };
    }
    const Resend = getResend();
    if (!Resend) {
      return { ok: false, provider, error: 'resend package not installed (npm i resend)' };
    }
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        html,
      });
      if (result.error) {
        return { ok: false, provider, error: result.error.message || 'resend error' };
      }
      return { ok: true, provider, id: result.data && result.data.id };
    } catch (e) {
      return { ok: false, provider, error: e.message };
    }
  }

  if (process.env.SMTP_HOST || process.env.SMTP_URL) {
    try {
      const transport = nodemailerTransport();
      const info = await transport.sendMail({ from: FROM, to, subject, text, html });
      return { ok: true, provider: 'nodemailer', id: info.messageId };
    } catch (e) {
      return { ok: false, provider: 'nodemailer', error: e.message };
    }
  }

  // Dev fallback: log to stdout.
  console.log(`\n📧 [email/console] to=${to} subject="${subject}"`);
  console.log(text ? text.split('\n').map((l) => '  ' + l).join('\n') : '(html only)');
  console.log('');
  return { ok: true, provider: 'console', dev: true };
}

module.exports = { sendEmail, isConfigured, FROM };
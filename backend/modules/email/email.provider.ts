import { config } from './email.config';

export interface EmailMessage { recipient: string; name: string; subject: string; message: string; action_url?: string; action_label?: string; code?: string; login_identifier?: string; loans?: { title: string; due: string; balance: string }[]; as_of?: string }
export interface EmailProvider { send(message: EmailMessage, account: boolean): Promise<void> }
export class SendFailure extends Error {
  constructor(public kind: 'permanent' | 'retry' | 'unknown', public safeMessage: string, public retryAfterSeconds = 0) { super(safeMessage); }
}
// Test/development-only memory capture. Never exposed through a production route.
export const capturedEmails: EmailMessage[] = [];
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

// Render locally so deployment needs no provider-hosted templates. Escape every value.
export function renderEmail(message: EmailMessage, account: boolean) {
  const html = [`<h1>${escapeHtml(message.subject)}</h1>`, `<p>Hello ${escapeHtml(message.name)},</p>`, `<p>${escapeHtml(message.message).replace(/\r?\n/g, '<br>')}</p>`];
  const text = [message.subject, `Hello ${message.name},`, message.message];
  const paragraph = (value: string) => { html.push(`<p>${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>`); text.push(value); };
  if (account) {
    if (message.login_identifier) paragraph(`Library login ID: ${message.login_identifier}`);
    if (message.code) paragraph(`Your recovery code: ${message.code}`);
  } else {
    if (message.as_of) paragraph(`Balances as of ${message.as_of}. Amounts are in PHP.`);
    for (const loan of message.loans || []) paragraph(`${loan.title}\nDue: ${loan.due}\nUnsettled balance: PHP ${loan.balance}`);
  }
  if (message.action_url) {
    let url: URL;
    try { url = new URL(message.action_url); } catch { throw new SendFailure('permanent', 'Invalid email action URL'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new SendFailure('permanent', 'Invalid email action URL');
    const label = message.action_label || 'Open library';
    html.push(`<p><a href="${escapeHtml(message.action_url)}">${escapeHtml(label)}</a></p>`);
    text.push(`${label}: ${message.action_url}`);
  }
  if (account) paragraph('If you did not request this, contact library staff. Never share your password or recovery code.');
  return { htmlContent: `<!doctype html><html><body>${html.join('\n')}</body></html>`, textContent: text.join('\n\n') };
}
export function prepareEmailRequest(message: EmailMessage, account: boolean): string {
  const c = config();
  const body = JSON.stringify({ sender: { email: c.senderEmail, name: c.senderName },
    to: [{ email: message.recipient, name: message.name }], subject: message.subject, ...renderEmail(message, account) });
  if (Buffer.byteLength(body) > 48_000) throw new SendFailure('permanent', 'Email exceeds request size limit');
  return body;
}
export const provider: EmailProvider = {
  async send(message, account) {
    const c = config();
    if (c.mode === 'capture' && process.env.NODE_ENV !== 'production') { capturedEmails.push(structuredClone(message)); return; }
    const body = prepareEmailRequest(message, account);
    let response: Response;
    try { response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'api-key': c.apiKey }, body, signal: AbortSignal.timeout(15_000) }); }
    catch { throw new SendFailure('unknown', 'Connection ended without a confirmed provider result'); }
    if (response.status === 201) return;
    if (response.status === 429) {
      const header = response.headers.get('Retry-After');
      const seconds = header ? (/^\d+$/.test(header) ? Number(header) : Math.max(0, (Date.parse(header) - Date.now()) / 1000)) : 0;
      throw new SendFailure('retry', 'Brevo rate limit rejection', Number.isFinite(seconds) ? seconds : 0);
    }
    if (response.status >= 500 || response.status === 408 || response.ok) throw new SendFailure('unknown', 'Provider returned an uncertain result');
    throw new SendFailure('permanent', `Brevo rejected request (HTTP ${response.status})`);
  }
};

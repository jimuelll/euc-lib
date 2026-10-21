import { config } from './email.config';

export interface EmailMessage { recipient: string; name: string; subject: string; message: string; action_url?: string; action_label?: string; code?: string; login_identifier?: string; loans?: { title: string; due: string; balance: string }[]; as_of?: string }
export interface EmailProvider { send(message: EmailMessage, account: boolean): Promise<void> }
export class SendFailure extends Error {
  constructor(public kind: 'permanent' | 'retry' | 'unknown', public safeMessage: string, public retryAfterSeconds = 0) { super(safeMessage); }
}
// Test/development-only memory capture. Never exposed through a production route.
export const capturedEmails: EmailMessage[] = [];
export function prepareEmailRequest(message: EmailMessage, account: boolean): string {
  const c = config();
  const body = JSON.stringify({ service_id: c.serviceId, template_id: account ? c.accountTemplate : c.libraryTemplate,
    user_id: c.publicKey, accessToken: c.privateKey, template_params: { ...message, to_email: message.recipient, to_name: message.name } });
  if (Buffer.byteLength(body) > 48_000) throw new SendFailure('permanent', 'Email exceeds request size limit');
  return body;
}
export const provider: EmailProvider = {
  async send(message, account) {
    const c = config();
    if (c.mode === 'capture' && process.env.NODE_ENV !== 'production') { capturedEmails.push(structuredClone(message)); return; }
    const body = prepareEmailRequest(message, account);
    let response: Response;
    try { response = await fetch('https://api.emailjs.com/api/v1.0/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(15_000) }); }
    catch { throw new SendFailure('unknown', 'Connection ended without a confirmed provider result'); }
    if (response.status === 200) return;
    if (response.status === 429) {
      const header = response.headers.get('Retry-After');
      const seconds = header ? (/^\d+$/.test(header) ? Number(header) : Math.max(0, (Date.parse(header) - Date.now()) / 1000)) : 0;
      throw new SendFailure('retry', 'EmailJS rate limit rejection', Number.isFinite(seconds) ? seconds : 0);
    }
    if (response.status >= 500 || response.status === 408) throw new SendFailure('unknown', 'Provider returned an uncertain result');
    throw new SendFailure('permanent', `EmailJS rejected request (HTTP ${response.status})`);
  }
};

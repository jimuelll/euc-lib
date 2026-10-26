import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export function dailyQuotaPeriod(now = new Date()) {
  return { periodStart: now.toISOString().slice(0,10), periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1)).toISOString().slice(0,10) };
}

export function config() {
  const enabled = process.env.EMAIL_ENABLED === 'true';
  const mode = process.env.EMAIL_MODE || (process.env.NODE_ENV === 'production' ? 'brevo' : 'capture');
  const limit = Number(process.env.EMAIL_DAILY_LIMIT || 300);
  const reserve = Number(process.env.EMAIL_SECURITY_RESERVE || 50);
  const url = process.env.PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080');
  return { enabled, routineEnabled: process.env.EMAIL_ROUTINE_ENABLED === "true", mode, limit, reserve, url,
    apiKey: process.env.BREVO_API_KEY || '', senderEmail: process.env.BREVO_SENDER_EMAIL || '',
    senderName: process.env.BREVO_SENDER_NAME || 'Enverga Library',
    ...dailyQuotaPeriod(),
    timezone: process.env.EMAIL_DIGEST_TIMEZONE || 'Asia/Manila', time: process.env.EMAIL_DIGEST_TIME || '09:00' };
}
export function validateConfig() {
  const c = config();
  if (!c.enabled) return;
  if (!['capture','brevo'].includes(c.mode) || !Number.isInteger(c.limit) || c.limit < 1 || !Number.isInteger(c.reserve) || c.reserve < 0 || c.reserve > c.limit) throw new Error('Invalid email mode or quota configuration');
  const url = new URL(c.url);
  if (process.env.NODE_ENV === 'production' && (c.mode !== 'brevo' || url.protocol !== 'https:')) throw new Error('Production email requires Brevo and an HTTPS PUBLIC_APP_URL');
  encryptionKey();
  new Intl.DateTimeFormat('en', { timeZone: c.timezone });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.time)) throw new Error('EMAIL_DIGEST_TIME must be HH:mm');
  if (c.mode === 'brevo') {
    if (!c.apiKey || !c.senderEmail) throw new Error('BREVO_API_KEY and BREVO_SENDER_EMAIL are required');
    normalizeEmail(c.senderEmail);
  }
}
function encryptionKey() {
  const raw = process.env.EMAIL_ENCRYPTION_KEY;
  if (!raw || !/^[a-fA-F0-9]{64}$/.test(raw)) throw new Error('EMAIL_ENCRYPTION_KEY must be 32 random bytes encoded as hex');
  return Buffer.from(raw, 'hex');
}
export function protect(value: unknown): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
export function unprotect<T>(value: string): T {
  const bytes = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
}
export function secretHash(purpose: string, value: string): string {
  return createHmac('sha256', encryptionKey()).update(`${purpose}:${value}`).digest('hex');
}
export function requireEmail() {
  if (!config().enabled) throw Object.assign(new Error('Email workflows are not enabled. Contact the library.'), { status: 503 });
  validateConfig();
}
export function normalizeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 255 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address'), { status: 400 });
  return email;
}
export const sqlDate = (date: Date) => date.toISOString().slice(0,19).replace('T',' ');

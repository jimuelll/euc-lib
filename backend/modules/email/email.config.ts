import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export function config() {
  const enabled = process.env.EMAIL_ENABLED === 'true';
  const mode = process.env.EMAIL_MODE || (process.env.NODE_ENV === 'production' ? 'emailjs' : 'capture');
  const limit = Number(process.env.EMAIL_MONTHLY_LIMIT || 200);
  const reserve = Number(process.env.EMAIL_SECURITY_RESERVE || 50);
  const url = process.env.PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080');
  return { enabled, routineEnabled: process.env.EMAIL_ROUTINE_ENABLED === "true", mode, limit, reserve, url,
    serviceId: process.env.EMAILJS_SERVICE_ID || '', publicKey: process.env.EMAILJS_PUBLIC_KEY || '',
    privateKey: process.env.EMAILJS_PRIVATE_KEY || '', accountTemplate: process.env.EMAILJS_ACCOUNT_TEMPLATE_ID || '',
    libraryTemplate: process.env.EMAILJS_LIBRARY_TEMPLATE_ID || '',
    periodStart: process.env.EMAIL_QUOTA_PERIOD_START || '', periodEnd: process.env.EMAIL_QUOTA_PERIOD_END || '',
    timezone: process.env.EMAIL_DIGEST_TIMEZONE || 'Asia/Manila', time: process.env.EMAIL_DIGEST_TIME || '09:00' };
}
export function validateConfig() {
  const c = config();
  if (!c.enabled) return;
  if (!['capture','emailjs'].includes(c.mode) || !Number.isInteger(c.limit) || c.limit < 1 || !Number.isInteger(c.reserve) || c.reserve < 0 || c.reserve > c.limit) throw new Error('Invalid email mode or quota configuration');
  const url = new URL(c.url);
  if (process.env.NODE_ENV === 'production' && (c.mode !== 'emailjs' || url.protocol !== 'https:')) throw new Error('Production email requires EmailJS and an HTTPS PUBLIC_APP_URL');
  encryptionKey();
  new Intl.DateTimeFormat('en', { timeZone: c.timezone });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.time)) throw new Error('EMAIL_DIGEST_TIME must be HH:mm');
  if (c.mode === 'emailjs' && (!c.serviceId || !c.publicKey || !c.privateKey || !c.accountTemplate || !c.libraryTemplate)) throw new Error('EmailJS credentials and both templates are required');
  if (c.mode === 'emailjs' && (!/^\d{4}-\d{2}-\d{2}$/.test(c.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(c.periodEnd) || c.periodEnd <= c.periodStart)) throw new Error('Configure the actual EmailJS quota period start and exclusive end (YYYY-MM-DD)');
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

export const REPORT_TIME_ZONE = 'Asia/Manila';
/** SQL calendar dates must never pass through UTC instant serialization. */
export function calendarDate(value: string | Date = new Date()): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:REPORT_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  return ['year','month','day'].map(key=>parts.find(part=>part.type===key)?.value).join('-');
}

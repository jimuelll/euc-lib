export const LIBRARY_TIME_ZONE = "Asia/Manila";
export const LIBRARY_UTC_OFFSET = "+08:00";

type TimeValue = Date | string | number;
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const zonedValue = /(?:Z|[+-]\d\d:\d\d)$/;

export function libraryInstant(value: TimeValue): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === "string" && !zonedValue.test(value)) return new Date(value.replace(" ", "T") + LIBRARY_UTC_OFFSET);
  return new Date(value);
}

export function libraryDateKey(value: TimeValue = new Date()): string {
  if (typeof value === "string" && dateOnly.test(value)) return value;
  const date = libraryInstant(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: LIBRARY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateValue(value: TimeValue): Date {
  return typeof value === "string" && dateOnly.test(value) ? new Date(`${value}T12:00:00${LIBRARY_UTC_OFFSET}`) : libraryInstant(value);
}

export function formatLibraryDate(value: TimeValue, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: LIBRARY_TIME_ZONE, month: "short", day: "numeric", year: "numeric", ...options }).format(dateValue(value));
}

export function formatLibraryTime(value: TimeValue): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: LIBRARY_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(libraryInstant(value));
}

export function formatLibraryDateTime(value: TimeValue): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: LIBRARY_TIME_ZONE, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(dateValue(value));
}

export function formatLibraryDeadline(value: TimeValue): string {
  return `${formatLibraryDateTime(value)} Philippine time (UTC+8)`;
}

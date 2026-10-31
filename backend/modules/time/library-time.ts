export const LIBRARY_TIME_ZONE = "Asia/Manila";
export const LIBRARY_UTC_OFFSET = "+08:00";

type TimeValue = Date | string | number;
type DatePart = "year" | "month" | "day" | "hour" | "minute" | "second";

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const zonedValue = /(?:Z|[+-]\d\d:\d\d)$/;

export function libraryInstant(value: TimeValue): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === "string" && !zonedValue.test(value)) return new Date(value.replace(" ", "T") + LIBRARY_UTC_OFFSET);
  return new Date(value);
}

function parts(value: TimeValue): Record<DatePart, string> {
  const date = libraryInstant(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid library timestamp");
  const result = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIBRARY_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(result.filter(part => part.type !== "literal").map(part => [part.type, part.value])) as Record<DatePart, string>;
}

export function libraryDateKey(value: TimeValue = new Date()): string {
  if (typeof value === "string" && dateOnly.test(value)) return value;
  const valueParts = parts(value);
  return `${valueParts.year}-${valueParts.month}-${valueParts.day}`;
}

export function addLibraryDays(day: string, days: number): string {
  if (!dateOnly.test(day) || !Number.isInteger(days)) throw new Error("Invalid library calendar date");
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error("Invalid library calendar date");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function libraryDayRange(value: TimeValue = new Date()): { date: string; start: Date; end: Date } {
  const date = libraryDateKey(value);
  return { date, start: new Date(`${date}T00:00:00${LIBRARY_UTC_OFFSET}`), end: new Date(`${addLibraryDays(date, 1)}T00:00:00${LIBRARY_UTC_OFFSET}`) };
}

export function addLibraryCalendarDays(value: TimeValue, days: number): Date {
  if (!Number.isInteger(days)) throw new Error("Library calendar days must be a whole number");
  const instant = libraryInstant(value);
  const valueParts = parts(instant);
  const targetDay = addLibraryDays(`${valueParts.year}-${valueParts.month}-${valueParts.day}`, days);
  return new Date(`${targetDay}T${valueParts.hour}:${valueParts.minute}:${valueParts.second}.${String(instant.getMilliseconds()).padStart(3, "0")}${LIBRARY_UTC_OFFSET}`);
}

export function formatLibraryTime(value: TimeValue): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: LIBRARY_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(libraryInstant(value));
}

export function formatLibraryDateTime(value: TimeValue): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: LIBRARY_TIME_ZONE, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(libraryInstant(value));
}

export function formatLibraryDeadline(value: TimeValue): string {
  return `${formatLibraryDateTime(value)} Philippine time (UTC+8)`;
}

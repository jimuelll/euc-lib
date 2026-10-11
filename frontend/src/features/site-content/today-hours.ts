import type { HoursRow } from "./site-content.service";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function includesDay(label: string, day: number): boolean {
  const normalized = label.trim().toLowerCase();
  if (/^(daily|every day|everyday)$/.test(normalized)) return true;
  if (normalized === "weekdays") return day >= 1 && day <= 5;
  if (normalized === "weekends") return day === 0 || day === 6;
  const namedDays = [...normalized.matchAll(/sunday|monday|tuesday|wednesday|thursday|friday|saturday/g)]
    .map(([name]) => days.findIndex((candidate) => candidate.toLowerCase() === name));
  if (namedDays.length === 2 && /[–—-]|\bto\b|\bthrough\b/.test(normalized)) {
    const [start, end] = namedDays;
    return start <= end ? day >= start && day <= end : day >= start || day <= end;
  }
  return namedDays.includes(day);
}

/** Resolve the published weekly schedule in the library's timezone, not the visitor's. */
export function getTodayHours(hours: HoursRow[] | undefined, now = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Manila" }).format(now);
  const day = days.indexOf(weekday);
  const today = hours?.find((row) => includesDay(row.day, day));
  if (!today) return "See Hours & Location";
  if (today.open) return today.time.trim() ? `Open today · ${today.time.trim()}` : "Open today · See hours";

  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = (day + offset) % 7;
    const next = hours?.find((row) => includesDay(row.day, nextDay));
    if (next?.open) {
      const opening = next.time.match(/^\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i)?.[1];
      return `Closed today · Opens ${days[nextDay]}${opening ? ` ${opening.trim()}` : ""}`;
    }
  }
  return "Closed today";
}

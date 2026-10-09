import { calendarDate } from './analytics.calendar';
interface SeriesRow extends Record<string, any> { label: string; }
interface SeriesPoint extends Record<string, string | number> { label: string; }

function buildDateLabels(days: number, now = new Date()): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(calendarDate(now) + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - (days - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

function resolveDashboardRange(range: string): number {
  if (range === "30d") return 30;
  if (range === "month") return Number(calendarDate().slice(8));
  if (range === "year") {
    const today = calendarDate();
    return Math.floor((new Date(today+'T00:00:00Z').getTime() - new Date(today.slice(0,4)+'-01-01T00:00:00Z').getTime()) / 86400000) + 1;
  }
  return 7;
}

function buildMonthLabels(months: number): string[] {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(calendarDate().slice(0,7)+'-01T00:00:00Z');
    date.setUTCMonth(date.getUTCMonth() - (months - 1 - index), 1);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function normalizeSeries(rows: SeriesRow[], labels: string[], fields: string[]): SeriesPoint[] {
  const byLabel = new Map(rows.map((row) => [row.label, row]));
  return labels.map((label) => {
    const row: SeriesRow = byLabel.get(label) || { label };
    const point: SeriesPoint = { label };
    for (const field of fields) point[field] = Number(row[field] || 0);
    return point;
  });
}

export = { buildDateLabels, buildMonthLabels, normalizeSeries, resolveDashboardRange };

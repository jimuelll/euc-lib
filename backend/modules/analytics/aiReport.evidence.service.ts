const repository = require("./analytics.repository");
const { listUnsettledBorrowings } = require("../borrowing/overdue.helper");
const { DATE_ONLY, normalizeDateRange } = require("./aiReport.question.service");

interface ReportRange extends Record<string, any> {
  dateFrom: string;
  dateTo: string;
  days: number;
  allTime?: boolean;
}

async function resolveReportRange(input: Record<string, any>): Promise<ReportRange> {
  if (!input.allTime) return normalizeDateRange(input);
  const row = await repository.getReportRangeBounds();
  return { ...normalizeDateRange(row, { allowLongRange: true }), allTime: true };
}

const number = (value: unknown): number => Number(value || 0);
const totals = (row: Record<string, any> = {}): Record<string, number> => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, number(value)]));
const toDateOnly = (value: unknown): string => {
  if (typeof value === "string" && DATE_ONLY.test(value.slice(0, 10))) return value.slice(0, 10);
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? String(value || "") : parsed.toISOString().slice(0, 10);
};

/**
 * Produces the only data that may be sent to the text model. Every value is
 * aggregated; identities, identifiers, IP addresses, user agents, and raw
 * event records deliberately never leave this service.
 */
async function buildAiReportEvidence(input: Record<string, any>): Promise<Record<string, any>> {
  const range = await resolveReportRange(input);
  const startAt = `${range.dateFrom} 00:00:00`;
  const endExclusive = `${range.dateTo} 00:00:00`;
  const previousEnd = new Date(`${range.dateFrom}T00:00:00Z`);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - (range.days - 1));
  const previousRange = {
    dateFrom: previousStart.toISOString().slice(0, 10),
    dateTo: previousEnd.toISOString().slice(0, 10),
    days: range.days,
  };
  const previousStartAt = `${previousRange.dateFrom} 00:00:00`;
  const previousEndAt = `${previousRange.dateTo} 00:00:00`;
  const [data, unsettledOverview]: [any, any] = await Promise.all([
    repository.getAiReportQueryData({ range, previousRange, startAt, endExclusive, previousStartAt, previousEndAt }),
    listUnsettledBorrowings({ limit: null }),
  ]);
  const dailyRowsByDate = new Map<string, Record<string, any>>(data.dailyActivity.map((row: Record<string, any>) => [toDateOnly(row.day), row]));
  const dailyActivity = range.allTime ? data.dailyActivity : Array.from({ length: range.days }, (_, index) => {
    const date = new Date(`${range.dateFrom}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return dailyRowsByDate.get(date.toISOString().slice(0, 10)) || { day: date.toISOString().slice(0, 10) };
  });

  return {
    range,
    previous_range: previousRange,
    activity: {
      circulation: totals(data.circulation),
      reservations: totals(data.reservations),
      attendance: totals(data.attendance),
      site_activity: totals(data.visits),
      fine_collections: totals(data.fines),
      top_borrowed_titles: data.topBooks.map((row: Record<string, any>) => ({ title: String(row.title || "Untitled"), borrowings: number(row.borrowings) })),
      top_borrower: data.topBorrower ? { name_token: "__TOP_BORROWER__", borrowings: number(data.topBorrower.borrowings) } : null,
      daily_activity: dailyActivity.map((row: Record<string, any>) => ({
        date: toDateOnly(row.day),
        borrowed: number(row.borrowed),
        returned: number(row.returned),
        entry_exit_scans: number(row.entry_exit_scans),
        library_entries: number(row.library_entries),
        unique_library_visitors: number(row.unique_library_visitors),
        borrowing_scans: number(row.borrowing_scans),
        unique_visitors: number(row.unique_visitors),
        page_hits: number(row.page_hits),
      })),
    },
    previous_activity: {
      circulation: totals(data.previousCirculation),
      reservations: totals(data.previousReservations),
      attendance: totals(data.previousAttendance),
      site_activity: totals(data.previousVisits),
      fine_collections: totals(data.previousFines),
    },
    current_watch_items: {
      ...totals(data.watchItems),
      outstanding_fines: number(unsettledOverview.summary.total_unsettled_amount),
    },
    private_labels: data.topBorrower ? { __TOP_BORROWER__: String(data.topBorrower.name) } : {},
  };
}

export = { buildAiReportEvidence, resolveReportRange };

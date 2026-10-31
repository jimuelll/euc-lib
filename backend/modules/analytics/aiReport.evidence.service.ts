import { calendarDate } from './analytics.calendar';
import { addLibraryDays, libraryDateKey, libraryDayRange } from "../time/library-time";
const repository = require("./analytics.repository");
const { listUnsettledBorrowings } = require("../borrowing/overdue.helper");
const { DATE_ONLY, daysBetween, normalizeDateRange } = require("./aiReport.question.service");

interface ReportRange extends Record<string, any> {
  dateFrom: string;
  dateTo: string;
  days: number;
  allTime?: boolean;
}
interface QuestionPeriod { label: string; dateFrom: string; dateTo: string; coverage: "full" | "partial"; }
interface AcademicTerm { name: string; dateFrom: string; dateTo: string; }

async function resolveReportRange(input: Record<string, any>): Promise<ReportRange> {
  if (!input.allTime) return normalizeDateRange(input);
  const row = await repository.getReportRangeBounds();
  return { ...normalizeDateRange(row, { allowLongRange: true }), allTime: true };
}

/** UTC instants for a UTC+08 calendar period: its first midnight and the midnight after its last day. */
function periodBounds(period: { dateFrom: string; dateTo: string }) {
  return { dateFrom: period.dateFrom, dateTo: period.dateTo, startAt: libraryDayRange(period.dateFrom).start, endAt: libraryDayRange(period.dateTo).end };
}

const number = (value: unknown): number => Number(value || 0);
const totals = (row: Record<string, any> = {}): Record<string, number> => Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, number(value)]));
const toDateOnly = (value: unknown): string => {
  if (typeof value === "string" && DATE_ONLY.test(value.slice(0, 10))) return value.slice(0, 10);
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? String(value || "") : calendarDate(parsed);
};
const round = (value: number, digits = 1): number => Math.round(value * 10 ** digits) / 10 ** digits;

const DAILY_FIELDS = ["borrowed", "returned", "entry_exit_scans", "library_entries", "unique_library_visitors", "borrowing_scans", "unique_visitors", "page_hits"] as const;

/**
 * Gathers the aggregate evidence for one report. Every value is aggregated;
 * identities, identifiers, IP addresses, user agents, and raw event records
 * deliberately never leave this service. The dashboard reuses this shape, so
 * its fields are the shared source for charts, KPI cards, and AI reports.
 */
async function buildAiReportEvidence(input: Record<string, any>, resolvedRange?: ReportRange, { currentTerm = null }: { currentTerm?: AcademicTerm | null } = {}): Promise<Record<string, any>> {
  const range = resolvedRange || await resolveReportRange(input);
  const previousTo = addLibraryDays(range.dateFrom, -1);
  const previousRange = { dateFrom: addLibraryDays(previousTo, -(range.days - 1)), dateTo: previousTo, days: range.days };
  const [data, unsettledOverview, bounds]: [any, any, any] = await Promise.all([
    repository.getAiReportQueryData({ current: periodBounds(range), previous: periodBounds(previousRange) }),
    listUnsettledBorrowings({ limit: null }),
    repository.getReportRangeBounds(),
  ]);
  const dailyRowsByDate = new Map<string, Record<string, any>>((data.dailyActivity || []).map((row: Record<string, any>) => [toDateOnly(row.day), row]));
  const dailyActivity = Array.from({ length: range.days }, (_, index) => {
    const date = addLibraryDays(range.dateFrom, index);
    const row = dailyRowsByDate.get(date) || {};
    return { date, ...Object.fromEntries(DAILY_FIELDS.map((field) => [field, number(row[field])])) };
  });
  const watch = totals(data.watchItems);
  const rows = (value: unknown, fields: string[]) => (Array.isArray(value) ? value : []).map((row: Record<string, any>) => ({ role: String(row.role || "unassigned"), ...Object.fromEntries(fields.map((field) => [field, number(row[field])])) }));
  const accounts = rows(data.accountsByRole, ["accounts", "active_accounts", "current_term_accounts", "active_current_term_accounts"]);
  const sumAccounts = (field: string) => accounts.reduce((total, row: Record<string, any>) => total + row[field], 0);

  return {
    range,
    previous_range: previousRange,
    comparison: { recordedFrom: bounds.dateFrom, available: !range.allTime && previousRange.dateFrom >= bounds.dateFrom },
    activity: {
      circulation: totals(data.circulation),
      reservations: totals(data.reservations),
      attendance: totals(data.attendance),
      site_activity: totals(data.visits),
      fine_collections: totals(data.fines),
      new_accounts: totals(data.accounts),
      top_borrowed_titles: (data.topBooks || []).map((row: Record<string, any>) => ({ title: String(row.title || "Untitled"), borrowings: number(row.borrowings) })),
      daily_activity: dailyActivity,
      by_role: {
        borrowing: rows(data.borrowingByRole, ["loans", "borrowers"]),
        check_ins: rows(data.checkInsByRole, ["check_ins", "patrons"]),
        new_accounts: rows(data.newAccountsByRole, ["new_accounts"]),
      },
    },
    previous_activity: {
      circulation: totals(data.previousCirculation),
      reservations: totals(data.previousReservations),
      attendance: totals(data.previousAttendance),
      site_activity: totals(data.previousVisits),
      fine_collections: totals(data.previousFines),
      new_accounts: totals(data.previousAccounts),
    },
    current_watch_items: {
      overdue_borrowings: watch.overdue_borrowings || 0,
      ready_reservations: watch.ready_reservations || 0,
      active_reservations: watch.active_reservations || 0,
      active_loans: watch.active_loans || 0,
      patrons_with_active_loans: watch.patrons_with_active_loans || 0,
      patrons_with_overdue_loans: watch.patrons_with_overdue_loans || 0,
      outstanding_fines: number(unsettledOverview?.summary?.total_unsettled_amount),
    },
    current_collection: {
      titles: watch.catalog_titles || 0,
      copies: watch.catalog_copies || 0,
      available_copies: watch.available_copies || 0,
      copies_needing_accession: watch.copies_needing_accession || 0,
      damaged_copies: watch.damaged_copies || 0,
      lost_copies: watch.lost_copies || 0,
    },
    current_users: {
      accounts: sumAccounts("accounts"),
      active_accounts: sumAccounts("active_accounts"),
      current_term: currentTerm,
      current_term_accounts: sumAccounts("current_term_accounts"),
      active_current_term_accounts: sumAccounts("active_current_term_accounts"),
      by_role: accounts,
    },
  };
}

/**
 * Period metrics in the order and wording the model sees. `pick` reads the
 * same value from current or previous activity so comparisons are always
 * like-for-like.
 */
const METRICS: Array<{ key: string; topic: string; pick: (activity: Record<string, any>) => number; money?: boolean }> = [
  { key: "books_borrowed", topic: "circulation", pick: (a) => a.circulation?.borrowed },
  { key: "books_returned", topic: "circulation", pick: (a) => a.circulation?.returned },
  { key: "unique_borrowers", topic: "circulation", pick: (a) => a.circulation?.unique_borrowers },
  { key: "reservations_created", topic: "reservations", pick: (a) => a.reservations?.created },
  { key: "reservations_fulfilled", topic: "reservations", pick: (a) => a.reservations?.fulfilled },
  { key: "reservations_cancelled", topic: "reservations", pick: (a) => a.reservations?.cancelled },
  { key: "library_check_ins", topic: "attendance", pick: (a) => a.attendance?.library_entries },
  { key: "unique_library_patrons", topic: "attendance", pick: (a) => a.attendance?.unique_library_visitors },
  { key: "entry_exit_scans", topic: "attendance", pick: (a) => a.attendance?.entry_exit_scans },
  { key: "borrowing_scans", topic: "attendance", pick: (a) => a.attendance?.borrowing_scans },
  { key: "website_daily_unique_visitors_sum", topic: "site_activity", pick: (a) => a.site_activity?.unique_visitors },
  { key: "website_distinct_visitors", topic: "site_activity", pick: (a) => a.site_activity?.distinct_visitors },
  { key: "website_page_hits", topic: "site_activity", pick: (a) => a.site_activity?.page_hits },
  { key: "fines_collected_php", topic: "fines", pick: (a) => a.fine_collections?.settled_amount, money: true },
  { key: "new_accounts", topic: "users", pick: (a) => a.new_accounts?.new_accounts },
  { key: "new_patron_accounts", topic: "users", pick: (a) => a.new_accounts?.new_patron_accounts },
];

const METRIC_DEFINITIONS: Record<string, string> = {
  books_borrowed: "Loans started in the period (by borrowed date).",
  books_returned: "Loans returned in the period (by return date).",
  unique_borrowers: "Different patrons who borrowed at least once in the period.",
  reservations_created: "Reservations placed in the period.",
  reservations_fulfilled: "Reservations fulfilled in the period, including ones placed earlier.",
  reservations_cancelled: "Reservations cancelled in the period, including ones placed earlier.",
  library_check_ins: "Physical library check-ins (arrivals).",
  unique_library_patrons: "Different patrons who checked in at least once in the whole period. Use for 'how many people visited the library'.",
  entry_exit_scans: "All check-in and check-out scans; not a count of people.",
  borrowing_scans: "Scans made at the desk for borrowing.",
  website_daily_unique_visitors_sum: "Website visitors counted once per day, summed over the period (matches the dashboard).",
  website_distinct_visitors: "Different website visitors across the whole period.",
  website_page_hits: "Website page hits.",
  fines_collected_php: "Fine payments, credits and reversals settled in the period, in Philippine pesos.",
  new_accounts: "User accounts created in the period (all roles), excluding accounts deleted since. Use for 'how many new users' or 'how many accounts were registered'.",
  new_patron_accounts: "New student, employee and alumni accounts created in the period.",
};

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00Z`));
}
function periodLabel(dateFrom: string, dateTo: string): string {
  return dateFrom === dateTo ? dateLabel(dateFrom) : `${dateLabel(dateFrom)} to ${dateLabel(dateTo)}`;
}

function compactDay(row: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(row).filter(([key, value]) => key === "date" || number(value) !== 0));
}
const dayHasActivity = (row: Record<string, any>) => DAILY_FIELDS.some((field) => number(row[field]) > 0);

/** Sums daily rows. Per-day unique counts become explicit "_daily_sum" fields. */
function sumDays(rows: Array<Record<string, any>>): Record<string, number> {
  const sum = (field: string) => rows.reduce((total, row) => total + number(row[field]), 0);
  return {
    borrowed: sum("borrowed"),
    returned: sum("returned"),
    library_check_ins: sum("library_entries"),
    library_patrons_daily_sum: sum("unique_library_visitors"),
    entry_exit_scans: sum("entry_exit_scans"),
    borrowing_scans: sum("borrowing_scans"),
    website_daily_unique_visitors_sum: sum("unique_visitors"),
    website_page_hits: sum("page_hits"),
  };
}

function busiestDays(rows: Array<Record<string, any>>, field: string): Array<{ date: string; value: number }> {
  return rows.filter((row) => number(row[field]) > 0)
    .sort((a, b) => number(b[field]) - number(a[field]) || a.date.localeCompare(b.date))
    .slice(0, 3)
    .map((row) => ({ date: row.date, value: number(row[field]) }));
}

function hasRecordedPeriodActivity(evidence: Record<string, any>): boolean {
  return METRICS.some((metric) => number(metric.pick(evidence.activity)) !== 0);
}

const SNAPSHOT_DEFINITIONS: Record<string, string> = {
  "collection.catalog_titles": "Book titles (catalog records) in the system. Use for 'how many books are in the system' or 'how many books do we have'.",
  "collection.physical_copies": "Active physical copies of those titles.",
  "collection.available_to_borrow": "Copies that can be borrowed right now.",
  "collection.needing_accession": "Active copies without an accession number; they cannot be borrowed yet.",
  "loans.on_loan": "Copies currently borrowed, including overdue ones.",
  "loans.patrons_with_active_loans": "Different patrons who currently have at least one book out.",
  "reservations.active": "Reservations currently pending or ready for pickup.",
  "users.accounts": "Registered user accounts that are not deleted, all roles, including staff and Library Operations device accounts.",
  "users.by_group": "patrons are student, employee and alumni accounts (the people who borrow and visit); staff are staff, admin and super_admin; library_operations are scanner and OPAC kiosk logins, not people. For 'how many users' give accounts and the patron count; for 'how many patrons' use patrons.",
  "users.active_accounts": "Accounts whose status is active (allowed to sign in and borrow). 'Active users' means this unless the question asks about activity in a period.",
  "users.current_term": "The academic term marked current in Academic Settings; 'this semester' or 'current semester' means this term.",
  "users.current_term_accounts": "Accounts assigned to the current term. Use for 'users or students in the current semester'.",
  "users.by_role": "The same account counts per role.",
};

// Matches the account roles in admin.service; scanner and OPAC are device logins (operations-access).
const ROLE_GROUPS: Record<string, string[]> = {
  patrons: ["student", "employee", "alumni"],
  staff: ["staff", "admin", "super_admin"],
  library_operations: ["scanner", "opac"],
};

/** The live position at generation time, labelled for the model. Never selected-period activity. */
function buildSnapshotFacts(evidence: Record<string, any>): Record<string, any> {
  const watch = evidence.current_watch_items || {}, collection = evidence.current_collection || {}, users = evidence.current_users || {};
  return {
    as_of: dateLabel(libraryDateKey()),
    note: "Live position at generation time, not activity within the selected period.",
    collection: {
      catalog_titles: number(collection.titles),
      physical_copies: number(collection.copies),
      available_to_borrow: number(collection.available_copies),
      needing_accession: number(collection.copies_needing_accession),
      damaged_copies: number(collection.damaged_copies),
      lost_copies: number(collection.lost_copies),
    },
    loans: {
      on_loan: number(watch.active_loans),
      overdue: number(watch.overdue_borrowings),
      patrons_with_active_loans: number(watch.patrons_with_active_loans),
      patrons_with_overdue_loans: number(watch.patrons_with_overdue_loans),
    },
    reservations: { active: number(watch.active_reservations), ready_for_pickup: number(watch.ready_reservations) },
    fines: { outstanding_php: round(number(watch.outstanding_fines), 2) },
    users: {
      accounts: number(users.accounts),
      active_accounts: number(users.active_accounts),
      inactive_accounts: number(users.accounts) - number(users.active_accounts),
      current_term: users.current_term ? { name: users.current_term.name, starts: dateLabel(users.current_term.dateFrom), ends: dateLabel(users.current_term.dateTo) } : "No academic term is marked current.",
      current_term_accounts: number(users.current_term_accounts),
      active_current_term_accounts: number(users.active_current_term_accounts),
      by_group: Object.fromEntries(Object.entries(ROLE_GROUPS).map(([group, roles]) => {
        const members = (users.by_role || []).filter((row: Record<string, any>) => roles.includes(row.role));
        const sum = (field: string) => members.reduce((total: number, row: Record<string, any>) => total + number(row[field]), 0);
        return [group, { accounts: sum("accounts"), active_accounts: sum("active_accounts"), current_term_accounts: sum("current_term_accounts") }];
      })),
      by_role: users.by_role || [],
    },
  };
}

/**
 * The only object sent to the model. Changes, percentages, averages and
 * busiest days are computed here so the model never does arithmetic, and the
 * figures in its answer can be checked against these values.
 */
function buildReportFacts(evidence: Record<string, any>, { intents = [], periods = [] }: { intents?: string[] | null; periods?: QuestionPeriod[] } = {}): Record<string, any> {
  const { range, previous_range: previousRange, activity, previous_activity: previousActivity } = evidence;
  const comparable = evidence.comparison?.available === true;
  const metrics: Record<string, Record<string, number>> = {};
  for (const metric of METRICS) {
    const current = round(number(metric.pick(activity)), 2);
    const entry: Record<string, number> = { current };
    if (comparable) {
      const previous = round(number(metric.pick(previousActivity)), 2);
      entry.previous = previous;
      entry.change = round(current - previous, 2);
      if (previous > 0) entry.change_pct = round(((current - previous) / previous) * 100);
    }
    if (!metric.money && range.days > 1) entry.daily_average = round(current / range.days);
    metrics[metric.key] = entry;
  }

  const daily: Array<Record<string, any>> = activity.daily_activity || [];
  const activeDays = daily.filter(dayHasActivity);
  const dailyFacts: Record<string, any> = {
    days_with_activity: activeDays.length,
    days_without_activity: daily.length - activeDays.length,
    busiest_borrowing_days: busiestDays(daily, "borrowed"),
    busiest_check_in_days: busiestDays(daily, "library_entries"),
  };
  if (range.days <= 62) {
    dailyFacts.active_days = activeDays.map(compactDay);
  } else {
    const months = new Map<string, Array<Record<string, any>>>();
    for (const row of daily) months.set(row.date.slice(0, 7), [...(months.get(row.date.slice(0, 7)) || []), row]);
    dailyFacts.monthly_totals = [...months].map(([month, rows]) => ({ month, ...sumDays(rows) }));
  }

  const questionPeriods = periods.map((period) => {
    const dateFrom = period.dateFrom < range.dateFrom ? range.dateFrom : period.dateFrom;
    const dateTo = period.dateTo > range.dateTo ? range.dateTo : period.dateTo;
    const rows = daily.filter((row) => row.date >= dateFrom && row.date <= dateTo);
    return {
      asked_as: period.label,
      covered: periodLabel(dateFrom, dateTo),
      coverage: period.coverage === "full" ? "fully inside the selected period" : `only ${periodLabel(dateFrom, dateTo)} is inside the selected period`,
      ...(dateFrom === dateTo ? { day: { ...rows[0], date: dateFrom } } : { days: daysBetween(dateFrom, dateTo), totals: sumDays(rows) }),
    };
  });

  return {
    reporting_time_zone: "UTC+08 (Philippine time)",
    selected_period: {
      label: periodLabel(range.dateFrom, range.dateTo),
      date_from: range.dateFrom,
      date_to: range.dateTo,
      days: range.days,
      ...(range.allTime ? { scope: "all recorded history" } : {}),
    },
    comparison: comparable
      ? { available: true, previous_period: periodLabel(previousRange.dateFrom, previousRange.dateTo) }
      : { available: false, reason: range.allTime ? "The whole recorded history is selected." : `Records begin on ${dateLabel(evidence.comparison?.recordedFrom || range.dateFrom)}, so the previous ${range.days}-day period is incomplete.` },
    focus: (intents || []).filter((intent) => intent !== "summary"),
    metrics,
    metric_definitions: METRIC_DEFINITIONS,
    top_borrowed_titles: activity.top_borrowed_titles || [],
    daily: dailyFacts,
    ...(questionPeriods.length ? { question_periods: questionPeriods } : {}),
    period_by_role: {
      note: "Selected-period activity grouped by account role. Roles are account types such as student or faculty.",
      borrowing: activity.by_role?.borrowing || [],
      check_ins: activity.by_role?.check_ins || [],
      new_accounts: activity.by_role?.new_accounts || [],
    },
    current_snapshot: buildSnapshotFacts(evidence),
    snapshot_definitions: SNAPSHOT_DEFINITIONS,
  };
}

export = { buildAiReportEvidence, buildReportFacts, dateLabel, hasRecordedPeriodActivity, periodBounds, periodLabel, resolveReportRange };

import { addLibraryDays, libraryDateKey } from "../time/library-time";

/**
 * Decides whether a question may be answered from aggregate analytics, before
 * any evidence is gathered or any text is sent to a model. Everything here is
 * deterministic; the model scope check in aiReport.providers is only consulted
 * for questions these rules cannot place.
 */

interface ReportDateRangeInput { dateFrom?: string; dateTo?: string; allTime?: boolean; }
interface ReportDateRange { dateFrom: string; dateTo: string; days: number; allTime?: boolean; }
interface MentionedPeriod { label: string; dateFrom: string; dateTo: string; }
interface QuestionPeriod extends MentionedPeriod { coverage: "full" | "partial"; }
interface QuestionAssessment {
  mode: "summary" | "answer";
  intents: string[] | null;
  periods: QuestionPeriod[];
  /** True when the question is about the current state (inventory, accounts) rather than activity over time. */
  snapshot: boolean;
}
interface AcademicTerm { name: string; dateFrom: string; dateTo: string; }
interface AcademicTerms { current?: AcademicTerm | null; previous?: AcademicTerm | null; }
type ReportError = Error & { status: number; code?: string | null; details?: Record<string, unknown> };

const MAX_REPORT_DAYS = 366;
const MAX_QUESTION_LENGTH = 500;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function requestError(message: string, status = 400, code: string | null = null, details?: Record<string, unknown>): ReportError {
  const error = Object.assign(new Error(message), { status }) as ReportError;
  if (code) error.code = code;
  if (details) error.details = details;
  return error;
}

const PRIVACY_RESTRICTION_CODE = "AI_REPORT_PRIVACY_RESTRICTED";
const PRIVACY_RESTRICTION_MESSAGE = "AI reports cannot identify individual visitors or patrons. Ask for an aggregate count instead. To review authorized individual attendance records, use Attendance History.";
const IRRELEVANT_QUESTION_CODE = "AI_REPORT_IRRELEVANT_QUESTION";
const IRRELEVANT_QUESTION_MESSAGE = "AI Reports only answer questions about the library operations data available here. Ask about borrowing, returns, reservations, attendance, website activity, fines, or collection performance.";
const DATE_OUTSIDE_RANGE_CODE = "AI_REPORT_DATE_OUTSIDE_RANGE";

function cleanQuestion(question: unknown): string {
  if (question === undefined || question === null) return "";
  if (typeof question !== "string") throw requestError("The report question must be text.");
  // Control characters are never meaningful in a question and could disguise
  // instructions inside the prompt.
  return question.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().replace(/\s+/g, " ").slice(0, MAX_QUESTION_LENGTH);
}

const PERSON = String.raw`(?:people|person|persons|patrons?|users?|students?|employees?|staff|visitors?|borrowers?|members?|readers?|faculty|teachers?|individuals?)`;
const PERSON_TERMS = new RegExp(String.raw`\b${PERSON}\b`, "i");

function isIdentitySeekingQuestion(question: string): boolean {
  if (!question) return false;
  const directIdentityTerms = /\b(?:name|names|named|identify|identified|identity|identities|profiles?)\b/i;
  const personActivityTerms = /\b(?:visit(?:ed|ing|s)?|attendance|check(?:ed|ing)?[- ]?(?:in|out)|enter(?:ed|ing|s)?|exit(?:ed|ing|s)?|borrow(?:ed|ing|s)?|reserv(?:e|ed|ing|ation|ations)|overdue|owe[sd]?|fines?|paid|returned)\b/i;
  const asksWho = /\bwho(?:se|m)?\b/i.test(question);
  return (
    new RegExp(String.raw`\bwhich\s+${PERSON}\b`, "i").test(question)
    || (directIdentityTerms.test(question) && PERSON_TERMS.test(question))
    || (asksWho && (PERSON_TERMS.test(question) || personActivityTerms.test(question)))
    || new RegExp(String.raw`\b(?:top|most active|most frequent|frequent|regular|biggest|heaviest|best|worst|leading)\s+${PERSON}\b`, "i").test(question)
    || new RegExp(String.raw`\b${PERSON}\s+(?:with|who has|who have|that has|that have)\s+(?:the\s+)?(?:most|highest|largest|biggest)\b`, "i").test(question)
    || new RegExp(String.raw`\b(?:list|show|give|export)\s+(?:me\s+)?(?:all\s+|every\s+|the\s+|a list of\s+)*(?:(?:active|inactive|registered|current|new|enrolled|overdue|blocked)\s+)?${PERSON}\b(?!\s+(?:counts?|totals?|numbers?|by role|per role))`, "i").test(question)
    || /\b(?:student|employee|patron|user|member|borrower|visitor)\s*(?:id|ids|number|numbers|email|emails|address|addresses|contact|phone|barcode|card)s?\b/i.test(question)
    || /\b(?:e-?mail|phone|contact)\s+(?:address(?:es)?|numbers?|details)\b/i.test(question)
  );
}

const REPORT_INTENTS: Array<[string, RegExp]> = [
  ["circulation", /\b(?:borrow(?:ed|er|ers|ing|ings)?|return(?:ed|ing|s)?|circulation|loan(?:ed|s)?|books?|titles?)\b/i],
  ["reservations", /\b(?:reserv(?:e|ed|ing|ation|ations)|fulfilled|cancelled|canceled|holds?|ready for pickup)\b/i],
  ["attendance", /\b(?:attendance|visit(?:ed|or|ors|ing|s)?|entr(?:y|ies)|exit(?:ed|s)?|check[- ]?(?:in|out|ins|outs)|library scans?|scans?|foot ?traffic|went (?:in|into|to) (?:the )?library)\b/i],
  ["site_activity", /\b(?:website|web ?site|site activity|page (?:hits?|views?)|online visit(?:or|ors|s)?)\b/i],
  ["fines", /\b(?:fines?|payments?|settled|collections?|outstanding balance|penalt(?:y|ies)|pesos?|php|₱)\b/i],
  ["catalog", /\b(?:catalog(?:ue)?|collection|copies|copy|inventory|holdings|condition|damaged|lost|accession(?:ed)?|in the (?:system|database|library)|do we have|in stock|on the shelves?)\b/i],
  ["users", /\b(?:users?|accounts?|registered|registrations?|sign[- ]?ups?|enrolled|patrons?|students?|faculty|teachers?|employees?|staff|members?|borrowers?|roles?|semesters?|academic terms?|school year)\b/i],
];
// Words that make a question about activity over time rather than the current state.
const ACTIVITY_WORDS = /\b(?:borrow(?:ed|ing|ings|s)?|return(?:ed|ing|s)?|loan(?:ed|s)?|circulation|reserv(?:e|ed|ing|ation|ations)|fulfilled|cancell?ed|visit(?:ed|ing|s|ors?)?|attendance|check(?:ed)?[- ]?(?:in|out)s?|entr(?:y|ies)|scans?|website|page (?:hits?|views?)|paid|payments?|settled|collected|happened|changed|trend|busiest|quietest|joined|sign(?:ed)?[- ]?ups?|registrations?|new (?:users?|accounts?|students?|patrons?|members?|borrowers?)|(?:were|was|got|been) (?:registered|created|added))\b/i;
const REPORT_INTENT_NAMES = REPORT_INTENTS.map(([intent]) => intent).concat("performance");
const ANALYTICS_SIGNAL = /\b(?:how many|how much|number of|count|total|sum|amount|most|top|least|popular|highest|lowest|average|rate|ratio|percentage|percent|difference|net|calculate|compute|change|changed|increase|decrease|trend|compare|comparison|performance|summary|summarize|overview|activity|busiest|quietest|outstanding|overdue|available|status|were|was|did|has|have|created|fulfilled|cancelled|collected|what happened|any)\b/i;
const PERIOD_ANALYSIS = /\b(?:what changed|key findings|performance|operational activity|activity summary|reporting period|selected period|during this period|compare|comparison|trend|busiest|quietest|overview|summar(?:y|ize|ise))\b/i;
// Standalone arithmetic may still be about library figures ("Oct 1 - 7
// borrowings"), so it only defers to the model scope check. Off-topic and
// instruction-override requests are always refused.
const ARITHMETIC_REQUEST = /\d+(?:\.\d+)?(?:\s*[+*×÷^]\s*|\s[-/]\s|\s+\b(?:plus|minus|times|multiplied|divided)\b\s*)\d+/i;
const OFF_TOPIC_REQUEST = /\b(?:capital of|weather|recipe|translate|president of|tell (?:me )?(?:a )?joke|write (?:me )?(?:a |an )?(?:poem|story|song|essay|email|letter|code)|ignore (?:all |the |previous |prior |your |above )*(?:instructions|rules)|system prompt|developer message|pretend (?:to be|you are)|role-?play|jailbreak)\b/i;
const UNSUPPORTED_REQUEST = new RegExp(`${ARITHMETIC_REQUEST.source}|${OFF_TOPIC_REQUEST.source}`, "i");

function classifyReportQuestion(question: string): string[] | null {
  if (!question) return ["summary"];
  if (UNSUPPORTED_REQUEST.test(question)) return null;

  const clauses = question.split(/\s*(?:;|\?|\b(?:and|also|plus|then)\b)\s*/i).map((part) => part.trim()).filter(Boolean);
  const clauseMatches = clauses.map((clause) => {
    const intents = REPORT_INTENTS.filter(([, pattern]) => pattern.test(clause)).map(([intent]) => intent);
    if (PERIOD_ANALYSIS.test(clause) || /\bwhat happened\b/i.test(clause)) return { intents: intents.length ? intents : ["performance"], complete: true };
    return { intents, complete: intents.length > 0 && ANALYTICS_SIGNAL.test(clause) };
  });

  // Topic-only fragments are allowed only when another clause supplies the
  // analytical operation, e.g. "compare borrowings and returns". Every clause
  // must still map to the allowlist, preventing one library word from
  // laundering an unrelated second request.
  if (!clauseMatches.some((match) => match.complete) || clauseMatches.some((match) => match.intents.length === 0)) return null;
  return [...new Set(clauseMatches.flatMap((match) => match.intents))];
}

function isReportRelevantQuestion(question: string): boolean {
  return classifyReportQuestion(question) !== null;
}

const MONTH_PATTERN = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const monthNumber = (name: string): number => MONTH_NUMBERS[name.toLowerCase().slice(0, 3)];
const pad = (value: number): string => String(value).padStart(2, "0");

function validDateParts(year: number, month: number, day: number): string | null {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() + 1 !== month || candidate.getUTCDate() !== day) return null;
  return candidate.toISOString().slice(0, 10);
}

function monthEnd(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** A date written without a year means its most recent occurrence on or before the reference date. */
function impliedYear(month: number, day: number, reference: string): number {
  const year = Number(reference.slice(0, 4));
  return `${year}-${pad(month)}-${pad(day)}` > reference ? year - 1 : year;
}

function daysBetween(dateFrom: string, dateTo: string): number {
  return Math.floor((Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86400000) + 1;
}

/**
 * Finds the calendar periods a question names. `reference` is the selected
 * range's end date (for implied years); `today` is the library's UTC+08 date
 * (for relative words such as "yesterday").
 */
function extractMentionedPeriods(question: string, { reference, today, terms = {} }: { reference: string; today: string; terms?: AcademicTerms }): MentionedPeriod[] {
  const periods: MentionedPeriod[] = [];
  const add = (label: string, dateFrom: string | null, dateTo: string | null = dateFrom) => {
    if (dateFrom && dateTo && !periods.some((period) => period.dateFrom === dateFrom && period.dateTo === dateTo)) periods.push({ label, dateFrom, dateTo });
  };
  let text = question;
  const consume = (pattern: RegExp, handler: (match: RegExpExecArray) => void) => {
    text = text.replace(pattern, (...args: any[]) => {
      handler(args.slice(0, -2) as unknown as RegExpExecArray);
      return " ";
    });
  };

  consume(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (match) => add(match[0], validDateParts(Number(match[1]), Number(match[2]), Number(match[3]))));
  consume(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/g, (match) => {
    const month = Number(match[1]), day = Number(match[2]);
    let year = match[3] ? Number(match[3]) : impliedYear(month, day, reference);
    if (year < 100) year += 2000;
    add(match[0], validDateParts(year, month, day));
  });
  consume(new RegExp(String.raw`\b(${MONTH_PATTERN})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b`, "gi"), (match) => {
    const month = monthNumber(match[1]), day = Number(match[2]);
    add(match[0], validDateParts(match[3] ? Number(match[3]) : impliedYear(month, day, reference), month, day));
  });
  consume(new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(${MONTH_PATTERN})\.?(?:\s*,?\s*(\d{4}))?\b`, "gi"), (match) => {
    const month = monthNumber(match[2]), day = Number(match[1]);
    add(match[0], validDateParts(match[3] ? Number(match[3]) : impliedYear(month, day, reference), month, day));
  });
  // A bare month needs a year or a preposition, so "may" as a verb is ignored.
  consume(new RegExp(String.raw`\b(?:(?:in|during|for|of|throughout|since)\s+)?(${MONTH_PATTERN})\.?\s*,?\s*(\d{4})\b|\b(?:in|during|for|of|throughout)\s+(${MONTH_PATTERN})\b`, "gi"), (match) => {
    const name = match[1] || match[3];
    if (!match[2] && /^may$/i.test(name) && !/\b(?:in|during|for|of|throughout)\s+May\b/.test(match[0])) return;
    const month = monthNumber(name);
    const year = match[2] ? Number(match[2]) : impliedYear(month, 1, reference);
    add(match[0].trim(), `${year}-${pad(month)}-01`, monthEnd(year, month));
  });
  consume(/\b(?:in|during|for|throughout)\s+(?:the\s+year\s+)?(20\d{2})\b/gi, (match) => add(match[0], `${match[1]}-01-01`, `${match[1]}-12-31`));

  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const relative: Array<[RegExp, () => [string, string]]> = [
    [/\btoday\b/i, () => [today, today]],
    [/\byesterday\b/i, () => [addLibraryDays(today, -1), addLibraryDays(today, -1)]],
    [/\bthis week\b/i, () => [addLibraryDays(today, -weekday), today]],
    [/\blast week\b/i, () => [addLibraryDays(today, -weekday - 7), addLibraryDays(today, -weekday - 1)]],
    [/\bthis month\b/i, () => [`${today.slice(0, 7)}-01`, today]],
    [/\blast month\b/i, () => {
      const end = addLibraryDays(`${today.slice(0, 7)}-01`, -1);
      return [`${end.slice(0, 7)}-01`, end];
    }],
    [/\bthis year\b/i, () => [`${today.slice(0, 4)}-01-01`, today]],
    [/\blast year\b/i, () => [`${Number(today.slice(0, 4)) - 1}-01-01`, `${Number(today.slice(0, 4)) - 1}-12-31`]],
  ];
  for (const [pattern, resolve] of relative) {
    const match = text.match(pattern);
    if (match) add(match[0], ...resolve());
  }
  // Semesters resolve to the academic terms configured in Academic Settings.
  const currentTerm = text.match(/\b(?:this|current|the current|present|ongoing)\s+(?:semester|academic term|school term|term)\b/i);
  if (currentTerm && terms.current) add(`${currentTerm[0]} (${terms.current.name})`, terms.current.dateFrom, terms.current.dateTo);
  const previousTerm = text.match(/\b(?:last|previous|past|prior)\s+(?:semester|academic term|school term|term)\b/i);
  if (previousTerm && terms.previous) add(`${previousTerm[0]} (${terms.previous.name})`, terms.previous.dateFrom, terms.previous.dateTo);
  const lastDays = text.match(/\b(?:last|past|previous)\s+(\d{1,3})\s+days?\b/i);
  if (lastDays && Number(lastDays[1]) > 0) add(lastDays[0], addLibraryDays(today, -(Number(lastDays[1]) - 1)), today);
  return periods;
}

/** Retained for callers that only need the first single date a question names. */
function extractMentionedDate(question: string, referenceDate = new Date()): string | null {
  const reference = libraryDateKey(referenceDate);
  const period = extractMentionedPeriods(question, { reference, today: reference }).find((item) => item.dateFrom === item.dateTo);
  return period?.dateFrom || null;
}

function normalizeDateRange({ dateFrom, dateTo }: ReportDateRangeInput, { allowLongRange = false }: { allowLongRange?: boolean } = {}): ReportDateRange {
  if (!DATE_ONLY.test(String(dateFrom || "")) || !DATE_ONLY.test(String(dateTo || ""))) {
    throw requestError("Choose a valid start and end date.");
  }
  if (!validDateParts(Number(dateFrom!.slice(0, 4)), Number(dateFrom!.slice(5, 7)), Number(dateFrom!.slice(8)))
    || !validDateParts(Number(dateTo!.slice(0, 4)), Number(dateTo!.slice(5, 7)), Number(dateTo!.slice(8)))) {
    throw requestError("Choose a valid date range.");
  }
  if (dateFrom! > dateTo!) throw requestError("The start date must be on or before the end date.");
  const days = daysBetween(dateFrom!, dateTo!);
  if (!allowLongRange && days > MAX_REPORT_DAYS) throw requestError(`Reports can cover up to ${MAX_REPORT_DAYS} days.`);
  return { dateFrom: dateFrom!, dateTo: dateTo!, days };
}

function outsideRangeError(period: MentionedPeriod, range: ReportDateRange, today: string): ReportError {
  const single = period.dateFrom === period.dateTo;
  const suggestedTo = period.dateTo > today ? today : period.dateTo;
  const suggestedFrom = daysBetween(period.dateFrom, suggestedTo) > MAX_REPORT_DAYS ? addLibraryDays(suggestedTo, -(MAX_REPORT_DAYS - 1)) : period.dateFrom;
  const requested = single ? period.dateFrom : `${period.dateFrom} to ${period.dateTo}`;
  return requestError(
    `The question asks about ${requested}, which is outside the selected reporting period (${range.dateFrom} to ${range.dateTo}). Change the report period and try again.`,
    400,
    DATE_OUTSIDE_RANGE_CODE,
    suggestedFrom <= suggestedTo ? { requested: period, suggestedRange: { dateFrom: suggestedFrom, dateTo: suggestedTo } } : { requested: period },
  );
}

/**
 * Applies every deterministic rule: privacy first, then scope, then the
 * selected range. `intents` is null when the rules cannot decide scope and the
 * model scope check must be consulted.
 */
function assessQuestion(question: string, range: ReportDateRange, { today = libraryDateKey(), terms = {} }: { today?: string; terms?: AcademicTerms } = {}): QuestionAssessment {
  if (!question) return { mode: "summary", intents: ["summary"], periods: [], snapshot: false };
  if (isIdentitySeekingQuestion(question)) throw requestError(PRIVACY_RESTRICTION_MESSAGE, 400, PRIVACY_RESTRICTION_CODE);

  const hasReportTopic = REPORT_INTENTS.some(([, pattern]) => pattern.test(question)) || PERIOD_ANALYSIS.test(question);
  if (OFF_TOPIC_REQUEST.test(question) || (ARITHMETIC_REQUEST.test(question) && !hasReportTopic)) {
    throw requestError(IRRELEVANT_QUESTION_MESSAGE, 400, IRRELEVANT_QUESTION_CODE);
  }

  // Current-state questions ("how many books are in the system", "active
  // students this semester") are answered from the live snapshot, so a date
  // they mention does not have to fall inside the selected range.
  // "registered" alone describes accounts ("registered accounts"); with a
  // period ("students registered this month") it asks about new accounts.
  const mentioned = extractMentionedPeriods(question, { reference: range.dateTo, today, terms });
  const snapshot = !ACTIVITY_WORDS.test(question) && !(mentioned.length && /\b(?:registered|created|added)\b/i.test(question));
  const periods: QuestionPeriod[] = [];
  for (const period of snapshot ? [] : mentioned) {
    if (period.dateTo < range.dateFrom || period.dateFrom > range.dateTo) throw outsideRangeError(period, range, today);
    const coverage = period.dateFrom >= range.dateFrom && period.dateTo <= range.dateTo ? "full" : "partial";
    periods.push({ ...period, coverage });
  }

  return { mode: "answer", intents: classifyReportQuestion(question), periods, snapshot };
}

export = {
  DATE_ONLY,
  DATE_OUTSIDE_RANGE_CODE,
  IRRELEVANT_QUESTION_CODE,
  IRRELEVANT_QUESTION_MESSAGE,
  MAX_QUESTION_LENGTH,
  MAX_REPORT_DAYS,
  PERIOD_ANALYSIS,
  PRIVACY_RESTRICTION_CODE,
  PRIVACY_RESTRICTION_MESSAGE,
  REPORT_INTENTS,
  REPORT_INTENT_NAMES,
  UNSUPPORTED_REQUEST,
  assessQuestion,
  classifyReportQuestion,
  cleanQuestion,
  daysBetween,
  extractMentionedDate,
  extractMentionedPeriods,
  isIdentitySeekingQuestion,
  isReportRelevantQuestion,
  normalizeDateRange,
  requestError,
};

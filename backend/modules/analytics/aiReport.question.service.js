const repository = require("./analytics.repository");

const MAX_REPORT_DAYS = 366;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function requestError(message, status = 400, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

const PRIVACY_RESTRICTION_CODE = "AI_REPORT_PRIVACY_RESTRICTED";
const PRIVACY_RESTRICTION_MESSAGE = "AI reports cannot identify individual visitors or patrons. Ask for an aggregate count instead. To review authorized individual attendance records, use Attendance History.";
const IRRELEVANT_QUESTION_CODE = "AI_REPORT_IRRELEVANT_QUESTION";
const IRRELEVANT_QUESTION_MESSAGE = "AI Reports only answer questions about the library operations data available here. Ask about borrowing, returns, reservations, attendance, website activity, fines, or collection performance.";
const DATE_NOT_RECORDED_CODE = "AI_REPORT_DATE_NOT_RECORDED";
const DATE_OUTSIDE_RANGE_CODE = "AI_REPORT_DATE_OUTSIDE_RANGE";

function isIdentitySeekingQuestion(question) {
  if (!question) return false;
  const personTerms = /\b(?:people|person|persons|patrons?|users?|students?|employees?|staff|visitors?|borrowers?|members?)\b/i;
  const directIdentityTerms = /\b(?:name|names|named|identify|identified|identity|identities)\b/i;
  const personActivityTerms = /\b(?:visit(?:ed|ing|s)?|attendance|check(?:ed|ing)?[- ]?(?:in|out)|enter(?:ed|ing|s)?|exit(?:ed|ing|s)?|borrow(?:ed|ing|s)?|reserv(?:e|ed|ing|ation|ations)|overdue|fines?)\b/i;
  const asksWho = /\bwho(?:se|m)?\b/i.test(question);
  const asksWhichPeople = /\bwhich\s+(?:people|person|persons|patrons?|users?|students?|employees?|staff|visitors?|borrowers?|members?)\b/i.test(question);
  const asksNamedPeople = directIdentityTerms.test(question) && personTerms.test(question);
  const asksWhoDidActivity = asksWho && (personTerms.test(question) || personActivityTerms.test(question));
  const asksForTopPerson = /\b(?:the\s+)?top\s+(?:user|patron|borrower|student|employee|visitor)\b/i.test(question);
  const asksForPersonalField = /\b(?:student|employee|patron|user)\s*(?:id|number|email|address|contact|phone|barcode)\b/i.test(question);
  return asksWhichPeople || asksNamedPeople || asksWhoDidActivity || asksForTopPerson || asksForPersonalField;
}

const REPORT_INTENTS = [
  ["circulation", /\b(?:borrow(?:ed|er|ers|ing|ings)?|return(?:ed|ing|s)?|circulation|loan(?:ed|s)?|books?|titles?)\b/i],
  ["reservations", /\b(?:reserv(?:e|ed|ing|ation|ations)|fulfilled|cancelled|ready for pickup)\b/i],
  ["attendance", /\b(?:attendance|visit(?:ed|or|ors|ing|s)?|entr(?:y|ies)|exit(?:ed|s)?|check[- ]?(?:in|out|ins|outs)|library scans?|went (?:in|into|to) (?:the )?library)\b/i],
  ["site_activity", /\b(?:website|site activity|page hits?|online visit(?:or|ors|s)?)\b/i],
  ["fines", /\b(?:fines?|payments?|settled|collections?|outstanding balance)\b/i],
  ["catalog", /\b(?:catalog(?:ue)?|collection|copies|copy|inventory|condition|damaged|lost)\b/i],
];
const REPORT_INTENT_NAMES = REPORT_INTENTS.map(([intent]) => intent).concat("performance");
const ANALYTICS_SIGNAL = /\b(?:how many|how much|number of|count|total|sum|amount|most|top|least|popular|highest|lowest|average|rate|ratio|percentage|percent|difference|net|calculate|compute|change|changed|increase|decrease|trend|compare|comparison|performance|summary|summarize|activity|busiest|quietest|outstanding|overdue|available|status|were|was|did|has|have|created|fulfilled|cancelled|collected)\b/i;
const PERIOD_ANALYSIS = /\b(?:what changed|key findings|performance|operational activity|activity summary|reporting period|selected period|during this period|compare|comparison|trend|busiest|quietest)\b/i;
const UNSUPPORTED_REQUEST = /(?:\d+(?:\.\d+)?(?:\s*(?:[+*×÷^]|\s[-/]\s)|\s+\b(?:plus|minus|times|multiplied|divided)\b\s*)\d+|\b(?:capital of|weather|recipe|translate|president of|tell (?:me )?(?:a )?joke|write (?:me )?(?:a )?(?:poem|story|email|code))\b)/i;

function classifyReportQuestion(question) {
  if (!question) return ["summary"];
  if (UNSUPPORTED_REQUEST.test(question)) return null;

  const clauses = question.split(/\s*(?:;|\b(?:and|also|plus|then)\b)\s*/i).map((part) => part.trim()).filter(Boolean);
  const clauseMatches = clauses.map((clause) => {
    const intents = REPORT_INTENTS.filter(([, pattern]) => pattern.test(clause)).map(([intent]) => intent);
    const datedHistory = /\bwhat happened\b/i.test(clause) && /\b(?:today|yesterday|this (?:week|month|year)|last \d+ days?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}|\d{4}-\d{2}-\d{2})\b/i.test(clause);
    if (PERIOD_ANALYSIS.test(clause)) return { intents: intents.length ? intents : ["performance"], complete: true };
    if (datedHistory && intents.length > 0) return { intents, complete: true };
    return { intents, complete: intents.length > 0 && ANALYTICS_SIGNAL.test(clause) };
  });

  // Topic-only fragments are allowed only when another clause supplies the
  // analytical operation, e.g. "compare borrowings and returns". Every clause
  // must still map to the allowlist, preventing one library word from
  // laundering an unrelated second request.
  if (!clauseMatches.some((match) => match.complete) || clauseMatches.some((match) => match.intents.length === 0)) return null;
  return [...new Set(clauseMatches.flatMap((match) => match.intents))];
}

function isReportRelevantQuestion(question) {
  return classifyReportQuestion(question) !== null;
}

const MONTH_NUMBERS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

function validDateParts(year, month, day) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() + 1 !== month || candidate.getUTCDate() !== day) return null;
  return candidate.toISOString().slice(0, 10);
}

function extractMentionedDate(question, referenceDate = new Date()) {
  const iso = question.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return validDateParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = question.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
  if (numeric) {
    let year = numeric[3] ? Number(numeric[3]) : referenceDate.getFullYear();
    if (year < 100) year += 2000;
    return validDateParts(year, Number(numeric[1]), Number(numeric[2]));
  }

  const named = question.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i);
  if (!named) return null;
  const month = MONTH_NUMBERS[named[1].toLowerCase().replace(/\.$/, "")];
  return validDateParts(named[3] ? Number(named[3]) : referenceDate.getFullYear(), month, Number(named[2]));
}

async function requireRecordedDateQuestion(question, input) {
  const reference = DATE_ONLY.test(String(input.dateTo || "")) ? new Date(`${input.dateTo}T00:00:00`) : new Date();
  const date = extractMentionedDate(question, reference);
  if (!date || !/\bwhat happened\b/i.test(question)) return false;

  if (!input.allTime && DATE_ONLY.test(String(input.dateFrom || "")) && DATE_ONLY.test(String(input.dateTo || "")) && (date < input.dateFrom || date > input.dateTo)) {
    throw requestError(`The mentioned date (${date}) is outside the selected reporting period. Change the report period and try again.`, 400, DATE_OUTSIDE_RANGE_CODE);
  }

  const startAt = `${date} 00:00:00`;
  const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const nextAt = `${next.toISOString().slice(0, 10)} 00:00:00`;
  const recorded = await repository.hasRecordedActivity({ startAt, nextAt, date });
  if (!recorded) throw requestError(`No recorded library activity was found for ${date}. Try another date or ask for a broader period summary.`, 400, DATE_NOT_RECORDED_CODE);
  return true;
}


function normalizeDateRange({ dateFrom, dateTo }, { allowLongRange = false } = {}) {
  if (!DATE_ONLY.test(String(dateFrom || "")) || !DATE_ONLY.test(String(dateTo || ""))) {
    throw requestError("Choose a valid start and end date.");
  }

  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (
    Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    || start.toISOString().slice(0, 10) !== dateFrom
    || end.toISOString().slice(0, 10) !== dateTo
  ) throw requestError("Choose a valid date range.");
  if (start > end) throw requestError("The start date must be on or before the end date.");
  if (!allowLongRange && Math.floor((end - start) / 86400000) + 1 > MAX_REPORT_DAYS) {
    throw requestError(`Reports can cover up to ${MAX_REPORT_DAYS} days.`);
  }

  return { dateFrom, dateTo, days: Math.floor((end - start) / 86400000) + 1 };
}


module.exports = { DATE_ONLY, DATE_OUTSIDE_RANGE_CODE, IRRELEVANT_QUESTION_CODE, IRRELEVANT_QUESTION_MESSAGE, MAX_REPORT_DAYS, PERIOD_ANALYSIS, PRIVACY_RESTRICTION_CODE, PRIVACY_RESTRICTION_MESSAGE, REPORT_INTENTS, REPORT_INTENT_NAMES, UNSUPPORTED_REQUEST, classifyReportQuestion, extractMentionedDate, isIdentitySeekingQuestion, isReportRelevantQuestion, normalizeDateRange, requestError, requireRecordedDateQuestion };

const db = require("../../db");
const { listUnsettledBorrowings } = require("../borrowing/overdue.helper");

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

async function resolveReportRange(input) {
  if (!input.allTime) return normalizeDateRange(input);
  const [[row]] = await db.query(
    `SELECT
       DATE_FORMAT(COALESCE(MIN(event_date), CURDATE()), '%Y-%m-%d') AS dateFrom,
       DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS dateTo
     FROM (
       SELECT MIN(borrowed_at) AS event_date FROM borrowings WHERE deleted_at IS NULL
       UNION ALL SELECT MIN(returned_at) FROM borrowings WHERE deleted_at IS NULL AND returned_at IS NOT NULL
       UNION ALL SELECT MIN(reserved_at) FROM reservations WHERE deleted_at IS NULL
       UNION ALL SELECT MIN(fulfilled_at) FROM reservations WHERE deleted_at IS NULL AND fulfilled_at IS NOT NULL
       UNION ALL SELECT MIN(cancelled_at) FROM reservations WHERE deleted_at IS NULL AND cancelled_at IS NOT NULL
       UNION ALL SELECT MIN(created_at) FROM attendance_logs
       UNION ALL SELECT MIN(visit_date) FROM site_daily_visits
       UNION ALL SELECT MIN(settled_at) FROM borrowings WHERE deleted_at IS NULL AND settled_at IS NOT NULL
     ) report_events`
  );
  return { ...normalizeDateRange(row, { allowLongRange: true }), allTime: true };
}

const number = (value) => Number(value || 0);
const totals = (row = {}) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, number(value)]));
const toDateOnly = (value) => {
  if (typeof value === "string" && DATE_ONLY.test(value.slice(0, 10))) return value.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value || "") : parsed.toISOString().slice(0, 10);
};

/**
 * Produces the only data that may be sent to the text model. Every value is
 * aggregated; identities, identifiers, IP addresses, user agents, and raw
 * event records deliberately never leave this service.
 */
async function buildAiReportEvidence(input) {
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

  const [
    circulationResult,
    reservationResult,
    attendanceResult,
    visitsResult,
    finesResult,
    topBooksResult,
    watchItemsResult,
    unsettledOverview,
    previousCirculationResult,
    previousReservationResult,
    previousAttendanceResult,
    previousVisitsResult,
    previousFinesResult,
    dailyActivityResult,
    topBorrowerResult,
  ] = await Promise.all([
    db.query(
      `SELECT
         SUM(borrowed_at >= ? AND borrowed_at < DATE_ADD(?, INTERVAL 1 DAY)) AS borrowed,
         SUM(returned_at IS NOT NULL AND returned_at >= ? AND returned_at < DATE_ADD(?, INTERVAL 1 DAY)) AS returned
       FROM borrowings WHERE deleted_at IS NULL`,
      [startAt, endExclusive, startAt, endExclusive]
    ),
    db.query(
      `SELECT
         SUM(reserved_at >= ? AND reserved_at < DATE_ADD(?, INTERVAL 1 DAY)) AS created,
         SUM(fulfilled_at IS NOT NULL AND fulfilled_at >= ? AND fulfilled_at < DATE_ADD(?, INTERVAL 1 DAY)) AS fulfilled,
         SUM(cancelled_at IS NOT NULL AND cancelled_at >= ? AND cancelled_at < DATE_ADD(?, INTERVAL 1 DAY)) AS cancelled
       FROM reservations WHERE deleted_at IS NULL`,
      [startAt, endExclusive, startAt, endExclusive, startAt, endExclusive]
    ),
    db.query(
      `SELECT
         SUM(purpose = 'entry_exit') AS entry_exit_scans,
         SUM(purpose = 'borrowing') AS borrowing_scans
       FROM attendance_logs
       WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [startAt, endExclusive]
    ),
    db.query(
      `SELECT COUNT(DISTINCT visitor_id) AS unique_visitors, COALESCE(SUM(hit_count), 0) AS page_hits
       FROM site_daily_visits WHERE visit_date >= ? AND visit_date <= ?`,
      [range.dateFrom, range.dateTo]
    ),
    db.query(
      `SELECT COALESCE(SUM(settled_amount), 0) AS settled_amount
       FROM borrowings
       WHERE deleted_at IS NULL AND settled_at IS NOT NULL
         AND settled_at >= ? AND settled_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [startAt, endExclusive]
    ),
    db.query(
      `SELECT bk.title AS title, COUNT(*) AS borrowings
       FROM borrowings b JOIN books bk ON bk.id = b.book_id
        WHERE b.deleted_at IS NULL AND b.borrowed_at >= ? AND b.borrowed_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY bk.id, bk.title ORDER BY borrowings DESC, bk.title ASC LIMIT 5`,
      [startAt, endExclusive]
    ),
    db.query(
      `SELECT
         (SELECT COUNT(*) FROM borrowings WHERE deleted_at IS NULL AND status = 'overdue') AS overdue_borrowings,
         (SELECT COUNT(*) FROM reservations WHERE deleted_at IS NULL AND status = 'ready') AS ready_reservations`
    ),
    listUnsettledBorrowings({ limit: null }),
    db.query(
      `SELECT
         SUM(borrowed_at >= ? AND borrowed_at < DATE_ADD(?, INTERVAL 1 DAY)) AS borrowed,
         SUM(returned_at IS NOT NULL AND returned_at >= ? AND returned_at < DATE_ADD(?, INTERVAL 1 DAY)) AS returned
       FROM borrowings WHERE deleted_at IS NULL`,
      [previousStartAt, previousEndAt, previousStartAt, previousEndAt]
    ),
    db.query(
      `SELECT
         SUM(reserved_at >= ? AND reserved_at < DATE_ADD(?, INTERVAL 1 DAY)) AS created,
         SUM(fulfilled_at IS NOT NULL AND fulfilled_at >= ? AND fulfilled_at < DATE_ADD(?, INTERVAL 1 DAY)) AS fulfilled,
         SUM(cancelled_at IS NOT NULL AND cancelled_at >= ? AND cancelled_at < DATE_ADD(?, INTERVAL 1 DAY)) AS cancelled
       FROM reservations WHERE deleted_at IS NULL`,
      [previousStartAt, previousEndAt, previousStartAt, previousEndAt, previousStartAt, previousEndAt]
    ),
    db.query(
      `SELECT
         SUM(purpose = 'entry_exit') AS entry_exit_scans,
         SUM(purpose = 'borrowing') AS borrowing_scans
       FROM attendance_logs
       WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [previousStartAt, previousEndAt]
    ),
    db.query(
      `SELECT COUNT(DISTINCT visitor_id) AS unique_visitors, COALESCE(SUM(hit_count), 0) AS page_hits
       FROM site_daily_visits WHERE visit_date >= ? AND visit_date <= ?`,
      [previousRange.dateFrom, previousRange.dateTo]
    ),
    db.query(
      `SELECT COALESCE(SUM(settled_amount), 0) AS settled_amount
       FROM borrowings
       WHERE deleted_at IS NULL AND settled_at IS NOT NULL
         AND settled_at >= ? AND settled_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [previousStartAt, previousEndAt]
    ),
    db.query(
      `SELECT day,
         SUM(borrowed) AS borrowed,
         SUM(returned) AS returned,
         SUM(entry_exit_scans) AS entry_exit_scans,
         SUM(library_entries) AS library_entries,
         SUM(unique_library_visitors) AS unique_library_visitors,
         SUM(borrowing_scans) AS borrowing_scans,
         SUM(unique_visitors) AS unique_visitors,
         SUM(page_hits) AS page_hits
       FROM (
          SELECT DATE_FORMAT(borrowed_at, '%Y-%m-%d') AS day, COUNT(*) AS borrowed, 0 AS returned, 0 AS entry_exit_scans, 0 AS library_entries, 0 AS unique_library_visitors, 0 AS borrowing_scans, 0 AS unique_visitors, 0 AS page_hits
          FROM borrowings WHERE deleted_at IS NULL AND borrowed_at >= ? AND borrowed_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY DATE_FORMAT(borrowed_at, '%Y-%m-%d')
         UNION ALL
         SELECT DATE_FORMAT(returned_at, '%Y-%m-%d'), 0, COUNT(*), 0, 0, 0, 0, 0, 0
         FROM borrowings WHERE deleted_at IS NULL AND returned_at IS NOT NULL AND returned_at >= ? AND returned_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY DATE_FORMAT(returned_at, '%Y-%m-%d')
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d'), 0, 0, SUM(purpose = 'entry_exit'), SUM(purpose = 'entry_exit' AND type = 'check_in'), COUNT(DISTINCT CASE WHEN purpose = 'entry_exit' AND type = 'check_in' THEN user_id END), SUM(purpose = 'borrowing'), 0, 0
         FROM attendance_logs WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
         UNION ALL
         SELECT DATE_FORMAT(visit_date, '%Y-%m-%d'), 0, 0, 0, 0, 0, 0, COUNT(DISTINCT visitor_id), COALESCE(SUM(hit_count), 0)
         FROM site_daily_visits WHERE visit_date >= ? AND visit_date <= ? GROUP BY DATE_FORMAT(visit_date, '%Y-%m-%d')
       ) daily
       GROUP BY day ORDER BY day ASC`,
      [startAt, endExclusive, startAt, endExclusive, startAt, endExclusive, range.dateFrom, range.dateTo]
    ),
    db.query(
      `SELECT u.name, COUNT(*) AS borrowings
       FROM borrowings b JOIN users u ON u.id = b.user_id AND u.deleted_at IS NULL
        WHERE b.deleted_at IS NULL AND b.borrowed_at >= ? AND b.borrowed_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY u.id, u.name ORDER BY borrowings DESC, u.name ASC LIMIT 1`,
      [startAt, endExclusive]
    ),
  ]);

  const [[circulation]] = circulationResult;
  const [[reservations]] = reservationResult;
  const [[attendance]] = attendanceResult;
  const [[visits]] = visitsResult;
  const [[fines]] = finesResult;
  const [[watchItems]] = watchItemsResult;
  const [[previousCirculation]] = previousCirculationResult;
  const [[previousReservations]] = previousReservationResult;
  const [[previousAttendance]] = previousAttendanceResult;
  const [[previousVisits]] = previousVisitsResult;
  const [[previousFines]] = previousFinesResult;
  const dailyRowsByDate = new Map(dailyActivityResult[0].map((row) => [toDateOnly(row.day), row]));
  const dailyActivity = range.allTime ? dailyActivityResult[0] : Array.from({ length: range.days }, (_, index) => {
    const date = new Date(`${range.dateFrom}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + index);
    return dailyRowsByDate.get(date.toISOString().slice(0, 10)) || { day: date.toISOString().slice(0, 10) };
  });
  const [topBorrower] = topBorrowerResult[0];

  return {
    range,
    previous_range: previousRange,
    activity: {
      circulation: totals(circulation),
      reservations: totals(reservations),
      attendance: totals(attendance),
      site_activity: totals(visits),
      fine_collections: totals(fines),
      top_borrowed_titles: topBooksResult[0].map((row) => ({ title: String(row.title || "Untitled"), borrowings: number(row.borrowings) })),
      top_borrower: topBorrower ? { name_token: "__TOP_BORROWER__", borrowings: number(topBorrower.borrowings) } : null,
      daily_activity: dailyActivity.map((row) => ({
        date: toDateOnly(row.day),
        borrowed: number(row.borrowed), returned: number(row.returned),
        entry_exit_scans: number(row.entry_exit_scans), library_entries: number(row.library_entries),
        unique_library_visitors: number(row.unique_library_visitors), borrowing_scans: number(row.borrowing_scans),
        unique_visitors: number(row.unique_visitors), page_hits: number(row.page_hits),
      })),
    },
    previous_activity: {
      circulation: totals(previousCirculation),
      reservations: totals(previousReservations),
      attendance: totals(previousAttendance),
      site_activity: totals(previousVisits),
      fine_collections: totals(previousFines),
    },
    current_watch_items: {
      ...totals(watchItems),
      outstanding_fines: number(unsettledOverview.summary.total_unsettled_amount),
    },
    private_labels: topBorrower ? { __TOP_BORROWER__: String(topBorrower.name) } : {},
  };
}

function cleanQuestion(question) {
  if (question === undefined || question === null) return "";
  if (typeof question !== "string") throw requestError("The report question must be text.");
  return question.trim().replace(/\s+/g, " ").slice(0, 500);
}

function reportPrompt(evidence, question) {
  const { private_labels: _privateLabels, ...modelEvidence } = evidence;
  if (question) return [
    "Answer the administrator's question using ONLY the evidence JSON below.",
    "Return only the direct answer as one or more short, self-contained sentences. Do not add a heading, introduction, summary, comparison, recommendation, or unrelated metric.",
    "Never return a bare number or name. Include the essential subject, value, and requested date or period so the answer remains understandable when copied by itself.",
    "Answer every part of the question in the same order it was asked. Be concise but include the requested names, dates, and counts.",
    "For a date-specific question, use daily_activity. If that date is outside the selected range or absent from the evidence, say that the requested data is unavailable.",
    "'Top user' means the patron with the most borrowings in the selected period. If asked for that person, reproduce the exact name_token from top_borrower; do not modify it.",
    "For questions such as 'how many people visited the library' or 'went in the library', use unique_library_visitors for that date. library_entries is the number of check-ins; entry_exit_scans includes both check-ins and check-outs. Do not substitute website unique_visitors unless the question explicitly asks about the website.",
    `Question: ${question}`,
    `Evidence JSON: ${JSON.stringify(modelEvidence)}`,
  ].join("\n\n");
  return [
    "You are an operations analyst writing a concise internal library performance brief.",
    "Use ONLY the JSON evidence below. Do not infer causes, add facts, mention personal data, or claim access to any other source.",
    evidence.range.allTime
      ? "This report covers the entire recorded history. Do not compare it with the period before records began; summarize the most important long-term totals and patterns instead."
      : "Do not restate every metric. Compare the selected period with the previous equal-length period and surface only the changes that matter.",
    `Write plain text with these short headings: Performance assessment, ${evidence.range.allTime ? "Key findings" : "What changed"}, Recommended follow-up.`,
    "Under What changed, give at most three evidence-backed findings. Explain the operational implication without inventing a cause.",
    "Under Recommended follow-up, give one or two concrete actions tied to the evidence. Current watch items are a snapshot at generation time, not selected-period activity.",
    "State the inclusive reporting dates exactly and make comparisons numerically precise. If a previous value is zero, use an absolute change instead of a percentage.",
    "If all selected-period activity counts are zero, clearly say that no recorded activity was found for the period.",
    "Keep the report neutral, practical, and under 220 words.",
    `Evidence JSON: ${JSON.stringify(modelEvidence)}`,
  ].join("\n\n");
}

async function generateReportText(evidence, question) {
  // Reports use a dedicated provider so the embedding configuration remains
  // independent. Gemini remains the default for backwards compatibility.
  const provider = String(process.env.AI_REPORT_PROVIDER || "gemini").trim().toLowerCase();
  let model;
  let url;
  let headers;
  let body;
  const prompt = reportPrompt(evidence, question);

  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) {
      throw requestError("Gemini AI reports are not configured. Set GEMINI_API_KEY on the server.", 503);
    }
    // Embedding models cannot generate reports. Keep the reporting model
    // separate from GEMINI_EMBEDDING_MODEL.
    model = process.env.GEMINI_REPORT_MODEL || "gemini-2.5-flash";
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    headers = { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY };
    body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 550 },
    });
  } else if (provider === "groq") {
    if (!process.env.GROQ_API_KEY) {
      throw requestError("Groq AI reports are not configured. Set GROQ_API_KEY on the server.", 503);
    }
    model = process.env.GROQ_REPORT_MODEL || "openai/gpt-oss-20b";
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` };
    body = JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      // GPT-OSS uses completion tokens for its internal reasoning as well as
      // the visible answer. A small cap can therefore end before it emits the
      // answer at all.
      max_tokens: 1000,
      reasoning_effort: "low",
      include_reasoning: false,
    });
  } else {
    throw requestError(`AI report provider "${provider}" is not supported. Use "gemini" or "groq".`, 503);
  }

  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(25000) });
    } catch (error) {
      console.error("[analytics] AI report connection failed:", error?.name || "Error", error?.cause?.code || error?.message || "unknown");
      if (attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1))); continue; }
      throw requestError("The AI report service could not be reached after several attempts. Try again shortly.", 503);
    }
    if (response.ok) break;
    const providerMessage = (await response.text()).slice(0, 500);
    if (response.status === 429) {
      console.error(`[analytics] ${provider} AI report quota reached:`, providerMessage);
      throw requestError(`${provider === "groq" ? "Groq" : "Gemini"}'s free-tier request limit has been reached. Wait for the quota to reset, then try again.`, 429);
    }
    if (response.status === 503 && attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1))); continue; }
    console.error("[analytics] AI report provider failed:", response.status, providerMessage);
    throw requestError(response.status === 503 ? `${provider === "groq" ? "Groq" : "Gemini"} is busy right now. The request was retried; please try again shortly.` : "The AI report service is unavailable. Try again shortly.", 503);
  }

  if (!response?.ok) throw requestError(`${provider === "groq" ? "Groq" : "Gemini"} is busy right now. The request was retried; please try again shortly.`, 503);

  const payload = await response.json();
  const groqContent = payload.choices?.[0]?.message?.content;
  const text = provider === "groq"
    ? (typeof groqContent === "string"
      ? groqContent.trim()
      : Array.isArray(groqContent)
        ? groqContent.map((part) => part?.text || "").join("\n").trim()
        : "")
    : payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
  if (!text) throw requestError("The AI report service returned an empty report. Try again.", 503);
  return text;
}

async function createAiAnalyticsReport(input) {
  const question = cleanQuestion(input.question);
  if (isIdentitySeekingQuestion(question)) {
    throw requestError(PRIVACY_RESTRICTION_MESSAGE, 400, PRIVACY_RESTRICTION_CODE);
  }
  const evidence = await buildAiReportEvidence(input);
  let report = await generateReportText(evidence, question);
  for (const [token, label] of Object.entries(evidence.private_labels || {})) report = report.split(token).join(label);
  report = report.replace(/\*\*(.*?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").trim();
  const { private_labels: _privateLabels, ...publicEvidence } = evidence;
  return { report, mode: question ? "answer" : "summary", range: evidence.range, evidence: publicEvidence };
}

module.exports = { buildAiReportEvidence, createAiAnalyticsReport, isIdentitySeekingQuestion, normalizeDateRange };

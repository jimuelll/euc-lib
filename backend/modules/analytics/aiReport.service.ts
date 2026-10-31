import { reportMetadata } from "./analytics.report-metadata.repository";
import { formatReport } from "./aiReport.format";
import { libraryDateKey, libraryDayRange } from "../time/library-time";
const repository = require("./analytics.repository");
const { buildAiReportEvidence, buildReportFacts, dateLabel, hasRecordedPeriodActivity, periodLabel, resolveReportRange } = require("./aiReport.evidence.service");
const { buildReportPrompt, correctionNote } = require("./aiReport.prompt.service");
const { classifyAmbiguousQuestion, generateReportText } = require("./aiReport.providers");
const { findUnverifiedFigures, normalizeMarkdown } = require("./aiReport.response.service");
const {
  IRRELEVANT_QUESTION_CODE, IRRELEVANT_QUESTION_MESSAGE, assessQuestion, classifyReportQuestion, cleanQuestion,
  extractMentionedDate, isIdentitySeekingQuestion, isReportRelevantQuestion, normalizeDateRange, requestError,
} = require("./aiReport.question.service");

type Mode = "summary" | "answer";
interface Draft { report: string; unverified: string[]; truncated: boolean; }

/**
 * Builds an AI analytics brief or answer in six steps:
 *   1. clean the question and resolve the selected UTC+08 range,
 *   2. apply the deterministic privacy, scope and date-range rules,
 *   3. consult the model scope check only when those rules cannot decide,
 *   4. gather aggregate evidence for the selected range,
 *   5. answer without the model when there is nothing recorded to describe,
 *   6. otherwise prompt the model, then verify and format what it wrote.
 */
async function createAiAnalyticsReport(input: Record<string, any>, actorId?: number): Promise<Record<string, any>> {
  const question = cleanQuestion(input.question);
  const range = await resolveReportRange(input);
  const assessment = assessQuestion(question, range);
  let intents: string[] | null = assessment.intents;
  if (intents === null) {
    const classification = await classifyAmbiguousQuestion(question);
    if (!classification.relevant) throw requestError(IRRELEVANT_QUESTION_MESSAGE, 400, IRRELEVANT_QUESTION_CODE);
    intents = classification.intents;
  }

  const evidence = await buildAiReportEvidence(input, range);
  const mode: Mode = assessment.mode;
  const comparisonAvailable = evidence.comparison?.available === true;
  const base = async (report: string, extra: Record<string, any> = {}) => ({
    ...(actorId ? await reportMetadata(actorId) : {}),
    report,
    mode,
    question: question || null,
    generatedAt: new Date().toISOString(),
    range: evidence.range,
    evidence,
    warnings: [] as string[],
    source: { kind: "rules" },
    ...extra,
  });

  const unrecorded = await unrecordedAnswer(question, assessment.periods, evidence);
  if (unrecorded) return base(formatReport(unrecorded, comparisonAvailable, { mode }));

  const facts = buildReportFacts(evidence, { intents, periods: assessment.periods });
  const prompt = buildReportPrompt(facts, question);
  const messages = [{ role: "user", content: prompt.user }];
  const write = async (history: Array<{ role: string; content: string }>): Promise<Draft & { provider: string; model: string }> => {
    const result = await generateReportText({ system: prompt.system, messages: history });
    const report = formatReport(normalizeMarkdown(result.text, mode), comparisonAvailable, { mode });
    return { report, unverified: findUnverifiedFigures(report, facts), truncated: result.truncated, provider: result.provider, model: result.model };
  };

  let draft = await write(messages);
  if (draft.unverified.length) {
    // One correction turn. Keep whichever draft quotes fewer unmatched figures.
    try {
      const revised = await write([...messages, { role: "assistant", content: draft.report }, { role: "user", content: correctionNote(draft.unverified) }]);
      if (revised.unverified.length < draft.unverified.length) draft = revised;
    } catch (error: any) {
      console.error("[analytics] AI report correction failed:", error?.code || error?.message || "unknown");
    }
  }

  const warnings: string[] = [];
  if (draft.unverified.length) warnings.push(`Some figures could not be matched to the report data (${draft.unverified.join(", ")}). Check them with the verification links before sharing.`);
  if (draft.truncated) warnings.push("The AI service stopped before finishing. The text may be incomplete; regenerate to try again.");
  return base(draft.report, { warnings, source: { kind: "model", provider: draft.provider, model: draft.model } });
}

/**
 * A deterministic answer when there is nothing recorded to describe: an empty
 * selected period for a brief, or empty days for a date-specific question.
 * Sending empty evidence to the model only invites invented activity.
 */
async function unrecordedAnswer(question: string, periods: Array<{ dateFrom: string; dateTo: string }>, evidence: Record<string, any>): Promise<string | null> {
  const { range } = evidence;
  if (!question) {
    if (hasRecordedPeriodActivity(evidence)) return null;
    const watch = evidence.current_watch_items || {};
    return [
      "## Performance assessment",
      "",
      `No recorded library activity was found for ${periodLabel(range.dateFrom, range.dateTo)} (UTC+08): no borrowings, returns, reservations, check-ins, website visits or fine collections.`,
      "",
      "## Recommended follow-up",
      "",
      `- Confirm that the attendance scanner and circulation desk were recording during this period, or choose a period with recorded activity.`,
      `- Current position on ${dateLabel(libraryDateKey())}: **${watch.overdue_borrowings || 0}** overdue loans and **${watch.ready_reservations || 0}** reservations ready for pickup.`,
    ].join("\n");
  }

  const days = periods.filter((period) => period.dateFrom === period.dateTo && period.dateFrom >= range.dateFrom && period.dateFrom <= range.dateTo).map((period) => period.dateFrom);
  if (!days.length || days.length !== periods.length) return null;
  for (const date of days) {
    const { start, end } = libraryDayRange(date);
    if (await repository.hasRecordedActivity({ startAt: start, nextAt: end, date })) return null;
  }
  return `No recorded library activity was found on ${days.map(dateLabel).join(", ")} (UTC+08): no borrowings, returns, reservations, check-ins, website visits or fine collections were recorded.`;
}

export = { buildAiReportEvidence, classifyAmbiguousQuestion, classifyReportQuestion, createAiAnalyticsReport, extractMentionedDate, isIdentitySeekingQuestion, isReportRelevantQuestion, normalizeDateRange };

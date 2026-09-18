const { buildAiReportEvidence } = require("./aiReport.evidence.service");
const { cleanQuestion } = require("./aiReport.prompt.service");
const { classifyAmbiguousQuestion, generateReportText } = require("./aiReport.providers");
const { DATE_OUTSIDE_RANGE_CODE, IRRELEVANT_QUESTION_CODE, IRRELEVANT_QUESTION_MESSAGE, PERIOD_ANALYSIS, PRIVACY_RESTRICTION_CODE, PRIVACY_RESTRICTION_MESSAGE, REPORT_INTENTS, UNSUPPORTED_REQUEST, classifyReportQuestion, extractMentionedDate, isIdentitySeekingQuestion, isReportRelevantQuestion, normalizeDateRange, requestError, requireRecordedDateQuestion } = require("./aiReport.question.service");

async function createAiAnalyticsReport(input) {
  const question = cleanQuestion(input.question);
  if (isIdentitySeekingQuestion(question)) {
    throw requestError(PRIVACY_RESTRICTION_MESSAGE, 400, PRIVACY_RESTRICTION_CODE);
  }
  if (question) {
    const hasReportTopic = REPORT_INTENTS.some(([, pattern]) => pattern.test(question)) || PERIOD_ANALYSIS.test(question);
    if (UNSUPPORTED_REQUEST.test(question) && !hasReportTopic) throw requestError(IRRELEVANT_QUESTION_MESSAGE, 400, IRRELEVANT_QUESTION_CODE);
    if (!isReportRelevantQuestion(question) || UNSUPPORTED_REQUEST.test(question)) {
      const recordedDateQuestion = !UNSUPPORTED_REQUEST.test(question) && !hasReportTopic
        ? await requireRecordedDateQuestion(question, input)
        : false;
      if (!recordedDateQuestion) {
        const classification = await classifyAmbiguousQuestion(question);
        if (!classification.relevant) throw requestError(IRRELEVANT_QUESTION_MESSAGE, 400, IRRELEVANT_QUESTION_CODE);
      }
    }
  }
  const evidence = await buildAiReportEvidence(input);
  let report = await generateReportText(evidence, question);
  for (const [token, label] of Object.entries(evidence.private_labels || {})) report = report.split(token).join(label);
  report = report.replace(/\*\*(.*?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").trim();
  const { private_labels: _privateLabels, ...publicEvidence } = evidence;
  return { report, mode: question ? "answer" : "summary", range: evidence.range, evidence: publicEvidence };
}


module.exports = { buildAiReportEvidence, classifyAmbiguousQuestion, classifyReportQuestion, createAiAnalyticsReport, extractMentionedDate, isIdentitySeekingQuestion, isReportRelevantQuestion, normalizeDateRange, requireRecordedDateQuestion };

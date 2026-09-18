const { requestError } = require("./aiReport.question.service");

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


module.exports = { cleanQuestion, reportPrompt };

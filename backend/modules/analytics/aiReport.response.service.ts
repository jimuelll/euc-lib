const { SUMMARY_HEADINGS } = require("./aiReport.prompt.service");

interface ParsedPayload { text: string; truncated: boolean; blocked: boolean; }

function parseProviderPayload(provider: string, payload: Record<string, any>): ParsedPayload {
  if (provider === "groq") {
    const choice = payload?.choices?.[0];
    const content = choice?.message?.content;
    const text = typeof content === "string"
      ? content.trim()
      : Array.isArray(content) ? content.map((part: any) => part?.text || "").join("\n").trim() : "";
    return { text, truncated: choice?.finish_reason === "length", blocked: choice?.finish_reason === "content_filter" };
  }
  const candidate = payload?.candidates?.[0];
  const text = (candidate?.content?.parts || []).filter((part: any) => !part?.thought).map((part: any) => part?.text || "").join("\n").trim();
  return {
    text,
    truncated: candidate?.finishReason === "MAX_TOKENS",
    blocked: Boolean(payload?.promptFeedback?.blockReason) || ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"].includes(candidate?.finishReason),
  };
}

/** Kept for callers that only need the text. */
function parseReportText(provider: string, payload: Record<string, any>): string {
  return parseProviderPayload(provider, payload).text;
}

const HEADING_NAMES = Object.values(SUMMARY_HEADINGS) as string[];
const headingPattern = new RegExp(String.raw`^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*(${HEADING_NAMES.join("|")})\s*:?\s*(?:\*\*|__)?\s*:?\s*$`, "i");

/**
 * Normalizes model Markdown into the subset the admin UI, print view and
 * saved briefs render: level-2 headings, "-" bullets, numbered lists and
 * paragraphs separated by blank lines.
 */
function normalizeMarkdown(text: string, mode: "summary" | "answer"): string {
  let lines = text
    .replace(/^\s*```(?:markdown|md)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, "").replace(/^(\s*)[*•]\s+/, "$1- "));

  if (mode === "summary") {
    lines = lines.map((line) => {
      const match = line.match(headingPattern);
      if (!match) return line.replace(/^#{1,6}\s+/, "## ");
      const name = HEADING_NAMES.find((heading) => heading.toLowerCase() === match[1].toLowerCase())!;
      return `## ${name}`;
    });
  } else {
    // Direct answers carry no headings.
    lines = lines.filter((line) => !/^\s*#{1,6}\s/.test(line));
  }

  const output: string[] = [];
  for (const line of lines) {
    const isHeading = /^## /.test(line);
    if (isHeading && output.length && output[output.length - 1] !== "") output.push("");
    output.push(line);
    if (isHeading) output.push("");
  }
  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Every figure the model may quote: numbers in the facts, plus numbers inside fact strings such as dates and titles. */
function allowedFigures(facts: unknown): number[] {
  const values = new Set<number>([0, 1, 2, 3]);
  const visit = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) { values.add(value); values.add(Math.abs(value)); return; }
    if (typeof value === "string") { for (const match of value.matchAll(/\d+(?:\.\d+)?/g)) values.add(Number(match[0])); return; }
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(facts);
  return [...values];
}

const FIGURE = /(?<![\w.])(?:₱\s?)?\d[\d,]*(?:\.\d+)?%?/g;

/**
 * Returns the figures in `text` that do not match any value in the facts at
 * the precision written. Dates written in UTC+08 notation are ignored.
 */
function findUnverifiedFigures(text: string, facts: unknown): string[] {
  const allowed = allowedFigures(facts);
  const unverified = new Set<string>();
  const scrubbed = text.replace(/\bUTC\s?[+-]\s?0?8(?::00)?\b/gi, " ");
  for (const match of scrubbed.matchAll(FIGURE)) {
    const written = match[0].trim();
    const digits = written.replace(/[₱,%\s]/g, "");
    if (!/^\d+(?:\.\d+)?$/.test(digits)) continue;
    const value = Number(digits);
    const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
    const factor = 10 ** decimals;
    const matches = allowed.some((candidate) => Math.abs(Math.round(candidate * factor) / factor - value) < 1e-9 || Math.abs(candidate - value) < 1e-9);
    if (!matches) unverified.add(written);
  }
  return [...unverified];
}

export = { allowedFigures, findUnverifiedFigures, normalizeMarkdown, parseProviderPayload, parseReportText };

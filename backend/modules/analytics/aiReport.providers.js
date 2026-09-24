const { requestError, REPORT_INTENT_NAMES } = require("./aiReport.question.service");
const { reportPrompt } = require("./aiReport.prompt.service");
const { parseReportText } = require("./aiReport.response.service");

async function classifyAmbiguousQuestion(question) {
  const provider = String(process.env.AI_REPORT_PROVIDER || "gemini").trim().toLowerCase();
  const prompt = [
    "Classify whether the entire user question can be answered using only aggregate library analytics.",
    `Allowed intents: ${REPORT_INTENT_NAMES.join(", ")}.`,
    "Available subjects are borrowing and returns, reservations, physical attendance, anonymized website activity, fine collections, catalog inventory, and period performance.",
    "Mark relevant=false if any requested part asks for external knowledge, standalone arithmetic, creative writing, advice, raw records, or information outside those subjects.",
    "Calculations such as totals, differences, averages, rates, ratios, and percentage changes are relevant when every input comes from the listed aggregate library analytics.",
    "Mark mixed=true when supported and unsupported requests are combined. Do not answer the question.",
    "Return JSON only with this exact shape: {\"relevant\":boolean,\"mixed\":boolean,\"intents\":string[]}.",
    `Question: ${question}`,
  ].join("\n");

  let url;
  let headers;
  let body;
  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) throw requestError("The AI report scope checker is not configured. Rephrase the question using a suggested analytics topic.", 503);
    const model = process.env.GEMINI_REPORT_MODEL || "gemini-2.5-flash";
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    headers = { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY };
    body = JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 160, responseMimeType: "application/json" } });
  } else if (provider === "groq") {
    if (!process.env.GROQ_API_KEY) throw requestError("The AI report scope checker is not configured. Rephrase the question using a suggested analytics topic.", 503);
    body = JSON.stringify({
      model: process.env.GROQ_REPORT_MODEL || "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 300,
      reasoning_effort: "low",
      include_reasoning: false,
      response_format: { type: "json_object" },
    });
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` };
  } else {
    throw requestError(`AI report provider "${provider}" is not supported. Use "gemini" or "groq".`, 503);
  }

  let response;
  try {
    response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
  } catch (error) {
    console.error("[analytics] AI report scope check failed:", error?.name || error?.message || "unknown");
    throw requestError("The question could not be verified as library-related. Rephrase it using a suggested analytics topic and try again.", 503);
  }
  if (!response.ok) {
    console.error("[analytics] AI report scope provider failed:", response.status, (await response.text()).slice(0, 300));
    throw requestError("The question could not be verified as library-related. Rephrase it using a suggested analytics topic and try again.", 503);
  }

  const payload = await response.json();
  const raw = provider === "groq"
    ? payload.choices?.[0]?.message?.content
    : payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  try {
    const parsed = JSON.parse(String(raw || "").replace(/^```(?:json)?\s*|\s*```$/gi, "").trim());
    const intents = Array.isArray(parsed.intents) ? parsed.intents.filter((intent) => REPORT_INTENT_NAMES.includes(intent)) : [];
    return { relevant: parsed.relevant === true && parsed.mixed !== true && intents.length > 0, mixed: parsed.mixed === true, intents };
  } catch {
    throw requestError("The question could not be verified as library-related. Rephrase it using a suggested analytics topic and try again.", 503);
  }
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
  const text = parseReportText(provider, payload);
  if (!text) throw requestError("The AI report service returned an empty report. Try again.", 503);
  return text;
}

module.exports = { classifyAmbiguousQuestion, generateReportText };

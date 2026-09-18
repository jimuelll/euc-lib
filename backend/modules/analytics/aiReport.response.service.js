function parseReportText(provider, payload) {
  const groqContent = payload.choices?.[0]?.message?.content;
  const text = provider === "groq"
    ? (typeof groqContent === "string"
      ? groqContent.trim()
      : Array.isArray(groqContent)
        ? groqContent.map((part) => part?.text || "").join("\n").trim()
        : "")
    : payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
  return text || "";
}

module.exports = { parseReportText };


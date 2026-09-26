function parseReportText(provider: string, payload: Record<string, any>): string {
  const groqContent = payload.choices?.[0]?.message?.content;
  const text = provider === "groq"
    ? (typeof groqContent === "string"
      ? groqContent.trim()
      : Array.isArray(groqContent)
        ? groqContent.map((part: any) => part?.text || "").join("\n").trim()
        : "")
    : payload.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("\n").trim();
  return text || "";
}

export = { parseReportText };

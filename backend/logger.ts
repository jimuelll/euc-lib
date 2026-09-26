function logError(context: string, error: unknown, ...details: unknown[]): void {
  const status = Number((error as { status?: unknown } | null | undefined)?.status);
  if (process.env.NODE_ENV === "production" && status >= 400 && status < 500) return;
  console.error(context, error, ...details);
}

function logDevelopment(...values: unknown[]): void {
  if (process.env.NODE_ENV !== "production") console.log(...values);
}

export = { logError, logDevelopment };

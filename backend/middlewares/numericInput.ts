function parsePositiveSafeInteger(value: unknown): number | null {
  const text = String(value ?? "");
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizePagination(
  page: unknown,
  limit: unknown,
  defaultLimit: number,
  maxLimit: number,
): { paged: boolean; safePage: number; safeLimit: number; offset: number } {
  const paged = page !== undefined && page !== null;
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const pageInteger = Number.isFinite(parsedPage) ? Math.trunc(parsedPage) : 1;
  const safeLimit = Math.min(maxLimit, Math.max(1, Number.isFinite(parsedLimit) && parsedLimit !== 0 ? Math.trunc(parsedLimit) : defaultLimit));
  const maxPage = Math.max(1, Math.floor(Number.MAX_SAFE_INTEGER / safeLimit));
  const safePage = Math.min(maxPage, Math.max(1, pageInteger));
  return { paged, safePage, safeLimit, offset: (safePage - 1) * safeLimit };
}

export = { normalizePagination, parsePositiveSafeInteger };

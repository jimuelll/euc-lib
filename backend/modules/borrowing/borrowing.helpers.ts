interface PaginationInput {
  page?: unknown;
  limit?: unknown;
}

function roundCurrency(value: unknown): number {
  return Number((Number(value) || 0).toFixed(2));
}

function getPagination({ page, limit }: PaginationInput, defaultLimit = 20, maxLimit = 100): {
  paged: boolean;
  safePage: number;
  safeLimit: number;
  offset: number;
} {
  const paged = Number.isFinite(Number(page));
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(maxLimit, Math.max(1, Number(limit) || defaultLimit));
  return { paged, safePage, safeLimit, offset: (safePage - 1) * safeLimit };
}

export = { getPagination, roundCurrency };

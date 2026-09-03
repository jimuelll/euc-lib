function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function getPagination({ page, limit }, defaultLimit = 20, maxLimit = 100) {
  const paged = Number.isFinite(Number(page));
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(maxLimit, Math.max(1, Number(limit) || defaultLimit));
  return { paged, safePage, safeLimit, offset: (safePage - 1) * safeLimit };
}

module.exports = { getPagination, roundCurrency };

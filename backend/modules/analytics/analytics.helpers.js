function buildDateLabels(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

function resolveDashboardRange(range) {
  if (range === "30d") return 30;
  if (range === "month") return Math.max(new Date().getDate(), 1);
  if (range === "year") {
    const now = new Date();
    return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
  }
  return 7;
}

function buildMonthLabels(months) {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - 1 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function normalizeSeries(rows, labels, fields) {
  const byLabel = new Map(rows.map((row) => [row.label, row]));
  return labels.map((label) => {
    const row = byLabel.get(label) || {};
    const point = { label };
    for (const field of fields) point[field] = Number(row[field] || 0);
    return point;
  });
}

module.exports = { buildDateLabels, buildMonthLabels, normalizeSeries, resolveDashboardRange };

const HOUR_MS = 60 * 60 * 1000;
const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

function calculateFine({ dueDate, finePerHour, fineInterval = "hour", initialFine = 0, now = new Date(), returnedAt = null }) {
  if (!dueDate) return { fineAmount: 0, hoursOverdue: 0, isOverdue: false };
  const elapsed = new Date(returnedAt || now).getTime() - new Date(dueDate).getTime();
  if (!Number.isFinite(elapsed) || elapsed <= 0) return { fineAmount: 0, hoursOverdue: 0, isOverdue: false };
  const hoursOverdue = Math.ceil(elapsed / HOUR_MS);
  const intervals = fineInterval === "day" ? Math.ceil(elapsed / (24 * HOUR_MS)) : hoursOverdue;
  return { fineAmount: roundCurrency(Number(initialFine || 0) + intervals * Number(finePerHour || 0)), hoursOverdue, isOverdue: true };
}

module.exports = { calculateFine, roundCurrency };

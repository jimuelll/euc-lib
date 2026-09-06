function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function normalizeIsbn(value) {
  return String(value || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

function validateIsbn(value) {
  const isbn = normalizeIsbn(value);
  const isbn10 = /^\d{9}[\dX]$/.test(isbn) && [...isbn].reduce((sum, digit, index) => sum + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0) % 11 === 0;
  const isbn13 = /^\d{13}$/.test(isbn) && [...isbn].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 === 0;
  if (!isbn10 && !isbn13) {
    throw httpError("Enter a valid ISBN-10 or ISBN-13", 400);
  }
  return isbn;
}

function validateBookTypeInput({ name, defaultBorrowDays, finePerHour, fineInterval = "hour", initialFine = 0 }) {
  const days = Number.parseInt(defaultBorrowDays, 10);
  const fine = Number(finePerHour);
  const initial = Number(initialFine);
  if (!name?.trim() || !Number.isInteger(days) || days < 1 || !Number.isFinite(fine) || fine < 0 || !["hour", "day"].includes(fineInterval) || !Number.isFinite(initial) || initial < 0) {
    throw httpError("Enter a valid policy with non-negative fines", 400);
  }
  return { name: name.trim(), days, fine, fineInterval, initial };
}

module.exports = { httpError, normalizeIsbn, validateBookTypeInput, validateIsbn };

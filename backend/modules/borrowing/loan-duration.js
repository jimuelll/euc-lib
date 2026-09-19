const { getHolidayDateSet } = require("../library-settings/library-settings.service");

function validateLoanDuration({ minutes, unit }) {
  const durationMinutes = Number(minutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 525600 || !["day", "hour"].includes(unit)) {
    throw Object.assign(new Error("Choose a loan duration from one minute to one year and a day or hour unit."), { status: 400 });
  }
  if (unit === "day" && durationMinutes % 1440 !== 0) throw Object.assign(new Error("Day-based loan limits must use whole days."), { status: 400 });
  return { minutes: durationMinutes, unit };
}

async function calculateLoanDueDate(borrowedAt, policy, conn) {
  const { minutes, unit } = validateLoanDuration(policy);
  const due = new Date(borrowedAt);
  if (unit === "hour") return new Date(due.getTime() + minutes * 60000);
  const holidays = await getHolidayDateSet(conn);
  let remainingDays = minutes / 1440;
  while (remainingDays > 0) {
    due.setDate(due.getDate() + 1);
    const key = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
    if (!holidays.has(key)) remainingDays -= 1;
  }
  return due;
}

module.exports = { validateLoanDuration, calculateLoanDueDate };

const repository = require("./borrowing.repository");
const notificationsService = require("../notifications/notifications.service");
const { getSettings, getHolidayDateSet } = require("../library-settings/library-settings.service");

const HOUR_MS = 60 * 60 * 1000;
const OVERDUE_REMINDER_INTERVAL_MS = HOUR_MS;
let ensuredBorrowingPaymentColumns = false;

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const ensureBorrowingPaymentColumns = async () => {
  if (ensuredBorrowingPaymentColumns) return;
  // Settlement columns are guaranteed by the migration baseline. Request handlers must never change schema.
  ensuredBorrowingPaymentColumns = true;
};

const toHolidayKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const calculateDueDateWithHolidays = async (borrowedAt, daysAllowed, conn) => {
  const holidayDateSet = await getHolidayDateSet(conn);
  const dueDate = new Date(borrowedAt);
  let countedDays = 0;
  while (countedDays < daysAllowed) {
    dueDate.setDate(dueDate.getDate() + 1);
    if (holidayDateSet.has(toHolidayKey(dueDate))) continue;
    countedDays += 1;
  }
  return dueDate;
};

const getFineDetails = ({ dueDate, finePerHour, fineInterval = "hour", initialFine = 0, now = new Date(), returnedAt = null, settledAmount = 0 }) => {
  if (!dueDate) return { isOverdue: false, hoursOverdue: 0, fineAmount: 0, settledAmount: 0, unsettledAmount: 0 };
  const dueAt = new Date(dueDate);
  const accrualEnd = returnedAt ? new Date(returnedAt) : now;
  const diffMs = accrualEnd.getTime() - dueAt.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return { isOverdue: false, hoursOverdue: 0, fineAmount: 0, settledAmount: roundCurrency(settledAmount), unsettledAmount: 0 };
  }
  const hoursOverdue = Math.ceil(diffMs / HOUR_MS);
  const intervalsOverdue = fineInterval === "day" ? Math.ceil(diffMs / (HOUR_MS * 24)) : hoursOverdue;
  const fineAmount = roundCurrency(Number(initialFine || 0) + intervalsOverdue * Number(finePerHour || 0));
  const normalisedSettledAmount = roundCurrency(settledAmount);
  return {
    isOverdue: true,
    hoursOverdue,
    fineAmount,
    settledAmount: normalisedSettledAmount,
    unsettledAmount: roundCurrency(Math.max(fineAmount - normalisedSettledAmount, 0)),
  };
};

const mapBorrowingsWithFineDetails = async (rows, conn) => {
  await ensureBorrowingPaymentColumns();
  const settings = await getSettings(conn);
  const now = new Date();
  return rows.map((row) => {
    const { isOverdue, hoursOverdue, fineAmount, settledAmount, unsettledAmount } = getFineDetails({
      dueDate: row.due_date,
      finePerHour: row.fine_per_hour ?? settings.overdue_fine_per_hour,
      fineInterval: row.fine_interval ?? "hour",
      initialFine: row.initial_fine ?? 0,
      now,
      returnedAt: row.returned_at,
      settledAmount: row.settled_amount,
    });
    return {
      ...row,
      hours_overdue: hoursOverdue,
      fine_amount: fineAmount,
      settled_amount: settledAmount,
      unsettled_amount: unsettledAmount,
      fine_per_hour: settings.overdue_fine_per_hour,
      status: row.status === "returned" ? row.status : (isOverdue ? "overdue" : row.status),
    };
  });
};

const syncOverdueBorrowings = async (conn) => {
  await ensureBorrowingPaymentColumns();
  const settings = await getSettings(conn);
  const rows = await repository.findOverdueCandidates(conn);
  for (const row of rows) {
    const { isOverdue, unsettledAmount } = getFineDetails({
      dueDate: row.due_date,
      finePerHour: row.fine_per_hour ?? settings.overdue_fine_per_hour,
      fineInterval: row.fine_interval ?? "hour",
      initialFine: row.initial_fine ?? 0,
      returnedAt: row.returned_at,
      settledAmount: row.settled_amount,
    });
    if (!isOverdue) continue;
    if (row.status !== "overdue") await repository.markOverdue(row.id, conn);
    const shouldNotifyAgain = unsettledAmount > 0 && (!row.last_overdue_notification_at || (Date.now() - new Date(row.last_overdue_notification_at).getTime()) >= OVERDUE_REMINDER_INTERVAL_MS);
    if (shouldNotifyAgain) {
      await notificationsService.createNotification({
        type: "overdue_fine",
        title: "Borrowed book is overdue",
        body: `"${row.title}" is overdue. Current unsettled balance: PHP ${unsettledAmount.toFixed(2)}. It continues to increase according to this book type's fine policy until the balance is settled or the book is returned.`,
        href: "/my-library",
        audienceType: "user",
        audienceUserId: row.user_id,
        sourceType: "borrowing",
        sourceId: row.id,
        replaceExisting: true,
      });
      await repository.markOverdueNotificationSent(row.id, conn);
    }
  }
};

const listUnsettledBorrowings = async ({ userId = null, limit = null, page = null } = {}, conn) => {
  await ensureBorrowingPaymentColumns();
  const rows = await repository.findBorrowingsForFineDetails(userId, conn);
  const mappedRows = await mapBorrowingsWithFineDetails(rows, conn);
  const unsettledRows = mappedRows.filter((row) => Number(row.unsettled_amount || 0) > 0).sort((left, right) => {
    const leftDate = new Date(left.returned_at ?? left.due_date ?? left.borrowed_at ?? 0).getTime();
    const rightDate = new Date(right.returned_at ?? right.due_date ?? right.borrowed_at ?? 0).getTime();
    return leftDate - rightDate;
  });
  const safeLimit = typeof limit === "number" ? Math.max(1, limit) : null;
  const safePage = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : null;
  const limitedRows = safeLimit ? unsettledRows.slice(safePage ? (safePage - 1) * safeLimit : 0, safePage ? safePage * safeLimit : safeLimit) : unsettledRows;
  const result = {
    rows: limitedRows,
    summary: {
      total_records: unsettledRows.length,
      affected_users: new Set(unsettledRows.map((row) => row.user_id)).size,
      total_unsettled_amount: roundCurrency(unsettledRows.reduce((sum, row) => sum + Number(row.unsettled_amount || 0), 0)),
    },
  };
  if (safePage && safeLimit) result.pagination = { page: safePage, limit: safeLimit, total: unsettledRows.length, totalPages: Math.ceil(unsettledRows.length / safeLimit) };
  return result;
};

module.exports = { ensureBorrowingPaymentColumns, calculateDueDateWithHolidays, getFineDetails, mapBorrowingsWithFineDetails, syncOverdueBorrowings, listUnsettledBorrowings };

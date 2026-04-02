const db = require("../../db");
const notificationsService = require("../notifications/notifications.service");
const { getSettings, getHolidayDateSet } = require("../librarySettings/librarySettings.service");

const HOUR_MS = 60 * 60 * 1000;
const OVERDUE_REMINDER_INTERVAL_MS = HOUR_MS;
let ensuredBorrowingPaymentColumns = false;

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const ensureBorrowingPaymentColumns = async (conn = db) => {
  if (ensuredBorrowingPaymentColumns) return;

  const [columns] = await conn.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'borrowings'
       AND COLUMN_NAME IN ('settled_amount', 'settled_at', 'settled_by')`
  );

  const existingColumns = new Set(columns.map((column) => column.COLUMN_NAME));

  if (!existingColumns.has("settled_amount")) {
    await conn.query(
      `ALTER TABLE borrowings
       ADD COLUMN settled_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER last_overdue_notification_at`
    );
  }

  if (!existingColumns.has("settled_at")) {
    await conn.query(
      `ALTER TABLE borrowings
       ADD COLUMN settled_at DATETIME DEFAULT NULL AFTER settled_amount`
    );
  }

  if (!existingColumns.has("settled_by")) {
    await conn.query(
      `ALTER TABLE borrowings
       ADD COLUMN settled_by BIGINT UNSIGNED DEFAULT NULL AFTER settled_at`
    );
  }

  ensuredBorrowingPaymentColumns = true;
};

const toHolidayKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const calculateDueDateWithHolidays = async (borrowedAt, daysAllowed, conn = db) => {
  const holidayDateSet = await getHolidayDateSet(conn);
  const dueDate = new Date(borrowedAt);
  let countedDays = 0;

  while (countedDays < daysAllowed) {
    dueDate.setDate(dueDate.getDate() + 1);

    if (holidayDateSet.has(toHolidayKey(dueDate))) {
      continue;
    }

    countedDays += 1;
  }

  return dueDate;
};

const getFineDetails = ({ dueDate, finePerHour, now = new Date(), returnedAt = null, settledAmount = 0 }) => {
  if (!dueDate) {
    return { isOverdue: false, hoursOverdue: 0, fineAmount: 0, settledAmount: 0, unsettledAmount: 0 };
  }

  const dueAt = new Date(dueDate);
  const accrualEnd = returnedAt ? new Date(returnedAt) : now;
  const diffMs = accrualEnd.getTime() - dueAt.getTime();

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return {
      isOverdue: false,
      hoursOverdue: 0,
      fineAmount: 0,
      settledAmount: roundCurrency(settledAmount),
      unsettledAmount: 0,
    };
  }

  const hoursOverdue = Math.ceil(diffMs / HOUR_MS);
  const fineAmount = roundCurrency(hoursOverdue * Number(finePerHour || 0));
  const normalisedSettledAmount = roundCurrency(settledAmount);

  return {
    isOverdue: true,
    hoursOverdue,
    fineAmount,
    settledAmount: normalisedSettledAmount,
    unsettledAmount: roundCurrency(Math.max(fineAmount - normalisedSettledAmount, 0)),
  };
};

const mapBorrowingsWithFineDetails = async (rows, conn = db) => {
  await ensureBorrowingPaymentColumns(conn);
  const settings = await getSettings(conn);
  const now = new Date();

  return rows.map((row) => {
    const { isOverdue, hoursOverdue, fineAmount, settledAmount, unsettledAmount } = getFineDetails({
      dueDate: row.due_date,
      finePerHour: settings.overdue_fine_per_hour,
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

const syncOverdueBorrowings = async (conn = db) => {
  await ensureBorrowingPaymentColumns(conn);
  const settings = await getSettings(conn);
  const [rows] = await conn.query(
    `SELECT
       b.id,
       b.user_id,
       b.status,
       b.due_date,
       b.returned_at,
       b.last_overdue_notification_at,
       COALESCE(b.settled_amount, 0) AS settled_amount,
       bk.title
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     WHERE b.deleted_at IS NULL
       AND b.status IN ('borrowed', 'overdue')`
  );

  for (const row of rows) {
    const { isOverdue, fineAmount, unsettledAmount } = getFineDetails({
      dueDate: row.due_date,
      finePerHour: settings.overdue_fine_per_hour,
      returnedAt: row.returned_at,
      settledAmount: row.settled_amount,
    });

    if (!isOverdue) {
      continue;
    }

    if (row.status !== "overdue") {
      await conn.query(
        `UPDATE borrowings
         SET status = 'overdue'
         WHERE id = ?`,
        [row.id]
      );
    }

    const shouldNotifyAgain = unsettledAmount > 0 && (
      !row.last_overdue_notification_at ||
      (Date.now() - new Date(row.last_overdue_notification_at).getTime()) >= OVERDUE_REMINDER_INTERVAL_MS
    );

    if (shouldNotifyAgain) {
      await notificationsService.createNotification({
        type: "overdue_fine",
        title: "Borrowed book is overdue",
        body: `"${row.title}" is overdue. Current unsettled balance: PHP ${unsettledAmount.toFixed(2)}. It increases every hour until the balance is settled or the book is returned.`,
        href: "/my-library",
        audienceType: "user",
        audienceUserId: row.user_id,
      });

      await conn.query(
        `UPDATE borrowings
         SET last_overdue_notification_at = NOW()
         WHERE id = ?`,
        [row.id]
      );
    }
  }
};

const listUnsettledBorrowings = async ({ userId = null, limit = null } = {}, conn = db) => {
  await ensureBorrowingPaymentColumns(conn);

  const params = [];
  let userWhere = "";
  if (userId !== null && userId !== undefined) {
    userWhere = "AND b.user_id = ?";
    params.push(userId);
  }

  const [rows] = await conn.query(
    `SELECT
       b.id,
       b.user_id,
       b.status,
       b.borrowed_at,
       b.due_date,
       b.returned_at,
       b.last_overdue_notification_at,
       COALESCE(b.settled_amount, 0) AS settled_amount,
       b.settled_at,
       b.settled_by,
       u.name AS user_name,
       u.student_employee_id,
       bk.title AS book_title,
       bk.author AS book_author,
       bk.isbn,
       bc.barcode AS copy_barcode
     FROM borrowings b
     JOIN users u ON u.id = b.user_id AND u.deleted_at IS NULL
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     WHERE b.deleted_at IS NULL
       ${userWhere}
     ORDER BY COALESCE(b.returned_at, b.due_date) ASC, b.id ASC`,
    params
  );

  const mappedRows = await mapBorrowingsWithFineDetails(rows, conn);
  const unsettledRows = mappedRows
    .filter((row) => Number(row.unsettled_amount || 0) > 0)
    .sort((left, right) => {
      const leftDate = new Date(left.returned_at ?? left.due_date ?? left.borrowed_at ?? 0).getTime();
      const rightDate = new Date(right.returned_at ?? right.due_date ?? right.borrowed_at ?? 0).getTime();
      return leftDate - rightDate;
    });

  const limitedRows = typeof limit === "number" ? unsettledRows.slice(0, Math.max(limit, 0)) : unsettledRows;

  return {
    rows: limitedRows,
    summary: {
      total_records: unsettledRows.length,
      affected_users: new Set(unsettledRows.map((row) => row.user_id)).size,
      total_unsettled_amount: roundCurrency(
        unsettledRows.reduce((sum, row) => sum + Number(row.unsettled_amount || 0), 0)
      ),
    },
  };
};

module.exports = {
  ensureBorrowingPaymentColumns,
  calculateDueDateWithHolidays,
  getFineDetails,
  mapBorrowingsWithFineDetails,
  syncOverdueBorrowings,
  listUnsettledBorrowings,
};

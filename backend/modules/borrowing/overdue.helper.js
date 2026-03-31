const db = require("../../db");
const notificationsService = require("../notifications/notifications.service");
const { getSettings, getHolidayDateSet } = require("../librarySettings/librarySettings.service");

const HOUR_MS = 60 * 60 * 1000;

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

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

const getFineDetails = ({ dueDate, finePerHour, now = new Date() }) => {
  if (!dueDate) {
    return { isOverdue: false, hoursOverdue: 0, fineAmount: 0 };
  }

  const dueAt = new Date(dueDate);
  const diffMs = now.getTime() - dueAt.getTime();

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return { isOverdue: false, hoursOverdue: 0, fineAmount: 0 };
  }

  const hoursOverdue = Math.ceil(diffMs / HOUR_MS);
  return {
    isOverdue: true,
    hoursOverdue,
    fineAmount: roundCurrency(hoursOverdue * Number(finePerHour || 0)),
  };
};

const mapBorrowingsWithFineDetails = async (rows, conn = db) => {
  const settings = await getSettings(conn);
  const now = new Date();

  return rows.map((row) => {
    const { isOverdue, hoursOverdue, fineAmount } = getFineDetails({
      dueDate: row.due_date,
      finePerHour: settings.overdue_fine_per_hour,
      now,
    });

    return {
      ...row,
      hours_overdue: hoursOverdue,
      fine_amount: fineAmount,
      fine_per_hour: settings.overdue_fine_per_hour,
      status: row.status === "returned" ? row.status : (isOverdue ? "overdue" : row.status),
    };
  });
};

const syncOverdueBorrowings = async (conn = db) => {
  const settings = await getSettings(conn);
  const [rows] = await conn.query(
    `SELECT b.id, b.user_id, b.status, b.due_date, b.last_overdue_notification_at, bk.title
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     WHERE b.deleted_at IS NULL
       AND b.status IN ('borrowed', 'overdue')`
  );

  for (const row of rows) {
    const { isOverdue, fineAmount } = getFineDetails({
      dueDate: row.due_date,
      finePerHour: settings.overdue_fine_per_hour,
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

    if (!row.last_overdue_notification_at) {
      await notificationsService.createNotification({
        type: "overdue_fine",
        title: "Borrowed book is overdue",
        body: `"${row.title}" is overdue. Current fine: PHP ${fineAmount.toFixed(2)} and it increases every hour until the book is returned.`,
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

module.exports = {
  calculateDueDateWithHolidays,
  getFineDetails,
  mapBorrowingsWithFineDetails,
  syncOverdueBorrowings,
};

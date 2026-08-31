const db = require("../../db");
const { syncOverdueBorrowings, listUnsettledBorrowings } = require("../borrowing/overdue.helper");
const notificationsService = require("../notifications/notifications.service");

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const ensureClearanceTables = async (conn = db) => {
  await conn.query(`CREATE TABLE IF NOT EXISTS clearance_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    receipt_number VARCHAR(48) NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    transaction_type ENUM('payment', 'adjustment', 'reversal') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash') NULL,
    reason TEXT NULL,
    reverses_transaction_id BIGINT UNSIGNED NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_clearance_receipt_number (receipt_number),
    KEY idx_clearance_user_created (user_id, created_at), KEY idx_clearance_reversal (reverses_transaction_id),
    CONSTRAINT fk_clearance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_clearance_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_clearance_reverses FOREIGN KEY (reverses_transaction_id) REFERENCES clearance_transactions(id) ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await conn.query(`CREATE TABLE IF NOT EXISTS clearance_transaction_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    transaction_id BIGINT UNSIGNED NOT NULL, borrowing_id INT NOT NULL, amount DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id), KEY idx_clearance_item_borrowing (borrowing_id), KEY idx_clearance_item_transaction (transaction_id),
    CONSTRAINT fk_clearance_item_transaction FOREIGN KEY (transaction_id) REFERENCES clearance_transactions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_clearance_item_borrowing FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
};

const buildStatus = async (userId, conn = db) => {
  const [overdueRows] = await conn.query(
    `SELECT b.id, bk.title, b.due_date
     FROM borrowings b JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     WHERE b.user_id = ? AND b.status = 'overdue' AND b.deleted_at IS NULL
     ORDER BY b.due_date ASC`, [userId]
  );
  const fines = await listUnsettledBorrowings({ userId }, conn);
  const reasons = [];
  if (overdueRows.length) reasons.push(`${overdueRows.length} overdue item${overdueRows.length === 1 ? "" : "s"} must be returned`);
  if (fines.summary.total_unsettled_amount > 0) reasons.push(`PHP ${fines.summary.total_unsettled_amount.toFixed(2)} outstanding fine${fines.summary.total_unsettled_amount === 1 ? "" : "s"}`);
  return { status: reasons.length ? "blocked" : "eligible", reasons, overdueItems: overdueRows, fineRows: fines.rows, outstandingAmount: fines.summary.total_unsettled_amount };
};

const getClearanceProfile = async (studentEmployeeId) => {
  await ensureClearanceTables();
  await syncOverdueBorrowings();
  const [[user]] = await db.query(
    `SELECT id, name, role, student_employee_id, is_active FROM users
     WHERE student_employee_id = ? AND deleted_at IS NULL LIMIT 1`, [String(studentEmployeeId).trim()]
  );
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  const clearance = await buildStatus(user.id);
  const [reservations] = await db.query(
    `SELECT r.id, r.status, r.reserved_at, r.expires_at, bk.title AS book_title
     FROM reservations r JOIN books bk ON bk.id = r.book_id AND bk.deleted_at IS NULL
     WHERE r.user_id = ? AND r.status IN ('pending', 'ready') AND r.deleted_at IS NULL
     ORDER BY r.reserved_at DESC`, [user.id]
  );
  const [transactions] = await db.query(
    `SELECT ct.id, ct.receipt_number, ct.transaction_type, ct.amount, ct.reason, ct.created_at,
       EXISTS(SELECT 1 FROM clearance_transactions reversed WHERE reversed.reverses_transaction_id = ct.id) AS corrected
     FROM clearance_transactions ct WHERE ct.user_id = ? ORDER BY ct.created_at DESC, ct.id DESC LIMIT 12`, [user.id]
  );
  return { user, ...clearance, reservations, transactions };
};

const getClearanceQueue = async () => {
  await ensureClearanceTables();
  await syncOverdueBorrowings();
  const [overdueRows] = await db.query(
    `SELECT u.id AS user_id, u.name, u.student_employee_id,
       COUNT(b.id) AS overdue_count, MIN(b.due_date) AS oldest_due_date,
       GROUP_CONCAT(bk.title ORDER BY b.due_date ASC SEPARATOR ' | ') AS overdue_titles
     FROM borrowings b
     JOIN users u ON u.id = b.user_id AND u.deleted_at IS NULL
     JOIN books bk ON bk.id = b.book_id AND bk.deleted_at IS NULL
     WHERE b.deleted_at IS NULL AND b.status = 'overdue'
     GROUP BY u.id, u.name, u.student_employee_id
     ORDER BY oldest_due_date ASC`
  );
  const fines = await listUnsettledBorrowings();
  const queue = new Map();

  for (const row of overdueRows) {
    queue.set(row.user_id, {
      userId: row.user_id,
      name: row.name,
      studentEmployeeId: row.student_employee_id,
      overdueCount: Number(row.overdue_count),
      oldestDueDate: row.oldest_due_date,
      overdueTitles: row.overdue_titles ? row.overdue_titles.split(" | ") : [],
      outstandingAmount: 0,
      fineRecords: 0,
    });
  }
  for (const fine of fines.rows) {
    const existing = queue.get(fine.user_id) || {
      userId: fine.user_id,
      name: fine.user_name,
      studentEmployeeId: fine.student_employee_id,
      overdueCount: 0,
      oldestDueDate: null,
      overdueTitles: [],
      outstandingAmount: 0,
      fineRecords: 0,
    };
    existing.outstandingAmount = roundCurrency(existing.outstandingAmount + Number(fine.unsettled_amount));
    existing.fineRecords += 1;
    queue.set(fine.user_id, existing);
  }

  return Array.from(queue.values()).sort((left, right) => {
    if (right.overdueCount !== left.overdueCount) return right.overdueCount - left.overdueCount;
    if (right.outstandingAmount !== left.outstandingAmount) return right.outstandingAmount - left.outstandingAmount;
    return String(left.name).localeCompare(String(right.name));
  });
};

const assertEligible = async (userId, conn = db) => {
  const profile = await buildStatus(userId, conn);
  if (profile.status === "blocked") {
    throw Object.assign(new Error(`Clearance required: ${profile.reasons.join("; ")}`), { status: 409, clearance: profile });
  }
  return profile;
};

const createTransaction = async ({ userId, type, amount, method = null, reason = null, createdBy, reversesTransactionId = null, allocations }, conn) => {
  const [result] = await conn.query(
    `INSERT INTO clearance_transactions (receipt_number, user_id, transaction_type, amount, payment_method, reason, reverses_transaction_id, created_by)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, amount, method, reason, reversesTransactionId, createdBy]
  );
  const id = result.insertId;
  const receiptNumber = type === "payment" ? `CLR-${new Date().getFullYear()}-${String(id).padStart(7, "0")}` : null;
  if (receiptNumber) await conn.query("UPDATE clearance_transactions SET receipt_number = ? WHERE id = ?", [receiptNumber, id]);
  for (const allocation of allocations) {
    await conn.query("INSERT INTO clearance_transaction_items (transaction_id, borrowing_id, amount) VALUES (?, ?, ?)", [id, allocation.borrowingId, allocation.amount]);
    await conn.query("UPDATE borrowings SET settled_amount = GREATEST(0, settled_amount + ?), settled_at = NOW(), settled_by = ? WHERE id = ?", [allocation.amount, createdBy, allocation.borrowingId]);
  }
  return { id, receiptNumber };
};

const recordFullPayment = async ({ studentEmployeeId, createdBy }) => {
  await syncOverdueBorrowings();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureClearanceTables(conn);
    const [[user]] = await conn.query("SELECT id, name, student_employee_id FROM users WHERE student_employee_id = ? AND deleted_at IS NULL FOR UPDATE", [String(studentEmployeeId).trim()]);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    const fines = await listUnsettledBorrowings({ userId: user.id }, conn);
    const amount = fines.summary.total_unsettled_amount;
    if (amount <= 0) throw Object.assign(new Error("This user has no outstanding fines"), { status: 409 });
    const transaction = await createTransaction({ userId: user.id, type: "payment", amount, method: "cash", createdBy, allocations: fines.rows.map((row) => ({ borrowingId: row.id, amount: row.unsettled_amount })) }, conn);
    await conn.commit();
    const clearance = await getClearanceProfile(user.student_employee_id);
    await notificationsService.createNotification({ type: "payment_settled", title: "Payment received", body: `A cash payment of PHP ${amount.toFixed(2)} was recorded for your library fines.`, href: "/my-library", audienceType: "user", audienceUserId: user.id, createdBy });
    return { message: "Full payment recorded", receiptNumber: transaction.receiptNumber, transactionId: transaction.id, amount, clearance };
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
};

const adjustFine = async ({ borrowingId, amount, reason, createdBy }) => {
  const reduction = roundCurrency(amount);
  if (reduction <= 0 || !String(reason || "").trim()) throw Object.assign(new Error("A positive reduction and written reason are required"), { status: 400 });
  await syncOverdueBorrowings();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction(); await ensureClearanceTables(conn);
    const [[borrowing]] = await conn.query("SELECT id, user_id FROM borrowings WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [borrowingId]);
    if (!borrowing) throw Object.assign(new Error("Borrowing not found"), { status: 404 });
    const fines = await listUnsettledBorrowings({ userId: borrowing.user_id }, conn);
    const row = fines.rows.find((item) => Number(item.id) === Number(borrowingId));
    if (!row || reduction > Number(row.unsettled_amount)) throw Object.assign(new Error("Reduction cannot exceed this borrowing's outstanding fine"), { status: 409 });
    const tx = await createTransaction({ userId: borrowing.user_id, type: "adjustment", amount: reduction, reason: String(reason).trim(), createdBy, allocations: [{ borrowingId, amount: reduction }] }, conn);
    await conn.commit(); return { message: "Fine adjustment recorded", transactionId: tx.id };
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
};

const reverseTransaction = async ({ transactionId, reason, createdBy }) => {
  if (!String(reason || "").trim()) throw Object.assign(new Error("A written correction reason is required"), { status: 400 });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction(); await ensureClearanceTables(conn);
    const [[tx]] = await conn.query("SELECT * FROM clearance_transactions WHERE id = ? FOR UPDATE", [transactionId]);
    if (!tx) throw Object.assign(new Error("Transaction not found"), { status: 404 });
    if (tx.transaction_type === "reversal") throw Object.assign(new Error("A reversal cannot be reversed"), { status: 409 });
    const [[existing]] = await conn.query("SELECT id FROM clearance_transactions WHERE reverses_transaction_id = ? LIMIT 1", [transactionId]);
    if (existing) throw Object.assign(new Error("This transaction has already been corrected"), { status: 409 });
    const [items] = await conn.query("SELECT borrowing_id, amount FROM clearance_transaction_items WHERE transaction_id = ?", [transactionId]);
    const reversal = await createTransaction({ userId: tx.user_id, type: "reversal", amount: -Number(tx.amount), reason: String(reason).trim(), createdBy, reversesTransactionId: transactionId, allocations: items.map((item) => ({ borrowingId: item.borrowing_id, amount: -Number(item.amount) })) }, conn);
    await conn.commit(); return { message: "Transaction corrected", transactionId: reversal.id };
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
};

const getReceipt = async (receiptNumber) => {
  await ensureClearanceTables();
  const [[transaction]] = await db.query(`SELECT ct.*, u.name AS user_name, u.student_employee_id, staff.name AS recorded_by_name
    FROM clearance_transactions ct JOIN users u ON u.id = ct.user_id LEFT JOIN users staff ON staff.id = ct.created_by
    WHERE ct.receipt_number = ? LIMIT 1`, [receiptNumber]);
  if (!transaction) throw Object.assign(new Error("Receipt not found"), { status: 404 });
  const [items] = await db.query(`SELECT cti.amount, bk.title AS book_title FROM clearance_transaction_items cti
    JOIN borrowings b ON b.id = cti.borrowing_id JOIN books bk ON bk.id = b.book_id WHERE cti.transaction_id = ?`, [transaction.id]);
  return { transaction, items };
};

module.exports = { ensureClearanceTables, getClearanceProfile, getClearanceQueue, assertEligible, recordFullPayment, adjustFine, reverseTransaction, getReceipt };

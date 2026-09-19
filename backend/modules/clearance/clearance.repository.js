const db = require("../../db");
const fineLedger = require("../borrowing/fine-ledger.service");

function getConnection() {
  return db.getConnection();
}

async function findUserByStudentEmployeeId(studentEmployeeId, conn = db) {
  const [[user]] = await conn.query(
    `SELECT u.id, u.name, u.role, u.student_employee_id, u.is_active, p.name AS program_course
     FROM users u
     LEFT JOIN academic_programs p ON p.id = u.program_id
     WHERE u.student_employee_id = ? AND u.deleted_at IS NULL LIMIT 1`,
    [String(studentEmployeeId).trim()]
  );
  return user || null;
}

async function findActiveUser(userId, conn) {
  const [[user]] = await conn.query(
    "SELECT id, is_active FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
    [userId]
  );
  return user || null;
}

async function findOverdueBorrowings(userId, conn = db) {
  const [rows] = await conn.query(
    `SELECT b.id, bk.title, b.due_date
     FROM borrowings b JOIN books bk ON bk.id = b.book_id
     WHERE b.user_id = ? AND b.status = 'overdue' AND b.deleted_at IS NULL
     ORDER BY b.due_date ASC`,
    [userId]
  );
  return rows;
}

async function findUserReservations(userId) {
  const [rows] = await db.query(
    `SELECT r.id, r.status, r.reserved_at, r.expires_at, bk.title AS book_title
     FROM reservations r JOIN books bk ON bk.id = r.book_id
     WHERE r.user_id = ? AND r.status IN ('pending', 'ready') AND r.deleted_at IS NULL
     ORDER BY r.reserved_at DESC`,
    [userId]
  );
  return rows;
}

async function findUserTransactions(userId) {
  const [rows] = await db.query(
    `SELECT ct.id, ct.receipt_number, ct.transaction_type, ct.amount, ct.reason, ct.created_at,
       EXISTS(SELECT 1 FROM clearance_transactions reversed WHERE reversed.reverses_transaction_id = ct.id) AS corrected
     FROM clearance_transactions ct
     WHERE ct.user_id = ?
     ORDER BY ct.created_at DESC, ct.id DESC LIMIT 12`,
    [userId]
  );
  return rows;
}

async function findQueueOverdueBorrowings() {
  const [rows] = await db.query(
    `SELECT u.id AS user_id, u.name, u.student_employee_id,
       COUNT(b.id) AS overdue_count, MIN(b.due_date) AS oldest_due_date,
       GROUP_CONCAT(bk.title ORDER BY b.due_date ASC SEPARATOR ' | ') AS overdue_titles
     FROM borrowings b
     JOIN users u ON u.id = b.user_id AND u.deleted_at IS NULL
     JOIN books bk ON bk.id = b.book_id
     WHERE b.deleted_at IS NULL AND b.status = 'overdue'
     GROUP BY u.id, u.name, u.student_employee_id
     ORDER BY oldest_due_date ASC`
  );
  return rows;
}

async function findUserForPayment(studentEmployeeId, conn) {
  const [[user]] = await conn.query(
    "SELECT id, name, student_employee_id FROM users WHERE student_employee_id = ? AND deleted_at IS NULL FOR UPDATE",
    [String(studentEmployeeId).trim()]
  );
  return user || null;
}

async function findBorrowingForAdjustment(borrowingId, conn) {
  const [[borrowing]] = await conn.query(
    "SELECT id, user_id FROM borrowings WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
    [borrowingId]
  );
  return borrowing || null;
}

async function createTransaction({ userId, type, amount, method = null, reason = null, createdBy, reversesTransactionId = null, allocations }, conn) {
  const [result] = await conn.query(
    `INSERT INTO clearance_transactions (receipt_number, user_id, transaction_type, amount, payment_method, reason, reverses_transaction_id, created_by)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, amount, method, reason, reversesTransactionId, createdBy]
  );
  const id = result.insertId;
  const receiptNumber = type === "payment" ? `CLR-${new Date().getFullYear()}-${String(id).padStart(7, "0")}` : null;
  if (receiptNumber) {
    await conn.query("UPDATE clearance_transactions SET receipt_number = ? WHERE id = ?", [receiptNumber, id]);
  }
  for (const allocation of allocations) {
    await conn.query(
      "INSERT INTO clearance_transaction_items (transaction_id, borrowing_id, amount) VALUES (?, ?, ?)",
      [id, allocation.borrowingId, allocation.amount]
    );
    const [[item]] = await conn.query("SELECT id FROM clearance_transaction_items WHERE transaction_id = ? AND borrowing_id = ? ORDER BY id DESC LIMIT 1", [id, allocation.borrowingId]);
    await fineLedger.postTransactionItem({ borrowingId: allocation.borrowingId, itemId: item.id, kind: type, amount: allocation.amount }, conn);
    await conn.query(
      "UPDATE borrowings SET settled_amount = GREATEST(0, settled_amount + ?), settled_at = NOW(), settled_by = ? WHERE id = ?",
      [allocation.amount, createdBy, allocation.borrowingId]
    );
  }
  return { id, receiptNumber };
}

async function findTransactionForReverse(transactionId, conn) {
  const [[transaction]] = await conn.query(
    "SELECT * FROM clearance_transactions WHERE id = ? FOR UPDATE",
    [transactionId]
  );
  return transaction || null;
}

async function findExistingReversal(transactionId, conn) {
  const [[reversal]] = await conn.query(
    "SELECT id FROM clearance_transactions WHERE reverses_transaction_id = ? LIMIT 1",
    [transactionId]
  );
  return reversal || null;
}

async function findTransactionItems(transactionId, conn) {
  const [items] = await conn.query(
    "SELECT borrowing_id, amount FROM clearance_transaction_items WHERE transaction_id = ?",
    [transactionId]
  );
  return items;
}

async function findReceipt(receiptNumber) {
  const [[transaction]] = await db.query(
    `SELECT ct.*, u.name AS user_name, u.student_employee_id, p.name AS program_course, staff.name AS recorded_by_name
     FROM clearance_transactions ct
     JOIN users u ON u.id = ct.user_id
     LEFT JOIN academic_programs p ON p.id = u.program_id
     LEFT JOIN users staff ON staff.id = ct.created_by
     WHERE ct.receipt_number = ? LIMIT 1`,
    [receiptNumber]
  );
  return transaction || null;
}

async function findReceiptItems(transactionId) {
  const [items] = await db.query(
    `SELECT cti.amount, bk.title AS book_title
     FROM clearance_transaction_items cti
     JOIN borrowings b ON b.id = cti.borrowing_id
     JOIN books bk ON bk.id = b.book_id
     WHERE cti.transaction_id = ?`,
    [transactionId]
  );
  return items;
}

module.exports = {
  getConnection,
  findUserByStudentEmployeeId,
  findActiveUser,
  findOverdueBorrowings,
  findUserReservations,
  findUserTransactions,
  findQueueOverdueBorrowings,
  findUserForPayment,
  findBorrowingForAdjustment,
  createTransaction,
  findTransactionForReverse,
  findExistingReversal,
  findTransactionItems,
  findReceipt,
  findReceiptItems,
};

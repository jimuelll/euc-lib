import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  BorrowingForAdjustment,
  ClearanceReservation,
  ClearanceTransaction,
  ClearanceTransactionItem,
  ClearanceUser,
  ClearanceUserTransaction,
  CreateTransactionInput,
  CreateTransactionResult,
  LockedClearanceUser,
  OverdueBorrowing,
  PaymentUser,
  QueueOverdueBorrowing,
  ReceiptItem,
} from "./clearance.types";

const db = require("../../db") as Pool;
const fineLedger = require("../borrowing/fine-ledger.service");
type QueryConnection = Pool | PoolConnection;

const getConnection = (): Promise<PoolConnection> => db.getConnection();

const findUserByStudentEmployeeId = async (studentEmployeeId: string, conn: QueryConnection = db): Promise<ClearanceUser | null> => {
  const [rows] = await conn.query<ClearanceUser[]>(
    `SELECT u.id, u.name, u.role, u.student_employee_id, u.is_active, p.name AS program_course
     FROM users u
     LEFT JOIN academic_programs p ON p.id = u.program_id
     WHERE u.student_employee_id = ? AND u.deleted_at IS NULL LIMIT 1`,
    [String(studentEmployeeId).trim()],
  );
  return rows[0] ?? null;
};

const findActiveUser = async (userId: number, conn: PoolConnection): Promise<ClearanceUser | null> => {
  const [rows] = await conn.query<ClearanceUser[]>(
    "SELECT id, is_active FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
    [userId],
  );
  return rows[0] ?? null;
};

const findOverdueBorrowings = async (userId: number, conn: QueryConnection = db): Promise<OverdueBorrowing[]> => {
  const [rows] = await conn.query<OverdueBorrowing[]>(
    `SELECT b.id, bk.title, b.due_date
     FROM borrowings b JOIN books bk ON bk.id = b.book_id
     WHERE b.user_id = ? AND b.status = 'overdue' AND b.deleted_at IS NULL
     ORDER BY b.due_date ASC`,
    [userId],
  );
  return rows;
};

const findUserReservations = async (userId: number): Promise<ClearanceReservation[]> => {
  const [rows] = await db.query<ClearanceReservation[]>(
    `SELECT r.id, r.status, r.reserved_at, r.expires_at, bk.title AS book_title
     FROM reservations r JOIN books bk ON bk.id = r.book_id
     WHERE r.user_id = ? AND r.status IN ('pending', 'ready') AND r.deleted_at IS NULL
       AND (r.expires_at IS NULL OR r.expires_at > NOW())
     ORDER BY r.reserved_at DESC`,
    [userId],
  );
  return rows;
};

const findUserTransactions = async (userId: number): Promise<ClearanceUserTransaction[]> => {
  const [rows] = await db.query<ClearanceUserTransaction[]>(
    `SELECT ct.id, ct.receipt_number, ct.transaction_type, ct.amount, ct.reason, ct.created_at,
       EXISTS(SELECT 1 FROM clearance_transactions reversed WHERE reversed.reverses_transaction_id = ct.id) AS corrected
     FROM clearance_transactions ct
     WHERE ct.user_id = ?
     ORDER BY ct.created_at DESC, ct.id DESC LIMIT 12`,
    [userId],
  );
  return rows;
};

const findQueueOverdueBorrowings = async (): Promise<QueueOverdueBorrowing[]> => {
  const [rows] = await db.query<QueueOverdueBorrowing[]>(
    `SELECT u.id AS user_id, u.name, u.student_employee_id,
       COUNT(b.id) AS overdue_count, MIN(b.due_date) AS oldest_due_date,
       GROUP_CONCAT(bk.title ORDER BY b.due_date ASC SEPARATOR ' | ') AS overdue_titles
     FROM borrowings b
     JOIN users u ON u.id = b.user_id AND u.deleted_at IS NULL
     JOIN books bk ON bk.id = b.book_id
     WHERE b.deleted_at IS NULL AND b.status = 'overdue'
     GROUP BY u.id, u.name, u.student_employee_id
     ORDER BY oldest_due_date ASC`,
  );
  return rows;
};

const findUserForPayment = async (studentEmployeeId: string, conn: PoolConnection): Promise<PaymentUser | null> => {
  const [rows] = await conn.query<PaymentUser[]>(
    "SELECT id, name, student_employee_id FROM users WHERE student_employee_id = ? AND deleted_at IS NULL FOR UPDATE",
    [String(studentEmployeeId).trim()],
  );
  return rows[0] ?? null;
};

const findBorrowingForAdjustment = async (borrowingId: number, conn: PoolConnection): Promise<BorrowingForAdjustment | null> => {
  const [rows] = await conn.query<BorrowingForAdjustment[]>("SELECT id, user_id, deleted_at FROM borrowings WHERE id = ? FOR UPDATE", [borrowingId]);
  return rows[0] ?? null;
};

const createTransaction = async ({ userId, type, amount, method = null, reason = null, createdBy, reversesTransactionId = null, allocations }: CreateTransactionInput, conn: PoolConnection): Promise<CreateTransactionResult> => {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO clearance_transactions (receipt_number, user_id, transaction_type, amount, payment_method, reason, reverses_transaction_id, created_by)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, amount, method, reason, reversesTransactionId, createdBy],
  );
  const id = result.insertId;
  const receiptNumber = type === "payment" ? `CLR-${new Date().getFullYear()}-${String(id).padStart(7, "0")}` : null;
  if (receiptNumber) await conn.query("UPDATE clearance_transactions SET receipt_number = ? WHERE id = ?", [receiptNumber, id]);

  for (const allocation of allocations) {
    await conn.query(
      "INSERT INTO clearance_transaction_items (transaction_id, borrowing_id, amount) VALUES (?, ?, ?)",
      [id, allocation.borrowingId, allocation.amount],
    );
    const [itemRows] = await conn.query<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM clearance_transaction_items WHERE transaction_id = ? AND borrowing_id = ? ORDER BY id DESC LIMIT 1",
      [id, allocation.borrowingId],
    );
    await fineLedger.postTransactionItem({ borrowingId: allocation.borrowingId, itemId: itemRows[0].id, kind: type, amount: allocation.amount }, conn);
    await conn.query(
      "UPDATE borrowings SET settled_amount = GREATEST(0, settled_amount + ?), settled_at = NOW(), settled_by = ? WHERE id = ?",
      [allocation.amount, createdBy, allocation.borrowingId],
    );
  }
  return { id, receiptNumber };
};

const findTransactionForReverse = async (transactionId: number, conn: PoolConnection): Promise<ClearanceTransaction | null> => {
  const [rows] = await conn.query<ClearanceTransaction[]>("SELECT * FROM clearance_transactions WHERE id = ? FOR UPDATE", [transactionId]);
  return rows[0] ?? null;
};

const lockUserForFineChange = async (userId: number, conn: PoolConnection): Promise<LockedClearanceUser | null> => {
  const [rows] = await conn.query<LockedClearanceUser[]>("SELECT id, is_active, deleted_at FROM users WHERE id = ? FOR UPDATE", [userId]);
  return rows[0] ?? null;
};

const findExistingReversal = async (transactionId: number, conn: PoolConnection): Promise<(RowDataPacket & { id: number }) | null> => {
  const [rows] = await conn.query<Array<RowDataPacket & { id: number }>>("SELECT id FROM clearance_transactions WHERE reverses_transaction_id = ? LIMIT 1", [transactionId]);
  return rows[0] ?? null;
};

const findTransactionItems = async (transactionId: number, conn: PoolConnection): Promise<ClearanceTransactionItem[]> => {
  const [items] = await conn.query<ClearanceTransactionItem[]>("SELECT borrowing_id, amount FROM clearance_transaction_items WHERE transaction_id = ?", [transactionId]);
  return items;
};

const findReceipt = async (receiptNumber: string): Promise<(ClearanceTransaction & { user_name: string; student_employee_id: string; program_course: string | null; recorded_by_name: string | null }) | null> => {
  const [rows] = await db.query<Array<ClearanceTransaction & { user_name: string; student_employee_id: string; program_course: string | null; recorded_by_name: string | null }>>(
    `SELECT ct.*, u.name AS user_name, u.student_employee_id, p.name AS program_course, staff.name AS recorded_by_name
     FROM clearance_transactions ct
     JOIN users u ON u.id = ct.user_id
     LEFT JOIN academic_programs p ON p.id = u.program_id
     LEFT JOIN users staff ON staff.id = ct.created_by
     WHERE ct.receipt_number = ? LIMIT 1`,
    [receiptNumber],
  );
  return rows[0] ?? null;
};

const findReceiptItems = async (transactionId: number): Promise<ReceiptItem[]> => {
  const [items] = await db.query<ReceiptItem[]>(
    `SELECT cti.amount, bk.title AS book_title
     FROM clearance_transaction_items cti
     JOIN borrowings b ON b.id = cti.borrowing_id
     JOIN books bk ON bk.id = b.book_id
     WHERE cti.transaction_id = ?`,
    [transactionId],
  );
  return items;
};

export = {
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
  lockUserForFineChange,
  findExistingReversal,
  findTransactionItems,
  findReceipt,
  findReceiptItems,
};

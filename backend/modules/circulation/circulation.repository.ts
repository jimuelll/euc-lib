import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  ActiveBorrow,
  BorrowingNotificationTarget,
  CirculationBook,
  CirculationLogOptions,
  CirculationLogRow,
  CirculationUser,
  RenewalBorrowing,
  ReturnBorrowing,
} from "./circulation.types";

const db = require("../../db") as Pool;
const { activeLendableCopy, hasAccession, availableToBorrow, hasActiveBookPolicy } = require("../catalog/copyEligibility");
type QueryConnection = Pool | PoolConnection;

const getConnection = (): Promise<PoolConnection> => db.getConnection();

const findUser = async (studentEmployeeId: string): Promise<CirculationUser | null> => {
  const [rows] = await db.query<CirculationUser[]>(
    `SELECT id, name, student_employee_id, role, is_active
       FROM users
      WHERE student_employee_id = ? AND deleted_at IS NULL`,
    [studentEmployeeId],
  );
  return rows[0] ?? null;
};

const findActiveBorrows = async (userId: number): Promise<ActiveBorrow[]> => {
  const [rows] = await db.query<ActiveBorrow[]>(
    `SELECT b.id, bk.title, bk.author, b.due_date, b.status
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id
      WHERE b.user_id = ? AND b.deleted_at IS NULL AND b.status IN ('borrowed', 'overdue')
      ORDER BY b.due_date ASC`,
    [userId],
  );
  return rows;
};

const findBookByIsbn = async (isbn: string): Promise<CirculationBook | null> => {
  const [rows] = await db.query<CirculationBook[]>(
    `SELECT bk.id, bk.title, bk.author, bk.isbn, bk.copies, bk.material_type,
            CASE WHEN bk.material_type = 'book' AND ${hasActiveBookPolicy("bk")} AND EXISTS (SELECT 1 FROM book_copies reserve_copy WHERE reserve_copy.book_id = bk.id AND ${activeLendableCopy("reserve_copy")} AND ${hasAccession("reserve_copy", "reserve_h")}) THEN TRUE ELSE FALSE END AS canReserve,
            CASE WHEN bk.material_type = 'book' AND EXISTS (SELECT 1 FROM book_copies borrow_copy WHERE borrow_copy.book_id = bk.id AND ${availableToBorrow("borrow_copy")}) THEN TRUE ELSE FALSE END AS canBorrow,
            (SELECT COUNT(*) FROM book_copies eligible WHERE eligible.book_id = bk.id AND ${availableToBorrow("eligible")}) AS available
       FROM books bk
      WHERE bk.isbn = ? AND bk.deleted_at IS NULL
      GROUP BY bk.id`,
    [isbn],
  );
  return rows[0] ?? null;
};

const getBorrowingNotificationTarget = async (borrowingId: number, conn: QueryConnection = db): Promise<BorrowingNotificationTarget | null> => {
  const [rows] = await conn.query<BorrowingNotificationTarget[]>(
    `SELECT b.id, b.user_id, bk.title
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id
      WHERE b.id = ?
      LIMIT 1`,
    [borrowingId],
  );
  return rows[0] ?? null;
};

const getBorrowingForReturn = async (borrowingId: number, conn: PoolConnection): Promise<ReturnBorrowing | null> => {
  const [rows] = await conn.query<ReturnBorrowing[]>(
    `SELECT b.id, b.status, b.user_id, b.book_id, b.copy_id, b.due_date, b.returned_at,
            b.fine_per_hour, b.fine_interval, b.initial_fine, bk.title, bc.barcode
       FROM borrowings b JOIN books bk ON bk.id = b.book_id
       LEFT JOIN book_copies bc ON bc.id = b.copy_id
      WHERE b.id = ? AND b.deleted_at IS NULL FOR UPDATE`,
    [borrowingId],
  );
  return rows[0] ?? null;
};

const markReturned = async (borrowingId: number, conn: PoolConnection): Promise<number> => {
  const [result] = await conn.query<ResultSetHeader>("UPDATE borrowings SET status = 'returned', returned_at = NOW() WHERE id = ? AND deleted_at IS NULL AND status IN ('borrowed','overdue')", [borrowingId]);
  return result.affectedRows;
};

const getBorrowingForRenewal = async (borrowingId: number, conn: PoolConnection): Promise<RenewalBorrowing | null> => {
  const [rows] = await conn.query<RenewalBorrowing[]>(
    `SELECT b.id, b.user_id, b.status, b.due_date, b.loan_duration_minutes,
            b.loan_duration_unit, bk.title, (bt.id IS NOT NULL) AS has_active_policy
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id
       LEFT JOIN book_types bt ON bt.id = bk.book_type_id AND bt.is_active = 1
      WHERE b.id = ? AND b.deleted_at IS NULL
      FOR UPDATE`,
    [borrowingId],
  );
  return rows[0] ?? null;
};

const renewBorrowing = async (borrowingId: number, dueDate: Date | string, conn: PoolConnection): Promise<number> => {
  const [result] = await conn.query<ResultSetHeader>(
    "UPDATE borrowings SET due_date = ?, status = 'borrowed' WHERE id = ? AND deleted_at IS NULL AND status IN ('borrowed', 'overdue')",
    [dueDate, borrowingId],
  );
  return result.affectedRows;
};

const getCirculationLog = async ({ status = "", search = "", page, limit }: CirculationLogOptions): Promise<{ rows: CirculationLogRow[]; total: number }> => {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status && ["borrowed", "overdue", "returned"].includes(status)) { conditions.push("b.status = ?"); params.push(status); }
  if (search.trim()) {
    conditions.push("(u.name LIKE ? OR u.student_employee_id LIKE ? OR bk.title LIKE ? OR bk.isbn LIKE ?)");
    const like = `%${search.trim()}%`;
    params.push(like, like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [countRows] = await db.query<Array<RowDataPacket & { total: number | string }>>(
    `SELECT COUNT(*) AS total
       FROM borrowings b
       JOIN users u ON u.id = b.user_id
       JOIN books bk ON bk.id = b.book_id
       ${where}`,
    params,
  );
  const [rows] = await db.query<CirculationLogRow[]>(
    `SELECT b.id, u.name AS user_name, u.student_employee_id,
            bk.title AS book_title, bk.author AS book_author, bk.isbn,
            b.borrowed_at, b.due_date, b.returned_at, b.status,
            iss.name AS issued_by_name
       FROM borrowings b
       JOIN users u ON u.id = b.user_id
       JOIN books bk ON bk.id = b.book_id
       LEFT JOIN users iss ON iss.id = b.issued_by
       ${where}
      ORDER BY b.borrowed_at DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { rows, total: Number(countRows[0].total) };
};

export = {
  getConnection,
  findUser,
  findActiveBorrows,
  findBookByIsbn,
  getBorrowingNotificationTarget,
  getBorrowingForReturn,
  markReturned,
  getBorrowingForRenewal,
  renewBorrowing,
  getCirculationLog,
};

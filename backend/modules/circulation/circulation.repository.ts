import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { RenewalBorrowing } from "./circulation.types";

const db = require("../../db") as Pool;

const getConnection = (): Promise<PoolConnection> => db.getConnection();

const getBorrowingForRenewal = async (borrowingId: number, conn: PoolConnection): Promise<RenewalBorrowing | null> => {
  const [rows] = await conn.query<RenewalBorrowing[]>(
    `SELECT b.id, b.user_id, b.book_id, b.status, b.due_date, b.renewal_count, b.returned_at, b.fine_per_hour, b.fine_interval, b.initial_fine, b.loan_duration_minutes,
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

const countOtherOpenReservations = async (bookId: number, userId: number, conn: PoolConnection): Promise<number> => {
  const [rows] = await conn.query<Array<RowDataPacket & { total: number | string }>>(
    `SELECT COUNT(*) AS total FROM reservations
      WHERE book_id = ? AND user_id <> ? AND status IN ('pending', 'ready')
        AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
    [bookId, userId],
  );
  return Number(rows[0]?.total ?? 0);
};

const renewBorrowing = async (borrowingId: number, dueDate: Date | string, conn: PoolConnection): Promise<number> => {
  const [result] = await conn.query<ResultSetHeader>(
    "UPDATE borrowings SET due_date = ?, status = 'borrowed', renewal_count = renewal_count + 1 WHERE id = ? AND deleted_at IS NULL AND status IN ('borrowed', 'overdue')",
    [dueDate, borrowingId],
  );
  return result.affectedRows;
};

export = {
  getConnection,
  getBorrowingForRenewal,
  renewBorrowing,
  countOtherOpenReservations,
};

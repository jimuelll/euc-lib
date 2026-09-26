import type { Pool, RowDataPacket } from "mysql2/promise";
import catalogProjection = require("../catalog/catalog.projection");
const { metadataValue } = catalogProjection;
import type {
  ActiveBorrowRow,
  ActiveReservationRow,
  AttendanceLogRow,
  BorrowHistoryRow,
  HistoryItemRow,
  ReservationHistoryRow,
  UserProfileRow,
} from "./my-library.types";

const db = require("../../db") as Pool;

interface UserBarcodeRow extends RowDataPacket {
  barcode: string;
}

interface HistoryCountRow extends RowDataPacket {
  total: number | string;
}

const findUserProfile = async (userId: number): Promise<UserProfileRow | null> => {
  const [[user]] = await db.query<UserProfileRow[]>(
    `SELECT id, name, role, student_employee_id, email, profile_picture, address, contact
     FROM users
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  return user ?? null;
};

const findUserBarcode = async (userId: number): Promise<string | null> => {
  const [[user]] = await db.query<UserBarcodeRow[]>(
    `SELECT COALESCE(NULLIF(TRIM(barcode), ''), student_employee_id) AS barcode
     FROM users
     WHERE id = ? AND is_active = 1 AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  return user?.barcode ?? null;
};

const findActiveBorrows = async (userId: number): Promise<ActiveBorrowRow[]> => {
  const [rows] = await db.query<ActiveBorrowRow[]>(
    `SELECT
       b.id,
       bk.title,
       bk.author,
       ${metadataValue("bk", "category")},
       h.location,
       b.borrowed_at,
       b.due_date,
       b.status,
       b.notes,
       bc.barcode AS copy_barcode
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id AND bc.deleted_at IS NULL
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     WHERE b.user_id = ?
       AND b.status IN ('borrowed', 'overdue')
       AND b.deleted_at IS NULL
     ORDER BY b.due_date ASC, b.borrowed_at DESC`,
    [userId],
  );
  return rows;
};

const findBorrowHistory = async (userId: number): Promise<BorrowHistoryRow[]> => {
  const [rows] = await db.query<BorrowHistoryRow[]>(
    `SELECT
       b.id,
       bk.title,
       bk.author,
       b.borrowed_at,
       b.returned_at,
       b.due_date,
       b.status,
       bc.id AS copy_id,
       bc.barcode AS copy_barcode,
       h.accession_number
     FROM borrowings b
     JOIN books bk ON bk.id = b.book_id
     LEFT JOIN book_copies bc ON bc.id = b.copy_id
     LEFT JOIN copy_holdings h ON h.copy_id = bc.id
     WHERE b.user_id = ?
       AND b.status = 'returned'
       AND b.deleted_at IS NULL
     ORDER BY b.returned_at DESC
     LIMIT 50`,
    [userId],
  );
  return rows;
};

const findActiveReservations = async (userId: number): Promise<ActiveReservationRow[]> => {
  const [rows] = await db.query<ActiveReservationRow[]>(
    `SELECT
       r.id,
       bk.title,
       bk.author,
       h.location,
       r.status,
       r.reserved_at,
       r.expires_at,
       r.notes
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     LEFT JOIN copy_holdings h ON h.copy_id = r.reserved_copy_id
     WHERE r.user_id = ?
       AND r.status IN ('pending', 'ready')
       AND r.deleted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > NOW())
     ORDER BY r.reserved_at DESC`,
    [userId],
  );
  return rows;
};

const findReservationHistory = async (userId: number): Promise<ReservationHistoryRow[]> => {
  const [rows] = await db.query<ReservationHistoryRow[]>(
    `SELECT
       r.id,
       bk.title,
       bk.author,
       r.status,
       r.reserved_at,
       r.expires_at,
       r.fulfilled_at,
       r.cancelled_at
     FROM reservations r
     JOIN books bk ON bk.id = r.book_id
     WHERE r.user_id = ?
       AND r.status IN ('cancelled', 'expired', 'fulfilled')
       AND r.deleted_at IS NULL
     ORDER BY r.reserved_at DESC
     LIMIT 50`,
    [userId],
  );
  return rows;
};

const findAttendanceLogs = async (userId: number): Promise<AttendanceLogRow[]> => {
  const [rows] = await db.query<AttendanceLogRow[]>(
    `SELECT id, type, created_at AS timestamp
     FROM attendance_logs
     WHERE user_id = ? AND purpose = 'entry_exit'
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId],
  );
  return rows;
};

const getHistory = async (userId: number, page: number, limit: number) => {
  const [[{ total }]] = await db.query<HistoryCountRow[]>(
    `SELECT (
       (SELECT COUNT(*) FROM borrowings WHERE user_id = ? AND status = 'returned' AND deleted_at IS NULL) +
       (SELECT COUNT(*) FROM reservations WHERE user_id = ? AND status IN ('cancelled', 'expired', 'fulfilled') AND deleted_at IS NULL)
     ) AS total`,
    [userId, userId],
  );
  const [rows] = await db.query<HistoryItemRow[]>(
    `SELECT * FROM (
       SELECT b.id, bk.title, bk.author, 'borrowing' AS kind, b.status,
              b.returned_at AS occurred_at, b.borrowed_at, b.returned_at, NULL AS reserved_at,
              bc.id AS copy_id, bc.barcode AS copy_barcode, h.accession_number
       FROM borrowings b
       JOIN books bk ON bk.id = b.book_id
       LEFT JOIN book_copies bc ON bc.id = b.copy_id
       LEFT JOIN copy_holdings h ON h.copy_id = bc.id
       WHERE b.user_id = ? AND b.status = 'returned' AND b.deleted_at IS NULL
       UNION ALL
       SELECT r.id, bk.title, bk.author, 'reservation' AS kind, r.status,
              COALESCE(r.fulfilled_at, r.cancelled_at, r.reserved_at) AS occurred_at,
              NULL AS borrowed_at, NULL AS returned_at, r.reserved_at,
              NULL AS copy_id, NULL AS copy_barcode, NULL AS accession_number
       FROM reservations r
       JOIN books bk ON bk.id = r.book_id
       WHERE r.user_id = ? AND r.status IN ('cancelled', 'expired', 'fulfilled') AND r.deleted_at IS NULL
     ) AS history
     ORDER BY occurred_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [userId, userId, limit, (page - 1) * limit],
  );
  return { rows, total: Number(total) };
};

const findAllAttendanceLogs = async (userId: number): Promise<AttendanceLogRow[]> => {
  const [rows] = await db.query<AttendanceLogRow[]>(
    `SELECT id, type, created_at AS timestamp
     FROM attendance_logs
     WHERE user_id = ? AND purpose = 'entry_exit'
     ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
};

export = {
  findUserProfile,
  findUserBarcode,
  findActiveBorrows,
  findBorrowHistory,
  findActiveReservations,
  findReservationHistory,
  findAttendanceLogs,
  getHistory,
  findAllAttendanceLogs,
};

import type { Pool, RowDataPacket } from 'mysql2/promise';
const db = require('../../db') as Pool;
const overdue = require('../borrowing/overdue.helper');
const clearance = require('../clearance/clearance.repository');

export interface PatronLoan extends RowDataPacket {
  id: number; book_id: number; book_title: string; copy_barcode: string | null;
  accession_number: string | null; borrowed_at: string; due_date: string;
  status: 'borrowed' | 'overdue';
}
export interface PatronFine extends RowDataPacket {
  id: number; book_title: string; copy_barcode: string | null;
  fine_amount: number; settled_amount: number; unsettled_amount: number;
}
export interface PatronBorrowing {
  activeLoans: PatronLoan[]; fineRows: PatronFine[];
  activeReservations: Array<{id: number; book_title: string; status: string; expires_at: string | null}>;
  summary: {activeLoans: number; overdueLoans: number; unpaidFines: number; activeReservations: number};
}

export async function getPatronBorrowing(identifier: string, allowedRoles: string[]): Promise<PatronBorrowing> {
  const [[user]] = await db.query<RowDataPacket[]>('SELECT id,role FROM users WHERE student_employee_id = ? LIMIT 1', [identifier]);
  if (!user || !allowedRoles.includes(user.role)) throw Object.assign(new Error('User not found'), {status: 404});
  const [loans] = await db.query<PatronLoan[]>(`SELECT b.id,b.book_id,COALESCE(NULLIF(bk.title,''),'Archived or missing book') AS book_title,bc.barcode AS copy_barcode,
    h.accession_number,b.borrowed_at,b.due_date,
    CASE WHEN b.due_date < NOW() THEN 'overdue' ELSE b.status END AS status
    FROM borrowings b LEFT JOIN books bk ON bk.id=b.book_id
    LEFT JOIN book_copies bc ON bc.id=b.copy_id LEFT JOIN copy_holdings h ON h.copy_id=bc.id
    WHERE b.user_id=? AND b.deleted_at IS NULL AND b.status IN ('borrowed','overdue')
    ORDER BY (b.status='overdue' OR b.due_date < NOW()) DESC,b.due_date ASC,b.id ASC`, [user.id]);
  const fines = await overdue.listUnsettledBorrowings({userId: user.id});
  const reservations = await clearance.findUserReservations(user.id);
  return {activeLoans: loans, fineRows: fines.rows, activeReservations: reservations,
    summary: {activeLoans: loans.length, overdueLoans: loans.filter((loan: PatronLoan) => loan.status === 'overdue').length,
      unpaidFines: fines.summary.total_unsettled_amount, activeReservations: reservations.length}};
}

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import fine = require("./fine-calculation");

const db = require("../../db") as Pool;
type QueryConnection = Pool | PoolConnection;
type FineCalculationResult = ReturnType<typeof fine.calculateFine>;

interface BorrowingFineRow extends RowDataPacket {
  id: number;
  due_date: Date | string | null;
  returned_at: Date | string | null;
  fine_per_hour: number | string;
  fine_interval: string;
  initial_fine: number | string;
}
interface FineAccountRow extends RowDataPacket {
  charged_amount: number | string;
  cycle_base_amount: number | string;
}
interface FineBalanceRow extends RowDataPacket {
  borrowing_id: number;
  charged_amount: number | string;
  paid_amount: number | string;
  adjusted_amount: number | string;
  balance: number | string;
}
interface FineEntryRow extends RowDataPacket {
  borrowing_id: number;
  amount: number | string;
}
interface FineBalance {
  fineAmount: number;
  paidAmount: number;
  adjustedAmount: number;
  balance: number;
}
interface FineSummary {
  outstandingAmount: number;
  affectedLoans: number;
}
interface FineTransactionItem {
  borrowingId: number;
  itemId: number;
  kind: string;
  amount: number | string;
  at?: Date;
}

async function withTransaction<T>(work: (connection: QueryConnection) => Promise<T>, existingConnection?: PoolConnection | null): Promise<T> {
  if (existingConnection) return work(existingConnection);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function assessBorrowing(row: BorrowingFineRow, connection: PoolConnection | null = null, assessedAt = new Date()): Promise<FineCalculationResult> {
  return withTransaction(async (conn) => {
    await conn.query("INSERT IGNORE INTO fine_accounts (borrowing_id) VALUES (?)", [row.id]);
    const [[account]] = await conn.query<FineAccountRow[]>("SELECT charged_amount, cycle_base_amount FROM fine_accounts WHERE borrowing_id = ? FOR UPDATE", [row.id]);
    const { fineAmount, isOverdue, hoursOverdue } = fine.calculateFine({
      dueDate: row.due_date,
      finePerHour: row.fine_per_hour,
      fineInterval: row.fine_interval,
      initialFine: row.initial_fine,
      now: assessedAt,
      returnedAt: row.returned_at,
    });
    const cumulativeFine = fine.roundCurrency(Number(account.cycle_base_amount) + fineAmount);
    const difference = fine.roundCurrency(cumulativeFine - Number(account.charged_amount));
    if (difference < 0) throw Object.assign(new Error("A recorded fine exceeds the loan's current policy amount. Review this account before continuing."), { status: 409 });
    if (difference > 0) {
      await conn.query("INSERT INTO fine_ledger_entries (borrowing_id, kind, amount, effective_at) VALUES (?, 'charge', ?, ?)", [row.id, difference, assessedAt]);
      await conn.query("UPDATE fine_accounts SET charged_amount = ?, assessed_through_at = ? WHERE borrowing_id = ?", [cumulativeFine, assessedAt, row.id]);
    }
    return { fineAmount: cumulativeFine, isOverdue, hoursOverdue };
  }, connection);
}

async function beginRenewalCycle(borrowingId: number, conn: PoolConnection): Promise<void> {
  const [[account]] = await conn.query<Array<RowDataPacket & { charged_amount: number | string }>>(
    "SELECT charged_amount FROM fine_accounts WHERE borrowing_id = ? FOR UPDATE",
    [borrowingId],
  );
  if (!account) throw new Error(`Fine ledger is missing loan #${borrowingId}.`);
  await conn.query("UPDATE fine_accounts SET cycle_base_amount = ? WHERE borrowing_id = ?", [account.charged_amount, borrowingId]);
}

async function balancesForBorrowings(borrowingIds: number[], conn: QueryConnection = db): Promise<Map<number, FineBalance>> {
  if (!borrowingIds.length) return new Map();
  const [rows] = await conn.query<FineBalanceRow[]>(
    `SELECT fa.borrowing_id, fa.charged_amount,
            COALESCE(SUM(CASE WHEN e.kind IN ('payment','legacy_credit') THEN -e.amount WHEN e.kind = 'reversal' THEN -e.amount ELSE 0 END), 0) AS paid_amount,
            COALESCE(SUM(CASE WHEN e.kind = 'adjustment' THEN -e.amount ELSE 0 END), 0) AS adjusted_amount,
            COALESCE(SUM(e.amount), 0) AS balance
       FROM fine_accounts fa LEFT JOIN fine_ledger_entries e ON e.borrowing_id = fa.borrowing_id
      WHERE fa.borrowing_id IN (${borrowingIds.map(() => "?").join(",")})
      GROUP BY fa.borrowing_id, fa.charged_amount`, borrowingIds,
  );
  return new Map(rows.map((row) => [Number(row.borrowing_id), {
    fineAmount: Number(row.charged_amount),
    paidAmount: Number(row.paid_amount),
    adjustedAmount: Number(row.adjusted_amount),
    balance: fine.roundCurrency(row.balance),
  }]));
}

async function lockBalancesForBorrowings(borrowingIds: number[], conn: PoolConnection): Promise<Map<number, number>> {
  const ids = [...new Set((borrowingIds || []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length) return new Map();
  const inClause = ids.map(() => "?").join(",");
  await conn.query(`SELECT borrowing_id FROM fine_accounts WHERE borrowing_id IN (${inClause}) FOR UPDATE`, ids);
  const [entries] = await conn.query<FineEntryRow[]>(
    `SELECT borrowing_id, amount FROM fine_ledger_entries
      WHERE borrowing_id IN (${inClause}) ORDER BY borrowing_id, id FOR UPDATE`,
    ids,
  );
  const balances = new Map(ids.map((id) => [id, 0]));
  for (const entry of entries) {
    const id = Number(entry.borrowing_id);
    balances.set(id, fine.roundCurrency((balances.get(id) || 0) + Number(entry.amount)));
  }
  return balances;
}

async function assertNoOutstandingFines(borrowingIds: number[], conn: PoolConnection, subject = "These records"): Promise<FineSummary> {
  const summary = await getOutstandingFineSummary(borrowingIds, conn);
  if (summary.affectedLoans === 0) return summary;
  throw Object.assign(
    new Error(`${subject} have PHP ${summary.outstandingAmount.toFixed(2)} outstanding across ${summary.affectedLoans} borrowing${summary.affectedLoans === 1 ? "" : "s"}. Record payment or adjust the fine before archiving.`),
    { status: 409, outstandingAmount: summary.outstandingAmount, affectedLoans: summary.affectedLoans },
  );
}

async function getOutstandingFineSummary(borrowingIds: number[], conn: PoolConnection): Promise<FineSummary> {
  const balances = await lockBalancesForBorrowings(borrowingIds, conn);
  const outstanding = [...balances.entries()].filter(([, amount]) => amount > 0.005);
  return {
    outstandingAmount: fine.roundCurrency(outstanding.reduce((total, [, balance]) => total + balance, 0)),
    affectedLoans: outstanding.length,
  };
}

async function postTransactionItem({ borrowingId, itemId, kind, amount, at = new Date() }: FineTransactionItem, conn: PoolConnection): Promise<void> {
  if (!["payment", "adjustment", "reversal"].includes(kind)) throw new Error("Invalid fine transaction kind");
  // Clearance allocations are positive for a payment/adjustment and negative
  // for a reversal; ledger balances use the opposite sign.
  const signed = -fine.roundCurrency(amount);
  await conn.query(
    "INSERT INTO fine_ledger_entries (borrowing_id, kind, amount, effective_at, transaction_item_id) VALUES (?, ?, ?, ?, ?)",
    [borrowingId, kind, signed, at, itemId],
  );
}

export = { assessBorrowing, beginRenewalCycle, balancesForBorrowings, lockBalancesForBorrowings, getOutstandingFineSummary, assertNoOutstandingFines, postTransactionItem };

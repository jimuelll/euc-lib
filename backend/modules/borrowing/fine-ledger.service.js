const db = require("../../db");
const { calculateFine, roundCurrency } = require("./fine-calculation");

async function withTransaction(work, existingConnection) {
  if (existingConnection) return work(existingConnection);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

async function assessBorrowing(row, connection = null, assessedAt = new Date()) {
  return withTransaction(async (conn) => {
    await conn.query("INSERT IGNORE INTO fine_accounts (borrowing_id) VALUES (?)", [row.id]);
    const [[account]] = await conn.query("SELECT charged_amount, cycle_base_amount FROM fine_accounts WHERE borrowing_id = ? FOR UPDATE", [row.id]);
    const { fineAmount, isOverdue, hoursOverdue } = calculateFine({
      dueDate: row.due_date, finePerHour: row.fine_per_hour,
      fineInterval: row.fine_interval, initialFine: row.initial_fine,
      now: assessedAt, returnedAt: row.returned_at,
    });
    const cumulativeFine = roundCurrency(Number(account.cycle_base_amount) + fineAmount);
    const difference = roundCurrency(cumulativeFine - Number(account.charged_amount));
    if (difference < 0) throw Object.assign(new Error("A recorded fine exceeds the loan's current policy amount. Review this account before continuing."), { status: 409 });
    if (difference > 0) {
      await conn.query("INSERT INTO fine_ledger_entries (borrowing_id, kind, amount, effective_at) VALUES (?, 'charge', ?, ?)", [row.id, difference, assessedAt]);
      await conn.query("UPDATE fine_accounts SET charged_amount = ?, assessed_through_at = ? WHERE borrowing_id = ?", [cumulativeFine, assessedAt, row.id]);
    }
    return { fineAmount: cumulativeFine, isOverdue, hoursOverdue };
  }, connection);
}

async function beginRenewalCycle(borrowingId, conn) {
  const [[account]] = await conn.query("SELECT charged_amount FROM fine_accounts WHERE borrowing_id = ? FOR UPDATE", [borrowingId]);
  if (!account) throw new Error(`Fine ledger is missing loan #${borrowingId}.`);
  await conn.query("UPDATE fine_accounts SET cycle_base_amount = ? WHERE borrowing_id = ?", [account.charged_amount, borrowingId]);
}

async function balancesForBorrowings(borrowingIds, conn = db) {
  if (!borrowingIds.length) return new Map();
  const [rows] = await conn.query(
    `SELECT fa.borrowing_id, fa.charged_amount,
            COALESCE(SUM(CASE WHEN e.kind IN ('payment','legacy_credit') THEN -e.amount WHEN e.kind = 'reversal' THEN -e.amount ELSE 0 END), 0) AS paid_amount,
            COALESCE(SUM(CASE WHEN e.kind = 'adjustment' THEN -e.amount ELSE 0 END), 0) AS adjusted_amount,
            COALESCE(SUM(e.amount), 0) AS balance
       FROM fine_accounts fa LEFT JOIN fine_ledger_entries e ON e.borrowing_id = fa.borrowing_id
      WHERE fa.borrowing_id IN (${borrowingIds.map(() => "?").join(",")})
      GROUP BY fa.borrowing_id, fa.charged_amount`, borrowingIds,
  );
  return new Map(rows.map((row) => [Number(row.borrowing_id), {
    fineAmount: Number(row.charged_amount), paidAmount: Number(row.paid_amount),
    adjustedAmount: Number(row.adjusted_amount), balance: roundCurrency(row.balance),
  }]));
}

async function postTransactionItem({ borrowingId, itemId, kind, amount, at = new Date() }, conn) {
  if (!["payment", "adjustment", "reversal"].includes(kind)) throw new Error("Invalid fine transaction kind");
  // Clearance allocations are positive for a payment/adjustment and negative
  // for a reversal; ledger balances use the opposite sign.
  const signed = -roundCurrency(amount);
  await conn.query(
    "INSERT INTO fine_ledger_entries (borrowing_id, kind, amount, effective_at, transaction_item_id) VALUES (?, ?, ?, ?, ?)",
    [borrowingId, kind, signed, at, itemId],
  );
}

module.exports = { assessBorrowing, beginRenewalCycle, balancesForBorrowings, postTransactionItem };

/*
 * Run after 2026-09-19-fine-ledger-and-loan-duration.sql, before starting the
 * new server. The import is resumable: accounts created by an early overdue
 * sync (or a previous completed import) are left untouched, while borrowing
 * records that still have no account are reconciled and imported.
 */
const db = require("../db");
const { calculateFine, roundCurrency } = require("../modules/borrowing/fine-calculation");

async function backfill() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [existingAccounts] = await conn.query("SELECT borrowing_id FROM fine_accounts FOR UPDATE");
    const existingAccountIds = new Set(existingAccounts.map((row) => Number(row.borrowing_id)));
    const [[settings]] = await conn.query("SELECT overdue_fine_per_hour FROM library_circulation_settings WHERE id = 1");
    const [loans] = await conn.query(
      `SELECT id, due_date, returned_at, fine_per_hour, fine_interval, initial_fine,
              COALESCE(settled_amount, 0) AS settled_amount
         FROM borrowings ORDER BY id ASC FOR UPDATE`,
    );
    const [items] = await conn.query(
      `SELECT cti.id, cti.borrowing_id, cti.amount, ct.transaction_type, ct.created_at
         FROM clearance_transaction_items cti
         JOIN clearance_transactions ct ON ct.id = cti.transaction_id
        ORDER BY cti.id ASC`,
    );
    const itemsByBorrowing = new Map();
    for (const item of items) {
      const entries = itemsByBorrowing.get(Number(item.borrowing_id)) || [];
      entries.push(item);
      itemsByBorrowing.set(Number(item.borrowing_id), entries);
    }
    const importedAt = new Date();
    let importedCredits = 0;
    let importedAccounts = 0;
    let skippedAccounts = 0;
    for (const loan of loans) {
      if (existingAccountIds.has(Number(loan.id))) {
        skippedAccounts += 1;
        continue;
      }
      const { fineAmount } = calculateFine({
        dueDate: loan.due_date,
        returnedAt: loan.returned_at,
        finePerHour: loan.fine_per_hour ?? settings?.overdue_fine_per_hour ?? 1,
        fineInterval: loan.fine_interval ?? "hour",
        initialFine: loan.initial_fine ?? 0,
        now: importedAt,
      });
      const knownItems = itemsByBorrowing.get(Number(loan.id)) || [];
      const knownCredit = roundCurrency(knownItems.reduce((sum, item) => sum + Number(item.amount), 0));
      const legacyCredit = roundCurrency(Number(loan.settled_amount) - knownCredit);
      if (legacyCredit < -0.01 || Number(loan.settled_amount) > fineAmount + 0.01) {
        throw new Error(`Loan #${loan.id} cannot be reconciled: fine ${fineAmount}, stored settlement ${loan.settled_amount}, known transactions ${knownCredit}.`);
      }
      await conn.query(
        "INSERT INTO fine_accounts (borrowing_id, charged_amount, assessed_through_at, imported_at) VALUES (?, ?, ?, ?)",
        [loan.id, fineAmount, loan.returned_at || importedAt, importedAt],
      );
      importedAccounts += 1;
      if (fineAmount > 0) await conn.query(
        "INSERT INTO fine_ledger_entries (borrowing_id, kind, amount, effective_at, source_note) VALUES (?, 'legacy_charge', ?, ?, 'Opening assessed fine; original charge dates unavailable')",
        [loan.id, fineAmount, importedAt],
      );
      for (const item of knownItems) await conn.query(
        "INSERT INTO fine_ledger_entries (borrowing_id, kind, amount, effective_at, transaction_item_id, source_note) VALUES (?, ?, ?, ?, ?, 'Imported clearance transaction')",
        [loan.id, item.transaction_type, -Number(item.amount), item.created_at, item.id],
      );
      if (legacyCredit > 0) {
        await conn.query(
          "INSERT INTO fine_ledger_entries (borrowing_id, kind, amount, effective_at, source_note) VALUES (?, 'legacy_credit', ?, ?, 'Unitemized payment or adjustment from prior system')",
          [loan.id, -legacyCredit, importedAt],
        );
        importedCredits += 1;
      }
    }
    const [[remaining]] = await conn.query(
      `SELECT COUNT(*) AS total
         FROM borrowings b
         LEFT JOIN fine_accounts fa ON fa.borrowing_id = b.id
        WHERE fa.borrowing_id IS NULL`,
    );
    if (Number(remaining.total) !== 0) {
      throw new Error(`Fine ledger import finished with ${remaining.total} borrowing records still missing accounts.`);
    }
    await conn.commit();
    console.log(`Imported ${importedAccounts} fine accounts; skipped ${skippedAccounts} existing accounts; ${importedCredits} include unitemized legacy credit.`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
}

backfill().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });

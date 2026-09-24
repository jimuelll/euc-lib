const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const db = require("../db");
const holdingsService = require("../modules/catalog/catalog.holdings.service");
const catalogAvailability = require("../modules/catalog/catalog.availability.service");
const copyState = require("../modules/catalog/catalog.copy-state.service");
const catalogQueryService = require("../modules/catalog/catalog.query.service");
const myLibraryRepository = require("../modules/my-library/my-library.repository");
const { availableToBorrow } = require("../modules/catalog/copyEligibility");
const borrowingRepository = require("../modules/borrowing/borrowing.repository");
const borrowingTransactions = require("../modules/borrowing/borrowing.transaction.service");
const clearanceService = require("../modules/clearance/clearance.service");
const adminService = require("../modules/admin/admin.service");
const reservationService = require("../modules/reservation/reservation.service");
const { listUnsettledBorrowings } = require("../modules/borrowing/overdue.helper");
const { createBackupPayload, preflightRestore } = require("../modules/backup/snapshot.service");
const restoreRepository = require("../modules/backup/restore.repository");


// These fixtures leave permanent accession claims by design, so never run this
// against the configured library database or any database without an explicit
// disposable *_test name.
const enabled = process.env.RUN_DB_INTEGRATION === "1" && /_test$/i.test(process.env.DB_NAME || "");

async function createBookCopies(prefix, count) {
  const [bookResult] = await db.query(
    "INSERT INTO books (title, author, material_type, copies) VALUES (?, 'Integration fixture', 'book', ?)",
    [`Accession integration ${prefix}`, count],
  );
  const copies = [];
  for (let index = 0; index < count; index += 1) {
    const barcode = `IT-${prefix}-${index + 1}`;
    const [copyResult] = await db.query(
      "INSERT INTO book_copies (book_id, barcode) VALUES (?, ?)",
      [bookResult.insertId, barcode],
    );
    copies.push({ id: copyResult.insertId, bookId: bookResult.insertId, barcode });
  }
  return copies;
}

async function createCirculationFixture(prefix, count, policyId = null) {
  const [[policy]] = policyId
    ? await db.query("SELECT id FROM book_types WHERE id = ? AND is_active = 1", [policyId])
    : await db.query("SELECT id FROM book_types WHERE is_active = 1 ORDER BY id LIMIT 1");
  assert.ok(policy, "fresh-start baseline must provide an active loan policy");
  const [bookResult] = await db.query(
    "INSERT INTO books (title, author, material_type, book_type_id, copies) VALUES (?, 'Integration fixture', 'book', ?, ?)",
    [`Circulation integration ${prefix}`, policy.id, count],
  );
  const [userResult] = await db.query(
    "INSERT INTO users (student_employee_id, name, password_hash, role, is_active, must_change_password) VALUES (?, ?, 'integration-test-hash', 'student', 1, 0)",
    [`IT-${prefix}`, `Integration patron ${prefix}`],
  );
  const copies = [];
  for (let index = 0; index < count; index += 1) {
    const barcode = `LIB-${String(bookResult.insertId).padStart(6, "0")}-${String(index + 1).padStart(3, "0")}`;
    const accession = `IT-${prefix}-ACC-${index + 1}`;
    const [copyResult] = await db.query(
      "INSERT INTO book_copies (book_id, barcode) VALUES (?, ?)",
      [bookResult.insertId, barcode],
    );
    const copy = { id: copyResult.insertId, bookId: bookResult.insertId, barcode, accession };
    await holdingsService.updateHolding(copy.id, { accession_number: accession }, null);
    copies.push(copy);
  }
  return { bookId: bookResult.insertId, userId: userResult.insertId, copies };
}

async function createPatron(studentEmployeeId, name) {
  const [result] = await db.query(
    "INSERT INTO users (student_employee_id, name, password_hash, role, is_active, must_change_password) VALUES (?, ?, 'integration-test-hash', 'student', 1, 0)",
    [studentEmployeeId, name],
  );
  return result.insertId;
}

test("database: accession collision is atomic, survives archive, and serializes concurrent assignment", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test; fixtures permanently reserve accessions",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const [firstCopy, secondCopy] = await createBookCopies(runId, 2);
  const accession = `INT-${runId}-CLAIM`;
  await holdingsService.updateHolding(firstCopy.id, { accession_number: accession }, null);
  await assert.rejects(
    holdingsService.updateHolding(firstCopy.id, { accession_number: `${accession}-EDIT` }, null),
    (error) => error.status === 409,
    "an assigned accession is immutable even when the copy has no active loan or reservation",
  );
  await assert.rejects(
    db.query("UPDATE copy_holdings SET accession_number = ? WHERE copy_id = ?", [`${accession}-DIRECT`, firstCopy.id]),
    (error) => /accession number is permanent/i.test(error.message),
    "the database must reject direct accession edits even if an application route is bypassed",
  );
  await holdingsService.updateHolding(firstCopy.id, { accession_number: accession, location: "Shelf A" }, null);
  const [[unchangedClaim]] = await db.query(
    "SELECT h.accession_number, h.location, (SELECT COUNT(*) FROM accession_claims ac WHERE ac.accession_number = ?) AS claim_count FROM copy_holdings h WHERE h.copy_id = ?",
    [`${accession}-EDIT`, firstCopy.id],
  );
  assert.equal(unchangedClaim.accession_number, accession);
  assert.equal(unchangedClaim.location, "Shelf A");
  assert.equal(Number(unchangedClaim.claim_count), 0);

  await assert.rejects(
    holdingsService.updateHolding(secondCopy.id, { accession_number: accession }, null),
    (error) => error.status === 409,
  );
  let [[state]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM copy_holdings WHERE copy_id = ?) AS first_holding,
       (SELECT COUNT(*) FROM copy_holdings WHERE copy_id = ?) AS second_holding,
       (SELECT COUNT(*) FROM accession_claims WHERE accession_number = ?) AS claims`,
    [firstCopy.id, secondCopy.id, accession],
  );
  assert.deepEqual(Object.values(state).map(Number), [1, 0, 1]);

  await db.query("UPDATE book_copies SET is_active = 0 WHERE id = ?", [firstCopy.id]);
  await db.query("UPDATE books SET deleted_at = UTC_TIMESTAMP() WHERE id = ?", [firstCopy.bookId]);
  await assert.rejects(
    db.query("DELETE FROM books WHERE id = ?", [firstCopy.bookId]),
    (error) => /book with a claimed accession cannot be hard-deleted/i.test(error.message),
    "the book delete guard must prevent ON DELETE CASCADE from removing claimed copy identity",
  );

  const [otherCopy] = await createBookCopies(`${runId}-other`, 1);
  await assert.rejects(
    holdingsService.updateHolding(otherCopy.id, { accession_number: accession }, null),
    (error) => error.status === 409,
    "an archived copy keeps its accession reserved for the original barcode",
  );
  [[state]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM copy_holdings WHERE copy_id = ?) AS first_holding,
       (SELECT COUNT(*) FROM copy_holdings WHERE copy_id = ?) AS other_holding,
       (SELECT COUNT(*) FROM accession_claims WHERE accession_number = ?) AS claims`,
    [firstCopy.id, otherCopy.id, accession],
  );
  assert.deepEqual(Object.values(state).map(Number), [1, 0, 1]);

  const [raceA, raceB] = await createBookCopies(`${runId}-race`, 2);
  const raceAccession = `INT-${runId}-RACE`;
  const outcomes = await Promise.allSettled([
    holdingsService.updateHolding(raceA.id, { accession_number: raceAccession }, null),
    holdingsService.updateHolding(raceB.id, { accession_number: raceAccession }, null),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((result) => result.status === "rejected" && result.reason.status === 409).length, 1);
  const [[raceState]] = await db.query(
    "SELECT COUNT(*) AS holdings, COUNT(DISTINCT accession_number) AS accessions FROM copy_holdings WHERE copy_id IN (?, ?)",
    [raceA.id, raceB.id],
  );
  assert.equal(Number(raceState.holdings), 1);
  assert.equal(Number(raceState.accessions), 1);
});

test("database: holdings audits preserve rapid before/after values and roll back when audit enqueue fails", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const [copy] = await createBookCopies(`AUDIT-${runId}`, 1);
  const accession = `AUDIT-${runId}-ACC`;
  await holdingsService.updateHolding(copy.id, { accession_number: accession, location: "Shelf A" }, 1);
  await holdingsService.updateHolding(copy.id, { accession_number: accession, location: "Shelf B" }, 1);

  const route = `/api/admin/copies/${copy.id}/holding`;
  const [events] = await db.query(
    `SELECT payload FROM delivery_outbox
      WHERE event_type = 'audit' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.route')) = ?
      ORDER BY created_at ASC, id ASC`,
    [route],
  );
  assert.equal(events.length, 2);
  const parsePayload = (value) => typeof value === "string" ? JSON.parse(value) : value;
  const payloads = events.map((event) => parsePayload(event.payload));
  const assignment = payloads.find((payload) => payload.metadata.changes.some(
    (change) => change.field === "Location" && change.before === "Cleared" && change.after === "Shelf A",
  ));
  const edit = payloads.find((payload) => payload.metadata.changes.some(
    (change) => change.field === "Location" && change.before === "Shelf A" && change.after === "Shelf B",
  ));
  assert.ok(assignment);
  assert.ok(edit);
  assert.ok(assignment.description.includes("Assigned accession"));

  const triggerName = `trg_it_fail_audit_${runId}`;
  await db.query(
    `CREATE TRIGGER \`${triggerName}\` BEFORE INSERT ON delivery_outbox FOR EACH ROW
       BEGIN
         IF NEW.event_type = 'audit' THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'integration audit enqueue failure';
         END IF;
       END`,
  );
  try {
    await assert.rejects(
      holdingsService.updateHolding(copy.id, { accession_number: accession, location: "Shelf C" }, 1),
      /integration audit enqueue failure/i,
    );
  } finally {
    await db.query(`DROP TRIGGER \`${triggerName}\``);
  }
  const [[state]] = await db.query("SELECT location FROM copy_holdings WHERE copy_id = ?", [copy.id]);
  assert.equal(state.location, "Shelf B", "the copy edit rolls back with its failed audit event");
});

test("database: copy-count audit records the persisted pre-edit count and every retired copy label", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const fixture = await createCirculationFixture(`COUNT-AUDIT-${runId}`, 2);
  await db.query("UPDATE books SET copies = 7 WHERE id = ?", [fixture.bookId]);
  await catalogQueryService.updateBook(fixture.bookId, { copies: 1 }, 1);

  const route = `/api/admin/books/${fixture.bookId}`;
  const [[event]] = await db.query(
    `SELECT payload FROM delivery_outbox
      WHERE event_type = 'audit' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.route')) = ?
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [route],
  );
  const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
  const copyCountChange = payload.metadata.changes.find((change) => change.field === "Copies");
  assert.deepEqual(copyCountChange, { field: "Copies", before: "7", after: "1" });
  assert.ok(payload.description.includes("Retired Copy 2"));
  assert.deepEqual(payload.metadata.affected_copy_labels, ["Copy 2"]);
});

test("database: voided accessions stay attached and claimed while current lending excludes the copy", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const fixture = await createCirculationFixture(runId, 2);
  const firstCopy = fixture.copies[0];
  const activeLoan = await borrowingTransactions.borrowBook(fixture.userId, firstCopy.accession, 1, { isCopyBarcode: true });
  await assert.rejects(holdingsService.voidAccession(firstCopy.id, { reason: "Transcription error" }, 1), (error) => error.status === 409 && /return this copy/i.test(error.message));
  await borrowingTransactions.returnBook(activeLoan.borrowingId, fixture.userId, { actorId: 1 });

  const pendingUserId = await createPatron(`VOID-${runId}`, `Void pending ${runId}`);
  const pending = await reservationService.reserveBook(pendingUserId, fixture.bookId);
  await holdingsService.voidAccession(firstCopy.id, { reason: "Accession label was entered incorrectly" }, 1);
  const [[copyState]] = await db.query(
    `SELECT h.accession_number, bc.barcode,
       EXISTS(SELECT 1 FROM accession_claims claim WHERE claim.accession_number = h.accession_number AND claim.copy_barcode = bc.barcode) AS permanently_claimed,
       EXISTS(SELECT 1 FROM accession_claim_voids voided WHERE voided.accession_number = h.accession_number) AS voided,
       ${availableToBorrow("bc")} AS eligible
       FROM copy_holdings h JOIN book_copies bc ON bc.id = h.copy_id WHERE bc.id = ?`,
    [firstCopy.id],
  );
  assert.equal(copyState.accession_number, firstCopy.accession);
  assert.equal(Number(copyState.permanently_claimed), 1);
  assert.equal(Number(copyState.voided), 1);
  assert.equal(Number(copyState.eligible), 0);
  await assert.rejects(
    borrowingTransactions.borrowBook(fixture.userId, firstCopy.accession, 1, { isCopyBarcode: true }),
    (error) => error.status === 409,
  );
  await assert.rejects(
    borrowingTransactions.borrowBook(fixture.userId, firstCopy.barcode, 1, { isCopyBarcode: true }),
    (error) => error.status === 409 && /voided/i.test(error.message),
    "a QR code for a voided accession cannot bypass the permanent void state",
  );
  await catalogAvailability.syncBookCopies(fixture.bookId, 3);
  const [[newCopy]] = await db.query(
    "SELECT id, barcode FROM book_copies WHERE book_id = ? AND id NOT IN (?, ?) ORDER BY id DESC LIMIT 1",
    [fixture.bookId, fixture.copies[0].id, fixture.copies[1].id],
  );
  await assert.rejects(
    holdingsService.updateHolding(Number(newCopy.id), { accession_number: firstCopy.accession }, 1),
    (error) => error.status === 409,
    "a voided accession remains permanently unavailable to another copy",
  );
  await assert.rejects(
    holdingsService.voidAccession(fixture.copies[1].id, { reason: "Second accession invalid" }, 1),
    (error) => error.status === 409 && /pending reservation/i.test(error.message),
    "voiding the final eligible copy cannot strand a pending reservation",
  );
  await reservationService.cancelReservation(pending.reservationId, pendingUserId);
  const replacementAccession = `IT-${runId}-NEW-COPY`;
  await holdingsService.updateHolding(Number(newCopy.id), { accession_number: replacementAccession }, 1);
  await holdingsService.voidAccession(fixture.copies[1].id, { reason: "Second accession invalid" }, 1);
  const replacementLoan = await borrowingTransactions.borrowBook(fixture.userId, replacementAccession, 1, { isCopyBarcode: true });
  assert.equal(replacementLoan.copyId, Number(newCopy.id));
  await borrowingTransactions.returnBook(replacementLoan.borrowingId, fixture.userId, { actorId: 1 });
  await assert.rejects(
    db.query("DELETE FROM accession_claim_voids WHERE accession_number = ?", [firstCopy.accession]),
    (error) => /void events cannot be deleted/i.test(error.message),
    "the void history remains append-only",
  );
});

test("database: retained accession identity is barcode based after snapshot copy IDs change", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const [copy] = await createBookCopies(runId, 1);
  const accession = `IT-${runId}-RETAINED-ID`;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("SET @allow_accession_restore = 1");
    await conn.query(
      `INSERT INTO accession_claims
         (accession_number, copy_barcode, copy_id, book_id, book_title, claimed_by)
       VALUES (?, ?, ?, ?, 'Restored identity fixture', 1)`,
      [accession, copy.barcode, copy.id + 1000000, copy.bookId],
    );
    await conn.query("SET @allow_accession_restore = 0");
    await conn.query(
      "INSERT INTO copy_holdings (copy_id, accession_number) VALUES (?, ?)",
      [copy.id, accession],
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.query("SET @allow_accession_restore = 0").catch(() => {});
    conn.release();
  }
  await holdingsService.voidAccession(copy.id, { reason: "Registry retained through restore" }, 1);
  const [[event]] = await db.query(
    "SELECT copy_id, copy_barcode FROM accession_claim_voids WHERE accession_number = ?",
    [accession],
  );
  assert.equal(Number(event.copy_id), copy.id);
  assert.equal(event.copy_barcode, copy.barcode);
});

test("database: barcode retained by an orphaned claim cannot be reused by another book", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const [original] = await createBookCopies(`${runId}-original`, 1);
  const [other] = await createBookCopies(`${runId}-other`, 1);
  const orphanBarcode = `ORPHAN-${runId}`;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("SET @allow_accession_restore = 1");
    await conn.query(
      `INSERT INTO accession_claims
         (accession_number, copy_barcode, copy_id, book_id, book_title, claimed_by)
       VALUES (?, ?, ?, ?, 'Absent snapshot copy', 1)`,
      [`IT-${runId}-ORPHAN`, orphanBarcode, original.id + 1000000, original.bookId],
    );
    await conn.query("SET @allow_accession_restore = 0");
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.query("SET @allow_accession_restore = 0").catch(() => {});
    conn.release();
  }
  await assert.rejects(
    db.query("INSERT INTO book_copies (book_id, barcode) VALUES (?, ?)", [other.bookId, orphanBarcode]),
    (error) => /barcode reserved by permanent accession history/i.test(error.message),
  );
});

test("database: checkout and exact-copy return resolve accession and QR barcode", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const fixture = await createCirculationFixture(runId, 1);
  const copy = fixture.copies[0];

  const [byAccession, byBarcode] = await Promise.all([
    borrowingRepository.findCopyByBarcode(copy.accession),
    borrowingRepository.findCopyByBarcode(copy.barcode),
  ]);
  assert.equal(byAccession.id, copy.id);
  assert.equal(byBarcode.id, copy.id);

  const accessionCheckout = await borrowingTransactions.borrowBook(
    fixture.userId, copy.accession, 1, { isCopyBarcode: true, auditRoute: "/api/admin/circulation/borrow" },
  );
  const [activeByAccession, activeByBarcode] = await Promise.all([
    borrowingRepository.findActiveBorrowingByCopyBarcode(copy.accession),
    borrowingRepository.findActiveBorrowingByCopyBarcode(copy.barcode),
  ]);
  assert.equal(activeByAccession.id, accessionCheckout.borrowingId);
  assert.equal(activeByBarcode.id, accessionCheckout.borrowingId);
  assert.equal(activeByAccession.copy_id, copy.id);
  await borrowingTransactions.returnBook(activeByAccession.id, fixture.userId, { actorId: 1 });

  const barcodeCheckout = await borrowingTransactions.borrowBook(
    fixture.userId, copy.barcode, 1, { isCopyBarcode: true, auditRoute: "/api/admin/circulation/borrow" },
  );
  const activeByBarcodeReturn = await borrowingRepository.findActiveBorrowingByCopyBarcode(copy.barcode);
  assert.equal(activeByBarcodeReturn.id, barcodeCheckout.borrowingId);
  assert.equal(activeByBarcodeReturn.copy_id, copy.id);
  await borrowingTransactions.returnBook(activeByBarcodeReturn.id, fixture.userId, { actorId: 1 });

  const [loans] = await db.query("SELECT id, copy_id, status FROM borrowings WHERE user_id = ? ORDER BY id", [fixture.userId]);
  assert.deepEqual(loans.map((loan) => [Number(loan.copy_id), loan.status]), [[copy.id, "returned"], [copy.id, "returned"]]);

  await catalogQueryService.deleteBook(fixture.bookId, 1);
  const history = await myLibraryRepository.findBorrowHistory(fixture.userId);
  assert.equal(history.length, 2);
  assert.ok(history.every((row) => Number(row.copy_id) === copy.id));
  assert.ok(history.every((row) => row.copy_barcode === copy.barcode && row.accession_number === copy.accession));
  const combinedHistory = await myLibraryRepository.getHistory(fixture.userId, 1, 10);
  assert.ok(combinedHistory.rows.filter((row) => row.kind === "borrowing").every((row) => (
    Number(row.copy_id) === copy.id && row.copy_barcode === copy.barcode && row.accession_number === copy.accession
  )));
  const [[currentEligibility]] = await db.query(
    `SELECT ${availableToBorrow("bc")} AS eligible
       FROM book_copies bc WHERE bc.id = ?`,
    [copy.id],
  );
  assert.equal(Number(currentEligibility.eligible), 0, "archiving the book removes its copy from current lending while preserving history identity");
});

test("database: count reduction retires copies, growth creates new identities, and restore is explicit", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const fixture = await createCirculationFixture(runId, 1);
  const original = fixture.copies[0];

  await catalogAvailability.syncBookCopies(fixture.bookId, 0);
  let [[copyStateRow]] = await db.query(
    "SELECT bc.is_active, bk.copies, h.accession_number, ac.accession_number AS claimed_accession FROM book_copies bc JOIN books bk ON bk.id = bc.book_id JOIN copy_holdings h ON h.copy_id = bc.id JOIN accession_claims ac ON ac.copy_barcode = bc.barcode WHERE bc.id = ?",
    [original.id],
  );
  assert.equal(Number(copyStateRow.is_active), 0);
  assert.equal(Number(copyStateRow.copies), 0);
  assert.equal(copyStateRow.accession_number, original.accession);
  assert.equal(copyStateRow.claimed_accession, original.accession);

  await assert.rejects(
    borrowingTransactions.borrowBook(fixture.userId, original.barcode, 1, { isCopyBarcode: true }),
    (error) => error.status === 409,
    "retired accessioned copies stay unavailable to checkout",
  );
  await catalogAvailability.syncBookCopies(fixture.bookId, 1);
  const [copiesAfterGrowth] = await db.query(
    "SELECT id, barcode, is_active FROM book_copies WHERE book_id = ? AND deleted_at IS NULL ORDER BY id",
    [fixture.bookId],
  );
  assert.equal(copiesAfterGrowth.length, 2);
  assert.equal(Number(copiesAfterGrowth[0].id), original.id);
  assert.equal(Number(copiesAfterGrowth[0].is_active), 0);
  assert.equal(Number(copiesAfterGrowth[1].is_active), 1);

  await copyState.restoreCopy(original.id, 1);
  [[copyStateRow]] = await db.query(
    "SELECT bc.is_active, bk.copies FROM book_copies bc JOIN books bk ON bk.id = bc.book_id WHERE bc.id = ?",
    [original.id],
  );
  assert.equal(Number(copyStateRow.is_active), 1);
  assert.equal(Number(copyStateRow.copies), 2);
});

test("database: checkout and reduction serialize without retiring a loaned copy", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const fixture = await createCirculationFixture(runId, 1);
  const copy = fixture.copies[0];
  const outcomes = await Promise.allSettled([
    borrowingTransactions.borrowBook(fixture.userId, fixture.bookId, 1),
    catalogAvailability.syncBookCopies(fixture.bookId, 0),
  ]);
  const checkoutSucceeded = outcomes[0].status === "fulfilled";
  const reductionSucceeded = outcomes[1].status === "fulfilled";
  assert.notEqual(checkoutSucceeded, reductionSucceeded, "exactly one operation may succeed for a one-copy book");
  if (checkoutSucceeded) assert.equal(outcomes[1].reason?.status, 409);
  else assert.equal(outcomes[0].reason?.status, 409);

  const [[state]] = await db.query(
    `SELECT bk.copies,
       (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = bk.id AND bc.deleted_at IS NULL AND bc.is_active = 1) AS active_copies,
       (SELECT COUNT(*) FROM borrowings b WHERE b.book_id = bk.id AND b.deleted_at IS NULL AND b.status IN ('borrowed','overdue')) AS active_loans,
       (SELECT is_active FROM book_copies WHERE id = ?) AS copy_active
     FROM books bk WHERE bk.id = ?`,
    [copy.id, fixture.bookId],
  );
  assert.equal(Number(state.copies), Number(state.active_copies));
  if (checkoutSucceeded) {
    assert.equal(Number(state.active_loans), 1);
    assert.equal(Number(state.copy_active), 1);
    const loan = await borrowingRepository.findActiveBorrowingByCopyBarcode(copy.accession);
    assert.equal(loan.copy_id, copy.id);
    await borrowingTransactions.returnBook(loan.id, fixture.userId, { actorId: 1 });
  } else {
    assert.equal(Number(state.active_loans), 0);
    assert.equal(Number(state.copy_active), 0);
  }
});

test("database: payment and patron archive serialize without archiving an unpaid account", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const [policyResult] = await db.query(
    `INSERT INTO book_types
       (name, default_borrow_days, loan_duration_minutes, loan_duration_unit, fine_per_hour, fine_interval, initial_fine, is_active)
     VALUES (?, 7, 10080, 'day', 1.00, 'hour', 5.00, 1)`,
    [`Payment/archive integration ${runId}`],
  );
  const fixture = await createCirculationFixture(runId, 1, policyResult.insertId);
  const studentId = `IT-${runId}`;
  const borrowing = await borrowingTransactions.borrowBook(fixture.userId, fixture.bookId, 1);
  await db.query("UPDATE borrowings SET due_date = UTC_TIMESTAMP() - INTERVAL 3 HOUR WHERE id = ?", [borrowing.borrowingId]);
  await borrowingTransactions.returnBook(borrowing.borrowingId, fixture.userId, { actorId: 1 });

  const beforePayment = await listUnsettledBorrowings({ userId: fixture.userId });
  assert.ok(beforePayment.summary.total_unsettled_amount > 0);

  const outcomes = await Promise.allSettled([
    clearanceService.recordFullPayment({ studentEmployeeId: studentId, createdBy: 1 }),
    adminService.deleteUser(studentId, "super_admin", 1),
  ]);
  assert.equal(outcomes[0].status, "fulfilled", "the payment must still settle the ledger");
  if (outcomes[1].status === "rejected") assert.equal(outcomes[1].reason.status, 409);

  const afterPayment = await listUnsettledBorrowings({ userId: fixture.userId });
  assert.equal(afterPayment.summary.total_unsettled_amount, 0);
  const [[user]] = await db.query("SELECT deleted_at FROM users WHERE id = ?", [fixture.userId]);
  assert.equal(Boolean(user.deleted_at), outcomes[1].status === "fulfilled");
});

test("database: pending and ready reservations protect copy reduction and exact-copy fulfillment", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const fixture = await createCirculationFixture(runId, 3);
  const reservation = await reservationService.reserveBook(fixture.userId, fixture.bookId);

  await catalogAvailability.syncBookCopies(fixture.bookId, 2);
  let [[counts]] = await db.query(
    `SELECT bk.copies,
       (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = bk.id AND bc.is_active = 1 AND bc.deleted_at IS NULL) AS active_copies,
       (SELECT COUNT(*) FROM book_copies bc JOIN copy_holdings h ON h.copy_id = bc.id WHERE bc.book_id = bk.id AND bc.is_active = 1 AND bc.deleted_at IS NULL AND h.accession_number <> '') AS active_accessioned
     FROM books bk WHERE bk.id = ?`,
    [fixture.bookId],
  );
  assert.deepEqual(Object.values(counts).map(Number), [2, 2, 2]);

  await reservationService.markReservationReady(reservation.reservationId, 1);
  const [[ready]] = await db.query(
    `SELECT r.status, r.reserved_copy_id, bc.barcode
       FROM reservations r JOIN book_copies bc ON bc.id = r.reserved_copy_id WHERE r.id = ?`,
    [reservation.reservationId],
  );
  assert.equal(ready.status, "ready");
  const [[alternate]] = await db.query(
    "SELECT id, barcode FROM book_copies WHERE book_id = ? AND is_active = 1 AND deleted_at IS NULL AND id <> ? ORDER BY id LIMIT 1",
    [fixture.bookId, ready.reserved_copy_id],
  );
  assert.ok(alternate);
  await assert.rejects(
    borrowingTransactions.borrowBook(
      fixture.userId, alternate.barcode, 1,
      { isCopyBarcode: true, reservationId: reservation.reservationId },
    ),
    (error) => error.status === 409 && /not the copy prepared/i.test(error.message),
  );

  await catalogAvailability.syncBookCopies(fixture.bookId, 1);
  await assert.rejects(
    catalogAvailability.syncBookCopies(fixture.bookId, 0),
    (error) => error.status === 409 && /prepared for pickup/i.test(error.message),
  );
  [[counts]] = await db.query(
    `SELECT bk.copies,
       (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = bk.id AND bc.is_active = 1 AND bc.deleted_at IS NULL) AS active_copies
     FROM books bk WHERE bk.id = ?`,
    [fixture.bookId],
  );
  assert.deepEqual(Object.values(counts).map(Number), [1, 1]);

  const checkout = await borrowingTransactions.borrowBook(
    fixture.userId, ready.barcode, 1,
    { isCopyBarcode: true, reservationId: reservation.reservationId },
  );
  assert.equal(checkout.copyId, Number(ready.reserved_copy_id));
  const [[history]] = await db.query(
    "SELECT copy_id, status FROM borrowings WHERE id = ?",
    [checkout.borrowingId],
  );
  assert.deepEqual([Number(history.copy_id), history.status], [Number(ready.reserved_copy_id), "borrowed"]);
  await borrowingTransactions.returnBook(checkout.borrowingId, fixture.userId, { actorId: 1 });
  const [[fulfilled]] = await db.query("SELECT status, reserved_copy_id FROM reservations WHERE id = ?", [reservation.reservationId]);
  assert.equal(fulfilled.status, "fulfilled");
  assert.equal(Number(fulfilled.reserved_copy_id), Number(ready.reserved_copy_id));
});

test("database: bulk deactivation skips loans and reservations while payment settles a fine", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const [policyResult] = await db.query(
    `INSERT INTO book_types
       (name, default_borrow_days, loan_duration_minutes, loan_duration_unit, fine_per_hour, fine_interval, initial_fine, is_active)
     VALUES (?, 7, 10080, 'day', 1.00, 'hour', 5.00, 1)`,
    [`Bulk archive integration ${runId}`],
  );
  const fixture = await createCirculationFixture(runId, 3, policyResult.insertId);
  const loanStudentId = `IT-${runId}`;
  const pendingStudentId = `IT-${runId}-P`;
  const fineStudentId = `IT-${runId}-F`;
  const eligibleStudentId = `IT-${runId}-E`;
  const pendingUserId = await createPatron(pendingStudentId, `Pending patron ${runId}`);
  const fineUserId = await createPatron(fineStudentId, `Fine patron ${runId}`);
  const eligibleUserId = await createPatron(eligibleStudentId, `Eligible patron ${runId}`);

  const loan = await borrowingTransactions.borrowBook(
    fixture.userId, fixture.copies[0].accession, 1, { isCopyBarcode: true },
  );
  const pending = await reservationService.reserveBook(pendingUserId, fixture.bookId);
  const fineLoan = await borrowingTransactions.borrowBook(
    fineUserId, fixture.copies[1].accession, 1, { isCopyBarcode: true },
  );
  await db.query("UPDATE borrowings SET due_date = UTC_TIMESTAMP() - INTERVAL 3 HOUR WHERE id = ?", [fineLoan.borrowingId]);
  await borrowingTransactions.returnBook(fineLoan.borrowingId, fineUserId, { actorId: 1 });
  const fineBefore = await listUnsettledBorrowings({ userId: fineUserId });
  assert.ok(fineBefore.summary.total_unsettled_amount > 0);

  const bulkBeforePayment = await adminService.bulkDeactivateStudentLikeUsers("super_admin", 1);
  assert.ok(bulkBeforePayment.deactivated_count >= 1);
  assert.ok(bulkBeforePayment.skipped_users.some((user) => (
    user.student_employee_id === fineStudentId && user.reasons.includes("unpaid_fines")
  )), "bulk deactivation must leave an account with an unpaid ledger balance active");

  const [payment, bulk] = await Promise.allSettled([
    clearanceService.recordFullPayment({ studentEmployeeId: fineStudentId, createdBy: 1 }),
    adminService.bulkDeactivateStudentLikeUsers("super_admin", 1),
  ]);
  assert.equal(payment.status, "fulfilled");
  assert.equal(bulk.status, "fulfilled");
  const outcomes = bulk.value;
  assert.ok(outcomes.skipped_users.some((user) => user.student_employee_id === loanStudentId && user.reasons.includes("active_loans")));
  assert.ok(outcomes.skipped_users.some((user) => user.student_employee_id === pendingStudentId && user.reasons.includes("active_reservations")));
  const fineAfter = await listUnsettledBorrowings({ userId: fineUserId });
  assert.equal(fineAfter.summary.total_unsettled_amount, 0);

  const [[archiveStates]] = await db.query(
    `SELECT
       (SELECT deleted_at IS NULL FROM users WHERE id = ?) AS loan_user_active,
       (SELECT deleted_at IS NULL FROM users WHERE id = ?) AS reservation_user_active,
       (SELECT deleted_at IS NOT NULL FROM users WHERE id = ?) AS eligible_user_archived`,
    [fixture.userId, pendingUserId, eligibleUserId],
  );
  assert.equal(Number(archiveStates.loan_user_active), 1);
  assert.equal(Number(archiveStates.reservation_user_active), 1);
  assert.equal(Number(archiveStates.eligible_user_archived), 1);
  const [[reservationRow]] = await db.query("SELECT status FROM reservations WHERE id = ?", [pending.reservationId]);
  assert.equal(reservationRow.status, "pending");

  await borrowingTransactions.returnBook(loan.borrowingId, fixture.userId, { actorId: 1 });
  await reservationService.cancelReservation(pending.reservationId, pendingUserId);
});

test("database: application restore retains a claim made after the saved snapshot", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const [copy] = await createBookCopies(runId, 1);
  const snapshot = await createBackupPayload();
  await preflightRestore(snapshot);
  const accession = `IT-${runId}-RESTORE`;
  await holdingsService.updateHolding(copy.id, { accession_number: accession, location: "Restore fixture" }, 1);
  await holdingsService.voidAccession(copy.id, { reason: "Snapshot restore integration" }, 1);
  const pendingAuditEventId = randomUUID();
  await db.query(
    `INSERT INTO delivery_outbox (id, event_type, payload, status, created_at)
     VALUES (?, 'audit', ?, 'pending', DATE_ADD(?, INTERVAL 1 DAY))`,
    [pendingAuditEventId, JSON.stringify({
      actorId: 1,
      category: "catalog",
      action: "updated",
      description: `Pending post-snapshot audit ${runId}`,
      route: "/api/admin/test/audit",
      metadata: { detail_status: "state_transition", changes: [{ field: "Test state", before: "Before", after: "After" }] },
    }), snapshot.createdAt.slice(0, 19).replace("T", " ")],
  );

  const restoreResult = await restoreRepository.replaceApplicationData(snapshot, {
    restoredBy: 1,
    restoredByName: "Integration Super Admin",
    restoredByRole: "super_admin",
    snapshotKind: "manual",
    snapshotLabel: "pre-accession integration snapshot",
    invalidateSessions: async () => undefined,
  });

  const [[restoredHolding]] = await db.query(
    `SELECT h.accession_number, h.location, bc.id AS copy_id, bc.barcode, bk.title,
       EXISTS(SELECT 1 FROM accession_claim_voids voided WHERE voided.accession_number = h.accession_number) AS accession_voided
       FROM copy_holdings h JOIN book_copies bc ON bc.id = h.copy_id
       JOIN books bk ON bk.id = bc.book_id WHERE bc.barcode = ?`,
    [copy.barcode],
  );
  assert.equal(restoredHolding.accession_number, accession);
  assert.equal(restoredHolding.location, "Restore fixture");
  assert.equal(Number(restoredHolding.copy_id), copy.id);
  assert.equal(Number(restoredHolding.accession_voided), 1, "void state survives a restore to a pre-assignment application snapshot");
  const [[claim]] = await db.query("SELECT copy_barcode, book_id FROM accession_claims WHERE accession_number = ?", [accession]);
  assert.equal(claim.copy_barcode, copy.barcode);
  assert.equal(Number(claim.book_id), copy.bookId);
  const [[orphanedClaims]] = await db.query(
    `SELECT COUNT(DISTINCT claim.copy_barcode) AS count
       FROM accession_claims claim
      WHERE NOT EXISTS (SELECT 1 FROM book_copies restored_copy WHERE restored_copy.barcode = claim.copy_barcode)`,
  );
  assert.equal(
    restoreResult.orphanedAccessionClaimCount,
    Number(orphanedClaims.count),
    "restore reports pre-existing and newly orphaned claims without treating this restored copy as missing",
  );
  const [[permanentAudit]] = await db.query(
    `SELECT COUNT(*) AS retained FROM audit_events
      WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.permanent_accession_event')) = 'true'`,
  );
  assert.ok(Number(permanentAudit.retained) > 0, "the first assignment audit remains available after the application restore");
  const [[pendingAudit]] = await db.query(
    "SELECT description, restore_status, reversed_by_restore_id FROM audit_events WHERE event_key = ?",
    [pendingAuditEventId],
  );
  assert.equal(pendingAudit.description, `Pending post-snapshot audit ${runId}`);
  assert.equal(pendingAudit.restore_status, "reversed", "a pending post-snapshot event is preserved and classified as reversed");
  assert.ok(pendingAudit.reversed_by_restore_id);
});

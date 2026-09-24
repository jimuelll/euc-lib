const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const db = require("../db");
const circulationService = require("../modules/circulation/circulation.service");
const borrowingTransactions = require("../modules/borrowing/borrowing.transaction.service");
const borrowingAdminService = require("../modules/borrowing/borrowing.admin.service");
const adminService = require("../modules/admin/admin.service");
const catalogQueryService = require("../modules/catalog/catalog.query.service");
const catalogAvailability = require("../modules/catalog/catalog.availability.service");
const catalogSettings = require("../modules/catalog/catalog.settings.service");
const copyStateService = require("../modules/catalog/catalog.copy-state.service");
const holdingsService = require("../modules/catalog/catalog.holdings.service");
const recommendationsRepository = require("../modules/recommendations/recommendations.repository");
const myLibraryRepository = require("../modules/my-library/my-library.repository");
const reservationService = require("../modules/reservation/reservation.service");
const reservationRepository = require("../modules/reservation/reservation.repository");
const clearanceService = require("../modules/clearance/clearance.service");
const settingsService = require("../modules/library-settings/library-settings.service");
const queryService = require("../modules/query/query.service");
const reportService = require("../modules/query/report.service");
const { listUnsettledBorrowings } = require("../modules/borrowing/overdue.helper");

// Real database fixtures create audit and transaction rows. Never run against a
// configured library database or a database without an explicit *_test name.
const enabled = process.env.RUN_DB_INTEGRATION === "1" && /_test$/i.test(process.env.DB_NAME || "");

async function createFixture(prefix, { initialFine = 0, finePerHour = 0.5, copyCount = 1, accessionCount = copyCount } = {}) {
  const runId = `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const [policyResult] = await db.query(
    `INSERT INTO book_types
       (name, default_borrow_days, loan_duration_minutes, loan_duration_unit, fine_per_hour, fine_interval, initial_fine, is_active)
     VALUES (?, 7, 10080, 'day', ?, 'hour', ?, 1)`,
    [`Policy ${runId}`, finePerHour, initialFine],
  );
  const [bookResult] = await db.query(
    "INSERT INTO books (title, author, material_type, book_type_id, copies) VALUES (?, 'Cross-system test', 'book', ?, ?)",
    [`Book ${runId}`, policyResult.insertId, copyCount],
  );
  const studentId = `X-${runId}`;
  const [userResult] = await db.query(
    "INSERT INTO users (student_employee_id, name, password_hash, role, is_active, must_change_password) VALUES (?, ?, 'integration-test-hash', 'student', 1, 0)",
    [studentId, `Patron ${runId}`],
  );
  const copies = [];
  for (let index = 0; index < copyCount; index += 1) {
    const barcode = `LIB-${String(bookResult.insertId).padStart(6, "0")}-${String(index + 1).padStart(3, "0")}`;
    const [copyResult] = await db.query("INSERT INTO book_copies (book_id, barcode) VALUES (?, ?)", [bookResult.insertId, barcode]);
    const copy = { id: copyResult.insertId, barcode, accession: index < accessionCount ? `ACC-${runId}-${index + 1}` : null };
    if (copy.accession) await holdingsService.updateHolding(copy.id, { accession_number: copy.accession }, 1);
    copies.push(copy);
  }
  const [firstCopy] = copies;
  return {
    runId,
    policyId: policyResult.insertId,
    bookId: bookResult.insertId,
    userId: userResult.insertId,
    studentId,
    copyId: firstCopy.id,
    barcode: firstCopy.barcode,
    accession: firstCopy.accession,
    copies,
    title: `Book ${runId}`,
  };
}

test("database: concurrent renewal and return leave one returned loan and a consistent fine cycle", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const fixture = await createFixture("renew-return");
  const loan = await borrowingTransactions.borrowBook(fixture.userId, fixture.bookId, 1);
  const results = await Promise.allSettled([
    circulationService.processRenew({ borrowingId: loan.borrowingId, renewedBy: 1 }),
    borrowingTransactions.returnBook(loan.borrowingId, fixture.userId, { actorId: 1 }),
  ]);
  assert.equal(results[1].status, "fulfilled", "the return must win or follow the renewal under the loan lock");
  if (results[0].status === "rejected") assert.equal(results[0].reason.status, 409);

  const [[state]] = await db.query(
    `SELECT b.status, b.due_date, b.returned_at, fa.charged_amount, fa.cycle_base_amount
       FROM borrowings b JOIN fine_accounts fa ON fa.borrowing_id = b.id WHERE b.id = ?`,
    [loan.borrowingId],
  );
  assert.equal(state.status, "returned", "a renewal must never restore a returned loan to borrowed");
  assert.ok(state.returned_at);
  assert.ok(Number(state.charged_amount) >= Number(state.cycle_base_amount));
});

test("database: count reduction retires unaccessioned and returned copies but preserves loan and reservation commitments", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const fixture = await createFixture("count-lifecycle", { copyCount: 4, accessionCount: 2 });
  const pendingStudentId = `P-${fixture.runId}`;
  const [pendingUserResult] = await db.query(
    "INSERT INTO users (student_employee_id, name, password_hash, role, is_active, must_change_password) VALUES (?, ?, 'integration-test-hash', 'student', 1, 0)",
    [pendingStudentId, `Pending ${fixture.runId}`],
  );
  const firstLoan = await borrowingTransactions.borrowBook(fixture.userId, fixture.copies[0].accession, 1, { isCopyBarcode: true });
  await borrowingTransactions.returnBook(firstLoan.borrowingId, fixture.userId, { actorId: 1 });
  const activeLoan = await borrowingTransactions.borrowBook(fixture.userId, fixture.copies[0].accession, 1, { isCopyBarcode: true });
  const pendingReservation = await reservationService.reserveBook(pendingUserResult.insertId, fixture.bookId);

  await catalogAvailability.syncBookCopies(fixture.bookId, 2);
  const [afterSafeReduction] = await db.query(
    "SELECT id, is_active FROM book_copies WHERE book_id = ? ORDER BY id",
    [fixture.bookId],
  );
  assert.deepEqual(afterSafeReduction.map((row) => Number(row.is_active)), [1, 1, 0, 0], "unaccessioned copies retire first while the loan and pending reservation remain serviceable");
  await assert.rejects(
    catalogAvailability.syncBookCopies(fixture.bookId, 1),
    (error) => error.status === 409 && /pending reservation/i.test(error.message),
  );

  await reservationService.markReservationReady(pendingReservation.reservationId, 1);
  await assert.rejects(
    catalogAvailability.syncBookCopies(fixture.bookId, 1),
    (error) => error.status === 409 && /prepared for pickup/i.test(error.message),
  );
  const checkout = await borrowingTransactions.borrowBook(
    pendingUserResult.insertId,
    fixture.copies[1].barcode,
    1,
    { isCopyBarcode: true, reservationId: pendingReservation.reservationId },
  );
  assert.equal(checkout.copyId, fixture.copies[1].id);
  await assert.rejects(catalogAvailability.syncBookCopies(fixture.bookId, 1), (error) => error.status === 409);

  await borrowingTransactions.returnBook(checkout.borrowingId, pendingUserResult.insertId, { actorId: 1 });
  await borrowingTransactions.returnBook(activeLoan.borrowingId, fixture.userId, { actorId: 1 });
  await catalogAvailability.syncBookCopies(fixture.bookId, 0);
  const [[finalCounts]] = await db.query(
    `SELECT bk.copies,
       (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = bk.id AND bc.is_active = 1 AND bc.deleted_at IS NULL) AS active_copies,
       (SELECT COUNT(*) FROM borrowings b WHERE b.book_id = bk.id AND b.status IN ('borrowed','overdue') AND b.deleted_at IS NULL) AS active_loans
       FROM books bk WHERE bk.id = ?`,
    [fixture.bookId],
  );
  assert.deepEqual([Number(finalCounts.copies), Number(finalCounts.active_copies), Number(finalCounts.active_loans)], [0, 0, 0]);
});

test("database: pending reservations keep a preparation copy and preparation locks the catalog record", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const fixture = await createFixture("pending-preparation", { copyCount: 2, accessionCount: 2 });
  const pendingStudentId = `P-${fixture.runId}`;
  const otherStudentId = `O-${fixture.runId}`;
  const [pendingUser] = await db.query(
    "INSERT INTO users (student_employee_id, name, password_hash, role, is_active, must_change_password) VALUES (?, ?, 'integration-test-hash', 'student', 1, 0)",
    [pendingStudentId, `Pending ${fixture.runId}`],
  );
  const [otherUser] = await db.query(
    "INSERT INTO users (student_employee_id, name, password_hash, role, is_active, must_change_password) VALUES (?, ?, 'integration-test-hash', 'student', 1, 0)",
    [otherStudentId, `Other ${fixture.runId}`],
  );
  const reservation = await reservationService.reserveBook(pendingUser.insertId, fixture.bookId);

  const firstCheckout = await borrowingTransactions.borrowBook(fixture.userId, fixture.bookId, 1);
  await assert.rejects(
    borrowingTransactions.borrowBook(otherUser.insertId, fixture.bookId, 1),
    (error) => error.status === 409 && /pending reservation/i.test(error.message),
    "a normal checkout must leave enough eligible copies for each pending reservation",
  );

  const locker = await db.getConnection();
  const originalFindBook = reservationRepository.findBookForReservation;
  let notifyBookLockReached;
  const bookLockReached = new Promise((resolve) => { notifyBookLockReached = resolve; });
  try {
    await locker.beginTransaction();
    await locker.query("SELECT id FROM books WHERE id = ? FOR UPDATE", [fixture.bookId]);
    reservationRepository.findBookForReservation = async (...args) => {
      notifyBookLockReached();
      return originalFindBook(...args);
    };
    const preparation = reservationService.markReservationReady(reservation.reservationId, 1);
    let lockTimeout;
    try {
      await Promise.race([
        bookLockReached,
        new Promise((_, reject) => { lockTimeout = setTimeout(() => reject(new Error("Preparation did not attempt to lock its book")), 5000); }),
      ]);
    } finally { clearTimeout(lockTimeout); }
    const [[stillPending]] = await locker.query("SELECT status FROM reservations WHERE id = ?", [reservation.reservationId]);
    assert.equal(stillPending.status, "pending", "preparation waits for the count-changing transaction's book lock");
    await locker.commit();
    await preparation;
  } catch (error) {
    await locker.rollback().catch(() => {});
    throw error;
  } finally {
    reservationRepository.findBookForReservation = originalFindBook;
    locker.release();
  }

  const [[ready]] = await db.query("SELECT status, reserved_copy_id FROM reservations WHERE id = ?", [reservation.reservationId]);
  assert.equal(ready.status, "ready");
  const checkout = await borrowingTransactions.borrowBook(
    pendingUser.insertId,
    fixture.copies[Number(ready.reserved_copy_id) === fixture.copies[0].id ? 0 : 1].barcode,
    1,
    { isCopyBarcode: true, reservationId: reservation.reservationId },
  );
  assert.equal(checkout.copyId, Number(ready.reserved_copy_id));
  await borrowingTransactions.returnBook(checkout.borrowingId, pendingUser.insertId, { actorId: 1 });
  await borrowingTransactions.returnBook(firstCheckout.borrowingId, fixture.userId, { actorId: 1 });
});

test("database: OPAC, recommendations, inventory, and history follow the copy lifecycle", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const fixture = await createFixture("surface-lifecycle", { copyCount: 3, accessionCount: 1 });
  const initialSettings = await catalogSettings.getCatalogSettings();
  try {
    await catalogSettings.updateCatalogSettings(true, 1);
    const visible = await catalogQueryService.searchBooks(fixture.runId, true, false, "book", 1, 100);
    const visibleBook = visible.rows.find((book) => Number(book.id) === fixture.bookId);
    assert.ok(visibleBook);
    assert.equal(Number(visibleBook.available), 1);
    assert.equal(Boolean(visibleBook.canBorrow), true);

    const candidatesWithUnheld = await recommendationsRepository.findActiveCandidates("book", [], { showUnheldInOpac: true });
    assert.equal(Number(candidatesWithUnheld.find((book) => Number(book.id) === fixture.bookId)?.available), 1);
    const inventory = await reportService.listReport({ report: "holdings_inventory", search: fixture.runId, page: 1, limit: 100 });
    assert.equal(inventory.pagination.total, 3);
    assert.equal(inventory.rows.filter((row) => row.accessionStatus === "Assigned").length, 1);
    assert.equal(inventory.rows.filter((row) => row.accessionStatus === "Needs accession").length, 2);

    const loan = await borrowingTransactions.borrowBook(fixture.userId, fixture.accession, 1, { isCopyBarcode: true });
    const checkedOut = await catalogQueryService.searchBooks(fixture.runId, true, false, "book", 1, 100);
    const checkedOutBook = checkedOut.rows.find((book) => Number(book.id) === fixture.bookId);
    assert.equal(Number(checkedOutBook.available), 0);
    assert.equal(Boolean(checkedOutBook.canBorrow), false);
    await borrowingTransactions.returnBook(loan.borrowingId, fixture.userId, { actorId: 1 });

    await copyStateService.retireCopy(fixture.copyId, 1);
    await catalogSettings.updateCatalogSettings(false, 1);
    const hiddenWhenNoEligibleCopies = await catalogQueryService.searchBooks(fixture.runId, true, false, "book", 1, 100);
    assert.equal(hiddenWhenNoEligibleCopies.rows.some((book) => Number(book.id) === fixture.bookId), false);
    const candidatesWithoutUnheld = await recommendationsRepository.findActiveCandidates("book", [], { showUnheldInOpac: false });
    assert.equal(candidatesWithoutUnheld.some((book) => Number(book.id) === fixture.bookId), false);
    const unavailableInventory = await reportService.listReport({ report: "holdings_inventory", search: fixture.runId, status: "inactive", page: 1, limit: 100 });
    assert.equal(unavailableInventory.pagination.total, 1);
    assert.equal(unavailableInventory.rows[0].lendingEligibility, "Not eligible");

    await catalogSettings.updateCatalogSettings(true, 1);
    const visibleUnavailable = await catalogQueryService.searchBooks(fixture.runId, true, false, "book", 1, 100);
    const unavailableBook = visibleUnavailable.rows.find((book) => Number(book.id) === fixture.bookId);
    assert.ok(unavailableBook);
    assert.equal(Number(unavailableBook.available), 0);
    assert.equal(Boolean(unavailableBook.canBorrow), false);

    await catalogQueryService.deleteBook(fixture.bookId, 1);
    const archivedFromOpac = await catalogQueryService.searchBooks(fixture.runId, true, false, "book", 1, 100);
    assert.equal(archivedFromOpac.rows.some((book) => Number(book.id) === fixture.bookId), false);
    const archivedRecommendation = await recommendationsRepository.findActiveCandidates("book", [], { showUnheldInOpac: true });
    assert.equal(archivedRecommendation.some((book) => Number(book.id) === fixture.bookId), false);
    const historicalUsage = await reportService.listReport({ report: "resource_usage", search: fixture.runId, page: 1, limit: 100 });
    const historicalBook = historicalUsage.rows.find((row) => row.title === fixture.title);
    assert.equal(Number(historicalBook?.borrowings), 1);
    const patronHistory = await myLibraryRepository.findBorrowHistory(fixture.userId);
    assert.ok(patronHistory.some((row) => Number(row.copy_id) === fixture.copyId && row.copy_barcode === fixture.barcode));
  } finally {
    await catalogSettings.updateCatalogSettings(initialSettings.show_unheld_in_opac, 1);
  }
});

test("database: checkout commits with a durable notification event and cannot be duplicated while delivery is pending", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const fixture = await createFixture("checkout-outbox");
  const loan = await borrowingTransactions.borrowBook(fixture.userId, fixture.bookId, 1);
  assert.ok(loan.borrowingId);
  const [[event]] = await db.query(
    `SELECT COUNT(*) AS total
       FROM delivery_outbox
      WHERE event_type = 'notification'
        AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.type')) = 'borrowing_created'
        AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.audienceUserId')) = ?`,
    [String(fixture.userId)],
  );
  assert.equal(Number(event.total), 1, "the committed loan has exactly one durable notification event awaiting dispatch");
  await assert.rejects(
    borrowingTransactions.borrowBook(fixture.userId, fixture.bookId, 1),
    (error) => error.status === 409,
    "retrying checkout while delivery is pending must not create a second loan",
  );
  const [[state]] = await db.query(
    `SELECT COUNT(*) AS loans
       FROM borrowings
      WHERE user_id = ? AND book_id = ? AND deleted_at IS NULL AND status IN ('borrowed','overdue')`,
    [fixture.userId, fixture.bookId],
  );
  assert.equal(Number(state.loans), 1);
});

test("database: unpaid ledger balances block user, book, direct-edit, and loan archives until payment", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const fixture = await createFixture("archive-fine", { initialFine: 5, finePerHour: 1 });
  const loan = await borrowingTransactions.borrowBook(fixture.userId, fixture.bookId, 1);
  await db.query("UPDATE borrowings SET due_date = UTC_TIMESTAMP() - INTERVAL 3 HOUR WHERE id = ?", [loan.borrowingId]);
  await borrowingTransactions.returnBook(loan.borrowingId, fixture.userId, { actorId: 1 });
  assert.ok((await listUnsettledBorrowings({ userId: fixture.userId })).summary.total_unsettled_amount > 0);

  const conflicts = await Promise.allSettled([
    adminService.deleteUser(fixture.studentId, "super_admin", 1),
    adminService.updateUser(fixture.studentId, { is_active: 0 }, "super_admin", 1),
    catalogQueryService.deleteBook(fixture.bookId, 1),
    borrowingAdminService.adminDeleteBorrowing(loan.borrowingId, 1),
  ]);
  assert.ok(conflicts.every((result) => result.status === "rejected" && result.reason.status === 409));
  const [[unchanged]] = await db.query(
    `SELECT u.deleted_at AS user_archived, b.deleted_at AS book_archived, l.deleted_at AS loan_archived, u.is_active
       FROM users u JOIN books b ON b.id = ? JOIN borrowings l ON l.id = ? WHERE u.id = ?`,
    [fixture.bookId, loan.borrowingId, fixture.userId],
  );
  assert.equal(unchanged.user_archived, null);
  assert.equal(unchanged.book_archived, null);
  assert.equal(unchanged.loan_archived, null);
  assert.equal(Number(unchanged.is_active), 1);

  await clearanceService.recordFullPayment({ studentEmployeeId: fixture.studentId, createdBy: 1 });
  assert.equal((await listUnsettledBorrowings({ userId: fixture.userId })).summary.total_unsettled_amount, 0);
  await borrowingAdminService.adminDeleteBorrowing(loan.borrowingId, 1);
  await adminService.deleteUser(fixture.studentId, "super_admin", 1);
  await catalogQueryService.deleteBook(fixture.bookId, 1);

  const [[archived]] = await db.query(
    `SELECT u.deleted_at AS user_archived, b.deleted_at AS book_archived, l.deleted_at AS loan_archived
       FROM users u JOIN books b ON b.id = ? JOIN borrowings l ON l.id = ? WHERE u.id = ?`,
    [fixture.bookId, loan.borrowingId, fixture.userId],
  );
  assert.ok(archived.user_archived);
  assert.ok(archived.book_archived);
  assert.ok(archived.loan_archived);
  assert.equal((await listUnsettledBorrowings({ userId: fixture.userId })).summary.total_unsettled_amount, 0);
});

test("database: term assignment and concurrent Set Current preserve one current term", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const first = await settingsService.createAcademicTerm({ name: `Term A ${runId}`, startsOn: "2031-01-01", endsOn: "2031-05-31", isCurrent: false }, 1);
  const second = await settingsService.createAcademicTerm({ name: `Term B ${runId}`, startsOn: "2031-06-01", endsOn: "2031-12-31", isCurrent: false }, 1);
  const outcomes = await Promise.allSettled([
    settingsService.setCurrentAcademicTerm(first.id, 1),
    settingsService.setCurrentAcademicTerm(second.id, 1),
  ]);
  assert.ok(outcomes.some((result) => result.status === "fulfilled"));
  const [[currentCount]] = await db.query("SELECT COUNT(*) AS total FROM academic_terms WHERE is_current = 1");
  assert.equal(Number(currentCount.total), 1);
  const [[current]] = await db.query("SELECT id FROM academic_terms WHERE is_current = 1");
  await assert.rejects(settingsService.updateAcademicTerm(Number(current.id), {
    name: `Unset ${runId}`, startsOn: "2031-01-01", endsOn: "2031-05-31", isCurrent: false,
  }, 1), (error) => error.status === 409);
  await assert.rejects(settingsService.deleteAcademicTerm(Number(current.id), 1), (error) => error.status === 409);
  await assert.rejects(settingsService.deleteAcademicTerm(999999999, 1), (error) => error.status === 404);

  const nonCurrent = Number(current.id) === Number(first.id) ? second : first;
  const [user] = await db.query(
    "INSERT INTO users (student_employee_id, name, password_hash, role, is_active, must_change_password, academic_term_id) VALUES (?, ?, 'integration-test-hash', 'student', 1, 0, ?)",
    [`TERM-${runId}`, `Term patron ${runId}`, nonCurrent.id],
  );
  assert.ok(user.insertId);
  await assert.rejects(settingsService.deleteAcademicTerm(nonCurrent.id, 1), (error) => error.status === 409);
  const [[stillAssigned]] = await db.query("SELECT academic_term_id FROM users WHERE id = ?", [user.insertId]);
  assert.equal(Number(stillAssigned.academic_term_id), Number(nonCurrent.id));
});

test("database: program, department, and holiday lifecycle preserves references and restores archived settings", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const fixture = await createFixture("settings-lifecycle");
  const program = await settingsService.createAcademicProgram({ name: `Program ${fixture.runId}` }, 1);
  await holdingsService.updateHolding(fixture.copyId, {
    accession_number: fixture.accession,
    program_id: program.id,
  }, 1);
  await db.query("UPDATE users SET program_id = ?, deleted_at = NOW(), is_active = 0, deleted_by = 1 WHERE id = ?", [program.id, fixture.userId]);

  const archivedProgram = await settingsService.deleteAcademicProgram(program.id, 1);
  assert.equal(archivedProgram.action, "archived");
  assert.equal(archivedProgram.user_reference_count, 1, "archived user references still prevent hard deletion");
  assert.equal(archivedProgram.holding_reference_count, 1);
  const oldHolding = (await holdingsService.getBookHoldings(fixture.bookId))[0];
  assert.equal(oldHolding.course, `Program ${fixture.runId}`);
  assert.equal(Number(oldHolding.program_is_active), 0);

  await holdingsService.updateHolding(fixture.copyId, {
    accession_number: fixture.accession,
    program_id: program.id,
    price: "18.25",
    location: "Updated shelf",
  }, 1);
  const editedHolding = (await holdingsService.getBookHoldings(fixture.bookId))[0];
  assert.equal(Number(editedHolding.price), 18.25);
  assert.equal(editedHolding.location, "Updated shelf");
  await assert.rejects(
    adminService.createUser({
      name: "Archived program test", password: "test-password", role: "student",
      library_card_number: `NEW-${fixture.runId}`, student_number: `ST-${fixture.runId}`,
      year_level: "1st Year", program_id: program.id,
    }, "super_admin", 1),
    /valid active program/i,
    "archived programs remain visible on old records but cannot be newly assigned",
  );
  assert.deepEqual(await settingsService.restoreAcademicProgram(program.id, 1), { success: true });

  const unusedProgram = await settingsService.createAcademicProgram({ name: `Unused ${fixture.runId}` }, 1);
  assert.equal((await settingsService.deleteAcademicProgram(unusedProgram.id, 1)).action, "deleted");
  const [[missingProgram]] = await db.query("SELECT id FROM academic_programs WHERE id = ?", [unusedProgram.id]);
  assert.equal(missingProgram, undefined);

  const department = await settingsService.createDepartment({ name: `Department ${fixture.runId}` }, 1);
  const [employee] = await db.query(
    "INSERT INTO users (student_employee_id, name, password_hash, role, is_active, must_change_password, department_id) VALUES (?, ?, 'integration-test-hash', 'employee', 1, 0, ?)",
    [`EMP-${fixture.runId}`, `Employee ${fixture.runId}`, department.id],
  );
  await db.query("UPDATE users SET deleted_at = NOW(), is_active = 0, deleted_by = 1 WHERE id = ?", [employee.insertId]);
  const archivedDepartment = await settingsService.deleteDepartment(department.id, 1);
  assert.equal(archivedDepartment.action, "archived");
  assert.equal(archivedDepartment.user_reference_count, 1);
  assert.deepEqual(await settingsService.restoreDepartment(department.id, 1), { success: true });

  const dayOffset = Number.parseInt(fixture.runId.slice(-4), 16) % 3000;
  const holidayDate = new Date(Date.UTC(2090, 0, 1 + dayOffset)).toISOString().slice(0, 10);
  const holiday = await settingsService.createHoliday({ name: `Holiday ${fixture.runId}`, holidayDate }, 1);
  const archivedHoliday = await settingsService.deleteHoliday(holiday.id, 1);
  assert.equal(archivedHoliday.action, "archived");
  await assert.rejects(
    settingsService.createHoliday({ name: `Replacement ${fixture.runId}`, holidayDate }, 1),
    (error) => error.status === 409,
    "holiday usage is not provably absent from persisted due dates, so its date stays reserved while archived",
  );
  assert.equal((await settingsService.restoreHoliday(holiday.id, 1)).restored, true);
});

test("database: policy reassignment/deletion and archival keep historical previews, filters, exports, and aggregates", {
  skip: enabled ? false : "requires RUN_DB_INTEGRATION=1 and DB_NAME ending in _test",
}, async () => {
  const fixture = await createFixture("policy-history", { finePerHour: 0.25 });
  await db.query(
    "INSERT INTO attendance_logs (user_id, scanned_id, type, purpose) VALUES (?, ?, 'check_in', 'entry_exit')",
    [fixture.userId, fixture.studentId],
  );
  const loan = await borrowingTransactions.borrowBook(fixture.userId, fixture.bookId, 1);
  const [replacementPolicy] = await db.query(
    `INSERT INTO book_types
       (name, default_borrow_days, loan_duration_minutes, loan_duration_unit, fine_per_hour, fine_interval, initial_fine, is_active)
     VALUES (?, 1, 60, 'hour', 9.00, 'hour', 20.00, 1)`,
    [`Replacement policy ${fixture.runId}`],
  );
  await db.query("UPDATE books SET book_type_id = ? WHERE id = ?", [replacementPolicy.insertId, fixture.bookId]);
  const renewal = await circulationService.processRenew({ borrowingId: loan.borrowingId, renewedBy: 1 });
  assert.ok(new Date(renewal.dueDate).getTime() - Date.now() > 6 * 24 * 60 * 60 * 1000,
    "renewal uses policy A's saved seven-day duration after the book is assigned policy B");
  const [[savedTerms]] = await db.query(
    "SELECT loan_policy_id_snapshot, loan_policy_name_snapshot, loan_duration_minutes, fine_per_hour, initial_fine FROM borrowings WHERE id = ?",
    [loan.borrowingId],
  );
  assert.equal(Number(savedTerms.loan_policy_id_snapshot), Number(fixture.policyId));
  assert.equal(savedTerms.loan_policy_name_snapshot, `Policy ${fixture.runId}`);
  assert.equal(Number(savedTerms.loan_duration_minutes), 10080);
  assert.equal(Number(savedTerms.fine_per_hour), 0.25);
  assert.equal(Number(savedTerms.initial_fine), 0);
  await catalogQueryService.deleteBookType(fixture.policyId, 1);
  const [[reassignedBook]] = await db.query("SELECT book_type_id FROM books WHERE id = ?", [fixture.bookId]);
  assert.equal(Number(reassignedBook.book_type_id), Number(replacementPolicy.insertId));
  await db.query("UPDATE borrowings SET due_date = UTC_TIMESTAMP() - INTERVAL 2 HOUR WHERE id = ?", [loan.borrowingId]);
  await borrowingTransactions.returnBook(loan.borrowingId, fixture.userId, { actorId: 1 });
  assert.ok((await listUnsettledBorrowings({ userId: fixture.userId })).summary.total_unsettled_amount > 0);
  await clearanceService.recordFullPayment({ studentEmployeeId: fixture.studentId, createdBy: 1 });
  await catalogQueryService.deleteBook(fixture.bookId, 1);
  await adminService.deleteUser(fixture.studentId, "super_admin", 1);
  await borrowingAdminService.adminDeleteBorrowing(loan.borrowingId, 1);

  const filtered = await queryService.listQuery({ dataset: "borrowings", page: 1, limit: 10, search: fixture.title, bookType: String(fixture.policyId) });
  assert.equal(filtered.pagination.total, 1);
  assert.equal(filtered.rows[0].bookType, `Policy ${fixture.runId}`);
  const exported = await queryService.exportQuery({ dataset: "borrowings", search: fixture.title, bookType: String(fixture.policyId) });
  assert.equal(exported.rows.length, 1);
  assert.equal(exported.rows[0].title, fixture.title);
  assert.equal(exported.rows[0].bookType, `Policy ${fixture.runId}`);
  const attendanceHistory = await queryService.listQuery({ dataset: "attendance", page: 1, limit: 10, search: fixture.studentId });
  assert.equal(attendanceHistory.pagination.total, 1, "archiving a patron must not remove their historical attendance scan");
  assert.equal(attendanceHistory.rows[0].name, `Patron ${fixture.runId}`);

  const metadata = await queryService.getQueryMeta();
  assert.ok(metadata.bookTypes.some((item) => Number(item.id) === Number(fixture.policyId) && item.name === `Policy ${fixture.runId}`));
  const usagePreview = await reportService.listReport({ report: "resource_usage", search: fixture.title, page: 1, limit: 10 });
  assert.equal(usagePreview.pagination.total, 1);
  assert.equal(usagePreview.rows[0].bookType, `Policy ${fixture.runId}`);
  const usageExport = await reportService.exportReport({ report: "resource_usage", search: fixture.title });
  assert.equal(usageExport.rows.length, 1);
  assert.equal(usageExport.rows[0].borrowings, 1);
  assert.equal(usageExport.rows[0].bookType, `Policy ${fixture.runId}`);

  const finePreview = await reportService.listReport({ report: "fined", search: fixture.title, page: 1, limit: 10 });
  assert.equal(finePreview.pagination.total, 1);
  assert.equal(finePreview.rows[0].status, "Settled");
  assert.ok(Number(finePreview.rows[0].paidAmount) > 0);
  const fineExport = await reportService.exportReport({ report: "fined", search: fixture.title });
  assert.equal(fineExport.rows.length, 1);
  assert.equal(fineExport.rows[0].status, "Settled");
});

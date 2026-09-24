const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const holdingsRepository = require("../modules/catalog/catalog.holdings.repository");
const holdingsService = require("../modules/catalog/catalog.holdings.service");
const borrowingRepository = require("../modules/borrowing/borrowing.repository");
const transactionalAudit = require("../modules/analytics/transactional-audit");

const makeConnection = () => ({
  async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
  async query() { return [{ affectedRows: 1 }]; },
});

test("holding saves validate accession uniqueness inputs and preserve cent values", async () => {
  const originals = {
    getConnection: db.getConnection,
    getCopyForUpdate: holdingsRepository.getCopyForUpdate,
    findProgram: holdingsRepository.findProgram,
    insertAccessionClaim: holdingsRepository.insertAccessionClaim,
    insertHolding: holdingsRepository.insertHolding,
    updateHoldingDetails: holdingsRepository.updateHoldingDetails,
    getHoldingForCopy: holdingsRepository.getHoldingForCopy,
    enqueueTransactionalAudit: transactionalAudit.enqueueTransactionalAudit,
  };
  const writes = new Map();
  const claims = new Map();
  db.getConnection = async () => makeConnection();
  holdingsRepository.getCopyForUpdate = async (copyId) => ({ id: copyId, book_id: 5, barcode: `LIB-000005-${String(copyId).padStart(3,"0")}`, title: "Atlas", is_active: 1, accession_number: writes.get(copyId)?.accessionNumber ?? null, program_id: null, has_active_loan: 0, has_ready_reservation: copyId === 12 ? 1 : 0 });
  holdingsRepository.findProgram = async (id) => ({ id, is_active: 1 });
  holdingsRepository.insertAccessionClaim = async (copy, accessionNumber) => {
    if (claims.has(accessionNumber)) throw Object.assign(new Error("Duplicate entry for accession_claims.PRIMARY"), { code: "ER_DUP_ENTRY" });
    claims.set(accessionNumber, copy.id);
  };
  holdingsRepository.insertHolding = async (copyId, value) => writes.set(copyId, value);
  holdingsRepository.updateHoldingDetails = async (copyId, value) => writes.set(copyId, { ...value, accessionNumber: writes.get(copyId).accessionNumber });
  holdingsRepository.getHoldingForCopy = async (copyId) => ({ id: copyId, book_id: 5, barcode: `LIB-000005-${String(copyId).padStart(3,"0")}`, title: "Atlas", ...writes.get(copyId) });
  transactionalAudit.enqueueTransactionalAudit = async () => ({});
  try {
    await holdingsService.updateHolding(12, {
      accession_number: " ACC-12 ", price: "1.15", program_id: "4", course_code: "CS101",
      location: "Shelf A", date_acquired: "2026-09-23", distributor: "Books Inc", invoice_reference: "OR-8",
    }, 2);
    assert.equal(writes.get(12).accessionNumber, "ACC-12");
    assert.equal(writes.get(12).price, "1.15");
    assert.equal(writes.get(12).programId, 4);
    await holdingsService.updateHolding(13, { accession_number: "ACC-13" }, 2);
    assert.equal(writes.get(13).accessionNumber, "ACC-13");
    assert.notEqual(writes.get(12).accessionNumber, writes.get(13).accessionNumber);
    await assert.rejects(holdingsService.updateHolding(13, { accession_number: "ACC-12" }, 2), /permanent/);
    await assert.rejects(holdingsService.updateHolding(12, { accession_number: "" }, 2), { status: 409 });
    await assert.rejects(holdingsService.updateHolding(14, { accession_number: "ACC-12" }, 2), /already been claimed/);

    await assert.rejects(holdingsService.updateHolding(12, { accession_number: "LIB-000123-001" }, 2), { status: 400 });
    await assert.rejects(holdingsService.updateHolding(12, { accession_number: "ACC-13", price: "1.999" }, 2), { status: 400 });
    assert.equal(writes.size, 2);
  } finally {
    db.getConnection = originals.getConnection;
    holdingsRepository.getCopyForUpdate = originals.getCopyForUpdate;
    holdingsRepository.findProgram = originals.findProgram;
    holdingsRepository.insertAccessionClaim = originals.insertAccessionClaim;
    holdingsRepository.insertHolding = originals.insertHolding;
    holdingsRepository.updateHoldingDetails = originals.updateHoldingDetails;
    holdingsRepository.getHoldingForCopy = originals.getHoldingForCopy;
    transactionalAudit.enqueueTransactionalAudit = originals.enqueueTransactionalAudit;
  }
});

test("existing accession cannot change while a copy is loaned or prepared", async () => {
  const originals = { getConnection: db.getConnection, getCopyForUpdate: holdingsRepository.getCopyForUpdate, updateHoldingDetails: holdingsRepository.updateHoldingDetails, enqueueTransactionalAudit: transactionalAudit.enqueueTransactionalAudit };
  db.getConnection = async () => makeConnection();
  holdingsRepository.getCopyForUpdate = async () => ({ id: 12, book_id: 5, barcode: "LIB-000005-012", title: "Atlas", is_active: 1, accession_number: "ACC-12", program_id: null, has_active_loan: 1, has_ready_reservation: 0 });
  let writes = 0;
  holdingsRepository.updateHoldingDetails = async () => { writes += 1; };
  transactionalAudit.enqueueTransactionalAudit = async () => ({});
  try {
    await assert.rejects(holdingsService.updateHolding(12, { accession_number: "ACC-13" }, 2), { status: 409 });
    assert.equal(writes, 0);
  } finally {
    db.getConnection = originals.getConnection;
    holdingsRepository.getCopyForUpdate = originals.getCopyForUpdate;
    holdingsRepository.updateHoldingDetails = originals.updateHoldingDetails;
    transactionalAudit.enqueueTransactionalAudit = originals.enqueueTransactionalAudit;
  }
});

test("copy resolution accepts an accession or the existing QR barcode, and returns the exact copy loan", async () => {
  const originalQuery = db.query;
  const statements = [];
  db.query = async (sql, params) => {
    statements.push({ sql, params });
    if (sql.includes("AS has_holding")) return [[{ id: 12, barcode: "LIB-000123-001", accession_number: "ACC-12", has_holding: 1 }]];
    return [[{ id: 90, user_id: 7, copy_id: 12 }]];
  };
  try {
    const copy = await borrowingRepository.findCopyByBarcode("ACC-12");
    const typedLoan = await borrowingRepository.findActiveBorrowingByCopyBarcode("ACC-12");
    const qrLoan = await borrowingRepository.findActiveBorrowingByCopyBarcode("LIB-000123-001");
    const checkoutStatements = [];
    const checkoutConn = { query: async (sql, params) => { checkoutStatements.push({ sql, params }); return [[{ id: 12, accession_number: "ACC-12" }]]; } };
    await borrowingRepository.findCopyForBorrow("ACC-12", checkoutConn);
    await borrowingRepository.findCopyForBorrow("LIB-000123-001", checkoutConn);
    assert.equal(copy.accession_number, "ACC-12");
    assert.equal(typedLoan.copy_id, 12);
    assert.equal(qrLoan.copy_id, 12);
    assert.match(statements[0].sql, /bc\.barcode = \? OR h\.accession_number = \?/);
    assert.match(statements[1].sql, /bc\.barcode = \? OR h\.accession_number = \?/);
    assert.match(statements[1].sql, /SELECT b\.id, b\.user_id, b\.copy_id/);
    assert.equal(checkoutStatements.length, 2);
    for (const statement of checkoutStatements) assert.match(statement.sql, /bc\.barcode = \? OR h\.accession_number = \?/);
    assert.deepEqual(checkoutStatements.map(({ params }) => params[0]), ["ACC-12", "LIB-000123-001"]);
  } finally { db.query = originalQuery; }
});

test("historical patron borrowing rows keep the physical copy identity after copy archival", async () => {
  const originalQuery = db.query;
  let statement = "";
  db.query = async (sql) => { statement = sql; return [[], []]; };
  try {
    await borrowingRepository.findBorrowHistory(7);
    assert.match(statement, /bc\.barcode AS copy_barcode/);
    assert.doesNotMatch(statement, /bc\.deleted_at IS NULL/);
    assert.match(statement, /b\.copy_id/);
  } finally { db.query = originalQuery; }
});

test("all checkout and reservation copy selectors filter to accessioned copies", async () => {
  const originals = { searchBooks: require("../modules/catalog/catalog.repository").searchBooks, query: db.query };
  const catalogRepository = require("../modules/catalog/catalog.repository");
  const reservationRepository = require("../modules/reservation/reservation.repository");
  const reservationQuery = reservationRepository.findAvailableCopyForReservation;
  const reservationBookQuery = reservationRepository.findBookForReservation;
  const borrowingQuery = borrowingRepository.findAvailableCopyForBook;
  const captured = [];
  db.query = async (sql, params) => { captured.push({ sql, params }); return [[{ total: 0 }]]; };
  const conn = { query: async (sql, params) => { captured.push({ sql, params }); return [[{ id: 12 }]]; } };
  try {
    await catalogRepository.searchBooks({ query: "Atlas", publicOnly: true, page: 1, showUnheldInOpac: false });
    await borrowingQuery(5, conn);
    await reservationQuery(5, conn);
    await reservationBookQuery(5, conn);
    await borrowingRepository.findCopyByBarcode("ACC-12");
    await catalogRepository.searchBooks({ query: "Atlas", publicOnly: true, page: 1, showUnheldInOpac: true });
    const checkoutSelectors = captured.filter(({ sql }) => /FROM book_copies bc[\s\S]*LIMIT 1 FOR UPDATE/.test(sql));
    assert.equal(checkoutSelectors.length, 2);
    for (const { sql } of checkoutSelectors) {
      assert.match(sql, /EXISTS \([\s\S]*FROM copy_holdings/);
      assert.match(sql, /accession_claim_voids/);
      assert.match(sql, /bc\.is_active = 1/);
    }
    const registeredCount = captured.find(({ sql }) => sql.includes("AS registered_copy_count"));
    assert.ok(registeredCount);
    assert.match(registeredCount.sql, /h\.accession_number IS NOT NULL/);
    assert.match(registeredCount.sql, /accession_claim_voids/);
    const catalogSearches = captured.filter(({ sql }) => sql.includes("FROM books bk") && sql.includes("book_copies"));
    assert.ok(catalogSearches.some(({ sql }) => /EXISTS \([\s\S]*copy_holdings/.test(sql)));
    const copyLookup = captured.find(({ sql }) => sql.includes("AS borrow_eligible") && sql.includes("AS needs_policy"));
    assert.ok(copyLookup);
    assert.match(copyLookup.sql, /h\.accession_number IS NOT NULL/);
    assert.match(copyLookup.sql, /active_policy\.is_active = 1/);
  } finally {
    db.query = originals.query;
    require("../modules/catalog/catalog.repository").searchBooks = originals.searchBooks;
  }
});

test("global holdings search applies course, completion, and circulation filters", async () => {
  const originalQuery = db.query;
  const statements = [];
  db.query = async (sql, params) => { statements.push({ sql, params }); return [[{ total: 0 }]]; };
  try {
    await holdingsRepository.searchHoldings({ query: "Atlas", programId: 8, status: "available", completion: "complete", page: 1, limit: 25 });
    assert.match(statements[0].sql, /h\.program_id = \?/);
    assert.match(statements[0].sql, /h\.accession_number IS NOT NULL/);
    assert.match(statements[0].sql, /bc\.is_active = 1/);
    assert.match(statements[0].sql, /NOT EXISTS \(SELECT 1 FROM borrowings/);
    assert.match(statements[0].sql, /NOT EXISTS \(SELECT 1 FROM reservations/);
    assert.deepEqual(statements[0].params.slice(-1), [8]);
    assert.equal(statements[1].params.at(-2), 25);
  } finally { db.query = originalQuery; }
});

test("catalog visibility setting can be saved in both states", async () => {
  const settings = require("../modules/catalog/catalog.settings.service");
  const originalQuery = db.query;
  const originalGetConnection = db.getConnection;
  let visible = 1;
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql, params = []) {
      if (sql.includes("INSERT INTO catalog_settings")) return [{ affectedRows: 1 }];
      if (sql.includes("SELECT show_unheld_in_opac FROM catalog_settings")) return [[{ show_unheld_in_opac: visible }]];
      if (sql.includes("UPDATE catalog_settings SET show_unheld_in_opac")) { visible = params[0]; return [{ affectedRows: 1 }]; }
      if (sql.includes("SELECT show_unheld_in_opac, updated_at")) return [[{ show_unheld_in_opac: visible, updated_at: "2026-09-23" }]];
      if (sql.includes("INSERT INTO delivery_outbox")) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected transaction query: ${sql}`);
    },
  };
  db.getConnection = async () => connection;
  db.query = async (sql, params = []) => {
    if (sql.includes("SELECT show_unheld_in_opac")) return [[{ show_unheld_in_opac: visible, updated_at: "2026-09-23" }]];
    throw new Error(`Unexpected query: ${sql}`);
  };
  try {
    assert.equal((await settings.getCatalogSettings()).show_unheld_in_opac, true);
    assert.equal((await settings.updateCatalogSettings(false, 2)).show_unheld_in_opac, false);
    assert.equal((await settings.updateCatalogSettings(true, 2)).show_unheld_in_opac, true);
    await assert.rejects(settings.updateCatalogSettings("false", 2), { status: 400 });
  } finally { db.query = originalQuery; db.getConnection = originalGetConnection; }
});

test("patron borrowing and recommendations follow the catalog visibility setting", async () => {
  const catalogSettings = require("../modules/catalog/catalog.settings.service");
  const borrowingPath = require.resolve("../modules/borrowing/borrowing.read.service");
  const overduePath = require.resolve("../modules/borrowing/overdue.helper");
  const borrowingServiceCache = require.cache[borrowingPath];
  const overdueCache = require.cache[overduePath];
  const originalSettings = catalogSettings.getCatalogSettings;
  const originalSearch = borrowingRepository.searchCatalogueWithAvailability;
  const originalQuery = db.query;
  let searchOptions;
  catalogSettings.getCatalogSettings = async () => ({ show_unheld_in_opac: false });
  borrowingRepository.searchCatalogueWithAvailability = async (_query, options) => { searchOptions = options; return []; };
  require.cache[overduePath] = { id: overduePath, filename: overduePath, loaded: true, exports: { syncOverdueBorrowings: async () => {} } };
  delete require.cache[borrowingPath];
  const borrowingReadService = require(borrowingPath);
  const recommendationRepository = require("../modules/recommendations/recommendations.repository");
  const sqlStatements = [];
  db.query = async (sql) => { sqlStatements.push(sql); return [[], []]; };
  try {
    await borrowingReadService.searchCatalogueWithAvailability("Atlas");
    assert.deepEqual(searchOptions, { showUnheldInOpac: false });

    await recommendationRepository.findActiveCandidates("book", [], { showUnheldInOpac: false });
    assert.match(sqlStatements[0], /visible_bc\.is_active = 1/);
    assert.match(sqlStatements[0], /hasAccession|copy_holdings/);
    await recommendationRepository.findActiveCandidates("thesis", [], { showUnheldInOpac: false });
    assert.doesNotMatch(sqlStatements[1], /visible_bc/);
  } finally {
    catalogSettings.getCatalogSettings = originalSettings;
    borrowingRepository.searchCatalogueWithAvailability = originalSearch;
    db.query = originalQuery;
    delete require.cache[borrowingPath];
    if (borrowingServiceCache) require.cache[borrowingPath] = borrowingServiceCache;
    if (overdueCache) require.cache[overduePath] = overdueCache; else delete require.cache[overduePath];
  }
});

test("desk checkout blocks unaccessioned QR copies and rejects reservation copy mismatches", async () => {
  const repositoryPath = require.resolve("../modules/borrowing/borrowing.repository");
  const overduePath = require.resolve("../modules/borrowing/overdue.helper");
  const clearancePath = require.resolve("../modules/clearance/clearance.service");
  const overdueOriginal = require.cache[overduePath];
  const clearanceOriginal = require.cache[clearancePath];
  require.cache[overduePath] = { id: overduePath, filename: overduePath, loaded: true, exports: { syncOverdueBorrowings: async () => {} } };
  require.cache[clearancePath] = { id: clearancePath, filename: clearancePath, loaded: true, exports: { assertEligible: async () => {} } };
  delete require.cache[require.resolve("../modules/borrowing/borrowing.transaction.service")];
  const service = require("../modules/borrowing/borrowing.transaction.service");
  const original = {};
  for (const key of ["getConnection", "findCopyBookIdentityForBorrow", "findBookForBorrow", "findCopyForBorrow", "countPendingReservationsForBook", "countAvailableCopiesForBook", "findReadyHoldByCopy", "findActiveBorrowingByCopy", "findActiveBorrowingByUserBook", "findReadyReservation", "createBorrowing", "fulfillReadyReservationAfterCheckout", "getBorrowingNotificationTarget"]) original[key] = borrowingRepository[key];
  const conn = makeConnection();
  conn.query = async (sql) => {
    if (sql.includes("SELECT r.id, r.status, r.book_id, r.reserved_copy_id")) {
      return [[{ id: 44, status: "fulfilled", book_id: 5, reserved_copy_id: 12, title: "Atlas", barcode: "LIB-000123-001" }]];
    }
    if (sql.includes("SELECT b.id, b.status, b.due_date, bk.title")) {
      return [[{ id: 91, status: "borrowed", due_date: "2026-09-24 12:00:00", title: "Atlas", copy_id: 12, barcode: "LIB-000123-001" }]];
    }
    return [{ affectedRows: 1 }];
  };
  borrowingRepository.getConnection = async () => conn;
  borrowingRepository.findCopyBookIdentityForBorrow = async () => ({ book_id: 5 });
  borrowingRepository.findBookForBorrow = async () => ({
    id: 5, title: "Atlas", material_type: "book", has_active_policy: 1,
    loan_policy_id_snapshot: 2, loan_policy_name_snapshot: "General", default_borrow_days: 7,
    loan_duration_minutes: 60, loan_duration_unit: "hour", fine_per_hour: 1,
    fine_interval: 60, initial_fine: 0,
  });
  borrowingRepository.findCopyForBorrow = async () => ({ id: 12, book_id: 5, barcode: "LIB-000123-001", is_active: 1, has_active_policy: 1, condition: "good", material_type: "book", accession_number: null, loan_duration_minutes: 60, loan_duration_unit: "hour" });
  borrowingRepository.countPendingReservationsForBook = async () => 0;
  borrowingRepository.countAvailableCopiesForBook = async () => 0;
  borrowingRepository.findReadyHoldByCopy = async () => null;
  borrowingRepository.findActiveBorrowingByCopy = async () => null;
  borrowingRepository.findActiveBorrowingByUserBook = async () => null;
  borrowingRepository.findReadyReservation = async () => ({ reserved_copy_id: 13 });
  let creates = 0;
  borrowingRepository.createBorrowing = async () => { creates += 1; return 91; };
  borrowingRepository.fulfillReadyReservationAfterCheckout = async () => 1;
  borrowingRepository.getBorrowingNotificationTarget = async () => null;
  try {
    await assert.rejects(service.borrowBook(7, "LIB-000123-001", 2, { isCopyBarcode: true }), /no accession number/);
    assert.equal(creates, 0);

    borrowingRepository.findCopyForBorrow = async () => ({ id: 12, book_id: 5, barcode: "LIB-000123-001", is_active: 1, has_active_policy: 1, condition: "good", material_type: "book", accession_number: "   ", loan_duration_minutes: 60, loan_duration_unit: "hour" });
    await assert.rejects(service.borrowBook(7, "LIB-000123-001", 2, { isCopyBarcode: true }), /no accession number/);
    assert.equal(creates, 0);

    borrowingRepository.findCopyForBorrow = async () => ({ id: 12, book_id: 5, barcode: "LIB-000123-001", is_active: 1, has_active_policy: 0, condition: "good", material_type: "book", accession_number: "ACC-12", loan_duration_minutes: null, loan_duration_unit: null });
    await assert.rejects(service.borrowBook(7, "LIB-000123-001", 2, { isCopyBarcode: true, reservationId: 44 }), /needs an active loan policy/);
    assert.equal(creates, 0);

    borrowingRepository.findCopyForBorrow = async () => ({ id: 12, book_id: 5, barcode: "LIB-000123-001", is_active: 1, has_active_policy: 1, condition: "good", material_type: "book", accession_number: "ACC-12", loan_duration_minutes: 60, loan_duration_unit: "hour" });
    borrowingRepository.findReadyHoldByCopy = async () => ({ id: 44 });
    await assert.rejects(service.borrowBook(7, "ACC-12", 2, { isCopyBarcode: true, reservationId: 44 }), /not the copy prepared/);
    assert.equal(creates, 0);

    borrowingRepository.findReadyReservation = async () => ({ reserved_copy_id: 12 });
    const fulfilled = [];
    borrowingRepository.fulfillReadyReservationAfterCheckout = async (id) => { fulfilled.push(id); return 1; };
    const result = await service.borrowBook(7, "ACC-12", 2, { isCopyBarcode: true, reservationId: 44 });
    assert.equal(result.copyId, 12);
    assert.deepEqual(fulfilled, [44]);

    borrowingRepository.findReadyHoldByCopy = async () => null;
    borrowingRepository.createBorrowing = async () => { throw Object.assign(new Error("uq_borrowings_active_copy"), { code: "ER_DUP_ENTRY" }); };
    await assert.rejects(service.borrowBook(7, "ACC-12", 2, { isCopyBarcode: true }), /no longer available/);
  } finally {
    for (const [key, value] of Object.entries(original)) borrowingRepository[key] = value;
    if (overdueOriginal) require.cache[overduePath] = overdueOriginal; else delete require.cache[overduePath];
    if (clearanceOriginal) require.cache[clearancePath] = clearanceOriginal; else delete require.cache[clearancePath];
  }
});

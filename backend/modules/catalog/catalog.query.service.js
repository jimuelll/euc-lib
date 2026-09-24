const repository = require("./catalog.repository");
const { httpError, validateBookTypeInput, validateIsbn } = require("./catalog.validation");
const { parseMetadata, hydrateCatalogRecord } = require("./catalog.projection");
const recommendations = require("../recommendations/recommendations.service");
const fineLedger = require("../borrowing/fine-ledger.service");
const catalogSettings = require("./catalog.settings.service");
const { fieldsForMaterial, getSchema, OPERATIONAL_BOOK_KEYS, PUBLIC_CATALOGUE_CORE_KEYS } = require("./catalog.schema.service");
const { syncBookCopies } = require("./catalog.availability.service");
const transactionalAudit = require("../analytics/transactional-audit");
const { copyLabel } = require("../analytics/audit.copy-label");

const searchBooks = async (query, publicOnly = false, showArchived = false, materialType = "all", page = null, limit = 20) => {
  const settings = publicOnly ? await catalogSettings.getCatalogSettings() : null;
  const result = await repository.searchBooks({ query, publicOnly, showArchived, materialType, page, limit, showUnheldInOpac: settings?.show_unheld_in_opac ?? true });
  if (publicOnly) {
    const schema = await getSchema();
    const publicFields = schema.filter((field) => field.public);
    const hydrated = result.rows.map((row) => hydrateCatalogRecord(row, { publicFields }));
    return result.paged
      ? { rows: hydrated, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.ceil(result.total / result.limit) } }
      : hydrated;
  }
  return result.rows.map(hydrateCatalogRecord);
};

const searchPublicCatalogue = async (options = {}) => {
  const settings = await catalogSettings.getCatalogSettings();
  const result = await repository.searchPublicCatalogue({
    ...options,
    showUnheldInOpac: settings?.show_unheld_in_opac ?? true,
  });
  const publicFields = (await getSchema()).filter((field) => field.public);
  return { ...result, rows: result.rows.map((row) => hydrateCatalogRecord(row, { publicFields })) };
};

const createBook = async (data, createdBy, actorId = null) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const materialType = data.material_type || "book";
    const schema = fieldsForMaterial(await getSchema(), materialType);
    const metadata = Object.fromEntries(schema
      .filter((field) => !OPERATIONAL_BOOK_KEYS.has(field.key) && data[field.key] !== undefined && data[field.key] !== "")
      .map((field) => [field.key, data[field.key]]));
    const copies = materialType === "thesis" ? 0 : Number(data.copies ?? 1);
    if (materialType !== "thesis" && !await repository.lockActiveBookType(data.book_type_id, conn)) {
      throw httpError("Select an active loan policy", 400);
    }
    const bookId = await repository.createBookRecord({
      createdBy,
      materialType,
      title: data.title,
      author: data.author,
      isbn: data.isbn ? validateIsbn(data.isbn) : null,
      copies,
      bookTypeId: materialType === "thesis" ? null : data.book_type_id,
      metadata,
    }, conn);
    await syncBookCopies(bookId, materialType === "thesis" ? 0 : parseInt(data.copies ?? 1, 10), conn);
    const created = await repository.findBookForUpdate(bookId, conn);
    await transactionalAudit.enqueueTransactionalAudit(conn, {
      actorId,
      route: "/api/admin/books",
      action: "created",
      description: `Created catalog record “${created.title}”`,
      before: null,
      after: { ...created, __auditSchema: schema },
      isCreation: true,
    });
    await conn.commit();
    void recommendations.queueEnrichmentAndEmbedding(bookId).catch((err) => console.error("[recommendations] enrichment queue:", err));
    return bookId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updateBook = async (id, data, actorId = null) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    if (Object.prototype.hasOwnProperty.call(data, "book_type_id") && !await repository.lockActiveBookType(data.book_type_id, conn)) {
      throw httpError("Select an active loan policy", 400);
    }
    const existing = await repository.findBookForUpdate(id, conn);
    if (!existing) throw httpError("Catalog record not found", 404);
    const schema = fieldsForMaterial(await getSchema(), existing.material_type);
    const initialActiveCount = await repository.getActiveCopyCount(id, conn);
    const metadata = { ...parseMetadata(existing.metadata) };
    for (const field of schema) {
      if (!OPERATIONAL_BOOK_KEYS.has(field.key) && Object.prototype.hasOwnProperty.call(data, field.key)) {
        metadata[field.key] = data[field.key] === "" ? null : data[field.key];
      }
    }
    const updates = { metadata: JSON.stringify(metadata) };
    for (const key of ["title", "author", "isbn", "copies", "book_type_id"]) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        updates[key] = key === "isbn" && data[key] ? validateIsbn(data[key]) : (data[key] === "" ? null : data[key]);
      }
    }
    await repository.updateBookRecord(id, updates, conn);
    let copySync = { previousActiveCount: initialActiveCount, activeCount: initialActiveCount, retiredCopies: [] };
    if (data.copies !== undefined) {
      const targetCount = parseInt(data.copies, 10);
      if (!Number.isNaN(targetCount) && targetCount >= 0) copySync = await syncBookCopies(id, targetCount, conn);
    }
    const afterRecord = await repository.findBookForUpdate(id, conn);
    // Audit the persisted column values. Active physical-copy counts are kept
    // in sync by copySync, but they must not be substituted for the database's
    // actual before value when repairing legacy count drift.
    const beforeAudit = { ...existing, __auditSchema: schema };
    const afterAudit = { ...afterRecord, __auditSchema: schema };
    const retiredLabels = copySync.retiredCopies.map((copy) => copy.label ?? copyLabel(copy));
    const copyDetails = retiredLabels.length ? ` · Retired ${retiredLabels.join(", ")}` : "";
    await transactionalAudit.enqueueTransactionalAudit(conn, {
      actorId,
      route: `/api/admin/books/${id}`,
      description: `Updated catalog record “${existing.title}”${copyDetails}`,
      before: beforeAudit,
      after: afterAudit,
      extraMetadata: retiredLabels.length ? {
        affected_record_count: retiredLabels.length,
        affected_record_type: "retired physical copies",
        affected_copy_labels: retiredLabels,
      } : {},
    });
    await conn.commit();
    void recommendations.queueEnrichmentAndEmbedding(id).catch((err) => console.error("[recommendations] enrichment queue:", err));
    return { auditEnqueued: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const deleteBook = async (id, deletedBy) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const book = await repository.findBookForDelete(id, conn);
    if (!book) throw Object.assign(new Error("Catalog record not found"), { status: 404 });
    const ownerIds = await repository.getBorrowingOwnerIdsForBook(id, conn);
    await repository.lockUsersByIds(ownerIds, conn);
    const borrowingIds = await repository.findBorrowingIdsForBook(id, conn);
    await fineLedger.assertNoOutstandingFines(borrowingIds, conn, "This book cannot be archived");
    const borrowed = await repository.findActiveBorrowingsForBook(id, conn);
    if (borrowed.length) throw Object.assign(new Error(`Cannot delete: ${borrowed.length} cop${borrowed.length === 1 ? "y is" : "ies are"} currently borrowed`), { status: 409 });
    const reservations = await repository.findActiveReservationsForBook(id, conn);
    if (reservations.length) throw Object.assign(new Error("Cannot archive a catalog record with active reservations"), { status: 409 });
    await repository.archiveBook(id, deletedBy, conn);
    const [[after]] = await conn.query("SELECT id, title, author, isbn, material_type, book_type_id, copies, metadata, deleted_at FROM books WHERE id = ?", [id]);
    await transactionalAudit.enqueueTransactionalAudit(conn, {
      actorId: deletedBy,
      category: "catalog",
      route: `/api/admin/books/${id}`,
      action: "archived",
      description: `Archived catalog record “${book.title}”`,
      before: book,
      after,
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const restoreBook = async (id, restoredBy = null) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const before = await repository.findArchivedBook(id, conn);
    if (!before) throw Object.assign(new Error("Archived book not found"), { status: 404 });
    await repository.restoreBook(id, conn);
    const [[after]] = await conn.query("SELECT id, title, author, isbn, material_type, book_type_id, copies, metadata, deleted_at FROM books WHERE id = ?", [id]);
    await transactionalAudit.enqueueTransactionalAudit(conn, {
      actorId: restoredBy,
      category: "catalog",
      route: `/api/admin/books/${id}/restore`,
      action: "restored",
      description: `Restored catalog record “${before.title}”`,
      before: { ...before, deleted_at: "archived" },
      after,
      type: "state_transition",
      details: { stateFrom: "Archived", stateTo: "Active", stateLabel: "Catalog state" },
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return { message: "Book restored successfully" };
};

const searchBooksPage = async (options = {}) => {
  const safeOptions = { ...options, policyStatus: options.policyStatus === "needs_policy" ? "needs_policy" : "all" };
  const result = await repository.searchBooksPage(safeOptions);
  return {
    rows: result.rows.map(hydrateCatalogRecord),
    pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / result.limit)) },
  };
};

const getCatalogRecordForValidation = async (id) => repository.findCatalogRecordForValidation(id);

const getBookTypes = async () => repository.getBookTypes();

const createBookType = async ({ name, defaultBorrowDays, durationMinutes, durationUnit, finePerHour, fineInterval = "hour", initialFine = 0 }) => {
  const { name: safeName, days, minutes, durationUnit: safeUnit, fine, fineInterval: safeInterval, initial } = validateBookTypeInput({ name, defaultBorrowDays, durationMinutes, durationUnit, finePerHour, fineInterval, initialFine });
  return repository.createBookType({ name: safeName, days, minutes, durationUnit: safeUnit, fine, fineInterval: safeInterval, initial });
};

const updateBookType = async (id, { name, defaultBorrowDays, durationMinutes, durationUnit, finePerHour, fineInterval = "hour", initialFine = 0 }) => {
  const { name: safeName, days, minutes, durationUnit: safeUnit, fine, fineInterval: safeInterval, initial } = validateBookTypeInput({ name, defaultBorrowDays, durationMinutes, durationUnit, finePerHour, fineInterval, initialFine });
  const row = await repository.updateBookType(id, { name: safeName, days, minutes, durationUnit: safeUnit, fine, fineInterval: safeInterval, initial });
  if (!row) throw httpError("Book type not found", 404);
  return row;
};

const deleteBookType = async (id, actorId = null) => {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw httpError("Invalid book type ID", 400);
  return repository.deleteBookType(Number(id), actorId);
};

const updateCopyCondition = async (copyId, condition, notes = null, userId = null) => {
  if (!["good", "damaged", "lost"].includes(condition)) throw Object.assign(new Error("Invalid copy condition"), { status: 400 });
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const [[identity]] = await conn.query("SELECT book_id FROM book_copies WHERE id = ? AND deleted_at IS NULL", [copyId]);
    if (!identity) throw Object.assign(new Error("Copy not found"), { status: 404 });
    await conn.query("SELECT id FROM books WHERE id = ? FOR UPDATE", [identity.book_id]);
    const copy = await repository.findCopyStateForUpdate(copyId, conn);
    if (!copy) throw Object.assign(new Error("Copy not found"), { status: 404 });
    if (condition === "lost" && copy.has_active_loan) throw Object.assign(new Error("Return this copy before marking it lost"), { status: 409 });
    if (condition === "lost" && copy.has_prepared_reservation) {
      throw Object.assign(new Error("Reassign or cancel the prepared reservation before marking this copy lost"), { status: 409 });
    }
    if (condition === "lost") {
      const pending = await repository.getPendingReservationCount(copy.book_id, conn);
      const eligibleRemaining = await repository.getAvailableEligibleCopyCount(copy.book_id, conn, copy.id);
      if (eligibleRemaining < pending) throw Object.assign(new Error(`Cannot mark this copy lost: ${pending} pending reservation${pending === 1 ? " needs" : "s need"} an available accessioned copy to prepare, but only ${eligibleRemaining} would remain. Resolve or cancel pending reservations first.`), { status: 409 });
    }
    const before = { ...copy };
    await repository.updateCopyCondition(copyId, condition, notes, conn);
    const after = await repository.findCopyStateForUpdate(copyId, conn);
    const description = `Updated condition for “${copy.title}” · ${copyLabel(copy)}`;
    await transactionalAudit.enqueueTransactionalAudit(conn, {
      actorId: userId,
      route: `/api/admin/copies/${copyId}`,
      description,
      before,
      after,
      extraMetadata: { copy_barcode: copy.barcode, copy_display_description: description },
    });
    await conn.commit();
    return { auditEnqueued: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const metadataFromOpenLibrary = (isbn, record) => {
  const subjects = (record.subjects || []).map((item) => item.name || item).filter(Boolean).slice(0, 10);
  const pages = Number(record.number_of_pages);
  return {
    isbn,
    title: record.title || "",
    author: (record.authors || []).map((item) => item.name).filter(Boolean).join(", "),
    copyright_year: record.publish_date?.match(/\d{4}/)?.[0] || "",
    publisher: record.publishers?.[0]?.name || "",
    publication_place: record.publish_places?.[0]?.name || "",
    physical_description: Number.isFinite(pages) && pages > 0 ? `${pages} pages` : "",
    subjects,
  };
};

const metadataFromGoogleBooks = (isbn, record) => {
  const pages = Number(record.pageCount);
  return {
    isbn,
    title: record.title || "",
    author: Array.isArray(record.authors) ? record.authors.filter(Boolean).join(", ") : "",
    copyright_year: String(record.publishedDate || "").match(/\d{4}/)?.[0] || "",
    publisher: record.publisher || "",
    publication_place: "",
    physical_description: Number.isFinite(pages) && pages > 0 ? `${pages} pages` : "",
    subjects: Array.isArray(record.categories) ? record.categories.filter(Boolean).slice(0, 10) : [],
  };
};

const metadataFromOpenLibrarySearch = (isbn, record) => {
  const pages = Number(record.number_of_pages_median);
  const publishedDate = record.publish_year?.[0] || record.first_publish_year || "";
  return {
    isbn,
    title: record.title || "",
    author: Array.isArray(record.author_name) ? record.author_name.filter(Boolean).join(", ") : "",
    copyright_year: String(publishedDate).match(/\d{4}/)?.[0] || "",
    publisher: Array.isArray(record.publisher) ? record.publisher.find(Boolean) || "" : "",
    publication_place: "",
    physical_description: Number.isFinite(pages) && pages > 0 ? `${pages} pages` : "",
    subjects: Array.isArray(record.subject) ? record.subject.filter(Boolean).slice(0, 10) : [],
  };
};

const lookupIsbn = async (value) => {
  const isbn = validateIsbn(value);
  let openLibraryResponded = false;
  try {
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000) });
    openLibraryResponded = response.ok;
    if (response.ok) {
      const record = (await response.json())[`ISBN:${isbn}`];
      if (record) return metadataFromOpenLibrary(isbn, record);
    }
  } catch {
    // The ISBN-search endpoint below is the fallback for unavailable Open Library requests.
  }

  try {
    const response = await fetch(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&fields=title,author_name,subject,publisher,number_of_pages_median,publish_year,first_publish_year&limit=1`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000) });
    openLibraryResponded ||= response.ok;
    if (response.ok) {
      const record = (await response.json()).docs?.[0];
      if (record) return metadataFromOpenLibrarySearch(isbn, record);
    }
  } catch {
    // Google Books below is the final fallback for unavailable Open Library requests.
  }

  try {
    const key = String(process.env.GOOGLE_BOOKS_API_KEY || "").trim();
    const keyParam = key ? `&key=${encodeURIComponent(key)}` : "";
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}${keyParam}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000) });
    if (response.ok) {
      const record = (await response.json()).items?.[0]?.volumeInfo;
      if (record) return metadataFromGoogleBooks(isbn, record);
    }
  } catch {
    // Return the same safe error below when both external sources are unavailable.
  }

  if (openLibraryResponded) throw Object.assign(new Error("No metadata was found for this ISBN"), { status: 404 });
  throw Object.assign(new Error("ISBN lookup is unavailable right now"), { status: 503 });
};

module.exports = { searchBooks, searchPublicCatalogue, searchBooksPage, getCatalogRecordForValidation, createBook, updateBook, deleteBook, restoreBook, getBookTypes, createBookType, updateBookType, deleteBookType, updateCopyCondition, lookupIsbn };

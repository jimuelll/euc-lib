const repository = require("./catalog.repository");
const { httpError, validateBookTypeInput, validateIsbn } = require("./catalog.validation");
const { parseMetadata, hydrateCatalogRecord } = require("./catalog.projection");
const isbnMetadataLookup = require("./isbn-metadata.lookup") as {
  lookupIsbnMetadata: (isbn: string) => Promise<{
    title: string; author: string; publisher: string; copyright_year: string; publication_place: string;
    physical_description: string; subjects: string[]; description: string; metadataFound: boolean;
    openLibraryResponded: boolean;
  }>;
};
const recommendations = require("../recommendations/recommendations.service");
const fineLedger = require("../borrowing/fine-ledger.service");
const catalogSettings = require("./catalog.settings.service");
const { fieldsForMaterial, getSchema, OPERATIONAL_BOOK_KEYS, PUBLIC_CATALOGUE_CORE_KEYS } = require("./catalog.schema.service");
const { syncBookCopies } = require("./catalog.availability.service");
const transactionalAudit = require("../analytics/transactional-audit");
const { copyLabel } = require("../analytics/audit.copy-label");

type DataRow = Record<string, any>;
interface BookTypeInput extends Record<string, any> {
  name: string;
  defaultBorrowDays?: number | string;
  durationMinutes?: number | string;
  durationUnit?: "day" | "hour";
  finePerHour: number | string;
  fineInterval?: "hour" | "day";
  initialFine?: number | string;
}
interface CopySyncResult {
  previousActiveCount: number;
  activeCount: number;
  retiredCopies: DataRow[];
}

const searchBooks = async (query: string, publicOnly = false, showArchived = false, materialType = "all", page: number | null = null, limit = 20) => {
  const settings = publicOnly ? await catalogSettings.getCatalogSettings() : null;
  const result = await repository.searchBooks({ query, publicOnly, showArchived, materialType, page, limit, showUnheldInOpac: settings?.show_unheld_in_opac ?? true });
  if (publicOnly) {
    const schema: DataRow[] = await getSchema();
    const publicFields = schema.filter((field) => field.public);
    const hydrated = result.rows.map((row: DataRow) => hydrateCatalogRecord(row, { publicFields }));
    return result.paged
      ? { rows: hydrated, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.ceil(result.total / result.limit) } }
      : hydrated;
  }
  return result.rows.map(hydrateCatalogRecord);
};

const searchPublicCatalogue = async (options: Record<string, any> = {}) => {
  const settings = await catalogSettings.getCatalogSettings();
  const result = await repository.searchPublicCatalogue({
    ...options,
    showUnheldInOpac: settings?.show_unheld_in_opac ?? true,
  });
  const publicFields = (await getSchema() as DataRow[]).filter((field: DataRow) => field.public);
  return { ...result, rows: result.rows.map((row: DataRow) => hydrateCatalogRecord(row, { publicFields })) };
};

const createBook = async (data: DataRow, createdBy: number | null, actorId: number | null = null): Promise<number> => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const materialType = data.material_type || "book";
    const schema: DataRow[] = fieldsForMaterial(await getSchema(), materialType);
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
    void recommendations.queueEnrichmentAndEmbedding(bookId);
    return bookId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updateBook = async (id: number, data: DataRow, actorId: number | null = null): Promise<{ auditEnqueued: boolean }> => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    if (Object.prototype.hasOwnProperty.call(data, "book_type_id") && !await repository.lockActiveBookType(data.book_type_id, conn)) {
      throw httpError("Select an active loan policy", 400);
    }
    const existing = await repository.findBookForUpdate(id, conn);
    if (!existing) throw httpError("Catalog record not found", 404);
    const schema: DataRow[] = fieldsForMaterial(await getSchema(), existing.material_type);
    const initialActiveCount = await repository.getActiveCopyCount(id, conn);
    const metadata = { ...parseMetadata(existing.metadata) };
    for (const field of schema) {
      if (!OPERATIONAL_BOOK_KEYS.has(field.key) && Object.prototype.hasOwnProperty.call(data, field.key)) {
        metadata[field.key] = data[field.key] === "" ? null : data[field.key];
      }
    }
    const updates: DataRow = { metadata: JSON.stringify(metadata) };
    for (const key of ["title", "author", "isbn", "copies", "book_type_id"]) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        updates[key] = key === "isbn" && data[key] ? validateIsbn(data[key]) : (data[key] === "" ? null : data[key]);
      }
    }
    await repository.updateBookRecord(id, updates, conn);
    let copySync: CopySyncResult = { previousActiveCount: initialActiveCount, activeCount: initialActiveCount, retiredCopies: [] };
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
    const retiredLabels = copySync.retiredCopies.map((copy: DataRow) => copy.label ?? copyLabel(copy));
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
    void recommendations.queueEnrichmentAndEmbedding(id);
    return { auditEnqueued: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const deleteBook = async (id: number, deletedBy: number): Promise<void> => {
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

const restoreBook = async (id: number, restoredBy: number | null = null): Promise<{ message: string }> => {
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

const searchBooksPage = async (options: Record<string, any> = {}) => {
  const safeOptions = { ...options, policyStatus: options.policyStatus === "needs_policy" ? "needs_policy" : "all" };
  const result = await repository.searchBooksPage(safeOptions);
  return {
    rows: result.rows.map(hydrateCatalogRecord),
    pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / result.limit)) },
  };
};

const getCatalogRecordForValidation = async (id: number) => repository.findCatalogRecordForValidation(id);

const getBookTypes = async () => repository.getBookTypes();

const createBookType = async ({ name, defaultBorrowDays, durationMinutes, durationUnit, finePerHour, fineInterval = "hour", initialFine = 0 }: BookTypeInput) => {
  const { name: safeName, days, minutes, durationUnit: safeUnit, fine, fineInterval: safeInterval, initial } = validateBookTypeInput({ name, defaultBorrowDays, durationMinutes, durationUnit, finePerHour, fineInterval, initialFine });
  return repository.createBookType({ name: safeName, days, minutes, durationUnit: safeUnit, fine, fineInterval: safeInterval, initial });
};

const updateBookType = async (id: number, { name, defaultBorrowDays, durationMinutes, durationUnit, finePerHour, fineInterval = "hour", initialFine = 0 }: BookTypeInput) => {
  const { name: safeName, days, minutes, durationUnit: safeUnit, fine, fineInterval: safeInterval, initial } = validateBookTypeInput({ name, defaultBorrowDays, durationMinutes, durationUnit, finePerHour, fineInterval, initialFine });
  const row = await repository.updateBookType(id, { name: safeName, days, minutes, durationUnit: safeUnit, fine, fineInterval: safeInterval, initial });
  if (!row) throw httpError("Book type not found", 404);
  return row;
};

const deleteBookType = async (id: number, actorId: number | null = null) => {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw httpError("Invalid book type ID", 400);
  return repository.deleteBookType(Number(id), actorId);
};

const updateCopyCondition = async (copyId: number, condition: string, notes: string | null = null, userId: number | null = null): Promise<{ auditEnqueued: boolean }> => {
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

const lookupIsbn = async (value: unknown) => {
  const isbn = validateIsbn(value);
  const metadata = await isbnMetadataLookup.lookupIsbnMetadata(isbn);
  if (metadata.metadataFound) {
    return {
      isbn,
      title: metadata.title,
      author: metadata.author,
      publisher: metadata.publisher,
      copyright_year: metadata.copyright_year,
      publication_place: metadata.publication_place,
      physical_description: metadata.physical_description,
      subjects: metadata.subjects,
      ...(metadata.description ? { description: metadata.description } : {}),
    };
  }
  if (!metadata.openLibraryResponded) {
    throw Object.assign(new Error("ISBN lookup is unavailable right now"), { status: 503 });
  }
  throw Object.assign(new Error("No metadata was found for this ISBN"), { status: 404 });
};

export = { searchBooks, searchPublicCatalogue, searchBooksPage, getCatalogRecordForValidation, createBook, updateBook, deleteBook, restoreBook, getBookTypes, createBookType, updateBookType, deleteBookType, updateCopyCondition, lookupIsbn };

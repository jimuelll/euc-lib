const repository = require("./catalog.repository");
const { httpError, validateBookTypeInput, validateIsbn } = require("./catalog.validation");
const { parseMetadata, hydrateCatalogRecord } = require("./catalog.projection");
const recommendations = require("../recommendations/recommendations.service");
const { fieldsForMaterial, getSchema, OPERATIONAL_BOOK_KEYS, PUBLIC_CATALOGUE_CORE_KEYS } = require("./catalog.schema.service");
const { syncBookCopies } = require("./catalog.availability.service");

const searchBooks = async (query, publicOnly = false, showArchived = false, materialType = "all", page = null, limit = 20) => {
  const result = await repository.searchBooks({ query, publicOnly, showArchived, materialType, page, limit });
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

const createBook = async (data, createdBy) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const materialType = data.material_type || "book";
    const schema = fieldsForMaterial(await getSchema(), materialType);
    const metadata = Object.fromEntries(schema
      .filter((field) => !OPERATIONAL_BOOK_KEYS.has(field.key) && data[field.key] !== undefined && data[field.key] !== "")
      .map((field) => [field.key, data[field.key]]));
    const copies = materialType === "thesis" ? 0 : Number(data.copies ?? 1);
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

const updateBook = async (id, data) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const existing = await repository.findBookForUpdate(id, conn);
    if (!existing) throw httpError("Catalog record not found", 404);
    const schema = fieldsForMaterial(await getSchema(), existing.material_type);
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
    if (data.copies !== undefined) {
      const targetCount = parseInt(data.copies, 10);
      if (!Number.isNaN(targetCount) && targetCount >= 0) await syncBookCopies(id, targetCount, conn);
    }
    await conn.commit();
    void recommendations.queueEnrichmentAndEmbedding(id).catch((err) => console.error("[recommendations] enrichment queue:", err));
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
    if (!await repository.findBookForDelete(id, conn)) throw Object.assign(new Error("Catalog record not found"), { status: 404 });
    const borrowed = await repository.findActiveBorrowingsForBook(id, conn);
    if (borrowed.length) throw Object.assign(new Error(`Cannot delete: ${borrowed.length} cop${borrowed.length === 1 ? "y is" : "ies are"} currently borrowed`), { status: 409 });
    const reservations = await repository.findActiveReservationsForBook(id, conn);
    if (reservations.length) throw Object.assign(new Error("Cannot archive a catalog record with active reservations"), { status: 409 });
    await repository.archiveBook(id, deletedBy, conn);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const restoreBook = async (id) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    if (!await repository.findArchivedBook(id, conn)) throw Object.assign(new Error("Archived book not found"), { status: 404 });
    await repository.restoreBook(id, conn);
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
  const result = await repository.searchBooksPage(options);
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

const updateCopyCondition = async (copyId, condition, notes = null) => {
  if (!["good", "damaged", "lost"].includes(condition)) throw Object.assign(new Error("Invalid copy condition"), { status: 400 });
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    if (!await repository.findCopyForUpdate(copyId, conn)) throw Object.assign(new Error("Copy not found"), { status: 404 });
    if (condition === "lost" && await repository.findActiveLoanForCopy(copyId, conn)) throw Object.assign(new Error("Return this copy before marking it lost"), { status: 409 });
    await repository.updateCopyCondition(copyId, condition, notes, conn);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const lookupIsbn = async (value) => {
  const isbn = validateIsbn(value);
  let response;
  try {
    response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000) });
  } catch {
    throw Object.assign(new Error("ISBN lookup is unavailable right now"), { status: 503 });
  }
  if (!response.ok) throw Object.assign(new Error("ISBN lookup is unavailable right now"), { status: 503 });
  const record = (await response.json())[`ISBN:${isbn}`];
  if (!record) throw Object.assign(new Error("No metadata was found for this ISBN"), { status: 404 });
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

module.exports = { searchBooks, searchBooksPage, getCatalogRecordForValidation, createBook, updateBook, deleteBook, restoreBook, getBookTypes, createBookType, updateBookType, updateCopyCondition, lookupIsbn };

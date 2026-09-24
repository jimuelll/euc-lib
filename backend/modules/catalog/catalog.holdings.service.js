const repository = require("./catalog.holdings.repository");
const transactionalAudit = require("../analytics/transactional-audit");
const { copyLabel } = require("../analytics/audit.copy-label");

const cleanText = (value, max, label) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw Object.assign(new Error(`${label} must be text`), { status: 400 });
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) throw Object.assign(new Error(`${label} must be ${max} characters or fewer`), { status: 400 });
  return text;
};

const parseDate = (value) => {
  const date = cleanText(value, 10, "Date acquired");
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw Object.assign(new Error("Enter a valid acquisition date"), { status: 400 });
  }
  return date;
};

const normaliseHolding = async (body = {}, conn, existingProgramId) => {
  const accessionNumber = cleanText(body.accession_number, 64, "Accession number");
  if (accessionNumber && /^LIB-\d{6}-\d{3}$/i.test(accessionNumber)) {
    throw Object.assign(new Error("Accession number cannot use the internal copy barcode format"), { status: 400 });
  }
  const rawPrice = body.price;
  let price = null;
  if (rawPrice !== undefined && rawPrice !== null && rawPrice !== "") {
    const priceText = String(rawPrice).trim();
    const priceCents = /^\d+(?:\.\d{1,2})?$/.test(priceText) ? Math.round(Number(priceText) * 100) : NaN;
    if (!Number.isSafeInteger(priceCents) || priceCents > 9999999999) {
      throw Object.assign(new Error("Price must be a non-negative amount with up to two decimal places"), { status: 400 });
    }
    price = (priceCents / 100).toFixed(2);
  }
  const rawProgramId = body.program_id;
  let programId = null;
  if (rawProgramId !== undefined && rawProgramId !== null && rawProgramId !== "") {
    programId = Number(rawProgramId);
    const program = Number.isSafeInteger(programId) && programId > 0 ? await repository.findProgram(programId, conn) : null;
    if (!program || (!program.is_active && Number(existingProgramId) !== programId)) {
      throw Object.assign(new Error("Select an active program / course"), { status: 400 });
    }
  }
  return {
    accessionNumber,
    price,
    programId,
    courseCode: cleanText(body.course_code, 64, "Course code"),
    location: cleanText(body.location, 255, "Location"),
    dateAcquired: parseDate(body.date_acquired),
    distributor: cleanText(body.distributor, 255, "Distributor"),
    invoiceReference: cleanText(body.invoice_reference, 128, "Invoice reference"),
  };
};

const getBookHoldings = async (bookId) => repository.getBookHoldings(bookId);
const searchHoldings = async (options) => repository.searchHoldings(options);

const updateHolding = async (copyId, body = {}, userId) => {
  if (!Number.isSafeInteger(copyId) || copyId < 1) throw Object.assign(new Error("Invalid copy ID"), { status: 400 });
  const conn = await require("../../db").getConnection();
  try {
    await conn.beginTransaction();
    const copy = await repository.getCopyForUpdate(copyId, conn);
    if (!copy) throw Object.assign(new Error("Copy not found"), { status: 404 });
    const value = await normaliseHolding(body, conn, copy.program_id);
    const accessionWasProvided = Object.prototype.hasOwnProperty.call(body, "accession_number");
    if (copy.accession_number && accessionWasProvided && copy.accession_number !== value.accessionNumber) {
      throw Object.assign(new Error("An assigned accession number is permanent and cannot be changed or removed. Void a mistaken number, then add a new physical copy for the correct one."), { status: 409 });
    }
    if (copy.accession_number) value.accessionNumber = copy.accession_number;
    else if (!value.accessionNumber) throw Object.assign(new Error("Accession number is required"), { status: 400 });
    if (!copy.accession_number && !copy.is_active) {
      throw Object.assign(new Error("Restore this copy before assigning its first accession number"), { status: 409 });
    }
    const before = { ...copy };
    if (copy.accession_number) await repository.updateHoldingDetails(copyId, value, userId, conn);
    else {
      await repository.insertAccessionClaim(copy, value.accessionNumber, userId, conn);
      await repository.insertHolding(copyId, value, userId, conn);
    }
    const after = await repository.getHoldingForCopy(copyId, conn);
    const label = copyLabel(copy);
    const route = `/api/admin/copies/${copyId}/holding`;
    const description = copy.accession_number
      ? `Updated holdings for “${copy.title}” · ${label}`
      : `Assigned accession ${value.accessionNumber} to “${copy.title}” · ${label}`;
    await transactionalAudit.enqueueTransactionalAudit(conn, {
      actorId: userId,
      route,
      description,
      before,
      after,
      extraMetadata: {
        copy_barcode: copy.barcode,
        copy_display_description: description,
        ...(copy.accession_number ? {} : { permanent_accession_event: true }),
      },
    });
    await conn.commit();
    return { auditEnqueued: true };
  } catch (error) {
    await conn.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      throw Object.assign(new Error("That accession number has already been claimed and can never be reused"), { status: 409 });
    }
    throw error;
  } finally {
    conn.release();
  }
};

const voidAccession = async (copyId, body = {}, userId) => {
  if (!Number.isSafeInteger(copyId) || copyId < 1) throw Object.assign(new Error("Invalid copy ID"), { status: 400 });
  const reason = cleanText(body.reason, 500, "Reason");
  if (!reason) throw Object.assign(new Error("A reason is required to void an accession"), { status: 400 });
  const conn = await require("../../db").getConnection();
  try {
    await conn.beginTransaction();
    const identity = await repository.getCopyBookIdentity(copyId, conn);
    if (!identity) throw Object.assign(new Error("Copy not found"), { status: 404 });
    const [[book]] = await conn.query("SELECT id FROM books WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [identity.book_id]);
    if (!book) throw Object.assign(new Error("Restore the book before changing its accession state"), { status: 409 });
    const copy = await repository.getCopyForUpdate(copyId, conn);
    if (!copy?.accession_number) throw Object.assign(new Error("This copy has no assigned accession number to void"), { status: 409 });
    if (copy.accession_voided) throw Object.assign(new Error("This accession has already been voided"), { status: 409 });
    if (copy.has_active_loan) throw Object.assign(new Error("Return this copy before voiding its accession"), { status: 409 });
    if (copy.has_ready_reservation) throw Object.assign(new Error("Resolve its prepared reservation before voiding its accession"), { status: 409 });
    const pending = await repository.countPendingReservations(copy.book_id, conn);
    const eligibleAfterVoid = await repository.countEligibleCopies(copy.book_id, copy.id, conn);
    if (eligibleAfterVoid < pending) {
      throw Object.assign(new Error(`Cannot void this accession: ${pending} pending reservation${pending === 1 ? " needs" : "s need"} an available accessioned copy to prepare, but only ${eligibleAfterVoid} would remain. Resolve or cancel pending reservations first.`), { status: 409, pendingReservations: pending, eligibleCopiesAfterVoid: eligibleAfterVoid });
    }
    await repository.insertAccessionVoid(copy, reason, userId, conn);
    const description = `Voided accession ${copy.accession_number} for “${copy.title}” · ${copyLabel(copy)}`;
    await transactionalAudit.enqueueTransactionalAudit(conn, {
      actorId: userId,
      route: `/api/admin/copies/${copyId}/holding/void-accession`,
      action: "updated",
      description,
      before: { id: copy.id, accession_number: copy.accession_number, accession_status: "Assigned" },
      after: { id: copy.id, accession_number: copy.accession_number, accession_status: "Voided" },
      type: "state_transition",
      details: { stateFrom: "Assigned", stateTo: "Voided", stateLabel: "Accession status" },
      extraMetadata: {
        permanent_accession_event: true,
        copy_barcode: copy.barcode,
        copy_display_description: description,
      },
    });
    await conn.commit();
    return { auditEnqueued: true, accessionNumber: copy.accession_number };
  } catch (error) {
    await conn.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      throw Object.assign(new Error("That accession number has already been claimed and can never be reused"), { status: 409 });
    }
    throw error;
  } finally { conn.release(); }
};

module.exports = { getBookHoldings, searchHoldings, updateHolding, voidAccession };

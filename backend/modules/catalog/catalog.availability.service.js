const repository = require("./catalog.repository");
const { copyLabel } = require("../analytics/audit.copy-label");

const generateBarcode = (bookId, copyNumber) =>
  `LIB-${String(bookId).padStart(6, "0")}-${String(copyNumber).padStart(3, "0")}`;

const syncBookCopies = async (bookId, targetCount, conn) => {
  const connection = conn || await repository.getConnection();
  const ownsConnection = !conn;
  let retiredCopies = [];
  let initialActiveCount = 0;
  try {
    if (ownsConnection) await connection.beginTransaction();

    // Count edits, retirement, reservation preparation, and checkout serialize
    // on the book row. The count written below therefore matches the physical
    // active-copy rows observed in this transaction.
    await repository.lockBookForCopySync(bookId, connection);

    await repository.getExistingCopies(bookId, connection);
    const currentCount = await repository.getActiveCopyCount(bookId, connection);
    initialActiveCount = currentCount;

    if (targetCount > currentCount) {
      const lastSequence = await repository.getLastCopySequence(bookId, connection);
      const toAdd = targetCount - currentCount;
      for (let index = 0; index < toAdd; index += 1) {
        const copyNumber = lastSequence + index + 1;
        await repository.createCopy(bookId, generateBarcode(bookId, copyNumber), connection);
      }
    } else if (targetCount < currentCount) {
      const committed = await repository.getCommittedCopyCounts(bookId, connection);
      const committedCopies = committed.borrowed + committed.prepared + committed.pending;
      if (committedCopies > targetCount) {
        const reasons = [];
        if (committed.borrowed) reasons.push(`${committed.borrowed} borrowed`);
        if (committed.prepared) reasons.push(`${committed.prepared} prepared for pickup`);
        if (committed.pending) reasons.push(`${committed.pending} pending reservation${committed.pending === 1 ? "" : "s"}`);
        throw Object.assign(
          new Error(
            `Cannot reduce copies to ${targetCount}: ${reasons.join(", ")} need ${committedCopies} active cop${committedCopies === 1 ? "y" : "ies"}. Resolve reservations or returns first.`
          ),
          { status: 409 }
        );
      }

      const activeCopies = await repository.getActiveCopies(bookId, connection);
      const pendingNeeds = committed.pending;
      retiredCopies = activeCopies.slice(0, currentCount - targetCount);
      const toDeactivate = retiredCopies.map((copy) => copy.id);
      if (toDeactivate.length !== currentCount - targetCount) {
        throw Object.assign(
          new Error(`Cannot reduce copies to ${targetCount}: only ${toDeactivate.length} copy/copies can be deactivated because the others are borrowed or prepared for pickup`),
          { status: 409, availableToDeactivate: toDeactivate.length },
        );
      }
      const eligibleCopies = activeCopies.filter((copy) => Boolean(copy.borrow_eligible));
      const retiredEligibleCount = activeCopies
        .slice(0, currentCount - targetCount)
        .filter((copy) => Boolean(copy.borrow_eligible)).length;
      const eligibleAfterReduction = eligibleCopies.length - retiredEligibleCount;
      if (eligibleAfterReduction < pendingNeeds) {
        throw Object.assign(
          new Error(`Cannot reduce copies to ${targetCount}: ${committed.pending} pending reservation${committed.pending === 1 ? " needs" : "s need"} ${committed.pending} available accessioned cop${committed.pending === 1 ? "y" : "ies"} to prepare, but only ${eligibleAfterReduction} would remain. Resolve or cancel pending reservations first.`),
          { status: 409, pendingReservations: committed.pending, eligibleCopiesAfterReduction: eligibleAfterReduction },
        );
      }
      const changed = await repository.deactivateCopies(toDeactivate, connection);
      if (changed !== toDeactivate.length) {
        throw Object.assign(
          new Error("The copy count changed while it was being updated. Reload the record and try again."),
          { status: 409 },
        );
      }
    }

    const finalActiveCount = await repository.getActiveCopyCount(bookId, connection);
    await repository.updateBookCopyCount(bookId, finalActiveCount, connection);
    const verifiedCount = await repository.getActiveCopyCount(bookId, connection);
    if (verifiedCount !== finalActiveCount) {
      throw Object.assign(new Error("The active copy count changed while it was being updated. Reload the record and try again."), { status: 409 });
    }

    if (ownsConnection) await connection.commit();
    return {
      previousActiveCount: initialActiveCount,
      activeCount: finalActiveCount,
      retiredCopies: retiredCopies.map((copy) => ({ ...copy, label: copyLabel(copy) })),
    };
  } catch (error) {
    if (ownsConnection) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
};

const getBookCopies = async (bookId) => repository.getBookCopies(bookId);
const getCopyByBarcode = async (barcode) => repository.getCopyByBarcode(barcode);

module.exports = { getBookCopies, syncBookCopies, getCopyByBarcode };

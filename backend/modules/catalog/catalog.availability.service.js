const repository = require("./catalog.repository");

const generateBarcode = (bookId, copyNumber) =>
  `LIB-${String(bookId).padStart(6, "0")}-${String(copyNumber).padStart(3, "0")}`;

const syncBookCopies = async (bookId, targetCount, conn) => {
  const connection = conn || await repository.getConnection();
  const ownsConnection = !conn;
  try {
    if (ownsConnection) await connection.beginTransaction();

    const existing = await repository.getExistingCopies(bookId, connection);
    const currentCount = await repository.getActiveCopyCount(bookId, connection);

    if (targetCount > currentCount) {
      const inactiveCopies = await repository.getInactiveCopies(bookId, connection);
      const toReactivate = inactiveCopies
        .slice(0, targetCount - currentCount)
        .map((copy) => copy.id);
      await repository.reactivateCopies(toReactivate, connection);

      const toAdd = targetCount - currentCount - toReactivate.length;
      for (let index = 0; index < toAdd; index += 1) {
        const copyNumber = existing.length + index + 1;
        await repository.createCopy(bookId, generateBarcode(bookId, copyNumber), connection);
      }
    } else if (targetCount < currentCount) {
      const committed = await repository.getCommittedCopyCounts(bookId, connection);
      const committedCopies = committed.borrowed + committed.prepared;
      if (committedCopies > targetCount) {
        throw Object.assign(
          new Error(
            `Cannot reduce copies to ${targetCount}: ${committedCopies} cop${committedCopies === 1 ? "y is" : "ies are"} borrowed or prepared for pickup`
          ),
          { status: 409 }
        );
      }

      const activeCopies = await repository.getActiveCopies(bookId, connection);
      const toDeactivate = activeCopies
        .slice(0, currentCount - targetCount)
        .map((copy) => copy.id);
      await repository.deactivateCopies(toDeactivate, connection);
    }

    if (ownsConnection) await connection.commit();
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

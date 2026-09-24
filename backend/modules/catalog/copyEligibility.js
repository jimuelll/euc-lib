// Keep inventory counts aligned with the copy rules used by checkout.
const activeLendableCopy = (alias = "bc") => `${alias}.deleted_at IS NULL AND ${alias}.is_active = 1 AND ${alias}.condition IN ('good', 'damaged')`;
const hasAccession = (alias = "bc", holdingsAlias = "h") => `EXISTS (
  SELECT 1 FROM copy_holdings ${holdingsAlias}
   WHERE ${holdingsAlias}.copy_id = ${alias}.id
     AND ${holdingsAlias}.accession_number IS NOT NULL
     AND TRIM(${holdingsAlias}.accession_number) <> ''
     AND NOT EXISTS (
       SELECT 1 FROM accession_claim_voids voided_accession
        WHERE voided_accession.accession_number = ${holdingsAlias}.accession_number
     )
)`;
const hasActiveLoan = (alias = "bc", borrowingAlias = "b") => `EXISTS (SELECT 1 FROM borrowings ${borrowingAlias} WHERE ${borrowingAlias}.copy_id = ${alias}.id AND ${borrowingAlias}.deleted_at IS NULL AND ${borrowingAlias}.status IN ('borrowed', 'overdue'))`;
const hasPreparedReservation = (alias = "bc", reservationAlias = "r") => `EXISTS (SELECT 1 FROM reservations ${reservationAlias} WHERE ${reservationAlias}.reserved_copy_id = ${alias}.id AND ${reservationAlias}.deleted_at IS NULL AND ${reservationAlias}.status = 'ready' AND (${reservationAlias}.expires_at IS NULL OR ${reservationAlias}.expires_at > NOW()))`;
const hasActiveBookPolicy = (bookAlias = "bk") => `(${bookAlias}.book_type_id IS NOT NULL AND EXISTS (SELECT 1 FROM book_types active_policy WHERE active_policy.id = ${bookAlias}.book_type_id AND active_policy.is_active = 1))`;
const availableToBorrow = (alias = "bc") => `(${activeLendableCopy(alias)} AND ${hasAccession(alias)} AND EXISTS (SELECT 1 FROM books eligible_book WHERE eligible_book.id = ${alias}.book_id AND eligible_book.deleted_at IS NULL AND eligible_book.material_type = 'book' AND ${hasActiveBookPolicy("eligible_book")}) AND NOT ${hasActiveLoan(alias)} AND NOT ${hasPreparedReservation(alias)})`;

module.exports = { activeLendableCopy, hasAccession, hasActiveLoan, hasPreparedReservation, hasActiveBookPolicy, availableToBorrow };

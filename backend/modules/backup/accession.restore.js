const conflict = (message) => Object.assign(new Error(message), { status: 409 });
const accessionKey = (value) => String(value ?? "").trim().toLocaleLowerCase("en-US");
const barcodeKey = (value) => String(value ?? "").trim().toLocaleLowerCase("en-US");

function assertSameClaim(left, right) {
  if (barcodeKey(left.copy_barcode) !== barcodeKey(right.copy_barcode) || Number(left.book_id) !== Number(right.book_id)) {
    throw conflict(`Accession ${left.accession_number} is permanently claimed by another physical copy and cannot be restored to this snapshot.`);
  }
}

function prepareAccessionRestore(tables, live = {}) {
  const restoredTables = { ...tables };
  const combinedClaims = new Map();
  for (const claim of [...(tables.accession_claims ?? []), ...(live.claims ?? [])]) {
    const key = accessionKey(claim.accession_number);
    if (!key) throw conflict("The accession registry contains a blank claim.");
    const existing = combinedClaims.get(key);
    if (existing) assertSameClaim(existing, claim);
    else combinedClaims.set(key, claim);
  }

  const combinedVoids = new Map();
  for (const voidEvent of [...(tables.accession_claim_voids ?? []), ...(live.voids ?? [])]) {
    const key = accessionKey(voidEvent.accession_number);
    if (!key) throw conflict("The accession void registry contains a blank number.");
    const claim = combinedClaims.get(key);
    if (!claim) throw conflict(`Voided accession ${voidEvent.accession_number} has no permanent claim.`);
    assertSameClaim(claim, voidEvent);
    const existing = combinedVoids.get(key);
    if (existing) assertSameClaim(existing, voidEvent);
    else combinedVoids.set(key, voidEvent);
  }

  const combinedCorrections = new Map();
  for (const correction of [...(tables.accession_claim_corrections ?? []), ...(live.corrections ?? [])]) {
    const existing = combinedCorrections.get(String(correction.correction_id));
    if (existing && (
      barcodeKey(existing.copy_barcode) !== barcodeKey(correction.copy_barcode)
      || accessionKey(existing.old_accession_number) !== accessionKey(correction.old_accession_number)
      || accessionKey(existing.new_accession_number) !== accessionKey(correction.new_accession_number)
    )) throw conflict("The accession correction registry has a conflicting event ID.");
    if (!existing) combinedCorrections.set(String(correction.correction_id), correction);
  }

  const corrections = [...combinedCorrections.values()];
  const voided = new Set();
  const correctionTargets = new Set();
  for (const correction of corrections) {
    const oldClaim = combinedClaims.get(accessionKey(correction.old_accession_number));
    const newClaim = combinedClaims.get(accessionKey(correction.new_accession_number));
    if (!oldClaim || !newClaim) throw conflict("The accession registry is missing a claim referenced by a correction.");
    assertSameClaim(oldClaim, correction);
    assertSameClaim(newClaim, correction);
    const oldKey = accessionKey(correction.old_accession_number);
    const newKey = accessionKey(correction.new_accession_number);
    if (oldKey === newKey || voided.has(oldKey) || correctionTargets.has(newKey)) throw conflict("The accession correction history contains a cycle or duplicate replacement.");
    voided.add(oldKey);
    correctionTargets.add(newKey);
  }

  const claimsByBarcode = new Map();
  for (const claim of combinedClaims.values()) {
    const key = barcodeKey(claim.copy_barcode);
    const group = claimsByBarcode.get(key) ?? [];
    group.push(claim);
    claimsByBarcode.set(key, group);
  }
  const currentClaimByBarcode = new Map();
  for (const [key, claims] of claimsByBarcode) {
    const current = claims.filter((claim) => !voided.has(accessionKey(claim.accession_number)));
    if (current.length !== 1) throw conflict(`Copy barcode ${claims[0].copy_barcode} has an ambiguous accession history.`);
    currentClaimByBarcode.set(key, current[0]);
  }

  const copiesByBarcode = new Map();
  const copiesById = new Map();
  for (const copy of tables.book_copies ?? []) {
    const key = barcodeKey(copy.barcode);
    if (!key || copiesByBarcode.has(key)) throw conflict("The snapshot contains duplicate or blank copy barcodes.");
    copiesByBarcode.set(key, copy);
    copiesById.set(Number(copy.id), copy);
  }
  for (const claim of combinedClaims.values()) {
    const restoredCopy = copiesByBarcode.get(barcodeKey(claim.copy_barcode));
    if (restoredCopy && Number(restoredCopy.book_id) !== Number(claim.book_id)) {
      throw conflict(`Barcode ${claim.copy_barcode} belongs to a different book in this snapshot; the accession claim cannot be reassigned.`);
    }
  }

  const claimByNumber = combinedClaims;
  const snapshotHoldingByBarcode = new Map();
  for (const holding of tables.copy_holdings ?? []) {
    const copy = copiesById.get(Number(holding.copy_id));
    if (!copy) throw conflict("A snapshot holding refers to a copy that is missing from the snapshot.");
    const claim = claimByNumber.get(accessionKey(holding.accession_number));
    if (!claim || barcodeKey(claim.copy_barcode) !== barcodeKey(copy.barcode) || Number(claim.book_id) !== Number(copy.book_id)) {
      throw conflict(`Snapshot accession ${holding.accession_number} does not match its recorded physical copy.`);
    }
    snapshotHoldingByBarcode.set(barcodeKey(copy.barcode), holding);
  }
  const liveHoldingByBarcode = new Map((live.holdings ?? []).map((holding) => [barcodeKey(holding.copy_barcode), holding]));
  const holdingColumns = ["copy_id", "accession_number", "price", "program_id", "course_code", "location", "date_acquired", "distributor", "invoice_reference", "created_by", "updated_by", "created_at", "updated_at"];
  const restoredHoldings = [...(tables.copy_holdings ?? [])].filter((holding) => {
    const copy = copiesById.get(Number(holding.copy_id));
    return !currentClaimByBarcode.has(barcodeKey(copy?.barcode));
  });
  for (const [key, claim] of currentClaimByBarcode) {
    const copy = copiesByBarcode.get(key);
    if (!copy) continue;
    const liveHolding = liveHoldingByBarcode.get(key);
    const snapshotHolding = snapshotHoldingByBarcode.get(key);
    const source = liveHolding || snapshotHolding || { accession_number: claim.accession_number };
    if (liveHolding && Number(liveHolding.book_id) !== Number(copy.book_id)) {
      throw conflict(`Barcode ${claim.copy_barcode} resolves to another book after restore.`);
    }
    restoredHoldings.push(Object.fromEntries(holdingColumns.map((column) => [
      column,
      column === "copy_id" ? copy.id : column === "accession_number" ? claim.accession_number : (source[column] ?? null),
    ])));
  }
  restoredTables.copy_holdings = restoredHoldings;
  restoredTables.accession_claims = [...combinedClaims.values()];
  restoredTables.accession_claim_corrections = corrections;
  restoredTables.accession_claim_voids = [...combinedVoids.values()];
  const orphanedClaimCount = [...currentClaimByBarcode.keys()].filter((key) => !copiesByBarcode.has(key)).length;
  return { tables: restoredTables, orphanedClaimCount };
}

module.exports = { prepareAccessionRestore, accessionKey, barcodeKey };

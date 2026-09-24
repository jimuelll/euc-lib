const test = require("node:test");
const assert = require("node:assert/strict");
const audit = require("../middlewares/auditLogger");
const { copyLabel, copyAuditDescription, enrichCopyAuditRows } = require("../modules/analytics/audit.copy-label");

test("staff and admin mutation routes resolve to an explicit audit policy", () => {
  const routes = [
    ["PUT", "/api/about", "field_changes"],
    ["PUT", "/api/site-content", "field_changes"],
    ["PUT", "/api/admin/catalog-settings", "field_changes"],
    ["PUT", "/api/admin/catalog-schema", "field_changes"],
    ["POST", "/api/admin/book-types", "field_changes"],
    ["PUT", "/api/admin/book-types/2", "field_changes"],
    ["DELETE", "/api/admin/book-types/2", "affected_records"],
    ["POST", "/api/admin/books", "field_changes"],
    ["PUT", "/api/admin/copies/42/holding", "field_changes"],
    ["POST", "/api/admin/copies/42/holding/void-accession", "state_transition"],
    ["POST", "/api/admin/copies/42/retire", "state_transition"],
    ["POST", "/api/admin/copies/42/restore", "state_transition"],
    ["PATCH", "/api/admin/copies/42", "field_changes"],
    ["PATCH", "/api/admin/books/12", "field_changes"],
    ["DELETE", "/api/admin/books/12", "field_changes"],
    ["POST", "/api/admin/books/12/restore", "field_changes"],
    ["PUT", "/api/admin/users/S-1", "field_changes"],
    ["POST", "/api/admin/circulation/borrow", "state_transition"],
    ["POST", "/api/admin/circulation/return", "state_transition"],
    ["POST", "/api/admin/circulation/renew", "state_transition"],
    ["POST", "/api/borrowing/borrows/12", "state_transition"],
    ["POST", "/api/borrowing/borrows/88/return", "state_transition"],
    ["POST", "/api/borrowing/scan/borrow", "state_transition"],
    ["POST", "/api/borrowing/scan/return", "state_transition"],
    ["DELETE", "/api/borrowing/admin/borrows/88", "state_transition"],
    ["PATCH", "/api/borrowing/admin/borrows/88/restore", "state_transition"],
    ["POST", "/api/borrowing/admin/payments/settle", "affected_records"],
    ["POST", "/api/reservations/12/cancel", "state_transition"],
    ["POST", "/api/admin/reservations/4/cancel", "state_transition"],
    ["POST", "/api/admin/reservations/4/ready", "state_transition"],
    ["DELETE", "/api/admin/reservations/4", "state_transition"],
    ["PATCH", "/api/admin/reservations/4/restore", "state_transition"],
    ["POST", "/api/attendance/scan", "state_transition"],
    ["POST", "/api/admin/clearance/payment", "state_transition"],
    ["POST", "/api/clearance/borrowings/4/adjust", "state_transition"],
    ["POST", "/api/clearance/transactions/9/reverse", "state_transition"],
    ["POST", "/api/events", "field_changes"],
    ["DELETE", "/api/events/1", "field_changes"],
    ["POST", "/api/bulletin", "state_transition"],
    ["PATCH", "/api/bulletin/5/pin", "state_transition"],
    ["PATCH", "/api/bulletin/5/restore", "state_transition"],
    ["POST", "/api/admin/notifications", "field_changes"],
    ["POST", "/api/admin/academic-terms", "field_changes"],
    ["POST", "/api/admin/academic-terms/2/current", "field_changes"],
    ["POST", "/api/admin/academic-programs", "field_changes"],
    ["POST", "/api/admin/departments", "field_changes"],
    ["POST", "/api/admin/library-holidays", "field_changes"],
    ["PUT", "/api/admin/library-settings", "field_changes"],
    ["POST", "/api/admin/subscriptions", "field_changes"],
    ["POST", "/api/reservations/17", "state_transition"],
    ["PATCH", "/api/admin/subscriptions/reorder", "affected_records"],
    ["PATCH", "/api/admin/subscriptions/1", "field_changes"],
    ["POST", "/api/admin/user-guide", "field_changes"],
    ["PATCH", "/api/admin/user-guide/reorder", "affected_records"],
    ["PUT", "/api/admin/user-guide/1", "field_changes"],
    ["POST", "/api/admin/user-guide/1/publish", "field_changes"],
    ["POST", "/api/admin/user-guide/1/unpublish", "field_changes"],
    ["DELETE", "/api/admin/user-guide/1", "field_changes"],
    ["PUT", "/api/admin/recommendations/books/1/metadata", "field_changes"],
    ["POST", "/api/admin/recommendations/embeddings/backfill", "affected_records"],
    ["POST", "/api/admin/backup/snapshots", "affected_records"],
    ["POST", "/api/admin/backup/snapshots/9/restore", "affected_records"],
    ["POST", "/api/admin/backup/restore", "affected_records"],
  ];
  for (const [method, path, type] of routes) assert.equal(audit.getAuditPolicy(method, path)?.type, type, `${method} ${path}`);
  assert.equal(audit.getAuditPolicy("POST", "/api/admin/dashboard/ai-report"), null);
  assert.equal(audit.getAuditPolicy("POST", "/api/admin/backup/compatibility"), null);
  assert.equal(audit.getAuditPolicy("GET", "/api/admin/query/reports/export"), null);
  assert.equal(audit.targetFromPath("/api/reservations/17"), null, "the route parameter is a book ID before reservation creation");
  assert.deepEqual(audit.targetFromPath("/api/reservations/17", { reservationId: 93 }), { kind: "id", value: 93 });
});

test("batch audit entries summarize the affected record type and count", () => {
  const policy = audit.getAuditPolicy("PATCH", "/api/admin/subscriptions/reorder");
  const metadata = audit.metadataFor("/api/admin/subscriptions/reorder", { ids: [2, 4, 9] }, null, null, null, false, policy, {});
  assert.equal(metadata.detail_status, "affected_record_summary");
  assert.equal(metadata.affected_record_type, "subscriptions");
  assert.equal(metadata.affected_record_count, 3);
  const snapshotPolicy = audit.getAuditPolicy("POST", "/api/admin/backup/snapshots");
  const snapshot = audit.metadataFor("/api/admin/backup/snapshots", {}, null, null, null, true, snapshotPolicy, {});
  assert.equal(snapshot.affected_record_type, "backup snapshot");
  assert.equal(snapshot.affected_record_count, 1);
});

test("body-less embedding backfill requests produce audit metadata safely", () => {
  const path = "/api/admin/recommendations/embeddings/backfill";
  const policy = audit.getAuditPolicy("POST", path);
  const metadata = audit.metadataFor(path, undefined, null, null, { affectedCount: 3 }, false, policy, {});
  assert.equal(metadata.affected_record_count, 3);
  assert.equal(metadata.affected_record_type, "book embeddings");
  assert.equal(metadata.detail_status, "affected_record_summary");
  assert.doesNotThrow(() => audit.metadataFor(path, null, null, null, null, false, policy, {}));
});

test("audit values keep numeric one separate from boolean Yes", () => {
  const bookPolicy = audit.getAuditPolicy("PUT", "/api/admin/books/9");
  const bookMetadata = audit.metadataFor(
    "/api/admin/books/9",
    {},
    { copies: 7 },
    { copies: 1 },
    null,
    false,
    bookPolicy,
    { comparable: true },
  );
  assert.deepEqual(bookMetadata.changes.find((change) => change.field === "Copies"), { field: "Copies", before: "7", after: "1" });
  const settingsPolicy = audit.getAuditPolicy("PUT", "/api/admin/catalog-settings");
  const settingsMetadata = audit.metadataFor("/api/admin/catalog-settings", {}, { show_unheld_in_opac: 0 }, { show_unheld_in_opac: 1 }, null, false, settingsPolicy, { comparable: true });
  assert.deepEqual(settingsMetadata.changes.find((change) => change.field === "Show books without holdings in OPAC"), { field: "Show books without holdings in OPAC", before: "No", after: "Yes" });
});

test("holding audit snapshots show financial changes approved for super admins", () => {
  const before = { id: 42, barcode: "LIB-000042-001", title: "Atlas", accession_number: null, price: null, program_id: null, course_code: null, location: null, date_acquired: null, distributor: null, invoice_reference: null };
  const after = { ...before, accession_number: "ACC-42", price: "125.00", program_id: 3, course_code: "LIB101", distributor: "A person at a bookshop", invoice_reference: "OR-44" };
  const policy = audit.getAuditPolicy("PUT", "/api/admin/copies/42/holding");
  const metadata = audit.metadataFor("/api/admin/copies/42/holding", {}, before, after, null, false, policy, { comparable: true });
  assert.equal(metadata.detail_status, "changes_captured");
  assert.deepEqual(metadata.changes.find((change) => change.field === "Accession number"), { field: "Accession number", before: "Cleared", after: "ACC-42" });
  assert.deepEqual(metadata.changes.find((change) => change.field === "Price (PHP)"), { field: "Price (PHP)", before: "Cleared", after: "125.00" });
  assert.deepEqual(metadata.changes.find((change) => change.field === "Invoice reference"), { field: "Invoice reference", before: "Cleared", after: "OR-44" });
  assert.deepEqual(metadata.changes.find((change) => change.field === "Distributor"), { field: "Distributor", value: "Changed" });
});

test("voiding an accession audits the persisted Assigned to Voided transition without the reason", () => {
  const route = "/api/admin/copies/12/holding/void-accession";
  const metadata = audit.metadataFor(
    route,
    { reason: "Mistyped during data entry" },
    { id: 12, accession_number: "ACC-12", accession_status: "Assigned" },
    { id: 12, accession_number: "ACC-12", accession_status: "Voided" },
    { stateFrom: "Assigned", stateTo: "Voided", stateLabel: "Accession status" },
    false,
    audit.getAuditPolicy("POST", route),
    { comparable: true },
  );
  assert.ok(metadata.changes.some((change) => (
    change.field === "Accession status" && change.before === "Assigned" && change.after === "Voided"
  )));
  assert.equal(JSON.stringify(metadata).includes("Mistyped during data entry"), false);
});

test("policy deletion audit records its name and affected book count", () => {
  const policy = audit.getAuditPolicy("DELETE", "/api/admin/book-types/17");
  const metadata = audit.metadataFor("/api/admin/book-types/17", {}, { id: 17, name: "General" }, null, { affectedCount: 3 }, false, policy, {});
  assert.equal(metadata.detail_status, "affected_record_summary");
  assert.equal(metadata.affected_record_type, "books now needing a loan policy");
  assert.equal(metadata.affected_record_count, 3);
  assert.equal(audit.getDescription("DELETE", "/api/admin/book-types/17", {}, { name: "General" }, null, { affectedCount: 3 }), "Deleted loan policy “General” · 3 books need a loan policy");
});

test("clearance audit reads persisted amounts and receipt references while redacting free text", () => {
  const changes = audit.snapshotChanges("/api/admin/clearance/payment", null, { id: 91, transaction_type: "payment", amount: "35.50", receipt_number: "CLR-2026-0000091" });
  assert.deepEqual(changes, [
    { field: "Amount (PHP)", before: "Not recorded", after: "35.50" },
    { field: "Receipt reference", before: "Not recorded", after: "CLR-2026-0000091" },
    { field: "Transaction type", before: "Not recorded", after: "payment" },
  ]);
  const personal = audit.snapshotChanges("/api/admin/clearance/payment", null, { id: 91, transaction_type: "payment", amount: "35.50", receipt_number: "CLR-2026-0000091", reason: "personal details" });
  assert.equal(personal.some((entry) => entry.field.toLowerCase().includes("reason")), false);
  const failed = audit.metadataFor("/api/admin/clearance/payment", {}, null, null, { stateFrom: "Not recorded", stateTo: "Recorded", stateLabel: "Transaction status" }, false, audit.getAuditPolicy("POST", "/api/admin/clearance/payment"), { failed: true, comparable: false });
  assert.equal(failed.detail_status, "details_unavailable");
  assert.deepEqual(failed.changes, []);
  const reversal = audit.snapshotChanges(
    "/api/clearance/transactions/9/reverse",
    { id: 9, transaction_type: "payment", amount: "35.50", receipt_number: "OLD-RECEIPT" },
    { id: 92, transaction_type: "reversal", amount: "-35.50", receipt_number: null },
  );
  assert.deepEqual(reversal, [
    { field: "Amount (PHP)", before: "Not recorded", after: "-35.50" },
    { field: "Transaction type", before: "Not recorded", after: "reversal" },
  ]);
});

test("copy audit summaries identify the book and stable barcode sequence", () => {
  const before = { id: 61, barcode: "LIB-000086-002", title: "86—Eighty-Six, Vol. 1", condition: "Good" };
  const after = { ...before, condition: "Damaged" };
  const policy = audit.getAuditPolicy("PATCH", "/api/admin/copies/61");
  const metadata = audit.metadataFor("/api/admin/copies/61", {}, before, after, null, false, policy, { comparable: true });
  assert.equal(metadata.detail_status, "changes_captured");
  assert.deepEqual(metadata.changes.find((entry) => entry.field === "Condition"), { field: "Condition", before: "Good", after: "Damaged" });
  assert.equal(copyLabel(before), "Copy 2");
  assert.equal(audit.getDescription("PATCH", "/api/admin/copies/61", {}, before, after), "Updated condition for “86—Eighty-Six, Vol. 1” · Copy 2");
  const failedCapture = audit.metadataFor("/api/admin/copies/61", {}, null, after, null, false, policy, { failed: true, comparable: false });
  assert.equal(failedCapture.detail_status, "details_unavailable");
  assert.deepEqual(failedCapture.changes, []);
  assert.equal(copyAuditDescription("/api/admin/copies/61", before), "Updated condition for “86—Eighty-Six, Vol. 1” · Copy 2");
  assert.equal(copyAuditDescription("/api/admin/copies/61/holding", before), "Updated holdings for “86—Eighty-Six, Vol. 1” · Copy 2");
  assert.equal(copyLabel({ id: 61, barcode: "legacy-qr" }), "Barcode legacy-qr");
  assert.equal(copyAuditDescription("/api/admin/copies/61", { id: 61 }), "Updated condition · Copy ID 61");
});

test("legacy copy audit summaries resolve current labels and use ID fallback for deleted copies", async () => {
  const rows = [
    { route: "/api/admin/copies/61", description: "Updated copy condition (#61)" },
    { route: "/api/admin/copies/62/holding", description: "Saved holdings for copy (#62)" },
    { route: "/api/admin/books/4", description: "Updated catalog record" },
  ];
  const queried = [];
  const enriched = await enrichCopyAuditRows(rows, async (sql, params) => {
    queried.push({ sql, params });
    return [[{ id: 61, barcode: "LIB-000086-002", title: "86—Eighty-Six, Vol. 1" }]];
  });
  assert.equal(enriched[0].copy_display_description, "Updated condition for “86—Eighty-Six, Vol. 1” · Copy 2");
  assert.equal(enriched[1].copy_display_description, "Updated holdings · Copy ID 62");
  assert.equal(enriched[2].description, "Updated catalog record");
  assert.equal("route" in enriched[0], false);
  assert.deepEqual(queried[0].params, [61, 62]);
});

test("permanent accession audit labels remain stable across application snapshot restores", async () => {
  const row = {
    route: "/api/admin/copies/61/holding",
    description: "Assigned accession ACC-61 to “Atlas” · Copy 3",
    metadata: JSON.stringify({ permanent_accession_event: true }),
  };
  const enriched = await enrichCopyAuditRows([row], async () => [[{ id: 61, barcode: "LIB-000999-001", title: "Different restored record" }]]);
  assert.equal(enriched[0].description, row.description);
  assert.equal(enriched[0].copy_display_description, undefined);
});

test("new copy audit labels remain stable after copy IDs are reused by restore", async () => {
  const row = {
    route: "/api/admin/copies/61/holding",
    description: "Updated holdings for “Atlas” · Copy 2",
    metadata: JSON.stringify({ copy_barcode: "LIB-000086-002", copy_display_description: "Updated holdings for “Atlas” · Copy 2" }),
  };
  const enriched = await enrichCopyAuditRows([row], async () => { throw new Error("stable labels must not be dynamically re-resolved"); });
  assert.equal(enriched[0].copy_display_description, "Updated holdings for “Atlas” · Copy 2");
});

test("user audit changes hide personal values and distinguish no change from failed capture", () => {
  const policy = audit.getAuditPolicy("PUT", "/api/admin/users/S-123");
  const before = { id: 4, name: "A Person", student_employee_id: "S-123", email: "old@example.test", role: "student", is_active: 1, program_id: 2, academic_term_id: null, department_id: null, address: null, contact: null, year_level: null, remarks: null, deleted_at: null };
  const after = { ...before, name: "B Person", email: "new@example.test", role: "staff" };
  const changed = audit.metadataFor("/api/admin/users/S-123", {}, before, after, null, false, policy, { comparable: true });
  assert.equal(changed.detail_status, "changes_captured");
  assert.deepEqual(changed.changes.find((change) => change.field === "Name"), { field: "Name", value: "Changed" });
  assert.deepEqual(changed.changes.find((change) => change.field === "Email"), { field: "Email", value: "Changed" });
  assert.ok(changed.changes.find((change) => change.field === "Role" && change.before === "student" && change.after === "staff"));
  const unchanged = audit.metadataFor("/api/admin/users/S-123", {}, before, before, null, false, policy, { comparable: true });
  assert.equal(unchanged.detail_status, "no_field_changes");
  const failed = audit.metadataFor("/api/admin/users/S-123", {}, null, null, null, false, policy, { failed: true, comparable: false });
  assert.equal(failed.detail_status, "details_unavailable");
  assert.deepEqual(failed.changes, []);
  assert.equal(audit.safeRoute("/api/admin/users/S-123"), "/api/admin/users/:user");
});

test("audit capture refuses to attribute a concurrent later edit to an earlier update", () => {
  const policy = audit.getAuditPolicy("PUT", "/api/admin/users/S-123");
  const before = { id: 4, name: "A Person", student_employee_id: "S-123", email: "old@example.test", role: "student", is_active: 1, program_id: 2, academic_term_id: null, department_id: null, address: null, contact: null, year_level: null, remarks: null, deleted_at: null };
  const request = { role: "staff" };
  assert.equal(audit.snapshotChangedSinceRequest("/api/admin/users/S-123", "PUT", request, before, { ...before, role: "staff" }, policy), false);
  assert.equal(audit.snapshotChangedSinceRequest("/api/admin/users/S-123", "PUT", request, before, { ...before, role: "staff", program_id: 7 }, policy), true);
  assert.equal(audit.snapshotChangedSinceRequest("/api/admin/users/S-123", "PUT", { role: "staff" }, before, { ...before, role: "admin" }, policy), true);
  const unavailable = audit.metadataFor("/api/admin/users/S-123", request, before, { ...before, role: "staff", program_id: 7 }, null, false, policy, { failed: true, comparable: false });
  assert.equal(unavailable.detail_status, "details_unavailable");
  assert.deepEqual(unavailable.changes, []);

  const readyPolicy = audit.getAuditPolicy("POST", "/api/admin/reservations/8/ready");
  assert.equal(audit.snapshotChangedSinceRequest(
    "/api/admin/reservations/8/ready", "POST", {},
    { id: 8, status: "pending" }, { id: 8, status: "ready" }, readyPolicy,
  ), false);
  assert.equal(audit.snapshotChangedSinceRequest(
    "/api/admin/reservations/8/ready", "POST", {},
    { id: 8, status: "pending" }, { id: 8, status: "cancelled" }, readyPolicy,
  ), true);
});

const SNAPSHOT_TABLE = "backup_snapshots";
// Audit history is an append-only operational ledger. It must survive a data
// restore so post-snapshot actions can be shown as reversed rather than erased.
const SYSTEM_TABLES = [SNAPSHOT_TABLE, "audit_events", "auth_restore_state", "restore_audit_events", "system_maintenance_state"];

// Add every application data table here with its migration. Control tables are
// deliberately excluded: restoring them would overwrite the recovery record,
// maintenance lock, or the session invalidation marker.
const APPLICATION_TABLES = Object.freeze([
  "about_settings", "accession_claim_corrections", "accession_claim_voids", "accession_claims", "academic_programs", "academic_subscriptions", "academic_terms", "attendance_logs", "departments",
  "auth_audit_events", "auth_refresh_sessions", "book_copies", "copy_holdings", "catalog_settings", "book_embeddings", "book_enrichment", "book_types", "books", "borrowings",
  "bulletin_comments", "bulletin_likes", "bulletin_posts", "catalog_schema", "clearance_transaction_items",
  "clearance_transactions", "delivery_outbox", "fine_accounts", "fine_ledger_entries", "library_circulation_settings", "library_events", "library_holidays", "notification_reads",
  "notifications", "recommendation_feedback", "reservations", "site_content_settings", "site_daily_visits", "users",
  "user_guide_modules",
]);

module.exports = { SNAPSHOT_TABLE, SYSTEM_TABLES, APPLICATION_TABLES };

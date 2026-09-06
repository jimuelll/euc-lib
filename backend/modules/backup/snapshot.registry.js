const SNAPSHOT_TABLE = "backup_snapshots";
const SYSTEM_TABLES = [SNAPSHOT_TABLE, "auth_restore_state", "restore_audit_events", "system_maintenance_state"];

// Add every application data table here with its migration. Control tables are
// deliberately excluded: restoring them would overwrite the recovery record,
// maintenance lock, or the session invalidation marker.
const APPLICATION_TABLES = Object.freeze([
  "about_settings", "academic_programs", "academic_subscriptions", "academic_terms", "attendance_logs",
  "audit_events", "auth_audit_events", "auth_refresh_sessions", "book_copies", "book_types", "books", "borrowings",
  "bulletin_comments", "bulletin_likes", "bulletin_posts", "catalog_schema", "clearance_transaction_items",
  "clearance_transactions", "library_circulation_settings", "library_events", "library_holidays", "notification_reads",
  "notifications", "reservations", "site_content_settings", "site_daily_visits", "users",
]);

module.exports = { SNAPSHOT_TABLE, SYSTEM_TABLES, APPLICATION_TABLES };

# Notifications administration

The Notifications page uses the shared admin header, tabs, filter chips and detail drawer. Announcements contains announcement/reminder types; System alerts contains the remaining types. Search and filter counts apply before pagination. Automatic records are grouped by type, day and delivery state; each message keeps its own actions in the group drawer. Group badges and chip counts count feed entries, while the group label shows the underlying alert count.

Scheduling uses the existing delivery outbox and its two-second worker. `available_at` holds the requested send time. Pending events remain private until the worker creates the notification. Failed events retry with their original delivery key. Expiring a pending event cancels it without deleting its queue record. Expiring an available message removes it from patron reads and refreshes connected audiences. A busy worker lock rejects cancellation/retry so it cannot race delivery.

Broadcast creation and resend require the confirmed current active-recipient count; a changed count returns HTTP 409. Audience membership is evaluated when patrons read their feed. “Available” means the notification is saved for its audience; it does not assert receipt on an offline device. Read counts come from `notification_reads`. Export includes the current filtered groups across all pages.

No database migration is required. Run backend `npm test` for validation, audience confirmation and queue retry coverage. Local SQL verification used a rolled-back transaction; browser sends used mocked APIs.

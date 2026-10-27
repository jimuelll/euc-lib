# Notification images and redesigned workspace

Implemented optional notification images and image emails, a shared recipient-facing detail modal, notification email deep links, and the admin notification ledger. The additive image migration was applied and verified in the local app and isolated test database; it adds nullable fields and queues no retrospective emails. Restart the backend after deploying the build. Existing Cloudinary backend settings were verified present without printing their values.

The screenshots here use synthetic messages and a sample poster in an isolated browser harness. No live email or Cloudinary upload was sent during validation. The temporary browser tab, preview server, and fixture source files were cleaned up. The compose UI is also being refined concurrently in this workspace; its screenshot records the version inspected during this task, rather than overriding those later edits.

Validation:

- Backend build passed; frontend production build passed, with the usual chunk-size warning.
- Seven focused backend image/link tests passed, including a real localhost multipart request with a stubbed Cloudinary uploader, role restrictions, format/size/reference checks, escaped rendering, backup upgrades, automatic notification links and legacy-link compatibility.
- Six isolated database integration tests passed, including image persistence through immediate/scheduled publication, recipient access/expiry, and captured manual email image/deep-link rendering.
- All 37 targeted frontend tests for the recipient modal, upload, notification workspace, My Library and optional-email controls passed (including a focused rerun of the workspace tests after concurrent changes). Browser checks covered desktop/mobile layouts, light/dark themes, all three entry points, image preservation on duplication, email defaulting off, Escape and focus restoration.
- Frontend architecture checks passed. Changed notification files passed lint, with the existing NotificationsContext Fast Refresh warning.
- Full backend suite run during this task: 314 passed, 37 skipped, and one existing failure in the query-route rate-limit assertion (`backend/test/rate-limit.test.js:246`). Focused checks were rerun after subsequent integration changes.
- Existing whole-project frontend issues remain: the `authDestination.ts` control-character regex lint error, and two Users test fixtures missing required summary fields in the optional TypeScript check.

Concurrent integration:

A separate change introduced selected-recipient audiences and `notification_recipients`. Its additive migration was applied to the isolated test database and verified in the local app database. The admin audience hydration was adjusted to use a normal membership lookup instead of `JSON_ARRAYAGG`, which is unavailable in the local MariaDB version. Existing image and audience data were preserved.

Preview files:

- `admin-ledger-desktop.jpg` — light-theme notification ledger.
- `admin-ledger-mobile.jpg` — mobile notification ledger.
- `notification-desktop.jpg` and `notification-mobile.jpg` — the recipient-facing image modal.
- `compose-image-desktop.jpg` — image-preserving duplication with email unchecked, before concurrent compose refinements.

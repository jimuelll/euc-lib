# Email delivery pages

Implemented two super-admin-only workspaces: Users → Account emails, and Notifications → Library emails. Library emails separates manual notifications from automated circulation, overdue/fine, and payment notices. Both workspaces use the same allowance and existing delivery records. Admins retain their notification-specific email totals.

The screenshots in this folder use synthetic records and counters from an isolated browser harness rendering the actual page component. They do not show live usage. No live email was sent during validation. The temporary harness and servers were removed after review.

- `library-desktop.jpg`: manual deliveries in the light theme.
- `library-mobile.jpg`: automated deliveries at 390px, after correcting tab-content overflow.
- `delivery-mobile-drawer.jpg`: failed routine delivery diagnostics and retry affordance.
- `account-dark-desktop.jpg`: account deliveries in the dark theme.

Validation:

- Backend and frontend production builds passed.
- Targeted email/notification backend tests: 35 passed.
- Isolated `euc_manual_email_test` database tests: 5 passed, including category separation, timestamp boundaries, pagination and provider-ID search. Provider calls were captured or stubbed.
- Frontend delivery, Users, and email-option tests: 48 passed (19 delivery, 23 Users, 6 email options).
- Frontend architecture check passed. Changed delivery files passed lint; Users retains its existing hook warnings.
- Full backend suite: 309 passed, 36 skipped, 1 existing failure in the query-route rate-limit assertion (`test/rate-limit.test.js:246`).
- Full frontend lint retains 1 existing error (`src/utils/authDestination.ts:6`, `no-control-regex`) and 66 warnings.
- Additional frontend TypeScript checking reports two existing Users test fixtures missing their required `summary` fields (`AdminUsersWorkspace.test.tsx:43` and `:52`); production builds pass.

No migration or environment changes are required. Deploy the backend API additions before or alongside the frontend, and restart the backend to load the new endpoints. Existing notification delivery and sending switches are preserved.

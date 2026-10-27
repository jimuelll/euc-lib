# Users and Notifications drawer verification

Implemented role-driven creation, inline availability checks, invitation guidance, edit tabs, dirty-state controls, account-email history, archive reasons, and scoped drawer styling. No schema migration is required.

## Checks

- User workspace tests: 26 passed; final validation-hook tests: 3 passed.
- Notification composer tests: 12 passed.
- Notification image tests: 7 passed; role-aware form helper tests: 3 passed.
- Frontend production build, type check, and architecture check passed.
- Backend build passed.
- Full backend suite: 331 passed, 39 skipped, 2 failures outside this change: query-export rate-limit wiring assertion and catalog cover-replacement response expectation. New availability, archive-reason, audit-policy, and permission tests passed.
- Browser verification: desktop 1366×768, tablet 820×1180, mobile 390×844 in light and dark themes. No page overflow or browser runtime errors; footer visible in every case.
- Computed field-border contrast against the drawer surface: 4.74:1 light and 6.33:1 dark. Enabled create actions use maroon (#7a0000) with white text.

Screenshots and computed browser results are saved beside this file in report.json. Browser checks use synthetic APIs and do not send real account emails.

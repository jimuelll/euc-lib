# Application architecture rules

These are the dependency rules for new and refactored code.

## Backend

```text
routes -> controllers -> services -> repositories -> database
jobs  -> services
```

- Routes define transport, authentication, and URL composition only.
- Controllers translate HTTP input/output and delegate business decisions.
- Services own business rules, transactions, and coordination between features.
- Repositories own SQL and database access. Controllers and routes must not import the database pool.
- A feature may call another feature through its public service API, never through another feature's repository or private implementation.
- Scheduled work belongs in `backend/jobs/` and should call a service rather than duplicate route logic.
- Compatibility facades are allowed during extraction, but new consumers should import the focused service directly.
- Feature folders use kebab-case names and expose stable route/module entrypoints. Temporary camel-case route shims remain only for renamed modules during the migration window.
- Repositories are the only feature layer allowed to import `db.js`; transport files must not contain SQL or database imports.

## Frontend

```text
route/page -> feature components -> feature hooks -> feature API -> backend API
```

- Keep feature API clients, hooks, types, and feature components together under the feature folder.
- UI components should receive data and callbacks; they should not call Axios directly.
- Shared UI primitives may not import page-specific code.
- Pages compose feature panels and own route-level layout, not domain data fetching.
- `src/app` owns providers and route composition. `src/pages` is reserved for temporary route adapters and exceptional shared pages.
- `src/features/<feature>` owns that feature's API, hooks, types, components, and route pages. Cross-feature consumers use the feature's public entrypoint instead of private `components`, `hooks`, `api`, or `admin` paths.
- `src/components/ui` contains visual primitives and `src/components/layout` contains shared application chrome. Neither may depend on pages or feature API clients.
- Legacy `src/services` files are re-export shims only and are allowlisted for removal after all consumers migrate.

## Automated enforcement

- `backend/npm run architecture:test` runs the backend regression and transport-layer checks.
- `frontend/npm run test:architecture` validates feature boundaries, compatibility imports, public feature entrypoints, kebab-case feature folders, and route coverage.
- Both checks are intended to run in CI before deployment; they do not require a database connection.

Large static defaults such as `userGuide.defaults.js` remain single files unless their editing workflow becomes difficult.

The refactored borrowing, analytics, catalog, users, admin catalog, bulletin, and My Library areas establish these boundaries while older modules can be migrated incrementally.

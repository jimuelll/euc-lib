# Enverga-Candelaria Library Management System

Full-stack library services platform for Manuel S. Enverga University Foundation – Candelaria. The system combines the public library website, patron self-service, circulation-desk workflows, content management, analytics, and administration in one role-aware application.

## What the system does

### For patrons

- Browse and search the public catalogue.
- View book availability and related recommendations.
- Borrow and reserve library materials.
- Review current loans, borrowing history, reservations, fines, attendance, subscriptions, and notifications in **My Library**.
- Scan a student or employee ID for library attendance.
- Read and interact with bulletin posts.

### For library staff

- Maintain books, copies, barcodes, book types, and a configurable catalogue schema.
- Look up patrons and process barcode-supported borrowing, returns, and renewals.
- Manage reservation queues and attendance records.
- Review clearance status, fines, and cash payments.
- Publish bulletin content and manage library-facing information.
- Open a role-aware user guide with plain-language instructions for each available module.

### For administrators

- Manage role-specific user accounts, departments, library settings, holidays, academic programs, and academic terms.
- Manage the About page, homepage content, subscriptions, announcements, and notifications.
- Draft, publish, reorder, hide, and archive user-guide modules from Content Management.
- Review analytics, exports, circulation reports, clearance exceptions, and audit data.
- Run aggregate AI analytics reports with Gemini or Groq.
- Maintain Gemini semantic catalogue embeddings and book recommendations.
- Create, download, validate, and restore database snapshots.

## Architecture

```text
React + TypeScript + Vite frontend
        │
        │ HTTP /api and authenticated WebSocket /ws
        ▼
Express backend
        │
        ├── MySQL/MariaDB operational database
        ├── Cloudinary media and snapshot storage
        ├── Gemini semantic embeddings and optional AI reports
        └── Optional Groq AI reports
```

The frontend and backend are separate Node.js applications. There is no root `package.json` or root workspace runner; install and run dependencies from `frontend/` and `backend/` independently.

## Technology

- **Frontend:** React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, Radix UI/shadcn-style components, Recharts, Axios, Framer Motion, and ZXing.
- **Backend:** Node.js, Express 5, MySQL2, JWT, cookie-parser, WebSockets (`ws`), Helmet, CORS, rate limiting, Cloudinary, QR Code, and JsBarcode.
- **Database:** MySQL-compatible SQL schema. The checked-in dump was generated from MariaDB 10.4.

## User roles

The database supports these roles:

| Role | Scope |
| --- | --- |
| `student` | Library Card Number, Student No., academic program, and year level; patron self-service and student library workflows |
| `staff` | Library Card Number, Student No., academic program, and year level; elevated desk, catalogue, reservation, and patron-administration access |
| `alumni` | Library Card Number; alumni patron workflows |
| `employee` | Employee No. and configurable department; employee patron workflows |
| `scanner` | Username; attendance and circulation scanning workflows |
| `admin` | Username; staff capabilities plus content, settings, reporting, analytics, and user administration |
| `super_admin` | Username; full administration, audit logs, catalogue policy/schema controls, and backups/restores |

Protected API routes use JWT authentication and role checks. New accounts must change their administrator-set password on first sign-in. Student remarks are an internal, student-only edit field and are never shown to patrons.

The legacy `student_employee_id` remains as a compatibility lookup key. It mirrors the account's primary sign-in identifier: Library Card Number for students, staff, and alumni; Employee No. for employees; and Username for scanner and administrator roles.

## Catalogue schema

Standard book records use a configurable default form. Only **Title** and **Primary Author** are required bibliographic fields. ISBN remains optional and supports metadata lookup.

- Identification: Title, Primary Author, ISBN.
- Publication: Publisher, Publication Place, Copyright Year, Edition, and Physical Description.
- Classification: Call Number and repeatable Subject headings.
- Relationships and contributors: Added Title, Series Title, and repeatable Added Authors, Editors, Coordinators, Consultants, Contributors, and Illustrators.
- Inventory: Loan Policy, Copies, and Location.

Repeatable fields store a list of text entries, so staff can add or remove individual subjects or contributors. The schema editor can reorder, hide, archive, and restore fields; it has no custom-field limit. Existing Category metadata is retained even though Category is no longer on the default book form. Thesis fields remain separate.

## Repository layout

```text
.
├── backend/
│   ├── app.js                  Express middleware and route mounting
│   ├── server.js               HTTP/WebSocket server entry point
│   ├── db.js                   MySQL connection pool
│   ├── middlewares/            Validation, rate limiting, maintenance, audit logging
│   ├── modules/                Feature routes, controllers, and services
│   ├── realtime/               Authenticated notification WebSocket hub
│   └── package.json
├── frontend/
│   ├── src/App.tsx             Route tree and application providers
│   ├── src/components/         Shared UI and layout components
│   ├── src/context/            Auth and notification state
│   ├── src/hooks/              Reusable client hooks
│   ├── src/pages/              Public, patron, scanner, and admin screens
│   ├── src/services/            API and content services
│   ├── vite.config.ts          Dev server and `/api` proxy
│   ├── vercel.json              Vercel rewrites
│   └── package.json
├── db/
│   ├── fresh-start.sql         Current destructive schema baseline and defaults
│   ├── migrations/             Additive SQL changes for existing databases
│   └── realistic-demo-data.sql Demo users and catalogue data
├── PRODUCT.md                  Product context and constraints
└── README.md
```

## Requirements

- Node.js 20 or newer.
- MySQL 8+ or a compatible MariaDB installation.
- A database named `library` or another database selected through `DB_NAME`.
- Cloudinary credentials for media uploads and saved snapshot storage.
- Gemini credentials for semantic recommendations and embedding backfills.
- Gemini or Groq credentials for AI analytics reports.

## Local setup

### 1. Create or migrate the database

For a brand new environment only, import the current baseline:

```powershell
mysql -u <user> -p <database> < db/fresh-start.sql
```

`db/fresh-start.sql` drops and recreates application tables. Never run it against an existing database whose data must be preserved. A local demo dataset can be added after a fresh start with `db/realistic-demo-data.sql`; it includes accessioned and unaccessioned copies, a voided accession, retired/lost/damaged copies, a book without a policy, an archived title, active and historical loans, and pending/ready reservations. It also seeds sample program/course acquisition details. Use demo data only in a non-production database.

For an existing database, take and verify a full database backup before running any migration. This pre-migration backup must include the current schema, data, and triggers; an older database may not have the accession registry yet. Restore it to a disposable database and check that its application tables and a sample holding can be read. Keep the verified backup available until the release is complete.

Then apply each unapplied migration below, in this order. Run each file once with the MySQL or MariaDB command-line client; the accession migration defines triggers and uses the client's `DELIMITER` command.

```powershell
mysql -u <user> -p <database> < db/migrations/2026-09-09-add-user-guide.sql
mysql -u <user> -p <database> < db/migrations/2026-09-18-index-refresh-session-revocations.sql
mysql -u <user> -p <database> < db/migrations/2026-09-19-default-book-catalog-schema.sql
mysql -u <user> -p <database> < db/migrations/2026-09-19-fine-ledger-and-loan-duration.sql
mysql -u <user> -p <database> < db/migrations/2026-09-19-role-specific-user-accounts.sql
mysql -u <user> -p <database> < db/migrations/2026-09-23-copy-holdings-and-catalog-visibility.sql
mysql -u <user> -p <database> < db/migrations/2026-09-23-cross-system-invariants.sql
mysql -u <user> -p <database> < db/migrations/2026-09-24-accession-lifecycle.sql
mysql -u <user> -p <database> < db/migrations/2026-09-24-permanent-accession-voids.sql
```

The fine-ledger migration must reconcile existing borrowing charges before the new backend is deployed. The accession migration backfills a permanent claim for each existing holding. The permanent-accession migration creates the append-only void registry and makes accession changes fail at the database level. After all migrations finish, take a second full backup and verify its restore includes `accession_claims`, `accession_claim_corrections`, `accession_claim_voids`, and the accession triggers. The release order is verified pre-migration backup, unapplied migrations, verified post-migration backup, backend, then frontend. Skip migrations already applied; do not rerun them. The accession migrations require permission to create triggers. Application snapshots are version 15 and include permanent accession claims and void events; full disaster-recovery backups must also include both registries and triggers.

An accession number is permanently attached to its first physical copy. If staff entered the wrong number, a super admin can choose **Void mistaken accession** in the Holdings editor and enter a reason. Voiding never edits or removes the number or its claim, and the copy can no longer be borrowed. To use the correct number, staff add a new physical copy and assign it there; the voided number remains reserved forever. Voiding is blocked while the copy has an active loan or prepared reservation, or if it would leave pending reservations without enough eligible copies. Database triggers block direct accession edits and hard deletion of claimed copies and books, including a book delete that would cascade to copies and holdings. Application restores merge and retain claims and void events made after an older snapshot; if a claimed barcode is absent from that snapshot, its claim and void event remain reserved until the same physical copy is restored. Delivered and pending permanent-accession audit events are retained through application snapshot restores.

The application adds the initial guide modules on first use. Editors can then change them without future application starts overwriting their content. The role-specific migration creates Departments, adds the account-profile fields, and backfills primary identifiers from legacy IDs. The catalogue migration adds the repeatable field type, changes Publication Year to Copyright Year, and installs the current book defaults without deleting existing metadata. A fresh `fresh-start.sql` followed by `realistic-demo-data.sql` creates permanent demo accession claims and holdings, a lifecycle scenario set, fine accounts, and seeded charge entries as part of the demo data import.

The connected copy/accession lifecycle review and state-by-state verification matrix are in [COPY-ACCESSION-LIFECYCLE-REVIEW.md](COPY-ACCESSION-LIFECYCLE-REVIEW.md).

### 2. Configure the backend

Create `backend/.env`:

```env
PORT=4000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASS=your_mysql_password
DB_NAME=library
DB_CONNECTION_LIMIT=10
# For Layerbase MariaDB, set DB_SSL=true. If using its pooled endpoint,
# set DB_SSL_REJECT_UNAUTHORIZED=false; for its direct endpoint, leave it unset.
# DB_CONNECT_TIMEOUT_MS=30000

JWT_SECRET=replace_with_a_long_random_access_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_with_a_long_random_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Semantic recommendations and embedding backfills
AI_EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# Aggregate analytics reports; Gemini is the default
AI_REPORT_PROVIDER=gemini
GEMINI_REPORT_MODEL=gemini-2.5-flash

# Use these instead when AI_REPORT_PROVIDER=groq
# GROQ_API_KEY=your_groq_api_key
# GROQ_REPORT_MODEL=openai/gpt-oss-20b

# Optional: changes the JSON body limit used by backup import
# BACKUP_MAX_BYTES=52428800
# Optional: maximum uncompressed snapshot payload saved or exported
# SNAPSHOT_MAX_BYTES=52428800
# Optional: Cloudinary snapshot upload timeout in milliseconds
# SNAPSHOT_UPLOAD_TIMEOUT_MS=120000
# Optional: stale refresh-session cleanup interval in milliseconds
# REFRESH_SESSION_PURGE_INTERVAL_MS=3600000
```

Install and start the API from `backend/`:

```powershell
cd backend
npm install
node server.js
```

For automatic restarts during development:

```powershell
npx nodemon server.js
```

The API listens on `http://localhost:4000`. The authenticated notification socket is available at `ws://localhost:4000/ws?token=<access-token>`.

### 3. Configure the frontend

Create `frontend/.env`:

```env
VITE_BASE_URL=http://localhost:4000
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

Install and start the frontend from `frontend/`:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:8080`. Vite proxies local `/api` requests to the backend.

## Available commands

Run these commands from `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 8080 |
| `npm run build` | Build the production frontend |
| `npm run build:dev` | Build using Vite's development mode |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build |

Run backend tests from `backend/`:

```powershell
npm test
```

Run frontend checks from `frontend/` with `npm test`; run backend checks from `backend/` with `npm test`.

## Frontend routes

The main routes registered in `frontend/src/App.tsx` are:

| Area | Routes |
| --- | --- |
| Public | `/`, `/about`, `/services`, `/services/subscriptions`, `/catalogue`, `/bulletin`, `/login`, `/scan-qr`, `/change-password` |
| Patron | `/services/borrowing`, `/my-library`, `/edit-profile` |
| Staff/admin | `/admin`, `/admin/manage`, `/admin/catalog`, `/admin/circulation`, `/admin/reservations`, `/admin/clearance`, `/admin/holidays`, `/admin/user-guide`, `/admin/content` |
| Admin-only | `/admin/analytics`, `/admin/report`, `/admin/notifications`, `/admin/attendance-logs` |
| Super-admin | `/admin/book-types`, `/admin/backup`, `/admin/audit-logs` |

Some older admin URLs redirect into the consolidated content or clearance pages, including `/admin/bulletin`, `/admin/subscriptions`, `/admin/edit-about`, and `/admin/payment`.

## Backend route groups

The Express application mounts feature modules under `/api`:

- **Public/content:** `/auth`, `/about`, `/site-content`, `/bulletin`, `/events`, `/catalogue`, `/analytics/visit`.
- **Patron:** `/borrowing`, `/reservations`, `/my-library`, `/notifications`, `/subscriptions`, `/recommendations`.
- **Staff/admin:** `/admin`, `/attendance`, `/user-guide`, `/admin/catalogue`, `/admin/circulation`, `/admin/analytics`, `/admin/clearance`, `/admin/library-settings`.
- **Guide editing:** `/admin/user-guide` supports drafts, publishing, ordering, visibility, and archival for `admin` and `super_admin` roles.
- **Super-admin:** `/admin/backup`, audit-log views, catalogue schema/book-type controls, and embedding maintenance.

The exact endpoint contracts live beside each feature in `backend/modules/*/*.routes.js`. The backend also runs overdue-borrowing synchronization at startup and every five minutes.

## Deployment

The frontend includes `frontend/vercel.json`, which:

1. Rewrites `/api/*` to the deployed Render backend at `https://euc-lib.onrender.com/api/:path*`.
2. Rewrites client-side routes to `index.html` for Vercel hosting.

For Vercel, set the project **Root Directory** to `frontend`, use `npm run build` as the build command, and use `dist` as the output directory. Set the production `VITE_BASE_URL` to the full deployed backend URL (currently `https://euc-lib.onrender.com`), not `http://localhost:4000`. The frontend needs this absolute URL for authenticated WebSocket notifications.

Before deploying:

- Configure all backend secrets and database settings in the backend host.
- Set `VITE_BASE_URL`, `VITE_CLOUDINARY_CLOUD_NAME`, and `VITE_CLOUDINARY_UPLOAD_PRESET` in Vercel. Do not copy local `.env` values such as `http://localhost:4000` to production.
- Import `db/fresh-start.sql` into the deployment database only when initializing a new environment.
- Add the exact production frontend origin to the CORS allowlist in `backend/app.js`. A new Vercel preview URL is a different origin and will be rejected until it is added.
- Confirm the backend host can reach MySQL/MariaDB and Cloudinary.
- Configure Gemini or Groq only if recommendations, embedding maintenance, or AI reports are enabled.

## Security and operational notes

- Never commit `backend/.env` or `frontend/.env`.
- Use separate high-entropy values for `JWT_SECRET` and `JWT_REFRESH_SECRET` in every environment.
- Keep Cloudinary upload presets narrowly scoped; browser uploads use the unsigned preset configured in the frontend.
- Snapshot restore replaces application data. Restrict it to trusted `super_admin` users and verify the automatically created recovery snapshot before continuing. Snapshot format version 15 includes the delivery outbox, permanent accession claims, and accession void events, upgrades older loans to the honest `Unknown historical policy` label, and retains later claims and void events when restoring an older snapshot.
- AI analytics reports send aggregate evidence only. The backend rejects questions that request individual visitor or patron identities.
- Apply existing-database migrations only after verifying a full backup, then deploy backend code and frontend code in that order. The single migration sequence and fresh-start rule are in “Create or migrate the database” above.
- Holiday records are kept restorable when removed. Saved due dates do not identify which holiday extended them, so the system cannot prove that a holiday was unused and does not hard-delete it.

## Project notes

The root `package-lock.json` is only a placeholder. The authoritative dependency manifests and lockfiles are `backend/package.json` / `backend/package-lock.json` and `frontend/package.json` / `frontend/package-lock.json`.

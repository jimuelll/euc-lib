# EUC Library

A web-based library management system for Manuel S. Enverga University Foundation — Candelaria Inc. It combines a public library website and catalogue, patron self-service, and a role-based workspace for library operations.

## Features

Features span public discovery, patron services, daily desk work, and library administration. Available actions depend on the account's role; email, cloud storage, and AI capabilities also require the integrations described below.

### Public website and catalogue discovery

- Browse library information, services, opening hours, contact details, policies, facilities, staff, and library spaces without an account.
- Search books and theses by title, author, or ISBN, with advanced search fields for specific titles, authors, ISBNs, and publication year.
- Narrow results by material format, category, and availability; switch between list and grid views and browse paginated results.
- Open catalogue details with cover images, publicly visible metadata, copy availability, and related titles. Thesis records include research-specific fields such as programme, adviser, academic year, and keywords.
- Read bulletin posts and upcoming library events. Signed-in users can like posts and add comments.

### My Library and patron self-service

- View a personal dashboard showing active loans, overdue and due-soon items, outstanding fines, and pending or ready reservations.
- Check loan due dates, copy barcodes, shelf locations, and current fine amounts; review completed borrowing and reservation history.
- Place and cancel eligible book reservations, track their status and expiry, and receive notices when materials are ready for collection.
- View attendance sessions, display a personal library barcode, access academic subscription links, and read account notifications.
- Manage email verification, email changes, and passwords from the account page. Other patron identity changes are handled by authorized library staff.

### Book and thesis cataloguing

- Create, edit, archive, and restore catalogue records, with separate metadata fields for books and theses.
- Record book details such as ISBN, publisher, edition, physical description, category, call number, subjects, and additional contributors. Thesis fields cover programme, adviser, academic year, accession number, keywords, and abstract.
- Look up ISBN metadata to assist data entry, enter missing details manually, and upload or remove catalogue cover images.
- Import catalogue records from CSV with a validation preview, and export records or holdings to CSV.
- Super administrators can configure field types, required fields, display order, public visibility, material-specific scopes, and selectable options, including archiving fields and options that should no longer be offered.

### Physical copies, holdings, and accessions

- Manage individual physical copies separately from title records, with unique copy barcodes and printable labels.
- Maintain copy-level holdings such as accession number, programme, location, price, acquisition date, distributor, and invoice reference; print individual holdings records.
- Track good, damaged, lost, weeded, and discarded conditions, and retire or restore physical copies while retaining their history.
- Distinguish copies that are available, on loan, reserved, inactive, or awaiting accession. Lending eligibility considers accession status, condition, loan policy, and existing commitments.
- Preserve permanent accession claims and prevent their reuse. Super administrators can void an accession with a recorded reason; copy retirement and catalogue changes are checked against active loans and reservations.

### Circulation and lending policies

- Find patrons and physical copies by identifier or barcode, preview account eligibility and item status, and process checkout, return, and renewal transactions at the desk.
- Review circulation activity and active, overdue, and returned loans, with the exact copy associated with each transaction.
- Configure loan durations, fine rates, charging intervals, and initial charges through super administrator loan policies. Loans retain their saved policy terms when settings change later.
- Calculate due dates with library holiday handling, synchronize overdue loans in the background, and offer a guarded undo workflow for eligible desk transactions.

### Reservation processing

- Let eligible patrons reserve books against available accessioned, lendable capacity, with checks against duplicate active reservations and overcommitting copies.
- Give desk staff a reservation workspace for reviewing pending requests, preparing a specific copy, marking it ready, and fulfilling collection as a loan.
- Support patron and staff cancellation, reservation history, and archiving or restoring records where allowed.
- Automatically expire elapsed reservations and release their commitments; notify patrons about reservation creation, readiness, and cancellation.

### Fines, payments, and clearance

- Review a patron's overdue items, assessed charges, payments, adjustments, and outstanding balance together in a clearance profile.
- Use a clearance queue to find patrons with overdue returns, unpaid fines, or both, and distinguish return-related blocks from payment-only cases.
- Record full fine payments at the desk. Administrators can also record partial payments, adjust fines, and reverse payment transactions with a recorded reason.
- Generate numbered receipts with itemized payment allocations and printable receipt views. A fine ledger preserves the relationship between charges, payments, adjustments, and reversals.

### Attendance and scanning

- Scan patron identifiers for library check-in and check-out, with dedicated scanner accounts and validation against duplicate consecutive scans.
- Review open visits, patrons currently inside, and completed attendance sessions; administrators can close individual visits or time out all open visits.
- Search attendance history by date, patron, scan type, and purpose, distinguishing physical entry and exit from borrowing activity.
- Show patrons their own attendance history and summarize physical visits separately from website traffic in analytics.

### Accounts and academic configuration

- Create and maintain student, employee, alumni, scanner, staff, and administrator accounts within the acting user's role permissions; archive and restore accounts while preserving historical records.
- Use role-specific identities and information, including library card numbers, student or employee numbers, staff usernames, programmes, departments, and year levels.
- Manage academic programmes, departments, and academic terms; choose the current term and identify student accounts requiring term revalidation.
- Maintain library holidays, including imports and restoration of archived dates, alongside circulation settings and loan policies.
- Issue account setup invitations rather than assigning patron passwords. Super administrators can also edit their own account identity through the profile editor.

### Website publishing, community content, and staff guides

- Edit homepage content, library information, hours, contact details, images, and About sections through a website content workspace.
- Save private drafts, preview changes, publish individual content or whole sections, publish multiple sections together, and discard unpublished changes.
- Manage bulletin announcements, images and galleries, pinned posts, archived posts, and comment moderation; maintain library events.
- Organize academic subscription resources by category, description, image, active status, and display order for signed-in patrons.
- Provide role-targeted staff guides with steps, prerequisites, warnings, and troubleshooting. Administrators can draft, reorder, publish, unpublish, and archive guide modules.

### Notifications and email access

- Deliver in-app notifications over WebSockets, maintain unread counts, and let users mark individual messages or all messages as read.
- Send administrative notices to all users, a selected role, or an individual recipient, with audience counts, expiry, and notification management controls.
- Support invitation-based password setup, email ownership verification, verified email changes, and password recovery using expiring links or codes.
- Process email through a persistent delivery queue with retry handling and quota controls. Super administrators can inspect delivery outcomes and retry eligible failed deliveries.
- Optionally send routine library emails alongside account security messages. Refresh sessions, forced password changes, and session invalidation enforce changes to account access.

### Recommendations and metadata enrichment

- Suggest related catalogue titles using category, author, and title relationships; thesis suggestions also use programme, adviser, academic year, and keyword relationships.
- Personalize suggestions using recent library activity and let patrons dismiss unwanted recommendations.
- Add semantic recommendations for books using configured Gemini embeddings while retaining rule-based suggestions.
- Give super administrators tools to review missing synopsis or enrichment data, enter summaries and subjects manually, preview recommendations, and run, monitor, or cancel embedding backfills.

### Dashboards, analytics, and reports

- Summarize collection size, accession readiness, available copies, active patrons, circulation, reservations, overdue items, fines, and activity needing attention.
- Explore trends for checkouts and returns, reservation outcomes, physical library visits, website activity, and fine collections, with reporting periods and comparisons where prior data is available.
- Review popular titles, borrowing by patron role, collection categories, copy conditions, and the distinction between current collection snapshots and activity during a selected period.
- Generate AI-assisted performance briefs or ask questions about aggregate library analytics using Gemini or Groq; reports show supporting figures and links back to relevant records.
- Query catalogue, user, borrowing, reservation, attendance, notification, subscription, and clearance datasets with filters, sorting, pagination, and selectable columns.
- Produce due-date, fine, daily attendance, holdings inventory, resource usage, and top-user reports. Export matching records to CSV or Excel-compatible files, or use print/PDF views identifying the library, reporting period, applied filters, and generating staff member.

### Audit history, backups, and recovery

- Let super administrators search, filter, inspect, and export audit events for account activity, library operations, administrative changes, and report exports.
- Export application backups, save manual snapshots to authenticated Cloudinary storage, or schedule daily and weekly snapshots.
- Label, annotate, pin, verify, download, and manage saved snapshots; check compatibility and preview record changes before restoring a saved snapshot or uploaded backup.
- Require administrator password confirmation and an explicit acknowledgement before restore, and create a safety snapshot before replacing live data.
- Place the application in maintenance mode during restore, invalidate affected sessions, and recover interrupted restore maintenance on startup.

### Access roles

| Role | Purpose |
| --- | --- |
| Visitor | Browse the public website and catalogue without signing in. |
| `student`, `employee`, `alumni` | Access patron self-service and personal library records. |
| `scanner` | Operate the attendance scanner. |
| `staff` | Perform library desk operations with scoped permissions. |
| `admin` | Manage library operations, website content, analytics, and reports. |
| `super_admin` | Access additional controls for catalogue configuration, loan policies, recommendation maintenance, backups and restore, audit logs, and email deliveries. |

## Technology

| Layer | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 5, React Router, TanStack Query, Tailwind CSS, Radix UI |
| Backend | Node.js, TypeScript, Express 5, `mysql2`, JWT authentication, WebSockets |
| Database | MariaDB; schema, seed data, and incremental SQL migrations are in `db/` |
| Tests | Node.js test runner for the backend; Vitest and React Testing Library for the frontend |

## Local development

### Requirements

- Node.js 24 and npm.
- MariaDB and a SQL client such as the MariaDB CLI or phpMyAdmin.

The supplied SQL baseline uses MariaDB-specific syntax, including `ADD COLUMN IF NOT EXISTS`. A MySQL installation may require changes to the SQL before importing.

Run the following commands from the repository root unless a different directory is specified.

### 1. Install dependencies

The frontend and backend have separate packages and lockfiles.

```sh
npm --prefix backend ci
npm --prefix frontend ci
```

### 2. Initialize the database

Open a MariaDB client from the repository root:

```sh
mariadb -u root -p
```

Some installations name the client `mysql`. In that client, run:

```sql
CREATE DATABASE library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE library;
SOURCE db/fresh-start.sql;
```

**Use `fresh-start.sql` only for a new or disposable database. It drops and recreates application tables in the selected database.** The backend does not create the schema automatically.

The baseline includes current schema changes and initial library settings, a general collection loan policy, and a development super administrator (`SA0001`). Do not replay every migration after importing it. For an existing installation, review and apply only the missing files in [db/migrations](db/migrations) in chronological order.

Optionally import [db/realistic-demo-data.sql](db/realistic-demo-data.sql) into a fresh development database for sample patrons, catalogue records, and circulation activity:

```sql
SOURCE db/realistic-demo-data.sql;
```

### 3. Configure the environment

Create `backend/.env`:

```dotenv
NODE_ENV=development
PORT=4000

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_database_user
DB_PASS=your_database_password
DB_NAME=library

JWT_SECRET=replace_with_a_random_secret
JWT_REFRESH_SECRET=replace_with_a_different_random_secret

EMAIL_ENABLED=false
EMAIL_ROUTINE_ENABLED=false
PUBLIC_APP_URL=http://localhost:8080
```

Generate each JWT secret separately:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The database user must have access to the database created above. For a remote database requiring TLS, the backend also accepts `DB_SSL`, `DB_SSL_CA`, and `DB_SSL_REJECT_UNAUTHORIZED`; certificate verification defaults to enabled.

Create or update `frontend/.env`:

```dotenv
VITE_BASE_URL=http://localhost:4000/api
```

Use this absolute API URL for local development. The current Vite `/api` proxy points to port 8080, which is also the frontend port. The notifications client also derives its WebSocket connection from `VITE_BASE_URL`.

### 4. Set a local administrator password

The baseline stores a bcrypt hash for `SA0001`. To use your own password for this development account, generate a replacement hash from `backend/`:

```sh
cd backend
node -e "require('bcryptjs').hash(process.argv[1], 12).then(console.log)" "replace-with-your-local-password"
```

In your SQL client, select the development database and paste the generated hash:

```sql
USE library;
UPDATE users
SET password_hash = 'PASTE_GENERATED_BCRYPT_HASH_HERE'
WHERE student_employee_id = 'SA0001' AND role = 'super_admin';
```

Sign in with `SA0001` and the password you chose. This step is for the freshly seeded local account; deployed accounts use the invitation and recovery workflows described below.

### 5. Start both applications

Run each command in a separate terminal, from the repository root:

```sh
npm --prefix backend run dev
```

```sh
npm --prefix frontend run dev
```

Open [http://localhost:8080](http://localhost:8080). The backend listens on port 4000 by default, serves HTTP endpoints under `/api`, and accepts WebSocket connections at `/ws`.

The backend checks database restore state before accepting requests. A database connection or schema failure can therefore prevent it from starting.

## Integration configuration

The basic setup above supports browsing and the seeded administrator account. Additional workflows require the following settings.

| Capability | Configuration |
| --- | --- |
| Catalogue cover uploads and backup storage | Backend: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Backups use authenticated Cloudinary storage. |
| Website content image uploads | Frontend: `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` for an unsigned upload preset. |
| Gemini recommendation embeddings | Backend: `AI_EMBEDDING_PROVIDER=gemini` and `GEMINI_API_KEY`; optionally `GEMINI_EMBEDDING_MODEL`. |
| AI analytics reports | Backend: `AI_REPORT_PROVIDER=gemini` with `GEMINI_API_KEY`, or `AI_REPORT_PROVIDER=groq` with `GROQ_API_KEY`. Optional model overrides: `GEMINI_REPORT_MODEL` and `GROQ_REPORT_MODEL`. |
| ISBN metadata enrichment | Open Library and Google Books are queried by the backend. Optional settings: `OPEN_LIBRARY_CONTACT_EMAIL`, `GOOGLE_BOOKS_API_KEY`, and `HARDCOVER_API_TOKEN`. |

Keep private keys and credentials in `backend/.env`. Values prefixed with `VITE_` are included in the browser build. Restart the development server after changing environment files.

### Account invitations and email recovery

New account creation, password setup, email verification, and password recovery depend on the email service. There is no public self-registration flow.

Use the field names in [backend/email.env.example](backend/email.env.example) with your own values. To deliver email, configure:

- `EMAIL_ENABLED=true` and `EMAIL_MODE=emailjs`.
- `PUBLIC_APP_URL` as the frontend's absolute URL.
- `EMAIL_ENCRYPTION_KEY` as 32 random bytes encoded as 64 hexadecimal characters; the secret-generation command above produces this format.
- `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`, `EMAILJS_ACCOUNT_TEMPLATE_ID`, and `EMAILJS_LIBRARY_TEMPLATE_ID`.
- `EMAIL_QUOTA_PERIOD_START` and `EMAIL_QUOTA_PERIOD_END` as the actual quota period dates in `YYYY-MM-DD` format; the end date is exclusive.

Account templates receive `to_email`, `to_name`, `subject`, `message`, `action_url`, `action_label`, `code`, and `login_identifier`. Library templates can also receive `loans` and `as_of`. Set up the templates to display the fields needed by each workflow.

`EMAIL_ROUTINE_ENABLED=true` enables routine library emails. Non-production `EMAIL_MODE=capture` stores outgoing messages in process memory for development and tests; it does not deliver them to an inbox or expose them through a public route.

With email configured, invite an existing active super administrator from the repository root:

```sh
npm --prefix backend run invite-super-admin -- SA0001 admin@example.com
```

This queues a password-setup invitation and invalidates the account's previous password and sessions. The backend must be running to process queued mail; the command does not create a super administrator.

## Development commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm --prefix backend run dev` | Run the API with automatic restarts. |
| `npm --prefix backend run build` | Compile backend TypeScript into `backend/dist/`. |
| `npm --prefix backend start` | Run the compiled backend. |
| `npm --prefix backend test` | Run backend regression and architecture checks. |
| `npm --prefix frontend run dev` | Run the Vite development server. |
| `npm --prefix frontend run build` | Build the frontend into `frontend/dist/`. |
| `npm --prefix frontend run preview` | Preview the built frontend locally. |
| `npm --prefix frontend run lint` | Run ESLint. |
| `npm --prefix frontend test` | Run frontend architecture checks and unit tests. |

Database integration tests are skipped by default. To enable them, initialize a separate disposable database from the baseline, point the backend's database settings at it, and set `RUN_DB_INTEGRATION=1`. Its name must end in `_test`. These tests write fixtures, including permanent accession records.

## Project structure

```text
backend/
  app.ts              Express middleware and API routes
  server.ts           HTTP/WebSocket server and background workers
  db.ts               Database connection pool
  modules/            Domain routes, controllers, services, and repositories
  jobs/               Scheduled circulation and session maintenance
  realtime/           WebSocket notifications
  scripts/            Administrative command-line tools
  test/               Backend tests
frontend/
  src/app/            Routes, providers, and query configuration
  src/features/       Feature pages, components, hooks, and API clients
  src/components/     Shared UI and layout
  src/context/        Authentication and notifications
  public/             Static assets
db/
  fresh-start.sql     Destructive development baseline
  migrations/         Incremental schema updates
  realistic-demo-data.sql
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for dependency boundaries and contribution rules.

## Deployment

Build each application separately. Serve `frontend/dist/` with a fallback to `index.html` for client-side routes, and run `npm start` from `backend/` after building it. The API needs a persistent Node.js process for WebSockets, queued deliveries, and scheduled jobs.

Set `VITE_BASE_URL` to the backend's absolute HTTPS API URL before building the frontend. The notification client connects to `/ws` on that host, so the backend host or reverse proxy must support secure WebSocket upgrades.

Update the origin allowlist in [backend/app.ts](backend/app.ts) for your frontend domain. [frontend/vercel.json](frontend/vercel.json) includes an API rewrite to the project's Render hostname; update it for your own backend when using Vercel.

Use `NODE_ENV=production`, private database and JWT credentials, and HTTPS. Production email additionally requires `EMAIL_MODE=emailjs` and an HTTPS `PUBLIC_APP_URL`. Replace the seeded development account's credentials before making an installation accessible.

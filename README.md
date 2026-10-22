# EUC Library

A web-based library management system for Manuel S. Enverga University Foundation — Candelaria Inc. It combines a public library website and catalogue, patron self-service, and a role-based workspace for library operations.

## Features

- **Public website:** searchable book and thesis catalogue, library information, opening hours, bulletin posts, events, and academic subscriptions.
- **Patron accounts:** borrowing and reservation records, attendance history, fines, notifications, and profile management through My Library.
- **Circulation:** barcode-based checkout and returns, reservation queues, overdue tracking, fine payments, clearance, and receipts.
- **Catalogue management:** configurable metadata fields, loan policies, physical copies, holdings, permanent accession records, cover images, and ISBN metadata lookup.
- **Administration:** role-based account management, academic programmes and terms, departments, holidays, and library settings.
- **Content and reporting:** draft-and-publish website editing, user guides, analytics, record queries, exports, and audit logs.
- **Integrations:** real-time notifications, email invitations and recovery, AI-assisted recommendations and analytics reports, and manual or scheduled backup snapshots.

### Access roles

| Role | Purpose |
| --- | --- |
| Visitor | Browse the public website and catalogue without signing in. |
| `student`, `employee`, `alumni` | Access patron self-service and personal library records. |
| `scanner` | Operate the attendance scanner. |
| `staff` | Perform library desk operations with scoped permissions. |
| `admin` | Manage library operations, website content, analytics, and reports. |
| `super_admin` | Access additional controls for loan policies, backups and restore, audit logs, and email deliveries. |

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

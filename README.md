# Enverga-Candelaria Library Management System

A full-stack library services platform built for Manuel S. Enverga University Foundation – Candelaria. The system combines a public catalogue and library website with authenticated patron services, circulation workflows, content management, reporting, and administrative controls.

## What the system covers

### Public and patron services

- Public catalogue search, availability, categories, book covers, and recommendations
- Library announcements, events, information, hours, and academic-resource links
- Student and patron sign-in with refresh-session support
- Personal library view for current loans, history, reservations, notifications, and barcode access
- Book reservations and reservation-queue tracking
- QR/barcode-based attendance scanning

### Staff and administration

- Catalogue records, configurable metadata, book types, physical copies, holdings, accession numbers, and cover images
- Barcode-assisted checkout, return, renewal, and circulation history
- Patron accounts for students, employees, alumni, scanners, staff, administrators, and super administrators
- Reservation preparation, fulfilment, expiry, and notifications
- Fine ledgers, clearance payments, and printable receipts
- Departments, academic programs, terms, holidays, and circulation settings
- Bulletin, subscription, About page, homepage, and role-aware user-guide management
- Analytics dashboards, audit logs, reports, and an administrative query workspace
- Cloud-backed application snapshots with restore maintenance mode
- Real-time notifications over WebSockets

## Technology

| Layer | Main technologies |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query, React Router, Axios, Recharts |
| Backend | Node.js, Express 5, TypeScript, MySQL2, WebSocket, JWT, bcrypt, Helmet |
| Database | MySQL or MariaDB |
| Media and backups | Cloudinary (optional for basic local use) |
| Optional AI features | Gemini embeddings and Gemini or Groq analytics reports |
| Testing | Node test runner, Vitest, Testing Library, architecture checks |

## Architecture

The repository contains two independently managed Node.js applications:

```text
Browser
  -> React/Vite frontend (port 8080)
      -> REST API and WebSocket connection
          -> Express API (port 4000)
              -> services and repositories
                  -> MySQL/MariaDB
```

The intended dependency flow is:

```text
Backend:  routes -> controllers -> services -> repositories -> database
Frontend: route/page -> components -> hooks -> feature API -> backend API
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the enforced module-boundary rules.

## Prerequisites

- A current Node.js LTS release and npm
- MySQL 8+ or a compatible MariaDB installation
- A MySQL client, phpMyAdmin, or another tool capable of importing SQL files
- Optional: a Cloudinary account for image uploads and snapshot backup/restore
- Optional: Gemini and/or Groq credentials for AI-assisted features

## Local setup

### 1. Install dependencies

The frontend and backend have separate lockfiles and must be installed separately.

```bash
cd backend
npm ci

cd ../frontend
npm ci
```

### 2. Create the database

Create an empty UTF-8 database, then import the current baseline:

```sql
CREATE DATABASE library
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

From the repository root, the MySQL CLI can import it with:

```bash
mysql -u root -p library -e "source db/fresh-start.sql"
```

`db/fresh-start.sql` is destructive when run against an existing database: it drops and recreates the application's tables. Use it only for a new installation or a database whose data can be discarded.

The baseline already incorporates the schema represented by the dated files in `db/migrations/`. Those migrations are for upgrading older installations; do not replay them after importing `fresh-start.sql`.

To add the optional realistic development dataset after the baseline import:

```bash
mysql -u root -p library -e "source db/realistic-demo-data.sql"
```

The demo seed adds five student accounts with IDs `DEMO-REAL-001` through `DEMO-REAL-005`. Their shared development-only password is `Test1234!`.

### 3. Configure the backend

Create `backend/.env`:

```dotenv
NODE_ENV=development
PORT=4000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=your_database_password
DB_NAME=library

JWT_SECRET=replace_with_a_long_random_secret
JWT_REFRESH_SECRET=replace_with_a_different_long_random_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

`JWT_SECRET` and `JWT_REFRESH_SECRET` are required for authentication. Use independent, high-entropy values and never commit the `.env` file.

### 4. Configure the frontend

No frontend environment file is required for ordinary local development. Vite proxies `/api` requests to `http://localhost:4000`.

If the API is hosted separately, create `frontend/.env`:

```dotenv
VITE_BASE_URL=https://your-api.example.com
```

### 5. Start both applications

In one terminal:

```bash
cd backend
npm run dev
```

In another terminal:

```bash
cd frontend
npm run dev
```

Open <http://localhost:8080>. The API listens on <http://localhost:4000>.

## Environment variables

### Backend

| Variable | Required | Purpose / default |
| --- | --- | --- |
| `DB_HOST` | Yes | Database host |
| `DB_PORT` | No | Database port; defaults to `3306` |
| `DB_USER` | Yes | Database user |
| `DB_PASS` | Depends | Database password |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Access-token signing secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh-token signing secret |
| `JWT_EXPIRES_IN` | No | Access-token lifetime; defaults to `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh-token lifetime; defaults to `7d` |
| `PORT` | No | HTTP/WebSocket port; defaults to `4000` |
| `NODE_ENV` | No | Enables production logging and secure cross-site cookies when set to `production` |
| `DB_SSL` | No | Enables database TLS |
| `DB_SSL_CA` | No | Database CA certificate; escaped `\\n` sequences are supported |
| `DB_SSL_REJECT_UNAUTHORIZED` | No | TLS certificate verification; defaults to `true` |
| `DB_CONNECT_TIMEOUT_MS` | No | Connection timeout; defaults to `30000` |
| `DB_CONNECTION_LIMIT` | No | Pool size; defaults to `10` |
| `CLOUDINARY_CLOUD_NAME` | Feature-specific | Server-side catalogue images and snapshot storage |
| `CLOUDINARY_API_KEY` | Feature-specific | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Feature-specific | Cloudinary API secret |
| `BACKUP_MAX_BYTES` | No | Maximum restore request body; defaults to 50 MiB |
| `SNAPSHOT_MAX_BYTES` | No | Maximum uncompressed snapshot size; defaults to 50 MiB |
| `SNAPSHOT_UPLOAD_TIMEOUT_MS` | No | Snapshot upload timeout; defaults to 120000 ms |
| `OPEN_LIBRARY_CONTACT_EMAIL` | No | Contact identity used for Open Library ISBN lookups |
| `GOOGLE_BOOKS_API_KEY` | No | Enables authenticated Google Books metadata lookups |
| `HARDCOVER_API_TOKEN` | No | Enables Hardcover synopsis fallback lookups |
| `AI_EMBEDDING_PROVIDER` | No | Set to `gemini` to enable semantic recommendation embeddings |
| `GEMINI_API_KEY` | Feature-specific | Gemini embeddings and/or report generation |
| `GEMINI_EMBEDDING_MODEL` | No | Defaults to `gemini-embedding-001` |
| `AI_REPORT_PROVIDER` | No | `gemini` (default) or `groq` |
| `GEMINI_REPORT_MODEL` | No | Defaults to `gemini-2.5-flash` |
| `GROQ_API_KEY` | Feature-specific | Required when the report provider is `groq` |
| `GROQ_REPORT_MODEL` | No | Defaults to `openai/gpt-oss-20b` |
| `REFRESH_SESSION_PURGE_INTERVAL_MS` | No | Refresh-session cleanup interval |

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_BASE_URL` | No locally | Absolute API origin for a separately hosted backend |
| `VITE_CLOUDINARY_CLOUD_NAME` | Feature-specific | Browser-side image upload cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Feature-specific | Unsigned Cloudinary upload preset |

Keep Cloudinary's API secret on the backend only. Every variable prefixed with `VITE_` is exposed to the browser bundle.

## Available commands

Run commands from the application directory shown.

### Backend (`backend/`)

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API with nodemon and ts-node |
| `npm run build` | Compile TypeScript into `backend/dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Run the backend test suite |
| `npm run architecture:test` | Run backend regression and architecture checks |

### Frontend (`frontend/`)

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 8080 |
| `npm run build` | Create a production bundle |
| `npm run preview` | Preview the production bundle locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run architecture checks and unit tests |
| `npm run test:architecture` | Validate frontend feature boundaries and route coverage |
| `npm run test:unit` | Run Vitest tests |

Database integration tests are guarded to prevent accidental use against a normal database. To enable them, set `RUN_DB_INTEGRATION=1` and use a database name ending in `_test`.

## Repository layout

```text
.
├── backend/
│   ├── jobs/             # Scheduled cleanup and synchronization work
│   ├── middlewares/      # Authentication, audit, maintenance, validation
│   ├── modules/          # Feature routes, controllers, services, repositories
│   ├── realtime/         # WebSocket notification transport
│   ├── test/             # Backend regression and integration tests
│   ├── app.ts            # Express composition and route mounting
│   ├── db.ts             # MySQL connection pool
│   └── server.ts         # HTTP/WebSocket startup and background jobs
├── db/
│   ├── migrations/       # Incremental upgrades for older databases
│   ├── fresh-start.sql   # Destructive, current database baseline
│   └── realistic-demo-data.sql
├── docs/                 # Audit notes and generated UML documentation
├── frontend/
│   ├── scripts/          # Architecture tooling
│   └── src/
│       ├── app/          # Providers, routing, and shared server-state setup
│       ├── components/   # Shared UI and layout primitives
│       ├── context/      # Application-wide contexts
│       ├── features/     # Domain-oriented frontend modules
│       ├── hooks/        # Cross-feature hooks
│       └── utils/        # HTTP and utility helpers
├── ARCHITECTURE.md
└── README.md
```

## Production notes

- Build the backend with `npm run build`, then run it with `npm start`.
- Build the frontend with `npm run build`; the static output is written to `frontend/dist/`.
- The checked-in `frontend/vercel.json` rewrites `/api/*` to the deployed API and sends other routes to the single-page application entry point.
- The API's allowed browser origins are currently declared in `backend/app.ts`. Add the production frontend origin there before deploying to a different domain.
- Production authentication uses `Secure`, `SameSite=None` refresh cookies. Serve the frontend and API over HTTPS and keep credentialed CORS correctly configured.
- WebSockets share the backend HTTP server and therefore use the same deployed origin and port.
- Snapshot backup/restore and server-managed catalogue images require all three server-side Cloudinary variables.
- Run both backend and frontend test suites before deployment.

## Security notes

- Do not commit `.env` files, database dumps containing private data, JWT secrets, or Cloudinary/API credentials.
- Replace all development credentials before using the system with real users.
- Treat `db/fresh-start.sql` as a destructive reset operation.
- Use a dedicated `_test` database for integration tests.
- Review role permissions, CORS origins, cookie behavior, database TLS, backup access, and external upload presets before production use.

## License

No license file is currently included in this repository. Unless the project owners state otherwise, the source should be treated as proprietary.

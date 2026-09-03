# Enverga-Candelaria Library Management System

A full-stack web system for Manuel S. Enverga University Foundation – Candelaria Inc. It brings the library's public services, student self-service, circulation-desk work, and administration into one role-aware platform.

The application lets patrons discover resources, manage borrows and reservations, view library activity, and receive notifications. Library personnel use the same system to maintain the catalogue, process barcode-supported circulation and attendance, manage clearances, and monitor library operations.

## System at a glance

```text
React + Vite client
  │  HTTP /api and authenticated WebSocket /ws
  ▼
Express API
  ├── Authentication, role checks, validation, rate limiting, audit-aware operations
  ├── Library modules: catalogue, circulation, reservations, attendance, payments, clearance
  ├── Content modules: bulletin, About page, academic subscriptions, notifications
  └── Analytics, settings, backups, and reporting
  │
  ├── MySQL — operational data, accounts, activity, settings, and snapshot metadata
  └── Cloudinary — bulletin/media assets and authenticated saved database snapshots
```

## User roles

| Role | Main access |
| --- | --- |
| Patron (student/employee) | Catalogue, account, My Library, borrowing/reservations, attendance history, subscriptions, and notifications |
| `scanner` | QR/barcode attendance scanning and circulation scanning |
| `staff` | Circulation desk, catalogue work, user lookup/creation, reservations, and clearance processing |
| `admin` | Staff capabilities plus user administration, settings, reporting, analytics, content administration, payments, and attendance logs |
| `super_admin` | Full administrative access, including audit logs, saved snapshots/restores, book-type policies, and catalogue schema changes |

All protected API routes use JWT authentication. Access tokens are short-lived; refresh sessions are stored in HTTP-only cookies and rotated on refresh. New or reset accounts are gated through a required password change.

## Capabilities

### Public and patron experience

- Home, About, Services, public catalogue, and bulletin-board pages
- Searchable catalogue with available-copy visibility
- Sign-in, refresh-session sign-out, password change, and profile editing
- **My Library** dashboard for current borrows, borrow history, fines, reservations, attendance history, subscriptions, and notifications
- Borrowing and reservation workflows, including active/history views and ready-for-pickup status
- QR/barcode attendance check-in and check-out
- Academic-subscription directory
- Bulletin posts with authenticated likes and comments; staff and administrators can publish posts
- Real-time unread notification count and notification read controls

### Library desk and staff operations

- User lookup and account creation; staff/admin barcode image retrieval
- Catalogue maintenance for books and individual copies, including copy barcodes and copy-condition updates
- ISBN lookup while adding catalogue records
- Barcode-based circulation: look up a patron/copy, borrow, return, renew, and review the circulation log
- Reservation queue handling: mark ready, fulfil, cancel, restore, and manage records
- Attendance scanner and administrative attendance logs
- Fine and payment overview plus settlement support
- Clearance queue, cash-payment recording, receipt retrieval, fine adjustments, and transaction reversal controls

### Administration and governance

- User search, update, archive/restore, and bulk student-like-account deactivation
- Configurable catalogue schema, book/material types, lending duration, fine interval, fine rate, and initial fine policies
- Library settings and holiday calendar; due-date and overdue processing use these rules
- Admin dashboard, analytics, visit tracking, reports, attendance data, and super-admin audit logs
- Administration of the About page, bulletin posts, academic subscriptions, and targeted notifications
- Exportable database backups and Cloudinary-hosted saved snapshots. Restoring a saved snapshot creates a pre-restore recovery snapshot; the newest 30 snapshots are retained.

## Architecture and code layout

| Path | Responsibility |
| --- | --- |
| `frontend/` | React 18 + TypeScript single-page application |
| `frontend/src/pages/` | Public, patron, scanner, and administrative routes/screens |
| `frontend/src/context/` | Authentication and real-time notification state |
| `backend/` | Express server, middleware, MySQL pool, WebSocket server, and feature modules |
| `backend/modules/` | API modules for auth, users, catalogue, borrowing, circulation, reservations, attendance, content, analytics, notifications, settings, backup, and clearance |
| `backend/realtime/` | Authenticated WebSocket notification hub at `/ws` |
| `db/` | Full database dumps and current incremental migrations |
| `backend/sql/` | Earlier incremental migrations for analytics, notifications, roles, and catalogue alignment |

The backend exposes REST endpoints below `/api`. Public routes are limited to authentication, public content, and anonymous visit tracking; the remaining application routes are protected after the global authentication middleware. The server also recalculates overdue borrowings at startup and every five minutes.

## Technology

**Frontend:** React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, shadcn/ui, Recharts, Axios, Framer Motion, and ZXing barcode/QR scanning.

**Backend:** Node.js, Express 5, MySQL (`mysql2`), JWT, cookie-based refresh sessions, WebSockets (`ws`), Helmet, CORS, rate limiting, Cloudinary, QR Code, and JsBarcode.

## Run locally

### Prerequisites

- Node.js 20 or later
- MySQL 8 or a compatible MySQL service
- A Cloudinary account for media uploads and saved cloud snapshots

There is no root workspace runner. Run the API and client in separate terminals.

### 1. Prepare the database

Create a MySQL database, then import one baseline dump from `db/` that matches your deployment target:

- `library-portable.sql` — general local/portable baseline
- `library-aiven.sql` — Aiven-oriented baseline
- `library-clevercloud.sql` — Clever Cloud-oriented baseline

Apply these additive migrations after the baseline as needed, in date order:

```text
backend/sql/2026-03-30-dashboard-analytics.sql
backend/sql/2026-03-30-notifications-websocket.sql
backend/sql/2026-04-01-add-employees-role.sql
backend/sql/2026-04-02-align-catalog-schema.sql
db/2026-08-30-catalog-materials.sql
db/2026-08-30-clearance-workflow.sql
db/2026-08-30-enable-catalog-isbn-metadata-fields.sql
db/2026-08-31-backup-snapshots.sql
db/2026-08-31-book-types-and-copy-conditions.sql
db/2026-08-31-book-type-fine-rules.sql
```

> The last two migrations build on the preceding catalogue changes. Do not reapply migrations already present in the selected baseline.

### 2. Start the backend

```powershell
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=4000
NODE_ENV=development

DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASS=your_mysql_password
DB_NAME=library
DB_CONNECTION_LIMIT=2

JWT_SECRET=replace_with_a_long_random_access_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_with_a_long_random_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Start the API:

```powershell
node server.js
```

For automatic restarts during development:

```powershell
npx nodemon server.js
```

The API listens on `http://localhost:4000`; its authenticated WebSocket endpoint is `ws://localhost:4000/ws?token=<access-token>`.

### 3. Start the frontend

```powershell
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_BASE_URL=http://localhost:4000
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

Run the development server:

```powershell
npm run dev
```

Open `http://localhost:8080`. Vite proxies `/api` requests to the local API.

## Common commands

Run these from `frontend/`:

```powershell
npm run dev       # local development server
npm run build     # production build
npm run lint      # ESLint
npm run test      # Vitest test suite
npm run preview   # preview the production build
```

## Deployment configuration

The frontend includes a Vercel configuration in `frontend/vercel.json` that rewrites `/api/*` to the deployed Render backend and rewrites client routes to `index.html`.

Before deploying, update the backend CORS allowlist in `backend/app.js` for the intended frontend origin, configure all backend environment variables, and apply the database migrations. Cloudinary credentials are required for bulletin/media handling and for saved snapshot operations. Snapshot files are uploaded as authenticated raw Cloudinary assets; metadata remains in MySQL.

## Security and operational notes

- Do not commit either `.env` file or database credentials.
- Use independent, high-entropy values for `JWT_SECRET` and `JWT_REFRESH_SECRET` in each environment.
- Saved snapshot restore replaces data across the available database tables. Restrict this capability to `super_admin` accounts and verify the recovery snapshot before proceeding.
- The frontend's unsigned upload preset should be narrowly scoped in Cloudinary.

## Documentation status

This README reflects the feature modules and routes currently present in the repository. It supersedes the older distinction that labelled Backup and Clearance as UI-only: both now have corresponding protected backend modules. `AdminInternet.tsx` and `AdminEditHomepage.tsx` are present as standalone frontend files but are not registered application routes in `frontend/src/App.tsx`.

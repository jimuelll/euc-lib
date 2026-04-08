# Enverga-Candelaria Library Management System

A full-stack library platform for Manuel S. Enverga University Foundation - Candelaria Inc. The project combines a React/Vite frontend with an Express/MySQL backend for catalogue search, borrowing, reservations, attendance scanning, notifications, analytics, and admin operations.

## Project Structure

- `frontend/` - React 18 + TypeScript + Vite client
- `backend/` - Express API, JWT auth, MySQL access, overdue sync, and WebSocket notifications
- `db/` - full database dump variants
- `backend/sql/` - incremental SQL updates for newer backend features

## Current Features

### Public and student-facing

- Landing page, About page, Services page, bulletin board, and searchable public catalogue
- Login with `student_employee_id` and password using refresh-token cookies
- Forced password-change flow for newly created or reset accounts
- My Library dashboard with active borrows, overdue fines, reservations, attendance history, notifications, and academic subscriptions
- Reservation workflow with active and history views plus ready-for-pickup status
- QR/barcode attendance scanner for check-in and check-out
- Public bulletin browsing plus authenticated likes/comments and staff/admin posting
- Real-time notifications with unread counts over WebSockets

### Staff and admin

- Protected admin/staff flows for `scanner`, `staff`, `admin`, and `super_admin`
- User management with account creation, update, archive, restore, and barcode/QR generation
- Catalog management with a dynamic schema builder and per-copy barcode tracking
- Circulation desk tools for barcode-based borrowing and return processing
- Reservation queue management for staff/admin
- Analytics dashboard, admin overview, attendance logs, audit logs, and filtered reports
- Payment overview, overdue fine configuration, and settlement tools
- Library settings for overdue fines and holiday calendar rules
- Bulletin management, About page management, academic subscription management, and admin notifications

### Present in the UI but not fully backed by server modules

- Backup
- Internet Access
- Clearance

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- TanStack Query
- React Router
- Recharts
- Axios
- ZXing for barcode/QR scanning
- Framer Motion

### Backend

- Node.js
- Express 5
- MySQL via `mysql2`
- JWT access tokens + refresh-token cookies
- WebSockets via `ws`
- Cloudinary for image handling
- QR/barcode generation with `qrcode` and `jsbarcode`

## Local Setup

There is no root workspace runner in this repository, so start the backend and frontend separately.

### 1. Backend

Install dependencies:

```powershell
cd backend
npm install
```

Create `backend/.env` with the variables used by the current codebase:

```env
PORT=4000
NODE_ENV=development

DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASS=your_mysql_password
DB_NAME=library
DB_CONNECTION_LIMIT=2

JWT_SECRET=your_access_token_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_REFRESH_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Start the backend:

```powershell
node server.js
```

Optional during development:

```powershell
npx nodemon server.js
```

Notes:

- Default backend port is `4000`
- The server also attaches a WebSocket endpoint at `/ws`
- Overdue borrowing sync runs automatically on startup and every 5 minutes

### 2. Frontend

Install dependencies:

```powershell
cd frontend
npm install
```

Create `frontend/.env` with:

```env
VITE_BASE_URL=http://localhost:4000
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

Useful scripts:

```powershell
npm run dev
npm run build
npm run lint
```

Notes:

- Default frontend dev port is `8080`
- Vite proxies `/api` requests to `http://localhost:4000`

## Database Notes

The project expects a MySQL database.

Database resources included in this repository:

- `db/library-aiven.sql`
- `db/library-clevercloud.sql`
- `db/library-portable.sql`

Incremental backend SQL updates for newer features:

- `backend/sql/2026-03-30-dashboard-analytics.sql`
- `backend/sql/2026-03-30-notifications-websocket.sql`
- `backend/sql/2026-04-01-add-employees-role.sql`
- `backend/sql/2026-04-02-align-catalog-schema.sql`

If your database predates the latest analytics, notifications, role, or catalog changes, apply the relevant SQL files before running the app.

## Deployment Notes

- `frontend/vercel.json` rewrites `/api/*` requests to `https://euc-lib.onrender.com/api/*`
- The backend currently allows CORS for:
  - `http://localhost:8080`
  - `http://localhost:5173`
  - `https://euc-lib.vercel.app`
  - `https://euc-lib-git-master-jimuellls-projects.vercel.app`

## Repository Status

This README reflects the code currently present in the repository, including:

- analytics dashboard support
- audit log support
- My Library APIs and UI
- payments and reporting flows
- WebSocket notifications
- holiday-aware due date handling
- overdue-fine management
- employee-role and catalog-alignment SQL updates

Some admin pages are still intentionally documented as UI-only because no matching backend module exists for them in this repository yet.

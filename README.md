# Enverga-Candelaria Library Management System

A full-stack library platform for Manuel S. Enverga University Foundation - Candelaria Inc. The project combines a React/Vite frontend with an Express/MySQL backend for catalogue search, borrowing, reservations, attendance scanning, notifications, and admin operations.

## Project Scope

This repository is organized as a split frontend and backend application:

- `frontend/` - React 18 + TypeScript + Vite client
- `backend/` - Express API, JWT auth, MySQL access, and WebSocket notifications
- `sql/` - shared SQL migration for fines and holidays
- `backend/sql/` - backend-specific analytics and notification migrations

## Implemented Features

### Public and student-facing

- Landing page, About page, services page, bulletin board, and searchable public catalogue
- Login using `student_employee_id` and password with refresh-token cookies
- Forced password-change flow for newly created or reset accounts
- My Library dashboard with active borrows, overdue fines, reservations, attendance history, notifications, and academic subscriptions
- Reservation workflow with active and history views plus ready-for-pickup status
- QR/barcode attendance scanner for check-in and check-out
- Real-time notifications and unread counts over WebSockets

### Staff and admin

- Role-based access for `student`, `scanner`, `staff`, `admin`, and `super_admin`
- User management with account creation, update, archive, restore, and barcode/QR generation
- Catalog management with a dynamic schema builder and per-copy barcode tracking
- Circulation desk tools for barcode-based borrowing and return processing
- Reservation queue management for staff/admin
- Analytics dashboard, audit log, circulation report, and admin overview
- Library fine settings and holiday calendar that affect due-date calculations
- Bulletin management, About page management, academic subscription management, and admin notifications

### Present in the UI but not fully wired to backend services yet

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
- ZXing for camera/barcode scanning
- Framer Motion

### Backend

- Node.js
- Express
- MySQL via `mysql2`
- JWT access tokens + refresh-token cookies
- WebSockets via `ws`
- Cloudinary for image lifecycle handling
- QR/barcode generation with `qrcode` and `jsbarcode`

## Local Setup

There is no root workspace script right now, so run the frontend and backend separately.

### 1. Install backend dependencies

```powershell
cd backend
npm install
```

Create `backend/.env` with the variables currently used by the codebase:

```env
PORT=4000
NODE_ENV=development

DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASS=your_mysql_password
DB_NAME=library

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

### 2. Install frontend dependencies

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

Start the frontend:

```powershell
npm run dev
```

Default local ports in the current repo:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:4000`

## Database Notes

The backend expects a MySQL database and includes migrations related to the latest library features:

- `sql/borrowing-fines-holidays-migration.sql`
- `backend/sql/2026-03-30-dashboard-analytics.sql`
- `backend/sql/2026-03-30-notifications-websocket.sql`

If your database was created before the current fine, holiday, analytics, or notification work, apply those SQL files before running the app.

## Deployment Notes

- `frontend/vercel.json` rewrites `/api/*` requests to `https://euc-lib.onrender.com/api/*`
- The backend currently allows CORS for:
  - `http://localhost:8080`
  - `http://localhost:5173`
  - `https://euc-lib.vercel.app`
  - `https://euc-lib-git-master-jimuellls-projects.vercel.app`
- The WebSocket endpoint is served from the backend at `/ws`

## Current Repository Status

This README matches the code that is currently present in the repository as of the latest local changes, including:

- analytics dashboard and audit log support
- notification tables and WebSocket push support
- My Library dashboard APIs
- holiday and overdue-fine management

Some admin screens are intentionally documented as UI-only because no matching backend module exists for them in this repo yet.

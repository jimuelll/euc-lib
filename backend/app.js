const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");
const cookieParser = require("cookie-parser");

const {
  authRoutes, adminRoutes, catalogRoutes, publicCatalogRoutes,
  recommendationPublicRoutes, recommendationRoutes, borrowingRoutes,
  reservationRoutes, adminReservationRoutes, circulationRoutes, bulletinRoutes,
  eventRoutes, aboutRoutes, attendanceRoutes, subscriptionsRoutes,
  analyticsRoutes, analyticsAdminRoutes, myLibraryRoutes, notificationsRoutes,
  librarySettingsRoutes, backupRoutes, clearanceRoutes, siteContentRoutes,
  userGuideRoutes,
} = require("./modules");
const maintenanceMode = require("./middlewares/maintenanceMode");
const auditLogger = require("./middlewares/auditLogger");

const { authMiddleware } = require("./modules/auth/auth.middleware");
const { forcePasswordChange } = require("./modules/auth/forcePasswordChange.middleware");

const app = express();
const backupBodyLimit = Number(process.env.BACKUP_MAX_BYTES || 50 * 1024 * 1024);
app.set("trust proxy", 1);
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      "http://localhost:8080",
      "http://localhost:5173",
      "https://euc-lib.vercel.app",
      "https://euc-lib-git-master-jimuellls-projects.vercel.app"
    ];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
app.use(helmet());
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: `${backupBodyLimit}b` }));
app.use(express.urlencoded({ extended: true }));

// A restore replaces application data atomically.  This must run before every
// route (including public routes) so a public visit, like, or comment cannot
// be written into the state that is being replaced.
app.use(maintenanceMode);
app.use(auditLogger);

// --- Public Routes ---
// --- Public Routes ---
app.use("/api/auth",     authRoutes);
app.use("/api/bulletin", bulletinRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/about",    aboutRoutes);
app.use("/api/site-content", siteContentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api", publicCatalogRoutes);
app.use("/api", recommendationPublicRoutes);
app.use("/api/admin/users", require("./modules/admin/barcode.routes"));

// --- Global Protection ---
app.use(authMiddleware());
app.use(forcePasswordChange);
// --- Protected Routes ---
app.use("/api/admin",        adminRoutes);
app.use("/api/admin",        analyticsAdminRoutes);
app.use("/api/admin",        catalogRoutes);
app.use("/api/admin",        circulationRoutes);
app.use("/api/borrowing",    borrowingRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/admin",        adminReservationRoutes);
app.use("/api/admin/about",  aboutRoutes);
app.use("/api/attendance",   attendanceRoutes);
app.use("/api",              subscriptionsRoutes);
app.use("/api",              myLibraryRoutes);
app.use("/api",              recommendationRoutes);
app.use("/api",              notificationsRoutes);
app.use("/api/admin",        librarySettingsRoutes);
app.use("/api/admin",        backupRoutes);
app.use("/api/admin",        clearanceRoutes);
app.use("/api",              userGuideRoutes);


module.exports = app;

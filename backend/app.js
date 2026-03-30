const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");
const cookieParser = require("cookie-parser");

const authRoutes        = require("./modules/auth/auth.routes");
const adminRoutes       = require("./modules/admin/admin.routes");
const catalogRoutes     = require("./modules/catalog/catalog.routes");
const borrowingRoutes   = require("./modules/borrowing/borrowing.routes");
const reservationRoutes = require("./modules/reservation/reservation.routes");
const adminReservationRoutes = require("./modules/reservation/adminReservation.routes");
const circulationRoutes = require("./modules/circulation/circulation.routes");
const bulletinRoutes    = require("./modules/bulletin/bulletin.routes");
const aboutRoutes       = require("./modules/about/about.routes");
const attendanceRoutes  = require("./modules/attendance/attendance.routes");
const subscriptionsRoutes = require("./modules/subscriptions/subscriptions.routes");

const { authMiddleware }      = require("./modules/auth/auth.middleware");
const { forcePasswordChange } = require("./modules/auth/forcePasswordChange.middleware");

const app = express();
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- Public Routes ---
// --- Public Routes ---
app.use("/api/auth",     authRoutes);
app.use("/api/bulletin", bulletinRoutes);
app.use("/api/about",    aboutRoutes);
app.use("/api/admin/users", require("./modules/admin/barcode.routes"));
app.use("/api", subscriptionsRoutes);

// --- Global Protection ---
app.use(authMiddleware());
app.use(forcePasswordChange);

// --- Protected Routes ---
app.use("/api/admin",        adminRoutes);
app.use("/api/admin",        catalogRoutes);
app.use("/api/admin",        circulationRoutes);
app.use("/api/borrowing",    borrowingRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/admin",        adminReservationRoutes);
app.use("/api/admin/about",  aboutRoutes);
app.use("/api/attendance",   attendanceRoutes);


module.exports = app;

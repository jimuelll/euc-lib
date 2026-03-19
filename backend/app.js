const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");
const cookieParser = require("cookie-parser"); // ✅ add this

const authRoutes    = require("./auth/auth.routes");
const adminRoutes   = require("./admin/admin.routes");
const catalogRoutes = require("./catalog/catalog.routes");

const { authMiddleware }      = require("./auth/auth.middleware");
const { forcePasswordChange } = require("./auth/forcePasswordChange.middleware");

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
app.use("/auth", authRoutes);

// --- Global Protection ---
app.use(authMiddleware());
app.use(forcePasswordChange);

// --- Protected Routes ---
app.use("/admin", adminRoutes);
app.use("/admin", catalogRoutes);

module.exports = app;
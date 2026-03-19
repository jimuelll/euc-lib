const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./auth/auth.routes");
const adminRoutes = require("./admin/admin.routes");

const { authMiddleware } = require("./auth/auth.middleware");
const { forcePasswordChange } = require("./auth/forcePasswordChange.middleware");

const app = express();

// --- Middleware ---
app.use(cors({
  origin: "http://localhost:8080", // your frontend origin
  credentials: true,               // allow cookies
}));
app.use(helmet());
app.use(morgan("dev"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Public Routes (NO AUTH REQUIRED) ---
app.use("/auth", authRoutes);

// --- Global Protection ---
app.use(authMiddleware());        // must be logged in
app.use(forcePasswordChange);     // must have changed password

// --- Protected Routes ---
app.use("/admin", adminRoutes);

module.exports = app;
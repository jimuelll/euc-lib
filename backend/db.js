require("dotenv").config();
const mysql = require("mysql2/promise");
const sslCa = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");
const parseBoolean = (value, fallback) => {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};
const sslEnabled = parseBoolean(process.env.DB_SSL, Boolean(sslCa));
const ssl = sslEnabled
  ? {
      ...(sslCa ? { ca: sslCa } : {}),
      rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
    }
  : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ...(ssl ? { ssl } : {}),
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 30000),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
});

module.exports = pool;

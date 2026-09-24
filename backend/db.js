require("dotenv").config();
const mysql = require("mysql2/promise");
const sslCa = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ...(sslCa ? { ssl: { ca: sslCa } } : {}),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 76),
  queueLimit: 0,
});

module.exports = pool;

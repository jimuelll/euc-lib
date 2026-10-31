import type { Pool } from "mysql2/promise";
import type { UserRecord } from "./users.types";

const db = require("../../db") as Pool;

const findByEmployeeId = async (studentEmployeeId: string): Promise<UserRecord | null> => {
  const [rows] = await db.query<UserRecord[]>(
    "SELECT * FROM users WHERE student_employee_id = ?",
    [studentEmployeeId],
  );
  return rows[0] || null;
};

const findById = async (id: number): Promise<UserRecord | null> => {
  const [rows] = await db.query<UserRecord[]>("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
};

const updateLastLogin = (userId: number) =>
  db.query("UPDATE users SET last_login = NOW() WHERE id = ?", [userId]);

export = { findByEmployeeId, findById, updateLastLogin };

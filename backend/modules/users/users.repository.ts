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

const updatePassword = (userId: number, newPasswordHash: string) => db.query(
  "UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?",
  [newPasswordHash, userId],
);

const updateLastLogin = (userId: number) =>
  db.query("UPDATE users SET last_login = NOW() WHERE id = ?", [userId]);

export = { findByEmployeeId, findById, updatePassword, updateLastLogin };

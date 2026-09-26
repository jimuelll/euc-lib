import type { RowDataPacket } from "mysql2/promise";

export type AdminRole = "super_admin" | "admin" | "staff" | "scanner" | "employee" | "alumni" | "student";

export interface UserProfile {
  studentEmployeeId: string;
  libraryCardNumber: string | null;
  studentNumber: string | null;
  employeeNumber: string | null;
  username: string | null;
}

export interface NewUserRecord extends UserProfile {
  email?: unknown;
  name: string;
  passwordHash: string;
  role: string;
  address?: unknown;
  contact?: unknown;
  programId: number | null;
  academicTermId: number | null;
  yearLevel: string | null;
  departmentId: number | null;
  remarks: string | null;
}

export interface AdminUserRow extends RowDataPacket {
  id: number;
  name: string;
  student_employee_id: string;
  role: string;
  is_active: number | boolean;
  barcode?: string | null;
  deleted_at?: Date | string | null;
  [key: string]: unknown;
}

export interface AdminEntityIdRow extends RowDataPacket {
  id: number;
}

export interface SearchUsersOptions {
  allowedRoles: string[];
  showArchived: boolean;
  studentEmployeeId?: unknown;
  name?: unknown;
  role?: unknown;
  status?: unknown;
  page?: unknown;
  limit?: unknown;
}

export interface SearchUserRow extends RowDataPacket {
  student_employee_id: string;
  name: string;
  role: string;
  is_active: number | boolean;
  [key: string]: unknown;
}

export interface SearchUsersPage {
  rows: SearchUserRow[];
  total: number;
  page: number;
  limit: number;
}

export type UserSearchQuery = Record<string, unknown>;

export interface UserUpdateRecord {
  [key: string]: unknown;
}

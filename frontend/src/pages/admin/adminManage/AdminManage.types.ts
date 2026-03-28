// ─── Domain Types ─────────────────────────────────────────────────────────────

export type FunctionType = "create" | "edit";

export type UserRole = "super_admin" | "admin" | "staff" | "scanner" | "student";

export interface User {
  student_employee_id: string;
  name: string;
  role: string;
  address?: string;
  contact?: string;
  is_active?: number;
}

// ─── Form State ───────────────────────────────────────────────────────────────

export interface UserFormState {
  fullName: string;
  id: string;
  address: string;
  contact: string;
  role: string;
  password: string;
  rePassword: string;
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────

export interface QrTarget {
  studentId: string;
  name: string;
}
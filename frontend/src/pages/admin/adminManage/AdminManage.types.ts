// ─── Domain Types ─────────────────────────────────────────────────────────────

export type FunctionType = "create" | "edit";

export type UserRole = "super_admin" | "admin" | "staff" | "scanner" | "employee" | "student";

export interface User {
  student_employee_id: string;
  name:                string;
  role:                string;
  address?:            string;
  contact?:            string;
  is_active?:          number;
  deleted_at?:         string | null;   // ← new: present when user is archived
}

// ─── Form State ───────────────────────────────────────────────────────────────

export interface UserFormState {
  fullName:   string;
  id:         string;
  address:    string;
  contact:    string;
  role:       string;
  password:   string;
  rePassword: string;
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────

export interface QrTarget {
  studentId: string;
  name:      string;
}

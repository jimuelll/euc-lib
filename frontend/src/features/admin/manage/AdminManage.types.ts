// ─── Domain Types ─────────────────────────────────────────────────────────────

export type UserRole = "super_admin" | "admin" | "staff" | "scanner" | "employee" | "student" | "alumni";

export interface User {
  student_employee_id: string;
  name:                string;
  role:                string;
  address?:            string;
  contact?:            string;
  program_id?:         number | null;
  program_course?:     string | null;
  library_card_number?: string | null; student_number?: string | null; employee_number?: string | null; username?: string | null;
  email?: string | null; year_level?: string | null; department_id?: number | null; department_name?: string | null; remarks?: string | null;
  is_active?:          number;
  deleted_at?:         string | null;   // ← new: present when user is archived
}

// ─── Form State ───────────────────────────────────────────────────────────────

export interface UserFormState {
  fullName:   string;
  id:         string;
  address:    string;
  contact:    string;
  programId:  string;
  academicTermId: string;
  libraryCardNumber: string; studentNumber: string; employeeNumber: string; username: string; email: string; yearLevel: string; departmentId: string; remarks: string;
  role:       string;
  password:   string;
  rePassword: string;
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────

export interface QrTarget {
  studentId: string;
  name:      string;
}

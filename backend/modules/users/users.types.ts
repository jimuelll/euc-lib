import type { RowDataPacket } from "mysql2/promise";

export interface UserRecord extends RowDataPacket {
  id: number;
  student_employee_id: string;
  name: string;
  email: string;
  password_hash: string;
  must_change_password: boolean | number;
  role: string;
  is_active: boolean | number;
  academic_term_id: number | null;
}

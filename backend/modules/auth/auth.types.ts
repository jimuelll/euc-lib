export interface AuthTokenPayload {
  id: number;
  role: string;
  name?: string;
  must_change_password?: boolean;
  term_status?: string;
  academic_term_name?: string | null;
  jti?: string;
  exp?: number;
  iat?: number;
  remember_me?: boolean;
  [claim: string]: unknown;
}

export interface AuthUser {
  id: number;
  role: string;
  name: string;
  password_hash: string;
  is_active: number | boolean;
  must_change_password: number | boolean;
  academic_term_id?: number | null;
}

export interface AuthAuditContext {
  deviceType?: unknown;
}

export interface AcademicTermStatus {
  term_status: "not_applicable" | "expired" | "current";
  academic_term_name: string | null;
}

export interface AuthError extends Error {
  status?: number;
}

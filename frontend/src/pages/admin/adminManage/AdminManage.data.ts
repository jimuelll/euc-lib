import type { UserRole, UserFormState } from "./AdminManage.types";

// ─── Role Hierarchy ───────────────────────────────────────────────────────────

export const ROLE_HIERARCHY: Record<string, UserRole[]> = {
  super_admin: ["super_admin", "admin", "staff", "scanner", "student"],
  admin:       ["admin", "staff", "scanner", "student"],
  staff:       ["staff", "scanner", "student"],
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const EMPTY_FORM: UserFormState = {
  fullName:   "",
  id:         "",
  address:    "",
  contact:    "",
  role:       "",
  password:   "",
  rePassword: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatRole = (role: string) =>
  role.replace("_", " ").toUpperCase();

export const getAllowedRoles = (userRole: string): UserRole[] =>
  ROLE_HIERARCHY[userRole] ?? [];
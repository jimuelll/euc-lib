import axiosInstance from "@/utils/AxiosInstance";
import type { User, UserFormState, UsersSummary } from "./AdminManage.types";

export type AcademicProgram = { id: number; name: string };
export type AcademicTerm = { id: number; name: string; starts_on: string; ends_on: string; is_current: number };
export type Department = { id: number; name: string };
export type UserPagination = { page: number; limit: number; total: number; totalPages: number };
type UserSearchResponse = { rows?: User[]; pagination?: UserPagination; summary?: UsersSummary } | User[];

const normaliseUserSearch = (data: UserSearchResponse) => {
  const rows = Array.isArray(data) ? data : data.rows ?? [];
  return { rows, summary: Array.isArray(data) ? undefined : data.summary, pagination: Array.isArray(data) ? { page: 1, limit: rows.length, total: rows.length, totalPages: 1 } : data.pagination ?? { page: 1, limit: rows.length, total: rows.length, totalPages: 1 } };
};

export const fetchAcademicTerms = async (signal?: AbortSignal): Promise<AcademicTerm[]> => (await axiosInstance.get<{ terms?: AcademicTerm[] }>("/api/admin/academic-terms", { signal })).data.terms ?? [];
export const fetchAcademicPrograms = async (signal?: AbortSignal): Promise<AcademicProgram[]> => (await axiosInstance.get<{ programs?: AcademicProgram[] }>("/api/admin/academic-programs", { signal })).data.programs ?? [];
export const fetchDepartments = async (signal?: AbortSignal): Promise<Department[]> => (await axiosInstance.get<{ departments?: Department[] }>("/api/admin/departments", { signal })).data.departments ?? [];
export const searchUsers = async ({ query, role, status, archived, access = "all", sort = "name", limit = 25, page = 1 }: { query: string; role: string; status: string; archived: boolean; page?: number; access?: string; sort?: string; limit?: number }, signal?: AbortSignal) => {
  const response = await axiosInstance.get<UserSearchResponse>("/api/admin/users", { params: { student_employee_id: query.trim() || undefined, name: query.trim() || undefined, role: role === "all" ? undefined : role, status: archived ? "archived" : status, archived: archived ? "true" : undefined, page, limit, access, sort }, signal });
  return normaliseUserSearch(response.data);
};
const userPayload = (form: UserFormState) => ({ name: form.fullName, role: form.role, password: form.password || undefined, address: form.address, contact: form.contact, email: form.email, library_card_number: form.libraryCardNumber, student_number: form.studentNumber, employee_number: form.employeeNumber, username: form.username, program_id: form.programId || null, academic_term_id: form.academicTermId || null, year_level: form.yearLevel, department_id: form.departmentId || null, remarks: form.remarks });
export const createUser = async (form: UserFormState) => (await axiosInstance.post<{ message: string }>("/api/admin/users", userPayload(form))).data;
export const updateUser = async (studentId: string, form: UserFormState) => (await axiosInstance.put<{ message: string }>(`/api/admin/users/${encodeURIComponent(studentId)}`, userPayload(form))).data;
export const archiveUser = async (studentId: string) => (await axiosInstance.delete<{ message?: string }>(`/api/admin/users/${encodeURIComponent(studentId)}`)).data;
export const restoreUser = async (studentId: string) => (await axiosInstance.patch<{ message?: string }>(`/api/admin/users/${encodeURIComponent(studentId)}/restore`)).data;

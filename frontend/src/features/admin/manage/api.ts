import axiosInstance from "@/utils/AxiosInstance";
import type { User, UserFormState } from "./AdminManage.types";

export type AcademicProgram = { id: number; name: string };
export type AcademicTerm = { id: number; name: string; starts_on: string; ends_on: string; is_current: number };
export type UserPagination = { page: number; limit: number; total: number; totalPages: number };
type UserSearchResponse = { rows?: User[]; pagination?: UserPagination } | User[];

const normaliseUserSearch = (data: UserSearchResponse) => {
  const rows = Array.isArray(data) ? data : data.rows ?? [];
  return { rows, pagination: Array.isArray(data) ? { page: 1, limit: rows.length, total: rows.length, totalPages: 1 } : data.pagination ?? { page: 1, limit: rows.length, total: rows.length, totalPages: 1 } };
};

export const fetchAcademicTerms = async (): Promise<AcademicTerm[]> => (await axiosInstance.get<{ terms?: AcademicTerm[] }>("/api/admin/academic-terms")).data.terms ?? [];
export const fetchAcademicPrograms = async (): Promise<AcademicProgram[]> => (await axiosInstance.get<{ programs?: AcademicProgram[] }>("/api/admin/academic-programs")).data.programs ?? [];
export const searchUsers = async ({ query, role, status, archived, page = 1 }: { query: string; role: string; status: string; archived: boolean; page?: number }) => {
  const response = await axiosInstance.get<UserSearchResponse>("/api/admin/users", { params: { student_employee_id: query.trim() || undefined, name: query.trim() || undefined, role: role === "all" ? undefined : role, status: archived || status === "all" ? undefined : status, archived: archived ? "true" : undefined, page, limit: 25 } });
  return normaliseUserSearch(response.data);
};
export const createUser = async (form: UserFormState) => (await axiosInstance.post<{ message: string }>("/api/admin/users", { student_employee_id: form.id, name: form.fullName, role: form.role, password: form.password, address: form.address, contact: form.contact, program_id: form.programId || null, academic_term_id: form.academicTermId || null })).data;
export const updateUser = async (studentId: string, form: UserFormState) => (await axiosInstance.put<{ message: string }>(`/api/admin/users/${studentId}`, { name: form.fullName, role: form.role, address: form.address, contact: form.contact, program_id: form.programId || null, academic_term_id: form.academicTermId || null, ...(form.password ? { password: form.password } : {}) })).data;
export const archiveUser = async (studentId: string) => (await axiosInstance.delete<{ message?: string }>(`/api/admin/users/${studentId}`)).data;
export const restoreUser = async (studentId: string) => (await axiosInstance.patch<{ message?: string }>(`/api/admin/users/${studentId}/restore`)).data;

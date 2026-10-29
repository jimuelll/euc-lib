import { isStudentProfileRole } from './userForm';
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
export const searchUsers = async ({ query, role, status, archived, programId, departmentId, termId, access = "all", sort = "name", limit = 25, page = 1 }: { query: string; role: string; status: string; archived: boolean; page?: number; programId?: string; departmentId?: string; termId?: string; access?: string; sort?: string; limit?: number }, signal?: AbortSignal) => {
  const response = await axiosInstance.get<UserSearchResponse>("/api/admin/users", { params: { programId, departmentId, termId, student_employee_id: query.trim() || undefined, name: query.trim() || undefined, role: role === "all" ? undefined : role, status: archived ? "archived" : status, archived: archived ? "true" : undefined, page, limit, access, sort }, signal });
  return normaliseUserSearch(response.data);
};
import { isOperationsRole } from "@/utils/operationsAccess";
const userPayload = (form: UserFormState) => ({ name: form.fullName.trim(), role: form.role, address: form.address, contact: form.contact, ...(!isOperationsRole(form.role) ? {email: form.email.trim()} : {}), remarks: form.remarks,
  ...(['student','staff','alumni'].includes(form.role) ? {library_card_number:form.libraryCardNumber.trim()} : form.role === 'employee' ? {employee_number:form.employeeNumber.trim(),department_id:form.departmentId || null} : {username:form.username.trim()}),
  ...(isStudentProfileRole(form.role) ? {student_number:form.studentNumber.trim(),program_id:form.programId || null,academic_term_id:form.academicTermId || null,year_level:form.yearLevel} : {}),
});
export const createUser = async (form: UserFormState) => (await axiosInstance.post<{ message: string }>("/api/admin/users", {...userPayload(form), ...(isOperationsRole(form.role) ? {password:form.password} : {})})).data;
export const updateUser = async (studentId: string, form: UserFormState) => (await axiosInstance.put<{ message: string }>(`/api/admin/users/${encodeURIComponent(studentId)}`, userPayload(form))).data;
export const archiveUser = async (studentId: string, reason: string) => (await axiosInstance.delete<{ message?: string }>(`/api/admin/users/${encodeURIComponent(studentId)}`, {data:{reason}})).data;
export const restoreUser = async (studentId: string) => (await axiosInstance.patch<{ message?: string }>(`/api/admin/users/${encodeURIComponent(studentId)}/restore`)).data;
export const requestAccountEmail = async (identifier: string, action: "invite" | "verify" | "recovery") => (await axiosInstance.post<{message:string}>(`/api/admin/users/${encodeURIComponent(identifier)}/account-email`,{action})).data;
export const checkUserAvailability = async (field:'email'|'username',value:string,excludeIdentifier?:string,signal?:AbortSignal) => (await axiosInstance.post<{available:boolean}>('/api/admin/users/availability',{field,value,excludeIdentifier},{signal})).data;
export type AccountEmailDelivery = {purpose:'setup'|'verify_email'|'recovery';status:string;requested_at:string;accepted_at:string|null};
export const fetchAccountEmailStatus = async (identifier:string,signal?:AbortSignal) => (await axiosInstance.get<{deliveries:AccountEmailDelivery[]}>(`/api/admin/users/${encodeURIComponent(identifier)}/account-email`,{signal})).data;

export const resetOperationsPassword = async (identifier:string,password:string) => (await axiosInstance.post<{message:string}>(`/api/admin/users/${encodeURIComponent(identifier)}/reset-password`,{password})).data;

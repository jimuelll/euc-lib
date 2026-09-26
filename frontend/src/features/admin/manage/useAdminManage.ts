import { useAdminUrlState, queryPage } from "@/features/admin/hooks/useAdminUrlState";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { invalidateServerState } from "@/app/server-state";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import type { User, UserFormState, QrTarget } from "./AdminManage.types";
import { EMPTY_FORM, getAllowedRoles } from "./AdminManage.data";
import { useAdminConfirmDialog } from "@/features/admin";
import { archiveUser, createUser, fetchAcademicPrograms, fetchAcademicTerms, fetchDepartments, restoreUser, searchUsers, updateUser, type AcademicProgram, type AcademicTerm, type Department } from "./api";
import { manageKeys } from "./manage.keys";

export type { AcademicProgram, AcademicTerm, Department } from "./api";

interface UseAdminManageReturn {
  // Form
  form:            UserFormState;
  setField:        <K extends keyof UserFormState>(key: K, value: string) => void;
  showPassword:    boolean;
  togglePassword:  () => void;
  resetForm:       () => void;

  // Roles
  allowedRoles: string[];
  programs: AcademicProgram[];
  terms: AcademicTerm[];
  departments: Department[];

  // Search
  searchQuery:          string;
  setSearchQuery:       (v: string) => void;
  roleFilter:           string;
  setRoleFilter:        (v: string) => void;
  statusFilter:         string;
  setStatusFilter:      (v: string) => void;
  searchResults:        User[];
  userPagination:       { page: number; limit: number; total: number; totalPages: number };
  handleSearchUsers:    (page?: number) => Promise<void>;
  showArchived:         boolean;
  setArchivedView:      (archived: boolean) => void;

  // Selected user
  selectedUser:      User | null;
  selectUserForEdit: (u: User) => void;

  // Actions
  loading:           boolean;
  handleCreateUser:  () => Promise<boolean>;
  handleUpdateUser:  () => Promise<boolean>;
  handleArchiveUser: () => Promise<boolean>;
  handleRestoreUser: () => Promise<boolean>;
  confirmDialog: JSX.Element;

  // QR
  qrTarget:    QrTarget | null;
  setQrTarget: (v: QrTarget | null) => void;
}

export const useAdminManage = (): UseAdminManageReturn => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, patchParams] = useAdminUrlState();
  const currentPage = queryPage(params.get("page"));

  const [form,          setForm]          = useState<UserFormState>(EMPTY_FORM);
  const [showPassword,  setShowPassword]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const searchQuery = params.get("q") ?? "";
  const debouncedSearch = useDebounce(searchQuery, 180);
  const setSearchQuery = (value: string) => patchParams({ q: value, page: null }, true);
  const roleFilter = params.get("role") ?? "all";
  const setRoleFilter = (value: string) => patchParams({ role: value, page: null }, false);
  const statusFilter = params.get("status") ?? "all";
  const setStatusFilter = (value: string) => patchParams({ status: value, page: null }, false);
  const [selectedUser,  setSelectedUser]  = useState<User | null>(null);
  const [qrTarget,      setQrTarget]      = useState<QrTarget | null>(null);
  const showArchived = params.get("archived") === "true";
  const { confirm, confirmDialog } = useAdminConfirmDialog();
  const allowedRoles = user ? getAllowedRoles(user.role) : [];
  const departmentsQuery = useQuery({ queryKey: manageKeys.departments(), queryFn: ({ signal }) => fetchDepartments(signal), enabled: Boolean(user) });
  const termsQuery = useQuery({ queryKey: manageKeys.terms(), queryFn: ({ signal }) => fetchAcademicTerms(signal), enabled: Boolean(user) });
  const programsQuery = useQuery({ queryKey: manageKeys.programs(), queryFn: ({ signal }) => fetchAcademicPrograms(signal), enabled: Boolean(user) });
  const departments: Department[] = departmentsQuery.data ?? [];
  const terms: AcademicTerm[] = termsQuery.data ?? [];
  const programs: AcademicProgram[] = programsQuery.data ?? [];
  const filters = { query: debouncedSearch, role: roleFilter, status: statusFilter, archived: showArchived, page: currentPage };
  const usersQuery = useQuery({ queryKey: manageKeys.userSearch(filters), queryFn: ({ signal }) => searchUsers(filters, signal), enabled: Boolean(user), placeholderData: (previousData) => previousData });
  const searchResults: User[] = usersQuery.data?.rows ?? [];
  const userPagination = usersQuery.data?.pagination ?? { page: currentPage, limit: 25, total: 0, totalPages: 1 };
  const invalidateUsers = () => invalidateServerState(queryClient, "user");
  const createMutation = useMutation({ mutationFn: createUser, onSuccess: invalidateUsers });
  const updateMutation = useMutation({ mutationFn: ({ id, form }: { id: string; form: UserFormState }) => updateUser(id, form), onSuccess: invalidateUsers });
  const archiveMutation = useMutation({ mutationFn: archiveUser, onSuccess: invalidateUsers });
  const restoreMutation = useMutation({ mutationFn: restoreUser, onSuccess: invalidateUsers });

  // ── Form helpers ───────────────────────────────────────────────────────────
  const setField = <K extends keyof UserFormState>(key: K, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSelectedUser(null);
  };

  const togglePassword = () => setShowPassword((v) => !v);

  // ── Toggle archived view ───────────────────────────────────────────────────
  const setArchivedView = (archived: boolean) => {
    patchParams({ archived, page: null });
    setSelectedUser(null);
  };
  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreateUser = async () => {
    const { fullName, id, role, password, rePassword, address, contact, programId, academicTermId, libraryCardNumber, studentNumber, employeeNumber, username, email, yearLevel, departmentId, remarks } = form;
    if (!fullName || !role || !password || !rePassword) {
      toast.error("All required fields must be filled");
      return false;
    }
    if (password !== rePassword) {
      toast.error("Passwords do not match");
      return false;
    }
    setLoading(true);
    try {
      const response = await createMutation.mutateAsync({ fullName, id, role, password, rePassword, address, contact, programId, academicTermId, libraryCardNumber, studentNumber, employeeNumber, username, email, yearLevel, departmentId, remarks });
      toast.success(response.message);
      const identifier = form.libraryCardNumber || form.employeeNumber || form.username;
      setQrTarget({ studentId: identifier, name: fullName });
      resetForm();
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to create user");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearchUsers = async (page = currentPage) => {
    if (page !== currentPage) { patchParams({ page }); return; }
    const trimmedQuery = searchQuery.trim();
    const result = await usersQuery.refetch();
    if (result.isSuccess) {
      if (!result.data.rows.length) {
        toast.info(trimmedQuery ? "No users found" : `No ${showArchived ? "archived" : "active"} users found`);
      }
    } else toast.error((result.error as any)?.response?.data?.message || "Search failed");
  };

  const selectUserForEdit = (u: User) => {
    setSelectedUser(u);
    setForm({
      fullName:   u.name,
      id:         u.student_employee_id,
      address:    u.address  || "",
      contact:    u.contact  || "",
      programId:  u.program_id ? String(u.program_id) : "",
      academicTermId: u.academic_term_id ? String(u.academic_term_id) : "",
      libraryCardNumber: u.library_card_number || "", studentNumber: u.student_number || "", employeeNumber: u.employee_number || "", username: u.username || "", email: u.email || "", yearLevel: u.year_level || "", departmentId: u.department_id ? String(u.department_id) : "", remarks: u.remarks || "",
      role:       u.role,
      password:   "",
      rePassword: "",
    });
  };

  // ── Update ─────────────────────────────────────────────────────────────────
  const handleUpdateUser = async () => {
    if (!selectedUser) return false;
    const { password, rePassword } = form;
    const updates = { ...form };
    if (password) {
      if (password !== rePassword) {
        toast.error("Passwords do not match");
        return false;
      }
      updates.password = password;
    }
    setLoading(true);
    try {
      const response = await updateMutation.mutateAsync({ id: selectedUser.student_employee_id, form: { ...form } });
      toast.success(response.message);
      resetForm();
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Update failed");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ── Archive — DELETE /api/admin/users/:id ──────────────────────────────────
  // Sets is_active=0 and deleted_at=NOW(). One action, one outcome.
  const handleArchiveUser = async () => {
    if (!selectedUser) return false;
    const shouldArchive = await confirm({
      title: `Archive ${selectedUser.name}?`,
      description: "They will lose access to the system and disappear from active searches until restored.",
      actionLabel: "Archive User",
      tone: "danger",
    });
    if (!shouldArchive) return false;
    setLoading(true);
    try {
      const response = await archiveMutation.mutateAsync(selectedUser.student_employee_id);
      toast.success(response.message || "User archived");
      resetForm();
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Archive failed");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ── Restore — PATCH /api/admin/users/:id/restore ───────────────────────────
  // Clears deleted_at and sets is_active=1. User is fully active again.
  const handleRestoreUser = async () => {
    if (!selectedUser) return false;
    const shouldRestore = await confirm({
      title: `Restore ${selectedUser.name}?`,
      description: "They will be able to sign in again. Students with an expired term will still appear as inactive until their term is renewed.",
      actionLabel: "Restore User",
    });
    if (!shouldRestore) return false;
    setLoading(true);
    try {
      const response = await restoreMutation.mutateAsync(selectedUser.student_employee_id);
      toast.success(response.message || "User restored");
      resetForm();
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Restore failed");
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    form,
    setField,
    showPassword,
    togglePassword,
    resetForm,
    allowedRoles,
    programs,
    terms,
    departments,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    searchResults,
    userPagination,
    handleSearchUsers,
    showArchived,
    setArchivedView,
    selectedUser,
    selectUserForEdit,
    loading: loading || usersQuery.isPending,
    handleCreateUser,
    handleUpdateUser,
    handleArchiveUser,
    handleRestoreUser,
    confirmDialog,
    qrTarget,
    setQrTarget,
  };
};

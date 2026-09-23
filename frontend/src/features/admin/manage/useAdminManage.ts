import { useAdminUrlState, queryPage } from "@/features/admin/hooks/useAdminUrlState";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import type { User, UserFormState, QrTarget } from "./AdminManage.types";
import { EMPTY_FORM, getAllowedRoles } from "./AdminManage.data";
import { useAdminConfirmDialog } from "@/features/admin";
import { archiveUser, createUser, fetchAcademicPrograms, fetchAcademicTerms, fetchDepartments, restoreUser, searchUsers, updateUser, type AcademicProgram, type AcademicTerm, type Department } from "./api";

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
  const [params, patchParams] = useAdminUrlState();
  const currentPage = queryPage(params.get("page"));

  const [form,          setForm]          = useState<UserFormState>(EMPTY_FORM);
  const [showPassword,  setShowPassword]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [allowedRoles,  setAllowedRoles]  = useState<string[]>([]);
  const [programs,      setPrograms]      = useState<AcademicProgram[]>([]);
  const [terms,         setTerms]         = useState<AcademicTerm[]>([]);
  const [departments,   setDepartments]   = useState<Department[]>([]);
  const searchQuery = params.get("q") ?? "";
  const setSearchQuery = (value: string) => patchParams({ q: value, page: null }, true);
  const roleFilter = params.get("role") ?? "all";
  const setRoleFilter = (value: string) => patchParams({ role: value, page: null }, false);
  const statusFilter = params.get("status") ?? "all";
  const setStatusFilter = (value: string) => patchParams({ status: value, page: null }, false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [selectedUser,  setSelectedUser]  = useState<User | null>(null);
  const [qrTarget,      setQrTarget]      = useState<QrTarget | null>(null);
  const showArchived = params.get("archived") === "true";
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  useEffect(() => {
    if (!user) return;
    setAllowedRoles(getAllowedRoles(user.role));
  }, [user]);
  useEffect(() => { if (user) void fetchDepartments().then(setDepartments).catch(() => setDepartments([])); }, [user]);

  useEffect(() => { if (!user) return; void fetchAcademicTerms().then(setTerms).catch(() => setTerms([])); }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchAcademicPrograms()
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, [user]);

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
      const response = await createUser({ fullName, id, role, password, rePassword, address, contact, programId, academicTermId, libraryCardNumber, studentNumber, employeeNumber, username, email, yearLevel, departmentId, remarks });
      toast.success(response.message);
      const identifier = form.libraryCardNumber || form.employeeNumber || form.username;
      setQrTarget({ studentId: identifier, name: fullName });
      resetForm();
      await handleSearchUsers();
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

    setLoading(true);
    try {
      const result = await searchUsers({ query: trimmedQuery, role: roleFilter, status: statusFilter, archived: showArchived, page });
      setSearchResults(result.rows);
      setUserPagination(result.pagination);
      if (!result.rows.length) {
        toast.info(trimmedQuery ? "No users found" : `No ${showArchived ? "archived" : "active"} users found`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { if (user) void handleSearchUsers(currentPage); }, 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchQuery, roleFilter, statusFilter, showArchived, currentPage]);

  const selectUserForEdit = (u: User) => {
    setSelectedUser(u);
    setForm({
      fullName:   u.name,
      id:         u.student_employee_id,
      address:    u.address  || "",
      contact:    u.contact  || "",
      programId:  u.program_id ? String(u.program_id) : "",
      academicTermId: "",
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
      const response = await updateUser(selectedUser.student_employee_id, {
        ...form,
      });
      toast.success(response.message);
      resetForm();
      await handleSearchUsers();
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
      const response = await archiveUser(selectedUser.student_employee_id);
      toast.success(response.message || "User archived");
      resetForm();
      await handleSearchUsers();
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
      description: "They will be able to log in and appear in active searches again.",
      actionLabel: "Restore User",
    });
    if (!shouldRestore) return false;
    setLoading(true);
    try {
      const response = await restoreUser(selectedUser.student_employee_id);
      toast.success(response.message || "User restored");
      resetForm();
      await handleSearchUsers();
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
    loading,
    handleCreateUser,
    handleUpdateUser,
    handleArchiveUser,
    handleRestoreUser,
    confirmDialog,
    qrTarget,
    setQrTarget,
  };
};

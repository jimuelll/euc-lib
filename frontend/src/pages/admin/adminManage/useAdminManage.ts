import { useState, useEffect } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import type { FunctionType, User, UserFormState, QrTarget } from "./AdminManage.types";
import { EMPTY_FORM, getAllowedRoles } from "./AdminManage.data";
import { useAdminConfirmDialog } from "../components/useAdminConfirmDialog";

export type AcademicProgram = { id: number; name: string };
export type AcademicTerm = { id: number; name: string; starts_on: string; ends_on: string; is_current: number };

interface UseAdminManageReturn {
  // Mode
  functionType:    FunctionType;
  setFunctionType: (v: FunctionType) => void;

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
  handleToggleArchived: () => void;

  // Selected user
  selectedUser:      User | null;
  selectUserForEdit: (u: User) => void;

  // Actions
  loading:           boolean;
  handleCreateUser:  () => Promise<void>;
  handleUpdateUser:  () => Promise<void>;
  handleArchiveUser: () => Promise<void>;
  handleRestoreUser: () => Promise<void>;
  confirmDialog: JSX.Element;

  // QR
  qrTarget:    QrTarget | null;
  setQrTarget: (v: QrTarget | null) => void;
}

export const useAdminManage = (): UseAdminManageReturn => {
  const { user } = useAuth();

  const [functionType,  setFunctionType]  = useState<FunctionType>("edit");
  const [form,          setForm]          = useState<UserFormState>(EMPTY_FORM);
  const [showPassword,  setShowPassword]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [allowedRoles,  setAllowedRoles]  = useState<string[]>([]);
  const [programs,      setPrograms]      = useState<AcademicProgram[]>([]);
  const [terms,         setTerms]         = useState<AcademicTerm[]>([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [roleFilter,    setRoleFilter]    = useState("all");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [selectedUser,  setSelectedUser]  = useState<User | null>(null);
  const [qrTarget,      setQrTarget]      = useState<QrTarget | null>(null);
  const [showArchived,  setShowArchived]  = useState(false);
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  useEffect(() => {
    if (!user) return;
    setAllowedRoles(getAllowedRoles(user.role));
  }, [user]);

  useEffect(() => { if (!user) return; void axiosInstance.get("/api/admin/academic-terms").then(r => setTerms(r.data.terms ?? [])).catch(() => setTerms([])); }, [user]);

  useEffect(() => {
    if (!user) return;
    void axiosInstance.get("/api/admin/academic-programs")
      .then((response) => setPrograms(response.data.programs ?? []))
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
  const handleToggleArchived = () => {
    const next = !showArchived;
    setShowArchived(next);
    setSelectedUser(null);
    void (async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get("/api/admin/users", { params: { student_employee_id: searchQuery.trim() || undefined, name: searchQuery.trim() || undefined, role: roleFilter === "all" ? undefined : roleFilter, status: statusFilter === "all" ? undefined : statusFilter, archived: next ? "true" : undefined } });
        setSearchResults(res.data);
      } catch (err: any) { toast.error(err.response?.data?.message || "Failed to load users"); }
      finally { setLoading(false); }
    })();
  };

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreateUser = async () => {
    const { fullName, id, role, password, rePassword, address, contact, programId, academicTermId } = form;
    if (!fullName || !id || !role || !password || !rePassword) {
      toast.error("All required fields must be filled");
      return;
    }
    if (password !== rePassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post("/api/admin/users", {
        student_employee_id: id,
        name: fullName,
        role,
        password,
        address,
        contact,
        program_id: programId || null,
        academic_term_id: academicTermId || null,
      });
      toast.success(res.data.message);
      setQrTarget({ studentId: id, name: fullName });
      resetForm();
      await handleSearchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearchUsers = async (page = 1) => {
    const trimmedQuery = searchQuery.trim();

    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/admin/users", {
        params: {
          student_employee_id: trimmedQuery || undefined,
          name:                trimmedQuery || undefined,
          role:                roleFilter === "all" ? undefined : roleFilter,
          status:              statusFilter === "all" ? undefined : statusFilter,
          archived:            showArchived ? "true" : undefined,
          page,
          limit: 25,
        },
      });
      const rows = res.data.rows ?? res.data;
      setSearchResults(rows);
      setUserPagination(res.data.pagination ?? { page: 1, limit: rows.length, total: rows.length, totalPages: 1 });
      if (!rows.length) {
        toast.info(trimmedQuery ? "No users found" : `No ${showArchived ? "archived" : "active"} users found`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void handleSearchUsers();
    // Records are the primary task view; creation stays available as a deliberate mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user) void handleSearchUsers();
    // Filters update the persistent records table immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter]);

  // ── Select for edit ────────────────────────────────────────────────────────
  const selectUserForEdit = (u: User) => {
    setSelectedUser(u);
    setForm({
      fullName:   u.name,
      id:         u.student_employee_id,
      address:    u.address  || "",
      contact:    u.contact  || "",
      programId:  u.program_id ? String(u.program_id) : "",
      academicTermId: "",
      role:       u.role,
      password:   "",
      rePassword: "",
    });
  };

  // ── Update ─────────────────────────────────────────────────────────────────
  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    const { fullName, role, address, contact, programId, academicTermId, password, rePassword } = form;
    const updates: any = { name: fullName, role, address, contact, program_id: programId || null, academic_term_id: academicTermId || null };
    if (password) {
      if (password !== rePassword) {
        toast.error("Passwords do not match");
        return;
      }
      updates.password = password;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.put(
        `/api/admin/users/${selectedUser.student_employee_id}`,
        updates
      );
      toast.success(res.data.message);
      resetForm();
      await handleSearchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Archive — DELETE /api/admin/users/:id ──────────────────────────────────
  // Sets is_active=0 and deleted_at=NOW(). One action, one outcome.
  const handleArchiveUser = async () => {
    if (!selectedUser) return;
    const shouldArchive = await confirm({
      title: `Archive ${selectedUser.name}?`,
      description: "They will lose access to the system and disappear from active searches until restored.",
      actionLabel: "Archive User",
      tone: "danger",
    });
    if (!shouldArchive) return;
    setLoading(true);
    try {
      const res = await axiosInstance.delete(
        `/api/admin/users/${selectedUser.student_employee_id}`
      );
      toast.success(res.data.message || "User archived");
      resetForm();
      await handleSearchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Archive failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Restore — PATCH /api/admin/users/:id/restore ───────────────────────────
  // Clears deleted_at and sets is_active=1. User is fully active again.
  const handleRestoreUser = async () => {
    if (!selectedUser) return;
    const shouldRestore = await confirm({
      title: `Restore ${selectedUser.name}?`,
      description: "They will be able to log in and appear in active searches again.",
      actionLabel: "Restore User",
    });
    if (!shouldRestore) return;
    setLoading(true);
    try {
      const res = await axiosInstance.patch(
        `/api/admin/users/${selectedUser.student_employee_id}/restore`
      );
      toast.success(res.data.message || "User restored");
      resetForm();
      await handleSearchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Restore failed");
    } finally {
      setLoading(false);
    }
  };

  /* const handleBulkDeactivateStudentLikeUsers = async () => {
    const shouldDeactivate = await confirm({
      title: "Deactivate all student-like accounts?",
      description: "This archives every active student, employee, and alumni account with no unreturned books so their library cards stop working for the new semester.",
      actionLabel: "Deactivate Eligible Accounts",
      tone: "danger",
    });
    if (!shouldDeactivate) return;

    setLoading(true);
    try {
      const res = await axiosInstance.post("/api/admin/users/bulk-deactivate-student-like");
      toast.success(res.data.message || "Accounts updated");

      if (res.data.skipped_count) {
        const skippedSummary = (res.data.skipped_users ?? [])
          .slice(0, 3)
          .map((item: { student_employee_id: string; active_borrow_count: number }) =>
            `${item.student_employee_id} (${item.active_borrow_count})`
          )
          .join(", ");

        toast.info(
          skippedSummary
            ? `Skipped accounts with unreturned books: ${skippedSummary}${res.data.skipped_count > 3 ? "..." : ""}`
            : "Some accounts were skipped because they still have unreturned books."
        );
      }

      setSelectedUser(null);
      await handleSearchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Bulk deactivation failed");
    } finally {
      setLoading(false);
    }
  }; */

  return {
    functionType,
    setFunctionType,
    form,
    setField,
    showPassword,
    togglePassword,
    resetForm,
    allowedRoles,
    programs,
    terms,
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
    handleToggleArchived,
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

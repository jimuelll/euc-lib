import { useState, useEffect } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import type { FunctionType, User, UserFormState, QrTarget } from "./AdminManage.types";
import { EMPTY_FORM, getAllowedRoles } from "./AdminManage.data";

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

  // Search
  searchQuery:          string;
  setSearchQuery:       (v: string) => void;
  searchResults:        User[];
  handleSearchUsers:    () => Promise<void>;
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

  // QR
  qrTarget:    QrTarget | null;
  setQrTarget: (v: QrTarget | null) => void;
}

export const useAdminManage = (): UseAdminManageReturn => {
  const { user } = useAuth();

  const [functionType,  setFunctionType]  = useState<FunctionType>("create");
  const [form,          setForm]          = useState<UserFormState>(EMPTY_FORM);
  const [showPassword,  setShowPassword]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [allowedRoles,  setAllowedRoles]  = useState<string[]>([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser,  setSelectedUser]  = useState<User | null>(null);
  const [qrTarget,      setQrTarget]      = useState<QrTarget | null>(null);
  const [showArchived,  setShowArchived]  = useState(false);

  useEffect(() => {
    if (!user) return;
    setAllowedRoles(getAllowedRoles(user.role));
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
    setShowArchived((prev) => !prev);
    setSearchResults([]);
    setSelectedUser(null);
    setSearchQuery("");
  };

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreateUser = async () => {
    const { fullName, id, role, password, rePassword, address, contact } = form;
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
      });
      toast.success(res.data.message);
      setQrTarget({ studentId: id, name: fullName });
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) {
      toast.error("Enter a name or ID to search");
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/admin/users", {
        params: {
          student_employee_id: searchQuery || undefined,
          name:                searchQuery || undefined,
          archived:            showArchived ? "true" : undefined,
        },
      });
      setSearchResults(res.data);
      if (!res.data.length) toast.info("No users found");
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Select for edit ────────────────────────────────────────────────────────
  const selectUserForEdit = (u: User) => {
    setSelectedUser(u);
    setForm({
      fullName:   u.name,
      id:         u.student_employee_id,
      address:    u.address  || "",
      contact:    u.contact  || "",
      role:       u.role,
      password:   "",
      rePassword: "",
    });
  };

  // ── Update ─────────────────────────────────────────────────────────────────
  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    const { fullName, role, address, contact, password, rePassword } = form;
    const updates: any = { name: fullName, role, address, contact };
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
      setSearchResults([]);
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
    if (!confirm(`Archive ${selectedUser.name}? They won't be able to log in and will be hidden from active searches. You can restore them later.`)) return;
    setLoading(true);
    try {
      const res = await axiosInstance.delete(
        `/api/admin/users/${selectedUser.student_employee_id}`
      );
      toast.success(res.data.message || "User archived");
      setSearchResults((prev) =>
        prev.filter((u) => u.student_employee_id !== selectedUser.student_employee_id)
      );
      resetForm();
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
    if (!confirm(`Restore ${selectedUser.name}? They will be able to log in again.`)) return;
    setLoading(true);
    try {
      const res = await axiosInstance.patch(
        `/api/admin/users/${selectedUser.student_employee_id}/restore`
      );
      toast.success(res.data.message || "User restored");
      setSearchResults((prev) =>
        prev.filter((u) => u.student_employee_id !== selectedUser.student_employee_id)
      );
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Restore failed");
    } finally {
      setLoading(false);
    }
  };

  return {
    functionType,
    setFunctionType,
    form,
    setField,
    showPassword,
    togglePassword,
    resetForm,
    allowedRoles,
    searchQuery,
    setSearchQuery,
    searchResults,
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
    qrTarget,
    setQrTarget,
  };
};
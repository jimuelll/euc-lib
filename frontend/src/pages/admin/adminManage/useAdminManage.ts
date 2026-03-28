import { useState, useEffect } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import type { FunctionType, User, UserFormState, QrTarget } from "./AdminManage.types";
import { EMPTY_FORM, getAllowedRoles } from "./AdminManage.data";

interface UseAdminManageReturn {
  // Mode
  functionType: FunctionType;
  setFunctionType: (v: FunctionType) => void;

  // Form
  form: UserFormState;
  setField: <K extends keyof UserFormState>(key: K, value: string) => void;
  showPassword: boolean;
  togglePassword: () => void;
  resetForm: () => void;

  // Roles
  allowedRoles: string[];

  // Search
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchResults: User[];
  handleSearchUsers: () => Promise<void>;

  // Selected user
  selectedUser: User | null;
  selectUserForEdit: (u: User) => void;

  // Actions
  loading: boolean;
  handleCreateUser: () => Promise<void>;
  handleUpdateUser: () => Promise<void>;
  handleDeactivateUser: () => Promise<void>;
  handleReactivateUser: () => Promise<void>;

  // QR
  qrTarget: QrTarget | null;
  setQrTarget: (v: QrTarget | null) => void;
}

export const useAdminManage = (): UseAdminManageReturn => {
  const { user } = useAuth();

  const [functionType, setFunctionType] = useState<FunctionType>("create");
  const [form, setForm]                 = useState<UserFormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [qrTarget, setQrTarget]         = useState<QrTarget | null>(null);

  // ── Derive allowed roles from logged-in user ───────────────────────────────
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
          name: searchQuery || undefined,
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

  // ── Deactivate ─────────────────────────────────────────────────────────────
  const handleDeactivateUser = async () => {
    if (!selectedUser) return;
    if (!confirm(`Deactivate ${selectedUser.name}? They will no longer be able to log in.`)) return;
    setLoading(true);
    try {
      const res = await axiosInstance.delete(
        `/api/admin/users/${selectedUser.student_employee_id}`
      );
      toast.success(res.data.message);
      setSearchResults((prev) =>
        prev.map((u) =>
          u.student_employee_id === selectedUser.student_employee_id
            ? { ...u, is_active: 0 }
            : u
        )
      );
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Deactivation failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Reactivate ─────────────────────────────────────────────────────────────
  const handleReactivateUser = async () => {
    if (!selectedUser) return;
    if (!confirm(`Reactivate ${selectedUser.name}?`)) return;
    setLoading(true);
    try {
      await axiosInstance.put(
        `/api/admin/users/${selectedUser.student_employee_id}`,
        { is_active: 1 }
      );
      toast.success("User reactivated successfully");
      setSearchResults((prev) =>
        prev.map((u) =>
          u.student_employee_id === selectedUser.student_employee_id
            ? { ...u, is_active: 1 }
            : u
        )
      );
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Reactivation failed");
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
    selectedUser,
    selectUserForEdit,
    loading,
    handleCreateUser,
    handleUpdateUser,
    handleDeactivateUser,
    handleReactivateUser,
    qrTarget,
    setQrTarget,
  };
};
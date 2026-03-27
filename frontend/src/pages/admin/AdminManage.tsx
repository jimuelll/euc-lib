import { useState, useEffect } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import {
  Input,
  Label,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import { toast } from "@/components/ui/sonner";
import { Eye, EyeOff, UserX, UserCheck, QrCode, Download, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

const roleHierarchy: Record<string, string[]> = {
  super_admin: ["super_admin", "admin", "staff", "scanner", "student"],
  admin: ["admin", "staff", "scanner", "student"],
  staff: ["staff", "scanner", "student"],
};

type User = {
  student_employee_id: string;
  name: string;
  role: string;
  address?: string;
  contact?: string;
  is_active?: number;
};

// ── QR Modal ─────────────────────────────────────────────────────────────────
const QrModal = ({
  studentId,
  name,
  onClose,
}: {
  studentId: string;
  name: string;
  onClose: () => void;
}) => {
  const src = `/api/admin/users/${encodeURIComponent(studentId)}/barcode-png`;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `qr-${studentId}.png`;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative rounded-xl border bg-card p-6 shadow-xl flex flex-col items-center gap-4 w-72"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="font-semibold text-foreground text-center">{name}</p>
        <p className="text-xs text-muted-foreground">{studentId}</p>
        <img
          src={src}
          alt={`QR code for ${studentId}`}
          className="h-48 w-48 rounded-lg border"
        />
        <Button onClick={handleDownload} variant="outline" className="gap-1.5 w-full">
          <Download className="h-4 w-4" />
          Download PNG
        </Button>
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const AdminManage = () => {
  const { user } = useAuth();
  const [functionType, setFunctionType] = useState<"create" | "edit">("create");

  const [fullName, setFullName]     = useState("");
  const [id, setId]                 = useState("");
  const [address, setAddress]       = useState("");
  const [contact, setContact]       = useState("");
  const [role, setRole]             = useState("");
  const [password, setPassword]     = useState("");
  const [rePassword, setRePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading]             = useState(false);
  const [allowedRoles, setAllowedRoles]   = useState<string[]>([]);
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser]   = useState<User | null>(null);

  // QR modal state
  const [qrTarget, setQrTarget] = useState<{ studentId: string; name: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setAllowedRoles(roleHierarchy[user.role] || []);
  }, [user]);

  const resetForm = () => {
    setFullName("");
    setId("");
    setAddress("");
    setContact("");
    setRole("");
    setPassword("");
    setRePassword("");
    setSelectedUser(null);
  };

  const handleCreateUser = async () => {
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
      // Show QR immediately after creation
      setQrTarget({ studentId: id, name: fullName });
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

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

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
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

  const selectUserForEdit = (u: User) => {
    setSelectedUser(u);
    setFullName(u.name);
    setId(u.student_employee_id);
    setAddress(u.address || "");
    setContact(u.contact || "");
    setRole(u.role);
    setPassword("");
    setRePassword("");
  };

  return (
    <div className="max-w-3xl">
      {/* QR Modal */}
      {qrTarget && (
        <QrModal
          studentId={qrTarget.studentId}
          name={qrTarget.name}
          onClose={() => setQrTarget(null)}
        />
      )}

      <h2 className="font-heading text-lg font-bold text-foreground">User Management</h2>

      {/* Mode selector */}
      <div className="mt-4">
        <Label>Mode</Label>
        <Select value={functionType} onValueChange={(v) => { setFunctionType(v as any); resetForm(); }}>
          <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="create">Create User</SelectItem>
            <SelectItem value="edit">Edit / Search / Deactivate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Create Form */}
      {functionType === "create" && (
        <form
          className="mt-6 space-y-4 rounded-lg border bg-card p-6"
          onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }}
        >
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>ID Number</Label>
            <Input value={id} onChange={(e) => setId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Contact</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Re-Type Password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                value={rePassword}
                onChange={(e) => setRePassword(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {allowedRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace("_", " ").toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create User"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
              Clear Form
            </Button>
          </div>
        </form>
      )}

      {/* Edit / Search / Deactivate */}
      {functionType === "edit" && (
        <>
          <div className="mt-6 flex gap-2">
            <Input
              placeholder="Search by ID or Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchUsers()}
            />
            <Button onClick={handleSearchUsers} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-left text-sm text-foreground">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((u) => (
                    <tr
                      key={u.student_employee_id}
                      className="border-t cursor-pointer hover:bg-accent/20"
                      onClick={() => selectUserForEdit(u)}
                    >
                      <td className="px-3 py-2">{u.student_employee_id}</td>
                      <td className="px-3 py-2">{u.name}</td>
                      <td className="px-3 py-2 capitalize">{u.role.replace("_", " ")}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={
                            u.is_active
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-muted/50 text-muted-foreground border-border"
                          }
                        >
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedUser && (
            <form
              className="mt-6 space-y-4 rounded-lg border bg-card p-6"
              onSubmit={(e) => { e.preventDefault(); handleUpdateUser(); }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  Editing: {selectedUser.name}
                </h3>
                <Badge
                  variant="outline"
                  className={
                    selectedUser.is_active
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-muted/50 text-muted-foreground border-border"
                  }
                >
                  {selectedUser.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>ID Number</Label>
                <Input value={id} disabled />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contact</Label>
                <Input value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave empty to keep current"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Re-Type Password</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={rePassword}
                    onChange={(e) => setRePassword(e.target.value)}
                    placeholder="Leave empty to keep current"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.replace("_", " ").toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update User"}
                </Button>

                {/* View QR button */}
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    setQrTarget({
                      studentId: selectedUser.student_employee_id,
                      name: selectedUser.name,
                    })
                  }
                >
                  <QrCode className="h-4 w-4" />
                  View QR
                </Button>

                {selectedUser.is_active ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeactivateUser}
                    disabled={loading}
                    className="gap-1.5"
                  >
                    <UserX className="h-4 w-4" />
                    {loading ? "Deactivating..." : "Deactivate User"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReactivateUser}
                    disabled={loading}
                    className="gap-1.5 border-success/40 text-success hover:bg-success/10"
                  >
                    <UserCheck className="h-4 w-4" />
                    {loading ? "Reactivating..." : "Reactivate User"}
                  </Button>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default AdminManage;
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
import { Eye, EyeOff } from "lucide-react";
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

const AdminManage = () => {
  const { user } = useAuth();
  const [functionType, setFunctionType] = useState<"create" | "edit">("create");

  const [fullName, setFullName] = useState("");
  const [id, setId] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

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
      const res = await axiosInstance.post("/admin/users", {
        student_employee_id: id,
        name: fullName,
        role,
        password,
        address,
        contact,
      });
      toast.success(res.data.message);
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
      const res = await axiosInstance.get("/admin/users", {
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
    const updates: any = {
      name: fullName,
      role,
      address,
      contact,
    };
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
        `/admin/users/${selectedUser.student_employee_id}`,
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

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!confirm(`Are you sure you want to delete ${selectedUser.name}?`)) return;
    setLoading(true);
    try {
      const res = await axiosInstance.delete(
        `/admin/users/${selectedUser.student_employee_id}`
      );
      toast.success(res.data.message);
      resetForm();
      setSearchResults((prev) =>
        prev.filter((u) => u.student_employee_id !== selectedUser.student_employee_id)
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Delete failed");
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
      <h2 className="font-heading text-lg font-bold text-foreground">User Management</h2>

      {/* Mode selector */}
      <div className="mt-4">
        <Label>Mode</Label>
        <Select value={functionType} onValueChange={(v) => setFunctionType(v as any)}>
          <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="create">Create User</SelectItem>
            <SelectItem value="edit">Edit / Search / Delete</SelectItem>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2"
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

      {/* Edit / Search / Delete */}
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
            <div className="mt-4 overflow-x-auto rounded-lg border bg-card p-4">
              <table className="w-full text-left text-sm text-foreground">
                <thead>
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Active</th>
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
                      <td className="px-3 py-2">{u.role}</td>
                      <td className="px-3 py-2">{u.is_active ? "Yes" : "No"}</td>
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
              <h3 className="font-semibold text-foreground">Editing: {selectedUser.name}</h3>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2"
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
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update User"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteUser}
                  disabled={loading}
                >
                  {loading ? "Deleting..." : "Delete User"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default AdminManage;
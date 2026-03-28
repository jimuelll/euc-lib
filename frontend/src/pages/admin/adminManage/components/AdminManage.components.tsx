import { useState, useEffect } from "react";
import { Eye, EyeOff, UserX, UserCheck, QrCode, Download, X } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
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
import { Badge } from "@/components/ui/badge";
import type { User, UserFormState, QrTarget } from "../AdminManage.types";
import { formatRole } from "../AdminManage.data";

// ─── QR Modal ─────────────────────────────────────────────────────────────────

interface QrModalProps {
  target: QrTarget;
  onClose: () => void;
}

export const QrModal = ({ target, onClose }: QrModalProps) => {
  const [qrUrl, setQrUrl]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadQr = async () => {
      try {
        const res = await axiosInstance.get(
          `/api/admin/users/${encodeURIComponent(target.studentId)}/barcode-png`,
          { responseType: "blob" }
        );
        objectUrl = URL.createObjectURL(res.data);
        setQrUrl(objectUrl);
      } catch (err) {
        console.error("Failed to load QR", err);
        toast.error("Failed to load QR code");
      } finally {
        setLoading(false);
      }
    };

    loadQr();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [target.studentId]);

  const handleDownload = async () => {
    try {
      const res = await axiosInstance.get(
        `/api/admin/users/${encodeURIComponent(target.studentId)}/barcode-png`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${target.studentId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      toast.error("Failed to download QR code");
    }
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

        <p className="font-semibold text-foreground text-center">{target.name}</p>
        <p className="text-xs text-muted-foreground">{target.studentId}</p>

        {loading ? (
          <div className="h-48 w-48 flex items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : qrUrl ? (
          <img
            src={qrUrl}
            alt={`QR code for ${target.studentId}`}
            className="h-48 w-48 rounded-lg border"
          />
        ) : (
          <div className="h-48 w-48 flex items-center justify-center text-sm text-destructive">
            Failed to load
          </div>
        )}

        <Button onClick={handleDownload} variant="outline" className="gap-1.5 w-full">
          <Download className="h-4 w-4" />
          Download PNG
        </Button>
      </div>
    </div>
  );
};

// ─── Shared: Password Field ───────────────────────────────────────────────────

interface PasswordFieldProps {
  label: string;
  value: string;
  showPassword: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
  onToggle?: () => void;
}

export const PasswordField = ({
  label,
  value,
  showPassword,
  placeholder,
  onChange,
  onToggle,
}: PasswordFieldProps) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  </div>
);

// ─── Shared: Role Select ──────────────────────────────────────────────────────

interface RoleSelectProps {
  value: string;
  allowedRoles: string[];
  onChange: (v: string) => void;
}

export const RoleSelect = ({ value, allowedRoles, onChange }: RoleSelectProps) => (
  <div className="space-y-2">
    <Label>Role</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
      <SelectContent>
        {allowedRoles.map((r) => (
          <SelectItem key={r} value={r}>{formatRole(r)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────

export const StatusBadge = ({ isActive }: { isActive?: number }) => (
  <Badge
    variant="outline"
    className={
      isActive
        ? "bg-success/10 text-success border-success/20"
        : "bg-muted/50 text-muted-foreground border-border"
    }
  >
    {isActive ? "Active" : "Inactive"}
  </Badge>
);

// ─── Create Form ──────────────────────────────────────────────────────────────

interface CreateFormProps {
  form: UserFormState;
  showPassword: boolean;
  allowedRoles: string[];
  loading: boolean;
  onField: <K extends keyof UserFormState>(key: K, value: string) => void;
  onTogglePassword: () => void;
  onSubmit: () => void;
  onReset: () => void;
}

export const CreateForm = ({
  form,
  showPassword,
  allowedRoles,
  loading,
  onField,
  onTogglePassword,
  onSubmit,
  onReset,
}: CreateFormProps) => (
  <form
    className="mt-6 space-y-4 rounded-lg border bg-card p-6"
    onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
  >
    <div className="space-y-2">
      <Label>Full Name</Label>
      <Input value={form.fullName} onChange={(e) => onField("fullName", e.target.value)} />
    </div>
    <div className="space-y-2">
      <Label>ID Number</Label>
      <Input value={form.id} onChange={(e) => onField("id", e.target.value)} />
    </div>
    <div className="space-y-2">
      <Label>Address</Label>
      <Input value={form.address} onChange={(e) => onField("address", e.target.value)} />
    </div>
    <div className="space-y-2">
      <Label>Contact</Label>
      <Input value={form.contact} onChange={(e) => onField("contact", e.target.value)} />
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <PasswordField
        label="Password"
        value={form.password}
        showPassword={showPassword}
        onChange={(v) => onField("password", v)}
        onToggle={onTogglePassword}
      />
      <PasswordField
        label="Re-Type Password"
        value={form.rePassword}
        showPassword={showPassword}
        onChange={(v) => onField("rePassword", v)}
      />
    </div>
    <RoleSelect value={form.role} allowedRoles={allowedRoles} onChange={(v) => onField("role", v)} />
    <div className="flex gap-2">
      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create User"}
      </Button>
      <Button type="button" variant="outline" onClick={onReset} disabled={loading}>
        Clear Form
      </Button>
    </div>
  </form>
);

// ─── Search Bar ───────────────────────────────────────────────────────────────

interface SearchBarProps {
  value: string;
  loading: boolean;
  onChange: (v: string) => void;
  onSearch: () => void;
}

export const SearchBar = ({ value, loading, onChange, onSearch }: SearchBarProps) => (
  <div className="mt-6 flex gap-2">
    <Input
      placeholder="Search by ID or Name"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onSearch()}
    />
    <Button onClick={onSearch} disabled={loading}>
      {loading ? "Searching..." : "Search"}
    </Button>
  </div>
);

// ─── Search Results Table ─────────────────────────────────────────────────────

interface SearchResultsTableProps {
  results: User[];
  onSelect: (u: User) => void;
}

export const SearchResultsTable = ({ results, onSelect }: SearchResultsTableProps) => (
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
        {results.map((u) => (
          <tr
            key={u.student_employee_id}
            className="border-t cursor-pointer hover:bg-accent/20"
            onClick={() => onSelect(u)}
          >
            <td className="px-3 py-2">{u.student_employee_id}</td>
            <td className="px-3 py-2">{u.name}</td>
            <td className="px-3 py-2 capitalize">{u.role.replace("_", " ")}</td>
            <td className="px-3 py-2"><StatusBadge isActive={u.is_active} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  selectedUser: User;
  form: UserFormState;
  showPassword: boolean;
  allowedRoles: string[];
  loading: boolean;
  onField: <K extends keyof UserFormState>(key: K, value: string) => void;
  onTogglePassword: () => void;
  onSubmit: () => void;
  onViewQr: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}

export const EditForm = ({
  selectedUser,
  form,
  showPassword,
  allowedRoles,
  loading,
  onField,
  onTogglePassword,
  onSubmit,
  onViewQr,
  onDeactivate,
  onReactivate,
}: EditFormProps) => (
  <form
    className="mt-6 space-y-4 rounded-lg border bg-card p-6"
    onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
  >
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-foreground">Editing: {selectedUser.name}</h3>
      <StatusBadge isActive={selectedUser.is_active} />
    </div>

    <div className="space-y-2">
      <Label>Full Name</Label>
      <Input value={form.fullName} onChange={(e) => onField("fullName", e.target.value)} />
    </div>
    <div className="space-y-2">
      <Label>ID Number</Label>
      <Input value={form.id} disabled />
    </div>
    <div className="space-y-2">
      <Label>Address</Label>
      <Input value={form.address} onChange={(e) => onField("address", e.target.value)} />
    </div>
    <div className="space-y-2">
      <Label>Contact</Label>
      <Input value={form.contact} onChange={(e) => onField("contact", e.target.value)} />
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <PasswordField
        label="New Password"
        value={form.password}
        showPassword={showPassword}
        placeholder="Leave empty to keep current"
        onChange={(v) => onField("password", v)}
        onToggle={onTogglePassword}
      />
      <PasswordField
        label="Re-Type Password"
        value={form.rePassword}
        showPassword={showPassword}
        placeholder="Leave empty to keep current"
        onChange={(v) => onField("rePassword", v)}
      />
    </div>
    <RoleSelect value={form.role} allowedRoles={allowedRoles} onChange={(v) => onField("role", v)} />

    <div className="flex gap-2 flex-wrap">
      <Button type="submit" disabled={loading}>
        {loading ? "Updating..." : "Update User"}
      </Button>

      <Button type="button" variant="outline" className="gap-1.5" onClick={onViewQr}>
        <QrCode className="h-4 w-4" />
        View QR
      </Button>

      {selectedUser.is_active ? (
        <Button
          type="button"
          variant="destructive"
          onClick={onDeactivate}
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
          onClick={onReactivate}
          disabled={loading}
          className="gap-1.5 border-success/40 text-success hover:bg-success/10"
        >
          <UserCheck className="h-4 w-4" />
          {loading ? "Reactivating..." : "Reactivate User"}
        </Button>
      )}
    </div>
  </form>
);
import { useState, useEffect } from "react";
import { Eye, EyeOff, QrCode, Download, X, Archive, ArchiveRestore } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import {
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import type { User, UserFormState, QrTarget } from "../AdminManage.types";
import { formatRole } from "../AdminManage.data";

// ─── Primitives ───────────────────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="h-px w-8 bg-warning shrink-0" />
    <p
      className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </p>
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <p
    className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60 mb-1.5"
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
  </p>
);

const ActionButton = ({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
  className = "",
}: {
  children:   React.ReactNode;
  onClick?:   () => void;
  type?:      "button" | "submit";
  disabled?:  boolean;
  variant?:   "primary" | "ghost" | "danger" | "success" | "warning";
  className?: string;
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] border transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/0.18)] hover:bg-primary/90",
    ghost:   "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
    danger:  "border-destructive/40 bg-transparent text-destructive hover:bg-destructive hover:text-destructive-foreground",
    success: "border-success/40 bg-transparent text-success hover:bg-success hover:text-success-foreground",
    warning: "border-warning/40 bg-transparent text-warning hover:bg-warning hover:text-warning-foreground",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </button>
  );
};

// ─── QR Modal ─────────────────────────────────────────────────────────────────

interface QrModalProps {
  target:  QrTarget;
  onClose: () => void;
}

export const QrModal = ({ target, onClose }: QrModalProps) => {
  const [qrUrl,   setQrUrl]   = useState<string | null>(null);
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
      const a   = document.createElement("a");
      a.href     = url;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border shadow-2xl flex flex-col items-center w-72 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full bg-primary relative">
          <div className="h-[3px] w-full bg-warning" />
          <div className="px-5 py-4 flex items-start justify-between">
            <div>
              <p
                className="text-[13px] font-bold tracking-tight text-primary-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {target.name}
              </p>
              <p className="text-[10px] tracking-[0.15em] text-primary-foreground/50 mt-0.5 uppercase"
                style={{ fontFamily: "var(--font-heading)" }}>
                {target.studentId}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-primary-foreground/40 hover:text-primary-foreground transition-colors mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col items-center gap-5 w-full">
          {loading ? (
            <div className="h-48 w-48 border border-border flex items-center justify-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40"
                style={{ fontFamily: "var(--font-heading)" }}>Loading…</p>
            </div>
          ) : qrUrl ? (
            <img src={qrUrl} alt={`QR code for ${target.studentId}`} className="h-48 w-48 border border-border" />
          ) : (
            <div className="h-48 w-48 border border-destructive/30 flex items-center justify-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-destructive"
                style={{ fontFamily: "var(--font-heading)" }}>Failed to load</p>
            </div>
          )}
          <ActionButton onClick={handleDownload} className="w-full justify-center">
            <Download className="h-3.5 w-3.5" />
            Download PNG
          </ActionButton>
        </div>
      </div>
    </div>
  );
};

// ─── Password Field ───────────────────────────────────────────────────────────

interface PasswordFieldProps {
  label:        string;
  value:        string;
  showPassword: boolean;
  placeholder?: string;
  onChange:     (v: string) => void;
  onToggle?:    () => void;
}

export const PasswordField = ({
  label, value, showPassword, placeholder, onChange, onToggle,
}: PasswordFieldProps) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-none"
      />
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  </div>
);

// ─── Role Select ──────────────────────────────────────────────────────────────

interface RoleSelectProps {
  value:        string;
  allowedRoles: string[];
  onChange:     (v: string) => void;
}

export const RoleSelect = ({ value, allowedRoles, onChange }: RoleSelectProps) => (
  <div>
    <FieldLabel>Role</FieldLabel>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="rounded-none"><SelectValue placeholder="Select role" /></SelectTrigger>
      <SelectContent className="rounded-none">
        {allowedRoles.map((r) => (
          <SelectItem key={r} value={r} className="rounded-none">{formatRole(r)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────

export const StatusBadge = ({ isArchived }: { isArchived: boolean }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] border ${
      isArchived
        ? "bg-warning/10 text-warning border-warning/30"
        : "bg-success/10 text-success border-success/30"
    }`}
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {isArchived ? <Archive className="h-2.5 w-2.5" /> : null}
    {isArchived ? "Archived" : "Active"}
  </span>
);

// ─── Create Form ──────────────────────────────────────────────────────────────

interface CreateFormProps {
  form:             UserFormState;
  showPassword:     boolean;
  allowedRoles:     string[];
  loading:          boolean;
  onField:          <K extends keyof UserFormState>(key: K, value: string) => void;
  onTogglePassword: () => void;
  onSubmit:         () => void;
  onReset:          () => void;
}

export const CreateForm = ({
  form, showPassword, allowedRoles, loading,
  onField, onTogglePassword, onSubmit, onReset,
}: CreateFormProps) => (
  <form
    className="admin-panel-surface admin-etched-border mt-6 border border-border bg-background"
    onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
  >
    <div className="border-b border-border px-6 py-4 bg-[linear-gradient(180deg,hsl(var(--primary)/0.07),transparent)]">
      <SectionLabel>New User Details</SectionLabel>
    </div>

    <div className="p-6 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel>Full Name</FieldLabel>
          <Input value={form.fullName} onChange={(e) => onField("fullName", e.target.value)} className="rounded-none" />
        </div>
        <div>
          <FieldLabel>ID Number</FieldLabel>
          <Input value={form.id} onChange={(e) => onField("id", e.target.value)} className="rounded-none" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel>Address</FieldLabel>
          <Input value={form.address} onChange={(e) => onField("address", e.target.value)} className="rounded-none" />
        </div>
        <div>
          <FieldLabel>Contact</FieldLabel>
          <Input value={form.contact} onChange={(e) => onField("contact", e.target.value)} className="rounded-none" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
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
    </div>

    <div className="flex gap-2 border-t border-border px-6 py-4">
      <ActionButton type="submit" disabled={loading}>
        {loading ? "Creating…" : "Create User"}
      </ActionButton>
      <ActionButton type="button" variant="ghost" onClick={onReset} disabled={loading}>
        Clear Form
      </ActionButton>
    </div>
  </form>
);

// ─── Search Bar ───────────────────────────────────────────────────────────────

interface SearchBarProps {
  value:            string;
  loading:          boolean;
  showArchived:     boolean;
  onChange:         (v: string) => void;
  onSearch:         () => void;
  onToggleArchived: () => void;
}

export const SearchBar = ({
  value, loading, showArchived, onChange, onSearch, onToggleArchived,
}: SearchBarProps) => (
  <div className="mt-6 space-y-0">
    {/* Section header with toggle */}
    <div className="flex items-center justify-between border border-border border-b-0 bg-[linear-gradient(180deg,hsl(var(--primary)/0.06),transparent)] px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="h-px w-4 bg-warning shrink-0" />
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {showArchived ? "Archived Users" : "Active Users"}
        </span>
      </div>
      <button
        onClick={onToggleArchived}
        className={`flex items-center gap-1.5 border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
          showArchived
            ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
            : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground"
        }`}
        style={{ fontFamily: "var(--font-heading)" }}
      >
        <Archive className="h-3 w-3" />
        {showArchived ? "Archived" : "Active"}
      </button>
    </div>

    {/* Archived banner */}
    {showArchived && (
      <div className="flex items-center gap-2.5 px-4 py-2 bg-warning/5 border border-t-0 border-warning/20">
        <Archive className="h-3 w-3 text-warning/60 shrink-0" />
        <p
          className="text-[10px] font-bold uppercase tracking-[0.15em] text-warning/70"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Showing archived users — restore to make them active again
        </p>
      </div>
    )}

    {/* Input */}
    <div className="flex gap-0">
      <Input
        placeholder="Search by ID or name…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
        className="rounded-none flex-1 border-r-0"
      />
      <ActionButton onClick={onSearch} disabled={loading}>
        {loading ? "Searching…" : "Search"}
      </ActionButton>
    </div>
  </div>
);

// ─── Search Results Table ─────────────────────────────────────────────────────

interface SearchResultsTableProps {
  results:      User[];
  showArchived: boolean;
  onSelect:     (u: User) => void;
}

export const SearchResultsTable = ({ results, showArchived, onSelect }: SearchResultsTableProps) => (
  <div className="mt-4 border border-border overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead className="border-b border-border bg-secondary/40">
        <tr>
          {["ID", "Name", "Role", "Status"].map((h) => (
            <th
              key={h}
              className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {results.map((u, i) => (
          <tr
            key={u.student_employee_id}
            className={`border-t border-border cursor-pointer transition-colors hover:bg-secondary/50 ${
              showArchived ? "opacity-70" : ""
            } ${i % 2 === 0 ? "bg-background" : "bg-secondary/20"}`}
            onClick={() => onSelect(u)}
          >
            <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{u.student_employee_id}</td>
            <td className="px-4 py-3 text-xs font-medium text-foreground">{u.name}</td>
            <td
              className="px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {u.role.replace("_", " ")}
            </td>
            <td className="px-4 py-3">
              <StatusBadge isArchived={showArchived} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  selectedUser:     User;
  form:             UserFormState;
  showPassword:     boolean;
  allowedRoles:     string[];
  loading:          boolean;
  showArchived:     boolean;
  onField:          <K extends keyof UserFormState>(key: K, value: string) => void;
  onTogglePassword: () => void;
  onSubmit:         () => void;
  onViewQr:         () => void;
  onArchive:        () => void;
  onRestore:        () => void;
}

export const EditForm = ({
  selectedUser, form, showPassword, allowedRoles, loading, showArchived,
  onField, onTogglePassword, onSubmit, onViewQr, onArchive, onRestore,
}: EditFormProps) => (
  <form
    className="mt-6 border border-border bg-background"
    onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
  >
    {/* Header band */}
    <div className="bg-primary relative overflow-hidden">
      <div className="h-[3px] w-full bg-warning" />
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <p
            className="text-[13px] font-bold tracking-tight text-primary-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {selectedUser.name}
          </p>
          <p
            className="text-[10px] uppercase tracking-[0.15em] text-primary-foreground/50 mt-0.5"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {selectedUser.student_employee_id}
          </p>
        </div>
        <StatusBadge isArchived={showArchived} />
      </div>
    </div>

    <div className="p-6 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel>Full Name</FieldLabel>
          <Input
            value={form.fullName}
            onChange={(e) => onField("fullName", e.target.value)}
            className="rounded-none"
            disabled={showArchived}
          />
        </div>
        <div>
          <FieldLabel>ID Number</FieldLabel>
          <Input value={form.id} disabled className="rounded-none opacity-50" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel>Address</FieldLabel>
          <Input
            value={form.address}
            onChange={(e) => onField("address", e.target.value)}
            className="rounded-none"
            disabled={showArchived}
          />
        </div>
        <div>
          <FieldLabel>Contact</FieldLabel>
          <Input
            value={form.contact}
            onChange={(e) => onField("contact", e.target.value)}
            className="rounded-none"
            disabled={showArchived}
          />
        </div>
      </div>

      {/* Password + role only editable in active mode */}
      {!showArchived && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
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
        </>
      )}
    </div>

    {/* Action bar */}
    <div className="border-t border-border px-6 py-4 flex gap-2 flex-wrap">
      {showArchived ? (
        <ActionButton type="button" variant="warning" onClick={onRestore} disabled={loading}>
          <ArchiveRestore className="h-3.5 w-3.5" />
          {loading ? "Restoring…" : "Restore User"}
        </ActionButton>
      ) : (
        <>
          <ActionButton type="submit" disabled={loading}>
            {loading ? "Updating…" : "Update User"}
          </ActionButton>

          <ActionButton type="button" variant="ghost" onClick={onViewQr}>
            <QrCode className="h-3.5 w-3.5" />
            View QR
          </ActionButton>

          <ActionButton
            type="button"
            variant="ghost"
            onClick={onArchive}
            disabled={loading}
            className="ml-auto border-border/50 text-muted-foreground/50 hover:border-warning/40 hover:text-warning"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </ActionButton>
        </>
      )}
    </div>
  </form>
);

import { useState, useEffect } from "react";
import { Eye, EyeOff, QrCode, Download, Printer, X, Archive, ArchiveRestore, MoreHorizontal, Search, UserPlus } from "lucide-react";
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
import type { AcademicProgram, AcademicTerm } from "../useAdminManage";
import { formatRole } from "../AdminManage.data";
import { printCodeLabel } from "@/utils/printCodeLabel";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

  const handlePrint = () => {
    if (!qrUrl) return toast.error("The code is still loading.");
    if (!printCodeLabel({ imageUrl: qrUrl, title: target.name, code: target.studentId, kind: "Library patron" })) toast.error("Allow pop-ups to print this label.");
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
          <ActionButton onClick={handlePrint} disabled={!qrUrl} className="w-full justify-center">
            <Printer className="h-3.5 w-3.5" />
            Print label
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

const ProgramSelect = ({ value, programs, onChange, disabled = false }: { value: string; programs: AcademicProgram[]; onChange: (value: string) => void; disabled?: boolean }) => (
  <div>
    <FieldLabel>Program / Course <span className="normal-case tracking-normal">(optional)</span></FieldLabel>
    <Select value={value || "__none"} onValueChange={(next) => onChange(next === "__none" ? "" : next)} disabled={disabled}>
      <SelectTrigger className="rounded-none"><SelectValue placeholder="No program / course selected" /></SelectTrigger>
      <SelectContent className="rounded-none">
        <SelectItem value="__none" className="rounded-none">No program / course</SelectItem>
        {programs.map((program) => <SelectItem key={program.id} value={String(program.id)} className="rounded-none">{program.name}</SelectItem>)}
      </SelectContent>
    </Select>
    {!programs.length ? <p className="mt-1.5 text-xs text-muted-foreground">No choices configured yet. An administrator can add them in Academic Calendar.</p> : null}
  </div>
);
const TermSelect = ({ value, terms, onChange, disabled = false }: { value: string; terms: AcademicTerm[]; onChange: (value: string) => void; disabled?: boolean }) => <div><FieldLabel>Academic term <span className="normal-case tracking-normal">(students)</span></FieldLabel><Select value={value || "__current"} onValueChange={v => onChange(v === "__current" ? "" : v)} disabled={disabled}><SelectTrigger className="rounded-none"><SelectValue placeholder="Current term" /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="__current">Current term (automatic)</SelectItem>{terms.map(term => <SelectItem key={term.id} value={String(term.id)}>{term.name}{term.is_current ? " · Current" : ""}</SelectItem>)}</SelectContent></Select></div>;

// ─── Status Badge ─────────────────────────────────────────────────────────────

export const StatusBadge = ({ status }: { status: "active" | "inactive" | "archived" }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] border ${
      status === "archived"
        ? "bg-warning/10 text-warning border-warning/30"
        : status === "active"
          ? "bg-success/10 text-success border-success/30"
          : "bg-muted text-muted-foreground border-border"
    }`}
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {status === "archived" ? <Archive className="h-2.5 w-2.5" /> : null}
    {status === "archived" ? "Archived" : status === "active" ? "Active" : "Inactive"}
  </span>
);

// ─── Create Form ──────────────────────────────────────────────────────────────

interface CreateFormProps {
  form:             UserFormState;
  showPassword:     boolean;
  allowedRoles:     string[];
  programs:         AcademicProgram[];
  terms:            AcademicTerm[];
  loading:          boolean;
  onField:          <K extends keyof UserFormState>(key: K, value: string) => void;
  onTogglePassword: () => void;
  onSubmit:         () => void;
  onReset:          () => void;
  embedded?:        boolean;
}

export const CreateForm = ({
  form, showPassword, allowedRoles, programs, terms, loading,
  onField, onTogglePassword, onSubmit, onReset, embedded = false,
}: CreateFormProps) => (
  <form
    className={embedded ? "py-5" : "admin-panel-surface admin-etched-border mt-6 border border-border bg-background"}
    onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
  >
    {!embedded && <div className="border-b border-border px-6 py-4 bg-[linear-gradient(180deg,hsl(var(--primary)/0.07),transparent)]">
      <SectionLabel>New User Details</SectionLabel>
    </div>}

    <div className={embedded ? "space-y-5" : "p-6 space-y-5"}>
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
      {form.role === "student" ? <><ProgramSelect value={form.programId} programs={programs} onChange={(value) => onField("programId", value)} /><TermSelect value={form.academicTermId} terms={terms} onChange={(value) => onField("academicTermId", value)} /></> : null}
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

    <div className={embedded ? "mt-6 flex gap-2 border-t border-border py-4" : "flex gap-2 border-t border-border px-6 py-4"}>
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
  roleFilter:       string;
  statusFilter:     string;
  allowedRoles:     string[];
  onChange:         (v: string) => void;
  onRoleFilterChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onSearch:         () => void;
  onArchivedViewChange: (archived: boolean) => void;
  onCreate: () => void;
}

export const SearchBar = ({
  value, loading, showArchived, roleFilter, statusFilter, allowedRoles, onChange,
  onRoleFilterChange, onStatusFilterChange, onSearch, onArchivedViewChange, onCreate,
}: SearchBarProps) => (
  <div className="flex flex-col gap-2 border border-border bg-card p-3 lg:flex-row lg:items-center">
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input placeholder="Search by ID or name…" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }} className="h-11 rounded-none pl-9" />
    </div>
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <select aria-label="Filter users by role" value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value)} className="h-11 min-w-32 border border-border bg-background px-3 text-sm"><option value="all">All roles</option>{allowedRoles.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select>
      {!showArchived ? <select aria-label="Filter users by account status" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} className="h-11 min-w-32 border border-border bg-background px-3 text-sm"><option value="all">All access</option><option value="active">Active</option><option value="inactive">Inactive</option></select> : null}
      <select aria-label="Filter archived users" value={showArchived ? "archived" : "current"} onChange={(event) => onArchivedViewChange(event.target.value === "archived")} className="h-11 min-w-32 border border-border bg-background px-3 text-sm"><option value="current">Current users</option><option value="archived">Archived users</option></select>
    </div>
    <div className="flex gap-2">
      <Button type="button" variant="outline" className="h-11 flex-1 rounded-none lg:flex-none" onClick={() => onSearch()} disabled={loading}><Search className="mr-2 h-4 w-4" />Search</Button>
      <Button type="button" className="h-11 flex-1 rounded-none lg:flex-none" onClick={onCreate}><UserPlus className="mr-2 h-4 w-4" />Create user</Button>
    </div>
  </div>
);

// ─── Search Results Table ─────────────────────────────────────────────────────

interface SearchResultsTableProps {
  results:      User[];
  showArchived: boolean;
  onSelect:     (u: User) => void;
  onViewQr:     (u: User) => void;
}

export const SearchResultsTable = ({ results, showArchived, onSelect, onViewQr }: SearchResultsTableProps) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead className="border-b border-border bg-secondary/40">
        <tr>
          {["User", "Program / Course", "Role", "Account", ""].map((h) => (
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
        {results.map((u) => (
          <tr
            key={u.student_employee_id}
            tabIndex={0}
            className={`border-t border-border cursor-pointer transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none ${showArchived ? "bg-muted/20 text-muted-foreground" : "bg-background"}`}
            onClick={() => onSelect(u)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(u); } }}
          >
            <td className="max-w-[320px] px-4 py-3"><p className="truncate text-sm font-semibold text-foreground">{u.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{u.student_employee_id}</p></td>
            <td className="px-4 py-3 text-sm text-muted-foreground">{u.program_course ?? "—"}</td>
            <td
              className="px-4 py-3 text-xs font-medium capitalize text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {formatRole(u.role)}
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={showArchived ? "archived" : u.is_active === 0 ? "inactive" : "active"} />
            </td>
            <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${u.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onSelect(u)}>{showArchived ? "Review account" : "Edit account"}</DropdownMenuItem>{!showArchived ? <DropdownMenuItem onClick={() => onViewQr(u)}><QrCode className="mr-2 h-4 w-4" />View QR code</DropdownMenuItem> : null}</DropdownMenuContent>
              </DropdownMenu>
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
  programs:         AcademicProgram[];
  terms:            AcademicTerm[];
  loading:          boolean;
  showArchived:     boolean;
  onField:          <K extends keyof UserFormState>(key: K, value: string) => void;
  onTogglePassword: () => void;
  onSubmit:         () => void;
  onViewQr:         () => void;
  onArchive:        () => void;
  onRestore:        () => void;
  embedded?:        boolean;
}

export const EditForm = ({
  selectedUser, form, showPassword, allowedRoles, programs, terms, loading, showArchived,
  onField, onTogglePassword, onSubmit, onViewQr, onArchive, onRestore, embedded = false,
}: EditFormProps) => (
  <form
    className={embedded ? "py-5" : "mt-6 border border-border bg-background"}
    onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
  >
    {/* Header band */}
    {!embedded && <div className="bg-primary relative overflow-hidden">
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
        <StatusBadge status={showArchived ? "archived" : selectedUser.is_active === 0 ? "inactive" : "active"} />
      </div>
    </div>}

    <div className={embedded ? "space-y-5" : "p-6 space-y-5"}>
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

      {form.role === "student" ? <><ProgramSelect value={form.programId} programs={programs} onChange={(value) => onField("programId", value)} disabled={showArchived} /><TermSelect value={form.academicTermId} terms={terms} onChange={(value) => onField("academicTermId", value)} disabled={showArchived} /></> : null}

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
    <div className={embedded ? "mt-6 flex flex-wrap gap-2 border-t border-border py-4" : "border-t border-border px-6 py-4 flex gap-2 flex-wrap"}>
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

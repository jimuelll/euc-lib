import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import type { FunctionType, User, UserFormState, QrTarget } from "./AdminManage.types";
import {
  QrModal,
  CreateForm,
  SearchBar,
  SearchResultsTable,
  EditForm,
} from "./components/AdminManage.components";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdminManageBuilderProps {
  functionType:         FunctionType;
  onFunctionTypeChange: (v: FunctionType) => void;
  form:                 UserFormState;
  showPassword:         boolean;
  allowedRoles:         string[];
  loading:              boolean;
  onField:              <K extends keyof UserFormState>(key: K, value: string) => void;
  onTogglePassword:     () => void;
  onResetForm:          () => void;
  searchQuery:          string;
  onSearchQueryChange:  (v: string) => void;
  searchResults:        User[];
  onSearch:             () => void;
  showArchived:         boolean;
  onToggleArchived:     () => void;
  selectedUser:         User | null;
  onSelectUser:         (u: User) => void;
  onCreateUser:         () => void;
  onUpdateUser:         () => void;
  onArchiveUser:        () => void;
  onRestoreUser:        () => void;
  qrTarget:             QrTarget | null;
  onSetQrTarget:        (v: QrTarget | null) => void;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

const AdminManageBuilder = ({
  functionType,
  onFunctionTypeChange,
  form,
  showPassword,
  allowedRoles,
  loading,
  onField,
  onTogglePassword,
  onResetForm,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSearch,
  showArchived,
  onToggleArchived,
  selectedUser,
  onSelectUser,
  onCreateUser,
  onUpdateUser,
  onArchiveUser,
  onRestoreUser,
  qrTarget,
  onSetQrTarget,
}: AdminManageBuilderProps) => (
  <div className="max-w-3xl">

    {qrTarget && (
      <QrModal target={qrTarget} onClose={() => onSetQrTarget(null)} />
    )}

    {/* ── Section heading ── */}
    <div className="flex items-center gap-3 mb-1">
      <div className="h-px w-6 bg-warning shrink-0" />
      <p
        className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Administration
      </p>
    </div>
    <h2
      className="text-xl font-bold tracking-tight text-foreground mb-6"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      User Management
    </h2>

    {/* ── Mode selector ── */}
    <div className="border border-border bg-background">
      <div className="border-b border-border px-5 py-3 bg-secondary/30 flex items-center gap-3">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Mode
        </p>
      </div>
      <div className="px-5 py-4">
        <Select
          value={functionType}
          onValueChange={(v) => onFunctionTypeChange(v as FunctionType)}
        >
          <SelectTrigger className="rounded-none max-w-xs">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="create" className="rounded-none">Create User</SelectItem>
            <SelectItem value="edit"   className="rounded-none">Edit / Search</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    {/* ── Create mode ── */}
    {functionType === "create" && (
      <CreateForm
        form={form}
        showPassword={showPassword}
        allowedRoles={allowedRoles}
        loading={loading}
        onField={onField}
        onTogglePassword={onTogglePassword}
        onSubmit={onCreateUser}
        onReset={onResetForm}
      />
    )}

    {/* ── Edit / Search mode ── */}
    {functionType === "edit" && (
      <>
        <SearchBar
          value={searchQuery}
          loading={loading}
          showArchived={showArchived}
          onChange={onSearchQueryChange}
          onSearch={onSearch}
          onToggleArchived={onToggleArchived}
        />

        {searchResults.length > 0 && (
          <SearchResultsTable
            results={searchResults}
            showArchived={showArchived}
            onSelect={onSelectUser}
          />
        )}

        {selectedUser && (
          <EditForm
            selectedUser={selectedUser}
            form={form}
            showPassword={showPassword}
            allowedRoles={allowedRoles}
            loading={loading}
            showArchived={showArchived}
            onField={onField}
            onTogglePassword={onTogglePassword}
            onSubmit={onUpdateUser}
            onViewQr={() => onSetQrTarget({
              studentId: selectedUser.student_employee_id,
              name:      selectedUser.name,
            })}
            onArchive={onArchiveUser}
            onRestore={onRestoreUser}
          />
        )}
      </>
    )}
  </div>
);

export default AdminManageBuilder;
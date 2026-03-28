import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Label,
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
  functionType: FunctionType;
  onFunctionTypeChange: (v: FunctionType) => void;

  form: UserFormState;
  showPassword: boolean;
  allowedRoles: string[];
  loading: boolean;
  onField: <K extends keyof UserFormState>(key: K, value: string) => void;
  onTogglePassword: () => void;
  onResetForm: () => void;

  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  searchResults: User[];
  onSearch: () => void;

  selectedUser: User | null;
  onSelectUser: (u: User) => void;

  onCreateUser: () => void;
  onUpdateUser: () => void;
  onDeactivateUser: () => void;
  onReactivateUser: () => void;

  qrTarget: QrTarget | null;
  onSetQrTarget: (v: QrTarget | null) => void;
}

// ─── Builder (pure presentational) ───────────────────────────────────────────

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
  selectedUser,
  onSelectUser,
  onCreateUser,
  onUpdateUser,
  onDeactivateUser,
  onReactivateUser,
  qrTarget,
  onSetQrTarget,
}: AdminManageBuilderProps) => (
  <div className="max-w-3xl">

    {/* QR Modal */}
    {qrTarget && (
      <QrModal target={qrTarget} onClose={() => onSetQrTarget(null)} />
    )}

    <h2 className="font-heading text-lg font-bold text-foreground">User Management</h2>

    {/* Mode selector */}
    <div className="mt-4">
      <Label>Mode</Label>
      <Select
        value={functionType}
        onValueChange={(v) => onFunctionTypeChange(v as FunctionType)}
      >
        <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="create">Create User</SelectItem>
          <SelectItem value="edit">Edit / Search / Deactivate</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* Create mode */}
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

    {/* Edit / Search / Deactivate mode */}
    {functionType === "edit" && (
      <>
        <SearchBar
          value={searchQuery}
          loading={loading}
          onChange={onSearchQueryChange}
          onSearch={onSearch}
        />

        {searchResults.length > 0 && (
          <SearchResultsTable results={searchResults} onSelect={onSelectUser} />
        )}

        {selectedUser && (
          <EditForm
            selectedUser={selectedUser}
            form={form}
            showPassword={showPassword}
            allowedRoles={allowedRoles}
            loading={loading}
            onField={onField}
            onTogglePassword={onTogglePassword}
            onSubmit={onUpdateUser}
            onViewQr={() => onSetQrTarget({
              studentId: selectedUser.student_employee_id,
              name: selectedUser.name,
            })}
            onDeactivate={onDeactivateUser}
            onReactivate={onReactivateUser}
          />
        )}
      </>
    )}
  </div>
);

export default AdminManageBuilder;
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { AdminPage, AdminPanel } from "../components/AdminPage";
import type { FunctionType, QrTarget, User, UserFormState } from "./AdminManage.types";
import {
  CreateForm,
  EditForm,
  QrModal,
  SearchBar,
  SearchResultsTable,
} from "./components/AdminManage.components";

interface AdminManageBuilderProps {
  functionType: FunctionType;
  onFunctionTypeChange: (v: FunctionType) => void;
  form: UserFormState;
  showPassword: boolean;
  currentUserRole: string;
  allowedRoles: string[];
  loading: boolean;
  onField: <K extends keyof UserFormState>(key: K, value: string) => void;
  onTogglePassword: () => void;
  onResetForm: () => void;
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  searchResults: User[];
  onSearch: () => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  selectedUser: User | null;
  onSelectUser: (u: User) => void;
  onCreateUser: () => void;
  onUpdateUser: () => void;
  onArchiveUser: () => void;
  onRestoreUser: () => void;
  onBulkDeactivateStudentLikeUsers: () => void;
  qrTarget: QrTarget | null;
  onSetQrTarget: (v: QrTarget | null) => void;
}

const AdminManageBuilder = ({
  functionType,
  onFunctionTypeChange,
  form,
  showPassword,
  currentUserRole,
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
  onBulkDeactivateStudentLikeUsers,
  qrTarget,
  onSetQrTarget,
}: AdminManageBuilderProps) => (
  <AdminPage
    eyebrow="Administration"
    title="User Management"
    description="Create, update, archive, and review library users in a single workspace built for quick scanning and fewer layout jumps."
  >
    {qrTarget ? <QrModal target={qrTarget} onClose={() => onSetQrTarget(null)} /> : null}

    <AdminPanel
      title="Mode"
      description="Switch between creating a new user and searching or editing an existing one."
      className="max-w-xl"
    >
      <div className="max-w-xs">
        <Select value={functionType} onValueChange={(v) => onFunctionTypeChange(v as FunctionType)}>
          <SelectTrigger>
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="create">Create User</SelectItem>
            <SelectItem value="edit">Edit / Search</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </AdminPanel>

    {functionType === "create" ? (
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
    ) : (
      <>
        <SearchBar
          currentUserRole={currentUserRole}
          value={searchQuery}
          loading={loading}
          showArchived={showArchived}
          onChange={onSearchQueryChange}
          onSearch={onSearch}
          onToggleArchived={onToggleArchived}
          onBulkDeactivateStudentLikeUsers={onBulkDeactivateStudentLikeUsers}
        />

        {searchResults.length > 0 ? (
          <SearchResultsTable
            results={searchResults}
            showArchived={showArchived}
            onSelect={onSelectUser}
          />
        ) : null}

        {selectedUser ? (
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
            onViewQr={() =>
              onSetQrTarget({
                studentId: selectedUser.student_employee_id,
                name: selectedUser.name,
              })
            }
            onArchive={onArchiveUser}
            onRestore={onRestoreUser}
          />
        ) : null}
      </>
    )}
  </AdminPage>
);

export default AdminManageBuilder;

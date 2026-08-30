import { useEffect, useRef } from "react";
import { Search, UserPlus } from "lucide-react";
import { AdminPage, AdminPanel } from "../components/AdminPage";
import { SegmentedNavigation } from "../components/SegmentedNavigation";
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
}: AdminManageBuilderProps) => {
  const editFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedUser) {
      editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedUser]);

  return (
    <AdminPage eyebrow="Administration" title="User Management">
      {qrTarget ? <QrModal target={qrTarget} onClose={() => onSetQrTarget(null)} /> : null}

      <AdminPanel
        title="User records"
        className="border-none bg-transparent shadow-none"
        contentClassName="p-0"
      >
        <div className="mt-5">
          <SegmentedNavigation
            ariaLabel="User management mode"
            value={functionType}
            onChange={onFunctionTypeChange}
            segments={[
              { value: "edit", label: "User Records", icon: Search },
              { value: "create", label: "Create User", icon: UserPlus },
            ]}
          />
        </div>

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
              <div ref={editFormRef} className="scroll-mt-6">
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
              </div>
            ) : null}
          </>
        )}
      </AdminPanel>
    </AdminPage>
  );
};

export default AdminManageBuilder;

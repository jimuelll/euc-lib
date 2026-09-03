import { useEffect, useRef } from "react";
import { Search, UserPlus } from "lucide-react";
import { AdminPage, AdminPanel } from "../components/AdminPage";
import { SegmentedNavigation } from "../components/SegmentedNavigation";
import { Skeleton } from "@/components/ui/skeleton";
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
  roleFilter: string;
  onRoleFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  searchResults: User[];
  userPagination: { page: number; limit: number; total: number; totalPages: number };
  onSearch: (page?: number) => void;
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
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  searchResults,
  userPagination,
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
              roleFilter={roleFilter}
              statusFilter={statusFilter}
              allowedRoles={allowedRoles}
              onChange={onSearchQueryChange}
              onRoleFilterChange={onRoleFilterChange}
              onStatusFilterChange={onStatusFilterChange}
              onSearch={onSearch}
              onToggleArchived={onToggleArchived}
              onBulkDeactivateStudentLikeUsers={onBulkDeactivateStudentLikeUsers}
            />

            {loading ? <div className="mt-4 space-y-2 border border-border p-4" aria-label="Loading user records">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-12 w-full rounded-none" />)}</div> : null}
            {!loading && searchResults.length > 0 ? (
              <SearchResultsTable
                results={searchResults}
                showArchived={showArchived}
                onSelect={onSelectUser}
              />
            ) : null}
            {!loading && searchResults.length > 0 ? <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground"><button type="button" className="border border-border px-3 py-2 disabled:opacity-50" disabled={userPagination.page <= 1} onClick={() => onSearch(userPagination.page - 1)}>Previous</button><span>Page {userPagination.page} of {userPagination.totalPages} · {userPagination.total} user(s)</span><button type="button" className="border border-border px-3 py-2 disabled:opacity-50" disabled={userPagination.page >= userPagination.totalPages} onClick={() => onSearch(userPagination.page + 1)}>Next</button></div> : null}

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

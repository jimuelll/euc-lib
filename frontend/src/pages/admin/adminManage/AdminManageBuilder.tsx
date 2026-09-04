import { useEffect, useRef } from "react";
import { Search, UserPlus } from "lucide-react";
import { AdminPage, AdminPanel } from "../components/AdminPage";
import { SegmentedNavigation } from "../components/SegmentedNavigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { FunctionType, QrTarget, User, UserFormState } from "./AdminManage.types";
import type { AcademicProgram, AcademicTerm } from "./useAdminManage";
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
  allowedRoles: string[];
  programs: AcademicProgram[];
  terms: AcademicTerm[];
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
  qrTarget: QrTarget | null;
  onSetQrTarget: (v: QrTarget | null) => void;
}

const AdminManageBuilder = ({
  functionType,
  onFunctionTypeChange,
  form,
  showPassword,
  allowedRoles,
  programs,
  terms,
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
            programs={programs}
            terms={terms}
            loading={loading}
            onField={onField}
            onTogglePassword={onTogglePassword}
            onSubmit={onCreateUser}
            onReset={onResetForm}
          />
        ) : (
          <>
            <SearchBar
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
            />

            {loading ? <div className="mt-4 space-y-2 border border-border p-4" aria-label="Loading user records">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-12 w-full rounded-none" />)}</div> : null}
            {!loading && searchResults.length > 0 ? (
              <SearchResultsTable
                results={searchResults}
                showArchived={showArchived}
                onSelect={onSelectUser}
              />
            ) : null}
            {!loading && searchResults.length > 0 ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground"><button type="button" className="border border-border bg-background px-3 py-2 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40" disabled={userPagination.page <= 1} onClick={() => onSearch(userPagination.page - 1)}>Previous</button><span className="px-2 text-center text-xs tabular-nums">Page {userPagination.page} of {userPagination.totalPages} <span className="text-muted-foreground/60">·</span> {userPagination.total} user{userPagination.total === 1 ? "" : "s"}</span><button type="button" className="border border-border bg-background px-3 py-2 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40" disabled={userPagination.page >= userPagination.totalPages} onClick={() => onSearch(userPagination.page + 1)}>Next</button></div> : null}

            {selectedUser ? (
              <div ref={editFormRef} className="scroll-mt-6">
                <EditForm
                  selectedUser={selectedUser}
                  form={form}
                  showPassword={showPassword}
                  allowedRoles={allowedRoles}
                  programs={programs}
                  terms={terms}
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

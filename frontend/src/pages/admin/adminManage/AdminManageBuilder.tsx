import { useState } from "react";
import { Archive, Users } from "lucide-react";
import { AdminPage, AdminPanel } from "../components/AdminPage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { QrTarget, User, UserFormState } from "./AdminManage.types";
import type { AcademicProgram, AcademicTerm } from "./useAdminManage";
import { CreateForm, EditForm, QrModal, SearchBar, SearchResultsTable } from "./components/AdminManage.components";

interface AdminManageBuilderProps {
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
  onArchivedViewChange: (archived: boolean) => void;
  selectedUser: User | null;
  onSelectUser: (u: User) => void;
  onCreateUser: () => Promise<boolean>;
  onUpdateUser: () => Promise<boolean>;
  onArchiveUser: () => Promise<boolean>;
  onRestoreUser: () => Promise<boolean>;
  qrTarget: QrTarget | null;
  onSetQrTarget: (v: QrTarget | null) => void;
}

const AdminManageBuilder = ({
  form, showPassword, allowedRoles, programs, terms, loading, onField,
  onTogglePassword, onResetForm, searchQuery, onSearchQueryChange, roleFilter,
  onRoleFilterChange, statusFilter, onStatusFilterChange, searchResults,
  userPagination, onSearch, showArchived, onArchivedViewChange, selectedUser,
  onSelectUser, onCreateUser, onUpdateUser, onArchiveUser, onRestoreUser,
  qrTarget, onSetQrTarget,
}: AdminManageBuilderProps) => {
  const [sheetMode, setSheetMode] = useState<"create" | "edit" | null>(null);

  const closeSheet = () => {
    setSheetMode(null);
    onResetForm();
  };
  const openCreate = () => {
    onResetForm();
    setSheetMode("create");
  };
  const openEdit = (user: User) => {
    onSelectUser(user);
    setSheetMode("edit");
  };
  const viewQr = (user: User) => onSetQrTarget({ studentId: user.student_employee_id, name: user.name });

  return (
    <AdminPage eyebrow="Administration" title="User Management">
      {qrTarget ? <QrModal target={qrTarget} onClose={() => onSetQrTarget(null)} /> : null}

      <AdminPanel title="User records" className="border-none bg-transparent shadow-none" contentClassName="p-0">
        <div className="mt-5 space-y-4">
          <SearchBar
            value={searchQuery} loading={loading} showArchived={showArchived}
            roleFilter={roleFilter} statusFilter={statusFilter} allowedRoles={allowedRoles}
            onChange={onSearchQueryChange} onRoleFilterChange={onRoleFilterChange}
            onStatusFilterChange={onStatusFilterChange} onSearch={onSearch}
            onArchivedViewChange={(archived) => { closeSheet(); onArchivedViewChange(archived); }} onCreate={openCreate}
          />

          {showArchived ? (
            <div className="flex items-center gap-2 border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-foreground">
              <Archive className="h-4 w-4 text-warning" />
              Archived accounts cannot sign in until restored.
            </div>
          ) : null}

          <div className="overflow-hidden border border-border bg-card">
            {loading ? (
              <div className="space-y-2 p-4" aria-label="Loading user records">
                {[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-14 w-full rounded-none" />)}
              </div>
            ) : searchResults.length ? (
              <SearchResultsTable results={searchResults} showArchived={showArchived} onSelect={openEdit} onViewQr={viewQr} />
            ) : (
              <div className="px-5 py-14 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-medium text-foreground">No user records found</p>
                <p className="mt-1 text-sm text-muted-foreground">Adjust the search or filters, or create a new user.</p>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border bg-muted/15 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>{userPagination.total} user{userPagination.total === 1 ? "" : "s"}</span>
              <div className="flex items-center justify-between gap-3">
                <Button size="sm" variant="outline" className="rounded-none" disabled={userPagination.page <= 1 || loading} onClick={() => onSearch(userPagination.page - 1)}>Previous</Button>
                <span className="tabular-nums">Page {userPagination.page} of {userPagination.totalPages}</span>
                <Button size="sm" variant="outline" className="rounded-none" disabled={userPagination.page >= userPagination.totalPages || loading} onClick={() => onSearch(userPagination.page + 1)}>Next</Button>
              </div>
            </div>
          </div>
        </div>
      </AdminPanel>

      <Sheet open={sheetMode !== null} onOpenChange={(open) => { if (!open && !loading) closeSheet(); }}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
          <SheetHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 pr-12 text-left text-primary-foreground">
            <SheetTitle className="text-primary-foreground">{sheetMode === "create" ? "Create user" : selectedUser?.name || "User record"}</SheetTitle>
            <SheetDescription className="text-primary-foreground/70">
              {sheetMode === "create" ? "Create an account and assign its library access role." : `${selectedUser?.student_employee_id || ""} · Account details and access.`}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6">
            {sheetMode === "create" ? (
              <CreateForm embedded form={form} showPassword={showPassword} allowedRoles={allowedRoles} programs={programs} terms={terms} loading={loading} onField={onField} onTogglePassword={onTogglePassword} onSubmit={async () => { if (await onCreateUser()) setSheetMode(null); }} onReset={onResetForm} />
            ) : selectedUser ? (
              <EditForm embedded selectedUser={selectedUser} form={form} showPassword={showPassword} allowedRoles={allowedRoles} programs={programs} terms={terms} loading={loading} showArchived={showArchived} onField={onField} onTogglePassword={onTogglePassword} onSubmit={async () => { if (await onUpdateUser()) setSheetMode(null); }} onViewQr={() => viewQr(selectedUser)} onArchive={async () => { if (await onArchiveUser()) setSheetMode(null); }} onRestore={async () => { if (await onRestoreUser()) setSheetMode(null); }} />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </AdminPage>
  );
};

export default AdminManageBuilder;

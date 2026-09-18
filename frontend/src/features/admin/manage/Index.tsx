import { useAdminManage } from "./useAdminManage";
import AdminManageBuilder from "./AdminManageBuilder";

const AdminManage = () => {
  const {
    form,
    setField,
    showPassword,
    togglePassword,
    resetForm,
    allowedRoles,
    programs,
    terms,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    searchResults,
    userPagination,
    handleSearchUsers,
    showArchived,
    setArchivedView,
    selectedUser,
    selectUserForEdit,
    loading,
    handleCreateUser,
    handleUpdateUser,
    handleArchiveUser,
    handleRestoreUser,
    confirmDialog,
    qrTarget,
    setQrTarget,
  } = useAdminManage();

  return (
    <>
      {confirmDialog}
      <AdminManageBuilder
        form={form}
        showPassword={showPassword}
        allowedRoles={allowedRoles}
        programs={programs}
        terms={terms}
        loading={loading}
        onField={setField}
        onTogglePassword={togglePassword}
        onResetForm={resetForm}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchResults={searchResults}
        userPagination={userPagination}
        onSearch={handleSearchUsers}
        showArchived={showArchived}
        onArchivedViewChange={setArchivedView}
        selectedUser={selectedUser}
        onSelectUser={selectUserForEdit}
        onCreateUser={handleCreateUser}
        onUpdateUser={handleUpdateUser}
        onArchiveUser={handleArchiveUser}
        onRestoreUser={handleRestoreUser}
        qrTarget={qrTarget}
        onSetQrTarget={setQrTarget}
      />
    </>
  );
};

export default AdminManage;

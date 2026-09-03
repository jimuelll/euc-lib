import { useAdminManage } from "./useAdminManage";
import AdminManageBuilder from "./AdminManageBuilder";

const AdminManage = () => {
  const {
    functionType,
    setFunctionType,
    form,
    setField,
    showPassword,
    togglePassword,
    resetForm,
    currentUserRole,
    allowedRoles,
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
    handleToggleArchived,
    selectedUser,
    selectUserForEdit,
    loading,
    handleCreateUser,
    handleUpdateUser,
    handleArchiveUser,
    handleRestoreUser,
    handleBulkDeactivateStudentLikeUsers,
    confirmDialog,
    qrTarget,
    setQrTarget,
  } = useAdminManage();

  return (
    <>
      {confirmDialog}
      <AdminManageBuilder
        functionType={functionType}
        onFunctionTypeChange={(v) => { setFunctionType(v); resetForm(); }}
        form={form}
        showPassword={showPassword}
        currentUserRole={currentUserRole}
        allowedRoles={allowedRoles}
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
        onToggleArchived={handleToggleArchived}
        selectedUser={selectedUser}
        onSelectUser={selectUserForEdit}
        onCreateUser={handleCreateUser}
        onUpdateUser={handleUpdateUser}
        onArchiveUser={handleArchiveUser}
        onRestoreUser={handleRestoreUser}
        onBulkDeactivateStudentLikeUsers={handleBulkDeactivateStudentLikeUsers}
        qrTarget={qrTarget}
        onSetQrTarget={setQrTarget}
      />
    </>
  );
};

export default AdminManage;

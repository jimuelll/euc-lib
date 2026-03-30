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
    allowedRoles,
    searchQuery,
    setSearchQuery,
    searchResults,
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
        allowedRoles={allowedRoles}
        loading={loading}
        onField={setField}
        onTogglePassword={togglePassword}
        onResetForm={resetForm}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchResults={searchResults}
        onSearch={handleSearchUsers}
        showArchived={showArchived}
        onToggleArchived={handleToggleArchived}
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

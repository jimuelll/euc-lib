import { useAdminManage } from "./useAdminManage";
import AdminManageBuilder from "./AdminManageBuilder";

/**
 * AdminManage
 *
 * Entry point. Owns no local state — delegates everything to
 * `useAdminManage` (logic) and `AdminManageBuilder` (UI).
 */
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
    selectedUser,
    selectUserForEdit,
    loading,
    handleCreateUser,
    handleUpdateUser,
    handleDeactivateUser,
    handleReactivateUser,
    qrTarget,
    setQrTarget,
  } = useAdminManage();

  return (
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
      selectedUser={selectedUser}
      onSelectUser={selectUserForEdit}
      onCreateUser={handleCreateUser}
      onUpdateUser={handleUpdateUser}
      onDeactivateUser={handleDeactivateUser}
      onReactivateUser={handleReactivateUser}
      qrTarget={qrTarget}
      onSetQrTarget={setQrTarget}
    />
  );
};

export default AdminManage;
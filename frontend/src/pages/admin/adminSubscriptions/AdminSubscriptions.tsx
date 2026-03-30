import { AlertTriangle, Check, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "../components/AdminPage";
import { EMPTY_FORM } from "./subscriptions.types";
import { FONT } from "./subscriptions.styles";
import { useAdminSubscriptions } from "./hooks/useAdminSubscriptions";
import { DeleteModal, SubscriptionModal, SubscriptionTable } from "./components";

const AdminSubscriptions = () => {
  const { user } = useAuth();
  const {
    subs,
    loading,
    error,
    modal,
    deleteTarget,
    toastMsg,
    activeCount,
    loadAll,
    handleCreate,
    handleEdit,
    handleDelete,
    toggleActive,
    openCreate,
    openEdit,
    closeModal,
    setDelete,
  } = useAdminSubscriptions();

  if (!user || !["admin", "super_admin"].includes(user.role)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-8 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive/50" />
          <p className="text-sm font-semibold text-foreground" style={FONT}>
            Access Denied
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminPage
      eyebrow="Content Management"
      title="Academic Subscriptions"
      description="Manage the subscription cards shown on the public site with a quieter layout that keeps actions and status counts easy to scan."
      contentWidth="wide"
      actions={
        <>
          <Button onClick={loadAll} disabled={loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add New
          </Button>
        </>
      }
    >
      <AdminStatGrid>
        <AdminStatCard label="Total" value={loading ? "-" : String(subs.length)} />
        <AdminStatCard label="Active" value={loading ? "-" : String(activeCount)} />
        <AdminStatCard
          label="Hidden"
          value={loading ? "-" : String(subs.length - activeCount)}
        />
      </AdminStatGrid>

      <AdminPanel
        title="Subscription records"
        description="Review all subscriptions, toggle visibility, and edit individual entries from one table."
        contentClassName="p-0"
      >
        <SubscriptionTable
          subs={subs}
          loading={loading}
          error={error}
          activeCount={activeCount}
          onToggleActive={toggleActive}
          onEdit={openEdit}
          onDelete={setDelete}
        />
      </AdminPanel>

      {modal?.mode === "create" ? (
        <SubscriptionModal
          mode="create"
          initial={EMPTY_FORM}
          onClose={closeModal}
          onSave={handleCreate}
        />
      ) : null}

      {modal?.mode === "edit" && modal.sub ? (
        <SubscriptionModal
          mode="edit"
          initial={{
            title: modal.sub.title,
            url: modal.sub.url,
            description: modal.sub.description ?? "",
            category: modal.sub.category ?? "",
            is_active: modal.sub.is_active,
            imageFile: null,
            imagePreview: null,
            existingImageUrl: modal.sub.image_url,
            removeImage: false,
            uploadedImageUrl: null,
            uploadedPublicId: null,
          }}
          onClose={closeModal}
          onSave={handleEdit(modal.sub)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          sub={deleteTarget}
          onClose={() => setDelete(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {toastMsg ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
          <Check className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium text-foreground" style={FONT}>
            {toastMsg}
          </span>
        </div>
      ) : null}
    </AdminPage>
  );
};

export default AdminSubscriptions;

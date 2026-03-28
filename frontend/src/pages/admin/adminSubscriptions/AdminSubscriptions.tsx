import { AlertTriangle, Globe, Plus, RefreshCw } from "lucide-react";
import { Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { EMPTY_FORM } from "./subscriptions.types";
import { FONT, LABEL_CLS } from "./subscriptions.styles";
import { useAdminSubscriptions } from "./hooks/useAdminSubscriptions";
import {
  DeleteModal,
  SubscriptionModal,
  SubscriptionTable,
} from "./components";

// ─── Component ────────────────────────────────────────────────────────────────

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

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!user || !["admin", "super_admin"].includes(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="border border-destructive/30 bg-destructive/5 px-8 py-10 flex flex-col items-center gap-3 max-w-sm text-center">
          <AlertTriangle className="h-8 w-8 text-destructive/50" />
          <p className="text-sm font-semibold text-foreground" style={FONT}>
            Access Denied
          </p>
          <p className="text-xs text-muted-foreground">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <div className="bg-primary border-b border-primary-foreground/10 relative overflow-hidden">
        <div className="h-[3px] w-full bg-warning" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
          }}
        />
        <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />

        <div className="container px-4 sm:px-6 py-10 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-6 bg-warning" />
            <span className={`${LABEL_CLS} text-[10px] text-warning`} style={FONT}>
              Admin · Library
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Globe className="h-7 w-7 text-primary-foreground/60 shrink-0" />
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold text-primary-foreground tracking-tight"
                  style={FONT}
                >
                  Academic Subscriptions
                </h1>
                <p className="mt-1 text-sm text-primary-foreground/40">
                  Manage the databases shown on the public page.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={loadAll}
                disabled={loading}
                className="flex items-center gap-2 border border-primary-foreground/20 bg-primary-foreground/5 hover:bg-primary-foreground/10 text-primary-foreground/70 hover:text-primary-foreground px-4 py-2 disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className={`${LABEL_CLS} text-[10px]`} style={FONT}>Refresh</span>
              </button>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 bg-warning text-warning-foreground hover:bg-warning/90 px-4 py-2 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className={`${LABEL_CLS} text-[10px]`} style={FONT}>Add New</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 bg-background py-10">
        <div className="container px-4 sm:px-6 space-y-6">

          {/* Stats strip */}
          <div className="grid grid-cols-3 border border-border">
            {[
              { label: "Total",  value: loading ? "—" : subs.length },
              { label: "Active", value: loading ? "—" : activeCount },
              { label: "Hidden", value: loading ? "—" : subs.length - activeCount },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center justify-center gap-1 px-4 py-6 ${
                  i < 2 ? "border-r border-border" : ""
                }`}
              >
                <span
                  className="text-3xl font-bold text-foreground tabular-nums"
                  style={FONT}
                >
                  {stat.value}
                </span>
                <span className={`${LABEL_CLS} text-muted-foreground/50`} style={FONT}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Table */}
          <SubscriptionTable
            subs={subs}
            loading={loading}
            error={error}
            activeCount={activeCount}
            onToggleActive={toggleActive}
            onEdit={openEdit}
            onDelete={setDelete}
          />
        </div>
      </main>

      {/* Modals */}
      {modal?.mode === "create" && (
        <SubscriptionModal
          mode="create"
          initial={EMPTY_FORM}
          onClose={closeModal}
          onSave={handleCreate}
        />
      )}

      {modal?.mode === "edit" && modal.sub && (
        <SubscriptionModal
          mode="edit"
          initial={{
            title:            modal.sub.title,
            url:              modal.sub.url,
            description:      modal.sub.description ?? "",
            category:         modal.sub.category ?? "",
            is_active:        modal.sub.is_active,
            imageFile:        null,
            imagePreview:     null,
            existingImageUrl: modal.sub.image_url,
            removeImage:      false,
            uploadedImageUrl: null,
            uploadedPublicId: null,
          }}
          onClose={closeModal}
          onSave={handleEdit(modal.sub)}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          sub={deleteTarget}
          onClose={() => setDelete(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 border border-border bg-card px-4 py-3 shadow-lg">
          <Check className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground" style={FONT}>
            {toastMsg}
          </span>
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptions;
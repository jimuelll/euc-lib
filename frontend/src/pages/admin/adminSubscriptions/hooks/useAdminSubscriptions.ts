import { useEffect, useRef, useState } from "react";
import {
  fetchSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from "../subscriptions.api";
import type {
  FormState,
  ModalState,
  Subscription,
} from "../subscriptions.types";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminSubscriptions() {
  const [subs, setSubs]           = useState<Subscription[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [modal, setModal]         = useState<ModalState | null>(null);
  const [deleteTarget, setDelete] = useState<Subscription | null>(null);
  const [toastMsg, setToast]      = useState<string | null>(null);
  const toastTimer                = useRef<ReturnType<typeof setTimeout>>();

  // ── Toast ──────────────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSubscriptions();
      setSubs(data);
    } catch {
      setError("Failed to load subscriptions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = async (form: FormState) => {
    const created = await createSubscription({
      title:           form.title.trim(),
      url:             form.url.trim(),
      description:     form.description.trim(),
      category:        form.category.trim(),
      is_active:       form.is_active,
      sort_order:      subs.length + 1,
      image_url:       form.uploadedImageUrl,
      image_public_id: form.uploadedPublicId,
    });
    setSubs((prev) => [...prev, created]);
    showToast("Subscription added.");
  };

  // ── Edit ───────────────────────────────────────────────────────────────────

  const handleEdit = (sub: Subscription) => async (form: FormState) => {
    const updated = await updateSubscription(sub.id, {
      title:       form.title.trim(),
      url:         form.url.trim(),
      description: form.description.trim(),
      category:    form.category.trim(),
      is_active:   form.is_active,
      ...(form.removeImage && { remove_image: true }),
      ...(form.uploadedImageUrl && {
        image_url:       form.uploadedImageUrl,
        image_public_id: form.uploadedPublicId ?? undefined,
      }),
    });
    setSubs((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
    showToast("Changes saved.");
  };

  // ── Toggle visibility ──────────────────────────────────────────────────────

  const toggleActive = async (sub: Subscription) => {
    try {
      const updated = await updateSubscription(sub.id, {
        is_active: !sub.is_active,
      });
      setSubs((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
      showToast(updated.is_active ? "Set to active." : "Set to hidden.");
    } catch {
      showToast("Failed to update visibility.");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteSubscription(deleteTarget.id);
    setSubs((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    showToast("Subscription deleted.");
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openCreate = () => setModal({ mode: "create" });
  const openEdit   = (sub: Subscription) => setModal({ mode: "edit", sub });
  const closeModal = () => setModal(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeCount = subs.filter((s) => s.is_active).length;

  return {
    // state
    subs,
    loading,
    error,
    modal,
    deleteTarget,
    toastMsg,
    activeCount,
    // actions
    loadAll,
    handleCreate,
    handleEdit,
    toggleActive,
    handleDelete,
    openCreate,
    openEdit,
    closeModal,
    setDelete,
  };
}
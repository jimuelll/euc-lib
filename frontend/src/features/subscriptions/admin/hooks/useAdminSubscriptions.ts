import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { subscriptionsKeys } from "../../subscriptions.keys";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminSubscriptions() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const listQuery = useQuery({
    queryKey: subscriptionsKeys.adminPage(page),
    queryFn: ({ signal }) => fetchSubscriptions(page, signal),
    placeholderData: (previousData) => previousData,
  });
  const subs = listQuery.data?.rows ?? [];
  const pagination = listQuery.data?.pagination ?? { page, limit: 25, total: 0, totalPages: 1 };
  const loading = listQuery.isFetching;
  const error = listQuery.isError ? "Failed to load subscriptions." : null;
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

  const loadAll = async (nextPage = 1) => {
    if (nextPage !== page) setPage(nextPage);
    else await listQuery.refetch();
  };

  const invalidateSubscriptions = () => queryClient.invalidateQueries({ queryKey: subscriptionsKeys.all });
  const createMutation = useMutation({ mutationFn: createSubscription, onSuccess: invalidateSubscriptions });
  const updateMutation = useMutation({ mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateSubscription>[1] }) => updateSubscription(id, payload), onSuccess: invalidateSubscriptions });
  const deleteMutation = useMutation({ mutationFn: deleteSubscription, onSuccess: invalidateSubscriptions });

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = async (form: FormState) => {
    await createMutation.mutateAsync({
      title:           form.title.trim(),
      url:             form.url.trim(),
      description:     form.description.trim(),
      category:        form.category.trim(),
      is_active:       form.is_active,
      sort_order:      subs.length + 1,
      image_url:       form.uploadedImageUrl,
      image_public_id: form.uploadedPublicId,
    });
    showToast("Subscription added.");
  };

  // ── Edit ───────────────────────────────────────────────────────────────────

  const handleEdit = (sub: Subscription) => async (form: FormState) => {
    await updateMutation.mutateAsync({ id: sub.id, payload: {
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
    } });
    showToast("Changes saved.");
  };

  // ── Toggle visibility ──────────────────────────────────────────────────────

  const toggleActive = async (sub: Subscription) => {
    try {
      const updated = await updateMutation.mutateAsync({ id: sub.id, payload: {
        is_active: !sub.is_active,
      } });
      showToast(updated.is_active ? "Set to active." : "Set to hidden.");
    } catch {
      showToast("Failed to update visibility.");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
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
    pagination,
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

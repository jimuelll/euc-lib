// ─── Domain model ─────────────────────────────────────────────────────────────

export interface Subscription {
  id: number;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  image_public_id: string | null;
  is_active: boolean;
  sort_order: number;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export interface FormState {
  title: string;
  url: string;
  description: string;
  category: string;
  is_active: boolean;
  imageFile: File | null;
  imagePreview: string | null;
  existingImageUrl: string | null;
  removeImage: boolean;
  uploadedImageUrl: string | null;
  uploadedPublicId: string | null;
}

export const EMPTY_FORM: FormState = {
  title: "",
  url: "",
  description: "",
  category: "",
  is_active: true,
  imageFile: null,
  imagePreview: null,
  existingImageUrl: null,
  removeImage: false,
  uploadedImageUrl: null,
  uploadedPublicId: null,
};

// ─── Modal ────────────────────────────────────────────────────────────────────

export type ModalMode = "create" | "edit";

export interface ModalState {
  mode: ModalMode;
  sub?: Subscription;
}

// ─── API payloads ─────────────────────────────────────────────────────────────

export interface CreateSubscriptionPayload {
  title: string;
  url: string;
  description: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  image_url: string | null;
  image_public_id: string | null;
}

export interface UpdateSubscriptionPayload {
  title?: string;
  url?: string;
  description?: string;
  category?: string;
  is_active?: boolean;
  remove_image?: boolean;
  image_url?: string;
  image_public_id?: string;
}
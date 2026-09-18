import axiosInstance from "@/utils/AxiosInstance";

export type GuideRole = "staff" | "admin" | "super_admin";

export type GuideStep = {
  title: string;
  body: string;
};

export type GuideTroubleshootingItem = {
  problem: string;
  solution: string;
};

export type GuideContent = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  overview: string;
  target_path: string | null;
  audience_roles: GuideRole[];
  before_you_begin: string[];
  steps: GuideStep[];
  warnings: string[];
  troubleshooting: GuideTroubleshootingItem[];
  image_url: string | null;
  image_public_id: string | null;
};

export type GuideModule = GuideContent & {
  id: number;
  sort_order: number;
};

export type EditableGuideModule = GuideModule & {
  is_published: boolean;
  has_unpublished_changes: boolean;
  published_at: string | null;
  updated_at: string;
};

const unwrap = <T>(response: { data: T | { data: T } }): T => {
  const payload = response.data;
  return payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: T }).data
    : (payload as T);
};

export const getPublishedGuide = async () =>
  unwrap<GuideModule[]>(await axiosInstance.get("/api/user-guide"));

export const getGuideForEditing = async () =>
  unwrap<EditableGuideModule[]>(await axiosInstance.get("/api/admin/user-guide"));

export const createGuideDraft = async (draft: GuideContent) =>
  unwrap<EditableGuideModule>(await axiosInstance.post("/api/admin/user-guide", draft));

export const updateGuideDraft = async (id: number, draft: GuideContent) =>
  unwrap<EditableGuideModule>(await axiosInstance.put(`/api/admin/user-guide/${id}`, draft));

export const publishGuideDraft = async (id: number) =>
  unwrap<EditableGuideModule>(await axiosInstance.post(`/api/admin/user-guide/${id}/publish`));

export const unpublishGuideModule = async (id: number) =>
  unwrap<EditableGuideModule>(await axiosInstance.post(`/api/admin/user-guide/${id}/unpublish`));

export const archiveGuideModule = async (id: number) =>
  axiosInstance.delete(`/api/admin/user-guide/${id}`);

export const reorderGuideModules = async (ids: number[]) =>
  axiosInstance.patch("/api/admin/user-guide/reorder", { ids });

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
  image_alt?:string;
  image_url: string | null;
  image_public_id: string | null;
};

export type GuideModule = GuideContent & {
  id: number;
  sort_order: number;
};

const unwrap = <T>(response: { data: T | { data: T } }): T => {
  const payload = response.data;
  return payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: T }).data
    : (payload as T);
};

export const getPublishedGuide = async (signal?: AbortSignal) =>
  unwrap<GuideModule[]>(await axiosInstance.get("/api/user-guide", { signal }));

import axiosInstance from "@/utils/AxiosInstance";
export type HoursRow = { day: string; time: string; open: boolean };
export type HeroStat = { value: string; label: string };
export type SiteContent = { hero_kicker: string; hero_title: string; hero_highlight: string; hero_description: string; hero_image_url: string | null; hero_stats: HeroStat[]; hours: HoursRow[]; address: string; contact_email: string; contact_phone: string };
export const getSiteContent = async () => (await axiosInstance.get<SiteContent>("/api/site-content")).data;
export const updateSiteContent = async (payload: SiteContent) => (await axiosInstance.put<SiteContent>("/api/site-content", payload)).data;

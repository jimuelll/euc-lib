import axiosInstance from "@/utils/AxiosInstance";

export type AudienceType = "all" | "user" | "role";
export interface AdminNotification { id: number; type: string; title: string; body: string; href: string | null; audience_type: AudienceType; audience_user_id: number | null; audience_role: string | null; created_at: string; expires_at: string | null; creator_name: string | null; }
export interface AdminNotificationStats { total_notifications: number; created_today: number; broadcast_notifications: number; direct_notifications: number; }
export interface AdminNotificationsResponse { stats: AdminNotificationStats; notifications: AdminNotification[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export const fetchAdminNotifications = async (page = 1): Promise<AdminNotificationsResponse> => (await axiosInstance.get<AdminNotificationsResponse>("/api/admin/notifications", { params: { page, limit: 20 } })).data;
export const createAdminNotification = async (payload: { type: string; title: string; body: string; href: string | null; audienceType: AudienceType; audienceUserId: number | null; audienceRole: string | null; expiresAt: string | null }): Promise<void> => { await axiosInstance.post("/api/admin/notifications", payload); };

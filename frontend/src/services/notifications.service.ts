import axiosInstance from "@/utils/AxiosInstance";

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  audience_type: "all" | "user" | "role";
  audience_user_id: number | null;
  audience_role: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_by: number | null;
  read_at: string | null;
  is_read: boolean;
}

export async function fetchNotifications(limit = 20): Promise<NotificationItem[]> {
  const res = await axiosInstance.get("/api/notifications/my", { params: { limit } });
  return res.data;
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await axiosInstance.get("/api/notifications/unread-count");
  return res.data.unreadCount ?? 0;
}

export async function markNotificationRead(notificationId: number) {
  const res = await axiosInstance.post(`/api/notifications/${notificationId}/read`);
  return res.data;
}

export async function markAllNotificationsRead() {
  const res = await axiosInstance.post("/api/notifications/read-all");
  return res.data;
}

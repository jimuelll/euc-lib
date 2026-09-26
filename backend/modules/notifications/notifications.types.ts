import type { RowDataPacket } from "mysql2/promise";

export type NotificationAudience = "all" | "user" | "role";

export interface NotificationContext {
  userId: number;
  role: string;
}

export interface NotificationRecord extends RowDataPacket {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  audience_type: NotificationAudience;
  audience_user_id: number | null;
  audience_role: string | null;
  created_at: Date | string;
  expires_at: Date | string | null;
  is_active: boolean | number;
  created_by: number | null;
  source_type: string | null;
  source_id: string | number | null;
  read_at: Date | string | null;
  audience_user_name?: string | null;
  audience_user_identifier?: string | null;
  creator_name?: string | null;
}

export interface NotificationRecipient extends RowDataPacket {
  id: number;
  name: string;
  role: string;
  student_employee_id: string | null;
  library_card_number: string | null;
  student_number: string | null;
  employee_number: string | null;
  username: string | null;
}

export interface NotificationListOptions extends NotificationContext {
  limit: number;
  unreadOnly: boolean;
}

export interface NotificationListAdminOptions {
  page: number;
  limit: number;
}

export interface CreateNotificationInput {
  type: string;
  title: string;
  body: string;
  href?: string | null;
  audienceType?: NotificationAudience;
  audienceUserId?: number | null;
  audienceRole?: string | null;
  expiresAt?: Date | string | null;
  createdBy?: number | null;
  sourceType?: string | null;
  sourceId?: string | number | null;
  replaceExisting?: boolean;
  deliveryKey?: string | null;
}

export interface NotificationWrite extends Omit<CreateNotificationInput, "replaceExisting" | "deliveryKey"> {
  href: string | null;
  audienceType: NotificationAudience;
  audienceUserId: number | null;
  audienceRole: string | null;
  expiresAt: Date | string | null;
  createdBy: number | null;
  sourceType: string | null;
  sourceId: string | number | null;
}

export interface NotificationUpdateInput {
  notificationId: number;
  title: string;
  body: string;
  href: string | null;
  expiresAt: Date | string | null;
  createdBy: number | null;
  sourceType: string | null;
  sourceId: string | number | null;
  deliveryKey?: string | null;
}

export interface NotificationAdminStats extends RowDataPacket {
  total_notifications: number | string | null;
  created_today: number | string | null;
  broadcast_notifications: number | string | null;
  direct_notifications: number | string | null;
}

export interface NotificationCountRow extends RowDataPacket {
  total: number;
}

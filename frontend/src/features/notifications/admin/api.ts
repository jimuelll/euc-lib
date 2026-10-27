import axiosInstance from "@/utils/AxiosInstance";
export type AudienceType = "all" | "user" | "role" | "users";
export interface AdminNotification {
    image_url?:string|null; image_public_id?:string|null; image_alt?:string|null;
    email_requested?: boolean | number;
    email_expires_at?: string | null;
    email_summary?: EmailSummary | null;
    audience_user_patron_id: string | null;
    record_key: string;
    id: number | null;
    queue_id: string | null;
    type: string;
    title: string;
    body: string;
    href: string | null;
    audience_type: AudienceType;
    audience_user_id: number | null;
    audience_user_ids?: number[];
    audience_users?: NotificationRecipient[];
    audience_user_name: string | null;
    audience_user_identifier: string | null;
    audience_role: string | null;
    created_at: string;
    expires_at: string | null;
    scheduled_at: string | null;
    creator_name: string | null;
    origin: 'manual' | 'automatic';
    delivery_status: 'available' | 'queued' | 'scheduled' | 'failed' | 'expired';
    read_count: number;
    group_reads: number;
    group_count: number;
    last_error: string | null;
}
export interface NotificationRecipient {
    id: number;
    name: string;
    role: string;
    student_employee_id: string;
    library_card_number: string | null;
    student_number: string | null;
    employee_number: string | null;
    username: string | null;
}
export interface AdminNotificationStats {
    total_notifications: number;
    created_today: number;
    broadcast_notifications: number;
    direct_notifications: number;
}
export interface AdminNotificationsResponse {
    counts: {
        manual: number;
        automatic: number;
        failed: number;
        all: number;
    };
    notifications: AdminNotification[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface FeedParams {
    page: number;
    limit?: number;
    tab: string;
    filter: string;
    q: string;
}
export const fetchAdminNotifications = async (params: FeedParams, signal?: AbortSignal): Promise<AdminNotificationsResponse> => (await axiosInstance.get<AdminNotificationsResponse>("/api/admin/notifications", { params: { limit: 20, ...params }, signal })).data;
export const searchNotificationRecipients = async (query: string, signal?: AbortSignal): Promise<NotificationRecipient[]> => (await axiosInstance.get<{
    recipients: NotificationRecipient[];
}>("/api/admin/notifications/recipients", { params: { q: query }, signal })).data.recipients;
export interface NotificationCompose {
    imageUrl?:string|null; imagePublicId?:string|null; imageAlt?:string|null;
    sendEmail?: boolean;
    confirmedEmailCount?: number;
    type: string;
    title: string;
    body: string;
    href: string | null;
    audienceType: AudienceType;
    audienceUserId: number | null;
    audienceUserIds?: number[];
    audienceRole: string | null;
    expiresAt: string | null;
    scheduledAt: string | null;
    confirmedRecipientCount?: number;
}
export const createAdminNotification = async (payload: NotificationCompose): Promise<void> => { await axiosInstance.post('/api/admin/notifications', payload); };
export const countNotificationRecipients = async (params: Pick<NotificationCompose, 'audienceType' | 'audienceUserId' | 'audienceUserIds' | 'audienceRole'>, signal?: AbortSignal) => (await axiosInstance.get<{
    count: number;
}>('/api/admin/notifications/audience-count', { params: audienceParams(params), signal })).data.count;
export const notificationDetails = async (key: string, signal?: AbortSignal) => (await axiosInstance.get<AdminNotification[]>(`/api/admin/notifications/${encodeURIComponent(key)}/details`, { signal })).data;
export const notificationAction = async (key: string, action: 'resend' | 'expire', confirmedRecipientCount?: number) => { await axiosInstance.post(`/api/admin/notifications/${encodeURIComponent(key)}/${action}`, { confirmedRecipientCount }); };
export interface EmailSummary { queued:number;processing:number;accepted:number;failed:number;unknown:number;cancelled:number }
export interface NotificationEmailPreview {
    exclusions?: {missingAddress:number;unverifiedAddress:number;incompleteSetup:number};
    inAppCount:number;emailCount:number;skippedCount:number;enabled:boolean;reason:string|null;
    dailyLimit:number;securityReserve:number;usedToday:number;queuedRoutine:number;remainingRoutine:number;resetAt:string;
}
export const previewNotificationEmail = async (params: Pick<NotificationCompose,'audienceType'|'audienceRole'|'audienceUserId'|'audienceUserIds'>,signal?:AbortSignal) =>
    (await axiosInstance.get<NotificationEmailPreview>('/api/admin/notifications/email-preview',{params:audienceParams(params),signal})).data;

export const uploadNotificationImage=async(file:File,onProgress:(progress:number)=>void,signal?:AbortSignal)=>{const data=new FormData();data.append('image',file);return (await axiosInstance.post<{imageUrl:string;imagePublicId:string}>('/api/admin/notifications/images',data,{signal,headers:{'Content-Type':'multipart/form-data'},onUploadProgress:event=>onProgress(event.total?Math.round(event.loaded/event.total*100):0)})).data;};

function audienceParams<T extends {audienceUserIds?:number[]}>(params:T) {return {...params,...(params.audienceUserIds ? {audienceUserIds:params.audienceUserIds.join(',')} : {})};}

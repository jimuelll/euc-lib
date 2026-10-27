import axios from '@/utils/AxiosInstance';
export type DeliveryStatus='queued'|'processing'|'accepted'|'failed'|'unknown'|'cancelled';
export interface Delivery {id:string;user_id:number;recipient:string;purpose:string;priority:number;status:DeliveryStatus;attempts:number;last_error:string|null;created_at:string;started_at:string|null;accepted_at:string|null;next_attempt_at:string|null;expires_at:string;notification_id:number|null;retry_available:number;provider_message_id:string|null;provider_mode:string|null}
export interface EmailDeliveryFilters {category:'account'|'manual'|'automated';q:string;status:string;purpose:string;from:string;to:string;sort:string;page:number;limit:number}
export interface EmailDeliveryStatus {enabled:boolean;routineEnabled:boolean;mode:string;limit:number;reserve:number;used:number;periodStart:string;periodEnd:string;periodValid:boolean;routineRemaining:number;queuedRoutine:number;routineAfterQueue:number;rows:Delivery[];statusTotals:Record<DeliveryStatus,number>;purposes:string[];pagination:{page:number;limit:number;total:number;totalPages:number}}
export const fetchEmailDeliveries=async(filters:EmailDeliveryFilters,signal?:AbortSignal)=>(await axios.get<EmailDeliveryStatus>('/api/admin/email-deliveries',{params:filters,signal})).data;
export const fetchEmailDelivery=async(id:string,signal?:AbortSignal)=>(await axios.get<Delivery>(`/api/admin/email-deliveries/${encodeURIComponent(id)}`,{signal})).data;
export const retryEmailDelivery=async(id:string)=>(await axios.post(`/api/admin/email-deliveries/${encodeURIComponent(id)}/retry`)).data;

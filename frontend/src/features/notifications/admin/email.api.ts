import axios from '@/utils/AxiosInstance';
export interface Delivery {id:string;recipient:string;purpose:string;status:string;attempts:number;last_error:string|null;created_at:string}
export interface EmailDeliveryStatus {enabled:boolean;routineEnabled:boolean;mode:string;limit:number;reserve:number;used:number;periodStart:string;periodEnd:string;periodValid:boolean;rows:Delivery[]}
export const fetchEmailDeliveries=async()=>(await axios.get<EmailDeliveryStatus>('/api/admin/email-deliveries')).data;
export const retryEmailDelivery=async(id:string)=>(await axios.post(`/api/admin/email-deliveries/${encodeURIComponent(id)}/retry`)).data;

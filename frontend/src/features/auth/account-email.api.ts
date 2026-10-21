import axios, { clearLocalAuthSession } from '@/utils/AxiosInstance';
export interface AccountEmailStatus {email:string|null;pending_email:string|null;email_verified_at:string|null;emailEnabled:boolean;student_employee_id:string}
export interface Authorization {id:string;token:string}
interface Message {message:string}
export const requestRecovery=async(email:string)=>(await axios.post<Message>('/api/auth/recovery/request',{email})).data;
export const verifyRecovery=async(email:string,code:string)=>(await axios.post<Authorization>('/api/auth/recovery/verify',{email,code})).data;
export const completeSetup=async(auth:Authorization,password:string)=>{const response=await axios.post<Message>('/api/auth/setup-password',{...auth,password});clearLocalAuthSession();return response.data;};
export const completeReset=async(auth:Authorization,password:string)=>{const response=await axios.post<Message>('/api/auth/recovery/reset',{...auth,password});clearLocalAuthSession();return response.data;};
export const verifyEmail=async(auth:Authorization)=>(await axios.post<Message>('/api/auth/verify-email',auth)).data;
export const emailStatus=async()=>(await axios.get<AccountEmailStatus>('/api/auth/email-status')).data;
export const requestVerification=async()=>(await axios.post<Message>('/api/auth/email-verification',{})).data;
export const changeEmail=async(email:string)=>(await axios.post<Message>('/api/auth/email-change',{email})).data;

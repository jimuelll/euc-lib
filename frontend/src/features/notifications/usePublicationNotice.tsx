import {useRef,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {useAdminConfirmDialog} from "@/features/admin/public";
import {previewNotificationEmail} from "./admin/api";
export function usePublicationNotice() {
 const [checked,setChecked]=useState(false);
 const requestId=useRef(crypto.randomUUID());
 const {confirm,confirmDialog}=useAdminConfirmDialog();
 const audience={audienceType:"all" as const,audienceRole:null,audienceUserId:null};
 const preview=useQuery({queryKey:["publication-notification-preview"],queryFn:({signal})=>previewNotificationEmail(audience,signal),enabled:checked,staleTime:0});
 const prepare=async()=>{
  if(!checked)return undefined;
  const result=await previewNotificationEmail(audience);
  if(!result.enabled||!result.inAppCount||!result.emailCount)throw new Error(result.reason||"No eligible recipients are available.");
  if(!await confirm({title:"Publish and notify users?",description:`${result.inAppCount.toLocaleString()} in-app recipients; ${result.emailCount.toLocaleString()} by email and ${result.skippedCount.toLocaleString()} in-app only. Emails are queued for delivery.`,actionLabel:"Publish and notify",cancelLabel:"Keep editing"}))return null;
  return {total:result.inAppCount,email:result.emailCount,requestId:requestId.current};
 };
 const reset=()=>{setChecked(false);requestId.current=crypto.randomUUID();};
 return {checked,setChecked,preview,prepare,reset,confirmDialog};
}

import {useId} from "react";
import type {NotificationEmailPreview} from "./admin/api";
import "./publication-notification.css";
export function PublicationNotificationOption({checked,onChange,preview,loading,error,onRetry,draft=false}:{checked:boolean;onChange:(value:boolean)=>void;preview?:NotificationEmailPreview;loading:boolean;error:boolean;onRetry:()=>void;draft?:boolean}) {
 const id=useId();
 return <section className="publication-notice" aria-label="Publication notification">
  <label className="publication-notice-choice" htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><span><strong>Notify users</strong><small>Send an in-app notification and email to active users.</small></span></label>
  <p className="publication-notice-help">{draft?"Sent once on publication. Saving a draft does not send.":"Sent once when this item is published."}</p>
  {checked&&<div className="publication-notice-status" role="status" aria-live="polite">{loading?<p>Checking recipients…</p>:error?<p role="alert">Could not check recipients. <button type="button" onClick={onRetry}>Try again</button></p>:preview?<><p><strong>{preview.inAppCount.toLocaleString()}</strong> in-app · <strong>{preview.emailCount.toLocaleString()}</strong> by email · {preview.skippedCount.toLocaleString()} in-app only</p>{!preview.enabled&&<p role="alert">{preview.reason}</p>}{preview.enabled&&!preview.emailCount&&<p role="alert">No active users have an eligible email address.</p>}</>:null}</div>}
 </section>;
}

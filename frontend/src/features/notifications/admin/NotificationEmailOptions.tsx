import { Button } from '@/components/ui/button';
import type { EmailSummary, NotificationEmailPreview } from './api';

export function NotificationEmailOptions({checked,onChange,preview,loading,error,onRetry,scheduled}: {
  checked:boolean;onChange:(checked:boolean)=>void;preview?:NotificationEmailPreview;loading:boolean;error:boolean;onRetry:()=>void;scheduled:boolean;
}) {
  return <section className="notification-email-options" aria-label="Email delivery option">
    <label className="notification-email-toggle"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)} aria-describedby="notification-email-help"/>Also send by email</label>
    <p id="notification-email-help">{checked && preview ? `${preview.skippedCount.toLocaleString()} patrons will get in-app only${preview.exclusions ? `: ${preview.exclusions.missingAddress} have no email address, ${preview.exclusions.unverifiedAddress} have no verified email, ${preview.exclusions.incompleteSetup} have incomplete account setup` : ' because their accounts are not eligible for email'}.` : 'Email goes only to active patrons with a verified address and completed account setup.'}</p>
    {checked && <div aria-live="polite">
      {loading ? <p role="status">Checking email recipients and allowance…</p> : error ? <p role="alert">Email preview could not be loaded. <Button type="button" variant="outline" onClick={onRetry}>Try again</Button></p> : preview && <>
        <p><strong>{scheduled?'Estimated email audience: ': 'This will email '}{preview.emailCount.toLocaleString()} users{scheduled?'.':'.'}</strong></p>
        <p>{preview.inAppCount.toLocaleString()} in-app recipients; {preview.skippedCount.toLocaleString()} skipped for email because their accounts are not eligible.</p>
        {!preview.enabled ? <p role="alert">{preview.reason} Uncheck email to send in-app only.</p> : preview.emailCount===0 ? <p role="alert">No verified email recipients. Uncheck email to send in-app only.</p> : <>
          <p>{preview.remainingRoutine.toLocaleString()} estimated email slots left today after {preview.usedToday.toLocaleString()} attempts and {preview.queuedRoutine.toLocaleString()} queued routine emails. {preview.securityReserve} of {preview.dailyLimit} daily slots are reserved for account and security emails.</p>
          <p>{scheduled?'Recipients are determined at scheduled publication. Today’s allowance may change before then.':'Counts and allowance are estimates, not reservations.'} Overflow waits for later daily allowances; unsent emails expire after seven days or the notification’s expiry, whichever comes first.</p>
        </>}
      </>}
    </div>}
  </section>;
}
export function NotificationEmailResults({summary,deadline,scheduled=false}: {summary?:EmailSummary|null;deadline?:string|null;scheduled?:boolean}) {
  return <section className="notification-email-results" aria-label="Email delivery results"><h4>Email delivery</h4>
    {summary ? <dl>{Object.entries(summary).map(([status,total])=><div key={status}><dt>{status==='accepted'?'Accepted by provider':status.charAt(0).toUpperCase()+status.slice(1)}</dt><dd>{total.toLocaleString()}</dd></div>)}</dl> : <p>{scheduled?'Recipients will be determined at publication.':'No email deliveries recorded.'}</p>}
    <p>Acceptance does not confirm inbox delivery. Unknown outcomes require review before resending.</p>
    {deadline && <p>Unsent email expires: {new Date(deadline).toLocaleString()}.</p>}
  </section>;
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { User } from '../AdminManage.types';
import { fetchAccountEmailStatus, requestAccountEmail } from '../api';
function relativeTime(value:string) {
  const minutes=Math.round((new Date(value).getTime()-Date.now())/60000);
  return new Intl.RelativeTimeFormat('en',{numeric:'auto'}).format(Math.abs(minutes)<60?minutes:Math.abs(minutes)<1440?Math.round(minutes/60):Math.round(minutes/1440),Math.abs(minutes)<60?'minute':Math.abs(minutes)<1440?'hour':'day');
}
export default function AccountEmailActions({user,disabled,dirty=false}:{user:User;disabled:boolean;dirty?:boolean}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const history=useQuery({queryKey:['user-account-email-status',user.student_employee_id],queryFn:({signal})=>fetchAccountEmailStatus(user.student_employee_id,signal),enabled:!disabled,refetchInterval:30000});
  const send=async(action:'invite'|'verify'|'recovery')=>{setBusy(true);setMessage('');setError('');try{const response=await requestAccountEmail(user.student_employee_id,action);setMessage(response.message);await history.refetch();}catch(error){setError((error as {response?:{data?:{message?:string}}})?.response?.data?.message||'Could not request account email.');}finally{setBusy(false);}};
  const locked=disabled||dirty||busy;
  const reason=dirty?'Save or discard your changes before requesting an email.':undefined;
  return <div className="users-email-actions users-wide">
    <p>{user.email_verified_at?`Verified ${new Intl.DateTimeFormat('en',{dateStyle:'medium'}).format(new Date(user.email_verified_at))}`:'Not verified'}{user.setup_pending?' · Setup pending':''}</p>
    {user.pending_email&&<p>Pending email: {user.pending_email}</p>}
    <p className="users-hint">Invitations let users set their own password. Verification confirms an address. Recovery lets a verified user reset their password.</p>
    <div className="users-email-buttons" tabIndex={dirty?0:undefined} title={reason} aria-describedby={dirty?'user-email-disabled':undefined}>
      {user.setup_pending?<Button type="button" variant="outline" disabled={locked||!user.email} onClick={()=>void send('invite')}>Resend invitation</Button>:<><Button type="button" variant="outline" disabled={locked||(!user.email&&!user.pending_email)||Boolean(user.email_verified_at&&!user.pending_email)} onClick={()=>void send('verify')}>Send verification email</Button><Button type="button" variant="outline" disabled={locked||!user.email_verified_at||!user.email} onClick={()=>void send('recovery')}>Send recovery email</Button></>}
    </div>
    {dirty&&<p id="user-email-disabled" className="users-hint">{reason}</p>}
    {history.isError?<p className="users-hint">Email history unavailable. <button type="button" onClick={()=>void history.refetch()}>Retry</button></p>:history.isPending&&!disabled?<p className="users-hint">Loading email history…</p>:history.data?.deliveries.length?<ul className="users-email-history">{history.data.deliveries.map(item=><li key={item.purpose}>{item.purpose==='setup'?'Invitation':item.purpose==='verify_email'?'Verification':'Recovery'}: {item.accepted_at?<span title={new Date(item.accepted_at).toLocaleString()}>Accepted by email provider {relativeTime(item.accepted_at)}</span>:<span>{['failed','expired','cancelled','suppressed'].includes(item.status)?item.status:'Queued'} · requested <time dateTime={item.requested_at} title={new Date(item.requested_at).toLocaleString()}>{relativeTime(item.requested_at)}</time></span>}</li>)}</ul>:!disabled&&<p className="users-hint">No account emails requested.</p>}
    {message&&<p role="status">{message}</p>}{error&&<p role="alert" className="users-field-error">{error}</p>}
  </div>;
}

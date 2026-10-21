import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { User } from '../AdminManage.types';
import { requestAccountEmail } from '../api';
export default function AccountEmailActions({user,disabled}:{user:User;disabled:boolean}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const send=async(action:'invite'|'verify'|'recovery')=>{setBusy(true);setMessage('');setError('');try{const response=await requestAccountEmail(user.student_employee_id,action);setMessage(response.message);}catch(error){setError((error as {response?:{data?:{message?:string}}})?.response?.data?.message||'Could not request account email.');}finally{setBusy(false);}};
  return <div className="space-y-3 sm:col-span-2"><p>{user.setup_pending?'Setup pending':user.email_verified_at?'Email verified':user.email?'Email not verified':'Email missing'}</p>{user.pending_email&&<p>Pending email: {user.pending_email}</p>}
    <div className="flex flex-wrap gap-2">{user.setup_pending?<Button type="button" variant="outline" disabled={disabled||busy||!user.email} onClick={()=>void send('invite')}>Resend invitation</Button>:<><Button type="button" variant="outline" disabled={disabled||busy||(!user.email&&!user.pending_email)} onClick={()=>void send('verify')}>Send verification email</Button><Button type="button" variant="outline" disabled={disabled||busy||!user.email_verified_at} onClick={()=>void send('recovery')}>Send recovery email</Button></>}</div>
    <p className="text-sm text-muted-foreground">Save contact corrections before requesting an email. Users choose their own passwords.</p>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="text-destructive">{error}</p>}
  </div>;
}

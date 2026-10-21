import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as api from '../account-email.api';
export default function AccountEmailPanel() {
  const client=useQueryClient();
  const query=useQuery({queryKey:['account-email'],queryFn:api.emailStatus});
  const [address,setAddress]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const action=async(change:boolean)=>{setBusy(true);setMessage('');setError('');try{const response=await (change?api.changeEmail(address):api.requestVerification());setMessage(response.message);setAddress('');await client.invalidateQueries({queryKey:['account-email']});}catch(error){setError((error as {response?:{data?:{message?:string}}})?.response?.data?.message||'Unable to request email. Try again.');}finally{setBusy(false);}};
  const submit=(event:FormEvent)=>{event.preventDefault();void action(true);};
  return <section className="space-y-4 border-y py-6" aria-label="Account email"><h2 className="font-heading text-xl">Account email</h2>
    {query.isPending?<p role="status">Loading email details…</p>:query.isError?<><p role="alert">Email details could not be loaded.</p><Button variant="outline" onClick={()=>void query.refetch()}>Try again</Button></>:<>
      <p>Login ID: <strong>{query.data.student_employee_id}</strong></p><p>{query.data.email||'No email recorded'} — {query.data.email_verified_at?'Verified':'Not verified'}</p>
      {query.data.pending_email && <p>Pending verification: {query.data.pending_email}. Your current address remains active until verification.</p>}
      {!query.data.emailEnabled && <p>Email workflows are not enabled yet. Contact library staff for help.</p>}
      {query.data.email && (!query.data.email_verified_at||query.data.pending_email) && <Button variant="outline" disabled={busy||!query.data.emailEnabled} onClick={()=>void action(false)}>Send verification email</Button>}
      <form onSubmit={submit} className="space-y-3"><label className="block space-y-2"><span>{query.data.email?'New email address':'Email address'}</span><Input type="email" autoComplete="email" value={address} required maxLength={255} disabled={busy||!query.data.emailEnabled} onChange={event=>setAddress(event.target.value)}/></label><Button disabled={busy||!query.data.emailEnabled}>{busy?'Requesting…':'Send verification link'}</Button></form>
    </>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="text-destructive">{error}</p>}
  </section>;
}

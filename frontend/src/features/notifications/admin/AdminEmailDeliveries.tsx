import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AdminPage, AdminPanel } from '@/features/admin';
import { Button } from '@/components/ui/button';
import { fetchEmailDeliveries, retryEmailDelivery } from './email.api';
export default function AdminEmailDeliveries() {
  const {user}=useAuth();
  const authorized=user?.role==='super_admin';
  const query=useQuery({queryKey:['admin-email-deliveries'],queryFn:fetchEmailDeliveries,refetchInterval:30_000,enabled:authorized});
  const [error,setError]=useState(''),[busy,setBusy]=useState('');
  const retry=async(id:string)=>{setBusy(id);setError('');try{await retryEmailDelivery(id);await query.refetch();}catch(error){setError((error as {response?:{data?:{message?:string}}})?.response?.data?.message||'Retry failed.');}finally{setBusy('');}};
  if(!authorized)return null;
  return <AdminPage title="Email delivery" description="Provider acceptance and queue activity. Acceptance does not confirm inbox delivery."><Link to="/admin/notifications" className="text-action underline">Back to notifications</Link><Button variant="outline" disabled={query.isFetching} onClick={()=>void query.refetch()}>Refresh</Button>
    {query.isPending?<p role="status">Loading deliveries…</p>:query.isError?<p role="alert">Email delivery details could not be loaded.</p>:<>
      <AdminPanel title="Daily email allowance"><p>{query.data.enabled?`Mode: ${query.data.mode}`:'Email sending is disabled.'}</p><p>{query.data.routineEnabled?"Personal library notices and overdue summaries enabled.":"Routine notices paused; account workflows only."}</p><p>{query.data.used} of {query.data.limit} send attempts today; {query.data.reserve} reserved for account and security emails.</p><p>UTC day: {query.data.periodStart}. Resets automatically at 00:00 UTC (08:00 Philippine time).</p><p>This counter covers this application only. Brevo account usage may differ.</p>{(!query.data.periodValid||query.data.used>=query.data.limit-query.data.reserve)&&<p role="alert">Routine emails are paused until the next UTC day. Account emails can use the reserve but also stop at the daily total limit.</p>}</AdminPanel>
      <AdminPanel title="Latest 100 deliveries">{!query.data.rows.length?<p>No email deliveries recorded.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Recipient','Purpose','Status','Attempts','Detail','Action'].map(label=><th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{query.data.rows.map(row=><tr key={row.id} className="border-t"><td className="p-3">{row.recipient}</td><td className="p-3">{row.purpose.replace(/_/g,' ')}</td><td className="p-3">{row.status==='accepted'?((row.provider_mode || query.data.mode)==='capture'?'Captured locally':'Accepted by provider'):row.status}</td><td className="p-3">{row.attempts}</td><td className="p-3">{row.last_error||'—'}{row.provider_message_id&&<div className="mt-2 max-w-xs break-all text-xs"><span className="block font-medium">Brevo message ID</span><code className="select-all">{row.provider_message_id}</code></div>}</td><td className="p-3">{row.status==='failed'&&!['setup','verify_email','recovery','password_changed','email_changed'].includes(row.purpose)?<Button variant="outline" disabled={Boolean(busy)} onClick={()=>void retry(row.id)}>{busy===row.id?'Queuing…':'Retry email'}</Button>:row.status==='unknown'?'Review; no automatic resend':row.status==='failed'?'Request a fresh account email or await the next event':'—'}</td></tr>)}</tbody></table></div>}</AdminPanel>
    </>}{error&&<p role="alert">{error}</p>}
  </AdminPage>;
}

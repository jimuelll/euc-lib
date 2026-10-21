import {useState, type FormEvent} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import * as api from '../profile.api';
function ProfileForm({profile}:{profile:api.Profile}) {
 const client=useQueryClient();
 const [form,setForm]=useState(profile),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);setMessage('');setError('');
  try {const saved=await api.saveProfile(form);setForm(saved);client.setQueryData(['own-profile'],saved);await client.invalidateQueries({queryKey:['account-email']});setMessage('Account details saved.');}
  catch(error){setError((error as {response?:{data?:{message?:string}}})?.response?.data?.message||'Unable to save account details. Try again.');}
  finally{setBusy(false);}
 };
 return <form onSubmit={submit} className="space-y-4 py-6" aria-label="Edit account details"><div className="grid gap-4 sm:grid-cols-2">
  {([{key:'name',label:'Full name',max:255,complete:'name'},{key:'username',label:'Login username',max:50,complete:'username'},{key:'address',label:'Address',max:100,complete:'street-address'},{key:'contact',label:'Contact number',max:11,complete:'tel'}] as const).map(field=><label key={field.key} className="block space-y-2"><span>{field.label}</span><Input value={form[field.key]} onChange={event=>setForm({...form,[field.key]:event.target.value})} required={field.key==='name'||field.key==='username'} maxLength={field.max} autoComplete={field.complete} type={field.key==='contact'?'tel':'text'} pattern={field.key==='contact'?'[0-9]{11}':undefined} title={field.key==='contact'?'Enter an 11-digit contact number':undefined} disabled={busy}/></label>)}
 </div><p className="text-sm text-muted-foreground">Use your login username when signing in. Email and password changes are available below.</p><Button disabled={busy}>{busy?'Saving…':'Save account details'}</Button>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="text-destructive">{error}</p>}</form>;
}
export default function SuperAdminProfileEditor(){
 const query=useQuery({queryKey:['own-profile'],queryFn:api.getProfile});
 if(query.isPending)return <p role="status">Loading account details…</p>;
 if(query.isError)return <div><p role="alert">Account details could not be loaded.</p><Button variant="outline" onClick={()=>void query.refetch()}>Try again</Button></div>;
 return <ProfileForm profile={query.data}/>;
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as api from '../account-email.api';

type Step = 'email' | 'code' | 'password' | 'verify' | 'done';
const errorMessage = (error: unknown) => (error as {response?:{data?:{message?:string}}})?.response?.data?.message || 'Unable to complete this request. Try again.';
export default function EmailAccess() {
  const { pathname, hash } = useLocation();
  const setup=pathname==='/set-password', verify=pathname==='/verify-email';
  const [step,setStep]=useState<Step>(verify?'verify':setup?'password':'email');
  const [email,setEmail]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [authorization,setAuthorization]=useState(()=>{const params=new URLSearchParams(hash.slice(1));return {id:params.get('id')||'',token:params.get('token')||''};});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[cooldown,setCooldown]=useState(0);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{document.querySelector('meta[name="referrer"]')?.remove();const meta=document.createElement('meta');meta.name='referrer';meta.content='no-referrer';document.head.append(meta);return ()=>meta.remove();},[]);
  useEffect(()=>{heading.current?.focus();},[step]);
  useEffect(()=>{if(!cooldown)return;const timer=window.setInterval(()=>setCooldown(value=>Math.max(0,value-1)),1000);return ()=>window.clearInterval(timer);},[cooldown]);
  const requestCode=async()=>{await api.requestRecovery(email);setCooldown(60);setMessage('If eligible, a recovery code has been queued. Check your inbox.');};
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return;setError('');setBusy(true);
    try {
      if(step==='email'){await requestCode();setStep('code');}
      else if(step==='code'){const response=await api.verifyRecovery(email,code);setAuthorization(response);setStep('password');setCode('');setMessage('Choose your new password.');}
      else if(step==='password'){
        if(password!==confirm)throw new Error('Passwords do not match.');
        const response=await (setup?api.completeSetup(authorization,password):api.completeReset(authorization,password));
        setMessage(response.message);setStep('done');setPassword('');setConfirm('');setAuthorization({id:'',token:''});window.history.replaceState(null,'',pathname);
      }else if(step==='verify'){
        const response=await api.verifyEmail(authorization);setMessage(response.message);setStep('done');setAuthorization({id:'',token:''});window.history.replaceState(null,'',pathname);
      }
    }catch(error){setError(error instanceof Error && !('response' in error)?error.message:errorMessage(error));}finally{setBusy(false);}
  };
  const title=step==='done'?'Account updated':verify?'Verify your email':setup?'Set your password':step==='email'?'Recover your password':step==='code'?'Enter your recovery code':'Choose a new password';
  return <main data-library-design className="min-h-screen bg-background text-foreground px-4 py-12"><div className="mx-auto max-w-lg space-y-6">
    <Link to="/login" className="text-action underline">Back to sign in</Link>
    <h1 ref={heading} tabIndex={-1} className="font-heading text-3xl">{title}</h1>
    <p className="text-muted-foreground">{setup?'Your invitation is valid for 24 hours. Library staff never needs to know your password.':verify?'Confirm this address to receive library email and recover your account.':'Use your verified library account email. If you cannot access it, contact library staff.'}</p>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
    {step!=='done' && <form onSubmit={submit} className="space-y-5 border-y py-6">
      {step==='email' && <label className="block space-y-2"><span>Email address</span><Input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required maxLength={255} disabled={busy}/></label>}
      {step==='code' && <><p>A code expires after 10 minutes and allows five attempts.</p><label className="block space-y-2"><span>Six-digit code</span><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))} required disabled={busy}/></label></>}
      {step==='password' && <><label className="block space-y-2"><span>New password</span><Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} disabled={busy}/></label><p className="text-sm text-muted-foreground">At least 8 characters; maximum 72 UTF-8 bytes.</p><label className="block space-y-2"><span>Confirm password</span><Input type="password" autoComplete="new-password" required value={confirm} onChange={event=>setConfirm(event.target.value)} disabled={busy}/></label></>}
      {step==='verify' && <p>Select Verify email to confirm. Opening this page alone does not use the link.</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy?'Working…':step==='email'?'Send recovery code':step==='code'?'Verify code':step==='verify'?'Verify email':'Save password'}</Button>
      {step==='code' && <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={busy||cooldown>0} onClick={async()=>{setBusy(true);setError('');try{await requestCode();}catch(error){setError(errorMessage(error));}finally{setBusy(false);}}}>{cooldown?`Resend in ${cooldown}s`:'Resend code'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setStep('email');setCode('');setMessage('');}}>Use another email</Button></div>}
    </form>}
    {step==='done' && <Button asChild><Link to="/login">Sign in</Link></Button>}
  </div></main>;
}

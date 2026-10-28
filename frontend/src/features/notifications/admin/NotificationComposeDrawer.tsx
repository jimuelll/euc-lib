import "../../admin/manage/refined-drawers.css";
import {useEffect,useRef,useState, type ReactNode} from 'react';
import {useQuery,useQueries,useQueryClient} from '@tanstack/react-query';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {AdminDetailDrawer,AdminDateTime,AdminIcon,formatAdminDate,useAdminConfirmDialog,useUnsavedChanges} from '@/features/admin';
import {useDebounce} from '@/hooks/use-debounce';
import {getApiErrorMessage} from '@/utils/apiError';
import {fetchBulletinPosts} from '@/features/bulletin';
import {notificationKeys} from '../notifications.keys';
import NotificationMessage from '../NotificationMessage';
import NotificationImageUpload from './NotificationImageUpload';
import {NotificationEmailOptions} from './NotificationEmailOptions';
import {countNotificationRecipients,createAdminNotification,previewNotificationEmail,searchNotificationRecipients,type AdminNotification,type AudienceType,type NotificationRecipient} from './api';

const types = [['announcement','Announcement'],['reminder','Reminder'],['reservation_ready','Reservation ready'],['reservation_cancelled','Reservation cancelled'],['overdue_fine','Overdue fine']];
const roles = ['student','alumni','employee','scanner','opac','staff','admin','super_admin'];
const destinations = [['none','No link'],['/my-library','My Library'],['/bulletin','Bulletin'],['/services/borrowing','Borrowing services'],['/catalogue','Catalogue']];
const sectionNames = ['Content','Audience','Delivery','Preview'];
const label = (value:string) => value.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
const patronCount = (count:number) => `${count.toLocaleString()} ${count===1?'patron':'patrons'}`;
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
function Field({label:caption,id,children}:{label:string;id:string;children:ReactNode}) {
  return <div className="notification-field"><label htmlFor={id}>{caption}</label>{children}</div>;
}
function Segments({label:caption,value,items,onChange}:{label:string;value:string;items:string[][];onChange:(value:string)=>void}) {
  return <div className="notification-segments" role="group" aria-label={caption}>{items.map(([key,text])=><button type="button" key={key} aria-pressed={value===key} onClick={()=>onChange(key)}>{text}</button>)}</div>;
}

export default function NotificationComposeDrawer({initial,onClose,onSent}:{initial:AdminNotification|null;onClose:()=>void;onSent:(message:string)=>Promise<void>}) {
  const [form,setForm]=useState(()=>({type:initial?.type || 'announcement',title:initial?.title || '',body:initial?.body || '',href:initial?.href || 'none',audienceType:(initial?.audience_type==='user'?'users':initial?.audience_type || 'all') as AudienceType,audienceRole:initial?.audience_role || 'student',sendMode:'now',scheduledAt:'',expiresAt:'',sendEmail:false,imageUrl:initial?.image_url || '',imagePublicId:initial?.image_public_id || '',imageAlt:initial?.image_alt || ''}));
  const [recipients,setRecipients]=useState<NotificationRecipient[]>(()=>initial?.audience_users || (initial?.audience_type==='user' ? [{id:initial.audience_user_id!,name:initial.audience_user_name || 'Patron',role:'',student_employee_id:initial.audience_user_patron_id || '',username:initial.audience_user_identifier,library_card_number:null,student_number:null,employee_number:null}] : []));
  const [postSearch,setPostSearch]=useState('');
  const [selectedPostTitle,setSelectedPostTitle]=useState('');
  const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [imageUploading,setImageUploading]=useState(false),[imageBlocked,setImageBlocked]=useState(false),[activeSection,setActiveSection]=useState('Content');
  const [clock,setClock]=useState(Date.now),[openedAt]=useState(()=>new Date().toISOString());
  const submitLock=useRef(false),searchRef=useRef<HTMLInputElement>(null);
  const client=useQueryClient(),{confirm,confirmDialog}=useAdminConfirmDialog();
  const guard=useUnsavedChanges({form,recipients},true);
  const q=useDebounce(search.trim(),300);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const set=<K extends keyof typeof form>(key:K,value:typeof form[K])=>{setForm(old=>({...old,[key]:value}));setError('');};
  const audience={audienceType:form.audienceType,audienceRole:form.audienceType==='role'?form.audienceRole:null,audienceUserId:null,audienceUserIds:form.audienceType==='users'?recipients.map(r=>r.id).sort((a,b)=>a-b):undefined};
  const audienceReady=form.audienceType!=='users'||recipients.length>0;
  const countKey=[...notificationKeys.admin(),'count',audience];
  const emailKey=[...notificationKeys.admin(),'email-preview',audience];
  const count=useQuery({queryKey:countKey,queryFn:({signal})=>countNotificationRecipients(audience,signal),enabled:audienceReady,staleTime:0,refetchInterval:30_000});
  const email=useQuery({queryKey:emailKey,queryFn:({signal})=>previewNotificationEmail(audience,signal),enabled:audienceReady&&form.sendEmail,staleTime:0,refetchInterval:30_000});
  const roleCounts=useQueries({queries:roles.map(role=>({queryKey:[...notificationKeys.admin(),'role-count',role],queryFn:({signal}:{signal:AbortSignal})=>countNotificationRecipients({audienceType:'role',audienceRole:role,audienceUserId:null},signal),enabled:form.audienceType==='role',staleTime:0,refetchInterval:30_000}))});
  const matches=useQuery({queryKey:notificationKeys.recipientSearch(q),queryFn:({signal})=>searchNotificationRecipients(q,signal),enabled:form.audienceType==='users'&&q.length>=2});
  const posts=useQuery({queryKey:['notification-post-picker',postSearch],queryFn:({signal})=>fetchBulletinPosts({search:postSearch,limit:50},signal),enabled:form.href==='/bulletin'||form.href.startsWith('/bulletin?post=')});
  const scheduled=form.sendMode==='schedule',sendTime=scheduled?new Date(form.scheduledAt).getTime():clock;
  const expiry=form.expiresAt?new Date(form.expiresAt).getTime():null;
  const invalidTime=scheduled&&(!Number.isFinite(sendTime)||sendTime<=clock);
  const invalidExpiry=expiry!==null&&(!Number.isFinite(expiry)||expiry<=sendTime);
  const validContent=Boolean(form.title.trim()&&form.body.trim());
  const countReady=audienceReady&&!count.isFetching&&!count.isError&&count.data!==undefined;
  const emailReady=!form.sendEmail||(!email.isFetching&&!email.isError&&Boolean(email.data?.enabled&&email.data.emailCount));
  const canSend=validContent&&countReady&&Boolean(count.data)&&emailReady&&!invalidTime&&!invalidExpiry&&!imageUploading&&!imageBlocked&&!busy;
  const select=(item:NotificationRecipient)=>{setRecipients(old=>old.some(r=>r.id===item.id)?old:[...old,item]);setError('');searchRef.current?.focus();};
  const jump=(name:string)=>{
    setActiveSection(name);
    const heading=document.getElementById(`notification-section-${name.toLowerCase()}`);
    heading?.focus({preventScroll:true});
    const behavior=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';
    const scrollArea=heading?.closest('form');
    if(scrollArea && heading)scrollArea.scrollTo?.({top:Math.max(0,scrollArea.scrollTop+heading.getBoundingClientRect().top-scrollArea.getBoundingClientRect().top-8),behavior});
    if(name==='Preview')document.querySelector('.notification-preview-scroll')?.scrollTo?.({top:0,behavior});
  };
  const close=async()=>{if(!submitLock.current&&!imageUploading&&await guard.confirmDiscard())onClose();};
  const send=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!canSend||submitLock.current)return;
    submitLock.current=true;setBusy(true);setError('');
    try {
      const total=await countNotificationRecipients(audience);
      const emailPreview=form.sendEmail?await previewNotificationEmail(audience):null;
      const previousTotal=count.data,previousEmail=email.data?.emailCount;
      client.setQueryData(countKey,total);if(emailPreview)client.setQueryData(emailKey,emailPreview);
      if(!total)throw new Error('This audience has no active recipients.');
      if(emailPreview&&(!emailPreview.enabled||!emailPreview.emailCount))throw new Error(emailPreview.reason || 'No verified email recipients. Uncheck email to send in-app only.');
      const scheduledAt=scheduled?new Date(form.scheduledAt).toISOString():null,expiresAt=form.expiresAt?new Date(form.expiresAt).toISOString():null;
      if(scheduledAt&&new Date(scheduledAt).getTime()<=Date.now())throw new Error('Choose a send time in the future.');
      if(expiresAt&&new Date(expiresAt).getTime()<=new Date(scheduledAt || Date.now()).getTime())throw new Error('Expiry must be after the send time.');
      const changed=previousTotal!==total || Boolean(emailPreview&&previousEmail!==emailPreview.emailCount);
      const audienceText=form.audienceType==='all'?'Everyone':form.audienceType==='role'?label(form.audienceRole):recipients.map(r=>r.name).join(', ');
      if((form.audienceType!=='users'||recipients.length>1||form.sendEmail)&&!await confirm({title:scheduled?'Schedule notification?':'Send notification?',description:`${changed?'Recipient counts have changed. Review the updated totals. ':''}“${form.title.trim()}” — ${audienceText}. ${total.toLocaleString()} in-app recipients${emailPreview?`; ${emailPreview.emailCount.toLocaleString()} by email, ${emailPreview.skippedCount.toLocaleString()} in-app only`:''}. ${scheduledAt?`Send ${formatAdminDate(scheduledAt)} (${timezone}). Recipients are checked at publication; counts are estimates.`:`Send now (${timezone}).`} ${expiresAt?`Expires ${formatAdminDate(expiresAt)} (${timezone}).`:'Never expires.'}${emailPreview?' Email is queued; overflow waits for later daily allowances.':''}`,actionLabel:scheduled?'Schedule notification':`Send to ${patronCount(total)}`,cancelLabel:'Keep editing'}))return;
      await createAdminNotification({...audience,type:form.type,title:form.title.trim(),body:form.body.trim(),href:form.href==='none'?null:form.href,scheduledAt,expiresAt,sendEmail:form.sendEmail,imageUrl:form.imageUrl||null,imagePublicId:form.imagePublicId||null,imageAlt:form.imageAlt||null,confirmedRecipientCount:total,confirmedEmailCount:emailPreview?.emailCount});
      guard.markSaved();onClose();
      await onSent(scheduled?'Notification scheduled.':form.sendEmail?'Notification published in-app. Emails queued for delivery.':'Notification sent.');
    } catch(failure) {setError(getApiErrorMessage(failure,'Could not send notification.'));void count.refetch();if(form.sendEmail)void email.refetch();}
    finally {submitLock.current=false;setBusy(false);}
  };
  const scope=!audienceReady?'Select patrons':count.isError?'Recipient count unavailable':count.isFetching||count.data===undefined?'Counting recipients…':`${scheduled?'Estimated: ':''}${count.data.toLocaleString()} recipients${form.sendEmail?email.isFetching?' · Checking email…':email.isError?' · Email count unavailable':email.data?` · ${email.data.emailCount.toLocaleString()} by email, ${email.data.skippedCount.toLocaleString()} in-app only`:'':''}`;
  const previewDestination=form.href.startsWith('/bulletin?post=')?'Bulletin post':destinations.find(item=>item[0]===form.href)?.[1];
  return <><AdminDetailDrawer open onClose={()=>void close()} title="New notification" description="Compose a message for your patrons." className="notification-drawer notification-compose-drawer refined-drawer" headerActions={<nav className="notification-section-index refined-section-index" aria-label="Compose sections">{sectionNames.map(name=><button key={name} type="button" aria-current={activeSection===name?'location':undefined} onClick={()=>jump(name)}>{name}</button>)}</nav>} footer={<><span className="notification-footer-scope" role="status">{scope}</span><Button variant="outline" disabled={busy||imageUploading} onClick={()=>void close()}>Cancel</Button><Button className="notification-send" type="submit" form="notification-compose" disabled={!canSend}>{busy?'Processing…':scheduled?invalidTime?'Choose send time':`Schedule for ${formatAdminDate(form.scheduledAt)}`:countReady?`Send to ${patronCount(count.data!)}`:'Send notification'}</Button></>}>
    <div className="notification-compose-layout">
      <form id="notification-compose" onSubmit={event=>void send(event)} className="notification-compose"><fieldset disabled={busy}>
        <section className="notification-compose-section"><h3 id="notification-section-content" tabIndex={-1}>Content</h3>
          <Field label="Type" id="notification-type"><Select value={form.type} onValueChange={value=>set('type',value)}><SelectTrigger id="notification-type"><SelectValue/></SelectTrigger><SelectContent>{types.map(([value,text])=><SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Title" id="notification-title"><Input id="notification-title" required maxLength={200} value={form.title} onChange={event=>set('title',event.target.value)} placeholder="Give your notification a clear title" aria-describedby="notification-title-hint notification-title-count"/><span id="notification-title-hint" className="notification-helper">{form.title.length>60?'Long titles may be harder to scan. Aim for 60 characters or fewer.':'Aim for 60 characters or fewer.'}</span><span id="notification-title-count" className="notification-counter" data-warning={form.title.length>=180}>{form.title.length>=180?`${200-form.title.length} characters remaining`:`${form.title.length} / 200`}</span></Field>
          <Field label="Message" id="notification-body"><Textarea id="notification-body" required rows={5} maxLength={2000} value={form.body} onChange={event=>set('body',event.target.value)} placeholder="Write the message patrons will see" aria-describedby="notification-body-count"/><span id="notification-body-count" className="notification-counter" data-warning={form.body.length>=1800}>{form.body.length>=1800?`${2000-form.body.length} characters remaining`:`${form.body.length} / 2,000`}</span></Field>
          {!form.href.startsWith('/bulletin?post=')&&<NotificationImageUpload url={form.imageUrl} alt={form.imageAlt} onChange={(imageUrl,imagePublicId)=>setForm(old=>({...old,imageUrl,imagePublicId,imageAlt:imageUrl===old.imageUrl?old.imageAlt:''}))} onAltChange={value=>set('imageAlt',value)} onBusy={setImageUploading} onBlocked={setImageBlocked}/>}
          <Field label="Link to (optional)" id="notification-destination"><Select value={form.href.startsWith('/bulletin?post=')?'/bulletin':form.href} onValueChange={value=>setForm(old=>({...old,href:value,...(old.href.startsWith('/bulletin?post=')?{imageUrl:'',imagePublicId:'',imageAlt:''}:{})}))}><SelectTrigger id="notification-destination" aria-describedby="notification-link-help"><SelectValue/></SelectTrigger><SelectContent>{destinations.map(([value,text])=><SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent></Select><span id="notification-link-help" className="notification-helper">Where patrons go when they open this notification.</span></Field>
          {(form.href==='/bulletin'||form.href.startsWith('/bulletin?post='))&&<Field label="Link a bulletin post" id="notification-post-search"><Input id="notification-post-search" value={postSearch} onChange={event=>setPostSearch(event.target.value)} placeholder="Search published posts"/><p className="notification-helper">Choose a post to link directly and carry its primary image.</p>{form.href.startsWith('/bulletin?post=')&&<div className="notification-linked-post" role="status"><strong>Post linked</strong><span>{selectedPostTitle||`Bulletin post #${form.href.split('=')[1]}`}</span><small>{form.imageUrl?'Primary image included':'No primary image'}</small><Button type="button" variant="outline" onClick={()=>{set('href','/bulletin');setSelectedPostTitle('');setForm(old=>({...old,imageUrl:'',imagePublicId:'',imageAlt:''}));}}>Remove link</Button></div>}{posts.isError?<p role="alert">Could not load posts. Try another search.</p>:posts.isPending?<p>Loading posts…</p>:<div className="notification-matches">{!posts.data?.data.length&&<p>No published posts match your search.</p>}{posts.data?.data.map(post=><button type="button" key={post.id} aria-pressed={form.href===`/bulletin?post=${post.id}`} onClick={()=>{setSelectedPostTitle(post.title);setForm(old=>({...old,href:`/bulletin?post=${post.id}`,imageUrl:post.image_url||'',imagePublicId:'',imageAlt:post.image_alt||''}));}}>{post.title}</button>)}</div>}</Field>}
        </section>
        <section className="notification-compose-section"><h3 id="notification-section-audience" tabIndex={-1}>Audience</h3>
          <Segments label="Audience" value={form.audienceType} items={[["all","Everyone"],["role","By role"],["users","Specific patrons"]]} onChange={value=>set('audienceType',value as AudienceType)}/>
          {form.audienceType==='role'&&<div className="notification-role-chips" role="group" aria-label="Audience role">{roles.map((role,index)=><button key={role} type="button" aria-pressed={form.audienceRole===role} onClick={()=>set('audienceRole',role)}>{label(role)} <span>{roleCounts[index].isFetching?'…':roleCounts[index].isError?'Unavailable':roleCounts[index].data?.toLocaleString()??'…'}</span></button>)}{roleCounts.some(query=>query.isError)&&<p role="alert">Some role counts could not be loaded. <Button type="button" variant="outline" onClick={()=>roleCounts.forEach(query=>void query.refetch())}>Retry role counts</Button></p>}</div>}
          {form.audienceType==='users'&&<Field label="Find patrons" id="notification-recipient"><Input ref={searchRef} id="notification-recipient" autoComplete="off" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search patron name, ID or username" aria-describedby="notification-recipient-help"/><span id="notification-recipient-help" className="notification-helper">Type at least 2 characters. Select one or more active patrons.</span>{recipients.length>0&&<ul className="notification-selected-patrons" aria-label="Selected patrons">{recipients.map(item=><li key={item.id}><span>{item.name}<small>{item.username||item.student_employee_id}</small></span><Button variant="ghost" type="button" size="icon" aria-label={`Remove ${item.name}`} onClick={()=>setRecipients(old=>old.filter(r=>r.id!==item.id))}><AdminIcon name="close"/></Button></li>)}</ul>}{search.trim().length>=2&&<div className="notification-matches" aria-live="polite">{q!==search.trim()||matches.isFetching?'Searching…':matches.isError?<p role="alert">Could not search patrons. <Button variant="outline" type="button" onClick={()=>void matches.refetch()}>Retry</Button></p>:matches.data?.length?matches.data.map(item=><button type="button" key={item.id} disabled={recipients.some(r=>r.id===item.id)} onClick={()=>select(item)}>{item.name}{recipients.some(r=>r.id===item.id)?' · Selected':''}<small>{item.username||item.student_employee_id} · {label(item.role)}</small></button>):'No active patrons match.'}</div>}</Field>}
          {count.isError&&<p role="alert">Could not count recipients. <Button type="button" variant="outline" onClick={()=>void count.refetch()}>Retry count</Button></p>}
          {audienceReady&&countReady&&count.data===0&&<p role="status">This audience has no active recipients.</p>}
        </section>
        <section className="notification-compose-section"><h3 id="notification-section-delivery" tabIndex={-1}>Delivery</h3>
          <NotificationEmailOptions checked={form.sendEmail} onChange={checked=>set('sendEmail',checked)} preview={audienceReady?email.data:undefined} loading={audienceReady&&email.isPending} error={email.isError} onRetry={()=>void email.refetch()} scheduled={scheduled}/>
          <Segments label="Send timing" value={form.sendMode} items={[["now","Send now"],["schedule","Schedule"]]} onChange={value=>set('sendMode',value)}/>
          {scheduled&&<><AdminDateTime label="Send date and time" hideTimeUntilDate value={form.scheduledAt} onChange={value=>set('scheduledAt',value)}/>{form.scheduledAt&&invalidTime&&<p role="alert">Choose a send time in the future.</p>}<p className="notification-helper">Recipients are checked at publication; counts are estimates.</p></>}
          <div className="notification-expiry"><AdminDateTime label="Expires (optional)" optional hideTimeUntilDate value={form.expiresAt} onChange={value=>set('expiresAt',value)}/><p className="notification-helper">Never expires if left empty.</p>{invalidExpiry&&<p role="alert">Expiry must be after the send time.</p>}</div>
          <p className="notification-helper">Dates and times use {timezone}.</p>
        </section>
        {error&&<p className="notification-feedback" role="alert">{error}</p>}
      </fieldset></form>
      <aside className="notification-live-preview" aria-label="Patron preview"><h3 id="notification-section-preview" tabIndex={-1}><AdminIcon name="eye"/>In-app preview</h3><div className="notification-preview-scroll" tabIndex={0} role="region" aria-label="Complete notification preview"><span className="notification-type">{types.find(([value])=>value===form.type)?.[1]}</span><h4>{form.title.trim()||'Notification title (preview)'}</h4><time>{scheduled&&!invalidTime?formatAdminDate(form.scheduledAt):scheduled?'Send time not selected':formatAdminDate(openedAt)}</time><NotificationMessage body={form.body.trim()||'Your message appears here (preview).'} imageUrl={form.imageUrl} imageAlt={form.imageAlt}/>{form.href!=='none'&&<span className="notification-preview-link">Open {previewDestination}<AdminIcon name="external"/></span>}</div></aside>
    </div>
  </AdminDetailDrawer>{confirmDialog}{guard.discardDialog}</>;
}

import NotificationMessage from './NotificationMessage';
export {NotificationImage} from './NotificationImage';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {fetchNotification} from './notifications.service';
import './notification-reader.css';
export default function NotificationReader({id,userId,onClose,onMarkRead,onDestination,onAfterClose}:{id:number|null;userId:number|null;onClose:()=>void;onMarkRead:(id:number)=>Promise<void>;onDestination:(href:string)=>void;onAfterClose:()=>void}) {
 const query=useQuery({queryKey:['notification-reader',userId,id],queryFn:({signal})=>fetchNotification(id!,signal),enabled:Boolean(id&&userId),gcTime:0,staleTime:0,retry:false});
 const [readError,setReadError]=useState(false),[reading,setReading]=useState(false),attempted=useRef<number|null>(null),leavingForDestination=useRef(false);
 const record=query.data,refetch=query.refetch;
 const read=useCallback(async()=>{if(!id)return;setReading(true);setReadError(false);try{await onMarkRead(id);}catch{setReadError(true);}finally{setReading(false);}},[id,onMarkRead]);
 useEffect(()=>{setReadError(false);attempted.current=null;},[id]);
 useEffect(()=>{if(record&&!query.isError&&attempted.current!==id){attempted.current=id;if(!record.is_read)void read();}},[id,record,query.isError,read]); // Read once after the authorized details request succeeds.
 useEffect(()=>{if(!record?.expires_at)return;const delay=new Date(record.expires_at).getTime()-Date.now();const timer=setTimeout(()=>void refetch(),Math.max(0,Math.min(delay+50,2147483647)));return()=>clearTimeout(timer);},[record?.expires_at,refetch]);
 const status=(query.error as {response?:{status?:number}})?.response?.status;
 const unavailable=status===404||status===403;
 return <Dialog open={Boolean(id&&userId)} onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="notification-reader" onCloseAutoFocus={event=>{event.preventDefault();if(!leavingForDestination.current)onAfterClose();}}><DialogHeader><DialogTitle>{!query.isError&&record?record.title:'Notification'}</DialogTitle><DialogDescription>{!query.isError&&record?new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Manila'}).format(new Date(record.created_at)):'A message from your library.'}</DialogDescription></DialogHeader><div className="notification-reader-body">{query.isPending?<p role="status">Loading notification…</p>:query.isError?<div role={unavailable?'status':'alert'}><h3>{unavailable?'Notification unavailable':'Could not load this notification'}</h3><p>{unavailable?'This notification may have expired or may no longer be available to your account.':'Check your connection and try again.'}</p>{!unavailable&&<Button variant="outline" onClick={()=>void query.refetch()}>Retry</Button>}</div>:record?<><NotificationMessage body={record.body} imageUrl={record.image_url} imageAlt={record.image_alt}/>{readError&&<div className="notification-read-error" role="alert">This notification could not be marked as read.<Button variant="outline" disabled={reading} onClick={()=>void read()}>{reading?'Saving…':'Retry marking as read'}</Button></div>}</>:null}</div><footer><Button variant="outline" onClick={onClose}>Close</Button>{!query.isError&&record?.href&&<Button onClick={()=>{leavingForDestination.current=true;onDestination(record.href!);}}>Open {record.href.startsWith('/admin/moderation')?'Moderation':record.href.startsWith('/my-library')?'My Library':record.href.startsWith('/bulletin')?'Bulletin':record.href.startsWith('/catalogue')?'Catalogue':'destination'}</Button>}</footer></DialogContent></Dialog>;
}

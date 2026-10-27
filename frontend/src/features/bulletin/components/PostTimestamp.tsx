import {useEffect,useState} from 'react';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
export function fullTimestamp(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString('en-US',{dateStyle:'medium',timeStyle:'long'});}
export default function PostTimestamp({value,editedAt,interactive=true}:{value:string;editedAt?:string|null;interactive?:boolean}){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const date=new Date(value);if(Number.isNaN(date.getTime()))return <span>{value}</span>;
 const seconds=(date.getTime()-now)/1000,age=Math.abs(seconds);
 const relative=age<60?'now':`${seconds>0?'in ':''}${Math.floor(age/(age<3600?60:age<86400?3600:age<604800?86400:age<2592000?604800:age<31536000?2592000:31536000))}${age<3600?'m':age<86400?'h':age<604800?'d':age<2592000?'w':age<31536000?'mo':'y'}`;
 const label=<><time dateTime={date.toISOString()} title={fullTimestamp(value)} aria-label={fullTimestamp(value)}>{relative}</time>{editedAt&&<> <span className="post-edited" title={`Last edited ${fullTimestamp(editedAt)}`}>(edited)</span></>}</>;
 if(!interactive)return <span className="post-timestamp">{label}</span>;
 return <span className="post-timestamp"><Popover><PopoverTrigger asChild><button className="post-time-trigger" type="button" aria-label={`Show full timestamp: ${fullTimestamp(value)}`}>{label}</button></PopoverTrigger><PopoverContent collisionPadding={12} className="post-time-details" aria-label="Full timestamp" side="top" align="start"><p><strong>Published</strong><time dateTime={date.toISOString()}>{fullTimestamp(value)}</time></p>{editedAt&&<p><strong>Last edited</strong><time dateTime={Number.isNaN(new Date(editedAt).getTime())?undefined:new Date(editedAt).toISOString()}>{fullTimestamp(editedAt)}</time></p>}</PopoverContent></Popover></span>;
}

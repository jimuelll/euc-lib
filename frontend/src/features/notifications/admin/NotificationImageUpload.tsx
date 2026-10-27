import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {AdminIcon} from '@/features/admin';
import {uploadNotificationImage} from './api';
export default function NotificationImageUpload({url,alt,onChange,onAltChange,onBusy,onBlocked}:{url:string;alt:string;onChange:(url:string,id:string)=>void;onAltChange:(alt:string)=>void;onBusy:(busy:boolean)=>void;onBlocked:(blocked:boolean)=>void}) {
  const [file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[progress,setProgress]=useState(0),[uploading,setUploading]=useState(false),[dragging,setDragging]=useState(false),[thumbnail,setThumbnail]=useState('');
  const controller=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{controller.current?.abort();onBusy(false);onBlocked(false);},[onBusy,onBlocked]);
  useEffect(()=>{
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024||!URL.createObjectURL){setThumbnail('');return;}
    const objectUrl=URL.createObjectURL(file);setThumbnail(objectUrl);return()=>URL.revokeObjectURL(objectUrl);
  },[file]);
  const upload=async(next:File)=>{
    if(controller.current)return;
    setFile(next);setError('');onBlocked(false);
    if(!['image/jpeg','image/png','image/webp'].includes(next.type)||next.size>5*1024*1024){setError('Choose a JPG, PNG, or WebP image of 5 MB or less.');onBlocked(true);return;}
    const request=new AbortController();controller.current=request;setUploading(true);onBusy(true);setProgress(0);
    try {const result=await uploadNotificationImage(next,value=>setProgress(value),request.signal);if(!request.signal.aborted)onChange(result.imageUrl,result.imagePublicId);}
    catch {if(!request.signal.aborted){setError('Image upload failed. Retry or remove the image to continue.');onBlocked(true);}}
    finally {if(controller.current===request){controller.current=null;setUploading(false);onBusy(false);}}
  };
  const remove=()=>{controller.current?.abort();controller.current=null;setUploading(false);onBusy(false);onBlocked(false);setError('');setFile(null);onChange('','');onAltChange('');};
  return <div className="notification-image-upload" role="group" aria-labelledby="notification-image-label">
    <label id="notification-image-label" htmlFor="notification-image-file">Image (optional)</label>
    <p id="notification-image-constraints">One JPG, PNG, or WebP image, up to 5 MB.</p>
    <div className="notification-image-privacy" role="note"><AdminIcon name="image"/><span>Images are public by URL; use general library images only.</span></div>
    <input ref={input} id="notification-image-file" hidden tabIndex={-1} aria-label={url?'Replace notification image':'Upload notification image'} aria-describedby="notification-image-constraints" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={event=>{const next=event.target.files?.[0];event.target.value='';if(next)void upload(next);}}/>
    <button type="button" className="notification-image-dropzone" data-dragging={dragging} disabled={uploading} onClick={()=>input.current?.click()} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);const files=event.dataTransfer.files;if(files.length!==1){setError('Choose one image at a time.');onBlocked(true);return;}if(!uploading)void upload(files[0]);}}>
      {(thumbnail||url)?<img src={thumbnail||url} alt="Selected image thumbnail"/>:<AdminIcon name="image"/>}<span><strong>{file?.name || (url?'Existing image':'Drop an image here or browse')}</strong><small>{file?`${(file.size/1024).toLocaleString(undefined,{maximumFractionDigits:1})} KB`:url?'Select to replace image':'Select one image'}</small></span>
    </button>
    {uploading&&<p role="status">Uploading image… {progress}%</p>}
    {error&&<div role="alert">{error}{file&&['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=5*1024*1024&&<Button type="button" variant="outline" onClick={()=>void upload(file)}>Retry image upload</Button>}</div>}
    {(url||file||uploading||error)&&<Button type="button" variant="outline" onClick={remove}>{uploading?'Cancel image upload':'Remove image'}</Button>}
    {url&&<><label htmlFor="notification-image-alt">Image description</label><Input id="notification-image-alt" required maxLength={250} value={alt} onChange={event=>onAltChange(event.target.value)} placeholder="Describe the information in the image"/></>}
  </div>;
}

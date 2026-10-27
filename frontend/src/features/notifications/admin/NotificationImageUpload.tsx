import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {AdminIcon} from '@/features/admin';
import {uploadNotificationImage} from './api';
import {compressNotificationImage,MAX_NOTIFICATION_IMAGE_BYTES} from './compressNotificationImage';

type Phase = 'idle' | 'compressing' | 'review' | 'uploading';
const validTypes = ['image/jpeg','image/png','image/webp'];
const formatSize = (size:number) => size >= 1024*1024 ? `${(size/(1024*1024)).toLocaleString(undefined,{maximumFractionDigits:2})} MB` : `${(size/1024).toLocaleString(undefined,{maximumFractionDigits:1})} KB`;
export default function NotificationImageUpload({url,alt,onChange,onAltChange,onBusy,onBlocked}:{url:string;alt:string;onChange:(url:string,id:string)=>void;onAltChange:(alt:string)=>void;onBusy:(busy:boolean)=>void;onBlocked:(blocked:boolean)=>void}) {
  const [file,setFile]=useState<File|null>(null),[prepared,setPrepared]=useState<File|null>(null),[error,setError]=useState(''),[progress,setProgress]=useState(0),[phase,setPhase]=useState<Phase>('idle'),[dragging,setDragging]=useState(false),[thumbnail,setThumbnail]=useState('');
  const controller=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null);
  const working=phase==='compressing'||phase==='uploading';
  useEffect(()=>()=>{controller.current?.abort();onBusy(false);onBlocked(false);},[onBusy,onBlocked]);
  useEffect(()=>{
    const preview=prepared || (file && file.size<=MAX_NOTIFICATION_IMAGE_BYTES ? file : null);
    if(!preview||!validTypes.includes(preview.type)||!URL.createObjectURL){setThumbnail('');return;}
    const objectUrl=URL.createObjectURL(preview);setThumbnail(objectUrl);return()=>URL.revokeObjectURL(objectUrl);
  },[file,prepared]);
  const uploadPrepared=async(next:File,request:AbortController)=>{
    setPhase('uploading');setProgress(0);
    try {const result=await uploadNotificationImage(next,value=>setProgress(value),request.signal);if(!request.signal.aborted){onChange(result.imageUrl,result.imagePublicId);onBlocked(false);setPhase('idle');}}
    catch {if(!request.signal.aborted){setError('Image upload failed. Retry or remove the image to continue.');onBlocked(true);setPhase('idle');}}
    finally {if(controller.current===request){controller.current=null;onBusy(false);}}
  };
  const select=async(next:File)=>{
    if(controller.current)return;
    setFile(next);setPrepared(null);setError('');onBlocked(false);
    if(!validTypes.includes(next.type)){setError('Choose a JPG, PNG, or WebP image.');onBlocked(true);return;}
    const request=new AbortController();controller.current=request;onBusy(true);
    if(next.size<=MAX_NOTIFICATION_IMAGE_BYTES){await uploadPrepared(next,request);return;}
    setPhase('compressing');
    try {
      const compressed=await compressNotificationImage(next,request.signal);
      if(!request.signal.aborted){setPrepared(compressed);setPhase('review');onBlocked(true);}
    } catch(failure) {
      if(!request.signal.aborted){setError(failure instanceof Error ? failure.message : 'Could not compress this image. Choose a smaller image.');onBlocked(true);setPhase('idle');}
    } finally {if(controller.current===request){controller.current=null;onBusy(false);}}
  };
  const confirmUpload=()=>{if(!prepared||controller.current)return;const request=new AbortController();controller.current=request;setError('');onBusy(true);void uploadPrepared(prepared,request);};
  const retry=()=>{if(prepared){confirmUpload();return;}if(file)void select(file);};
  const remove=()=>{controller.current?.abort();controller.current=null;setPhase('idle');onBusy(false);onBlocked(false);setError('');setFile(null);setPrepared(null);onChange('','');onAltChange('');};
  return <div className="notification-image-upload" role="group" aria-labelledby="notification-image-label">
    <label id="notification-image-label" htmlFor="notification-image-file">Image (optional)</label>
    <p id="notification-image-constraints">JPG, PNG, or WebP. Images over 5 MB are compressed before upload.</p>
    <div className="notification-image-privacy" role="note"><AdminIcon name="image"/><span>Images are public by URL; use general library images only.</span></div>
    <input ref={input} id="notification-image-file" hidden tabIndex={-1} aria-label={url?'Replace notification image':'Upload notification image'} aria-describedby="notification-image-constraints" type="file" accept="image/jpeg,image/png,image/webp" disabled={working} onChange={event=>{const next=event.target.files?.[0];event.target.value='';if(next)void select(next);}}/>
    <button type="button" className="notification-image-dropzone" data-dragging={dragging} disabled={working} onClick={()=>input.current?.click()} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);const files=event.dataTransfer.files;if(files.length!==1){setError('Choose one image at a time.');onBlocked(true);return;}if(!working)void select(files[0]);}}>
      {(thumbnail||url)?<img src={thumbnail||url} alt="Selected image thumbnail"/>:<AdminIcon name="image"/>}<span><strong>{file?.name || (url?'Existing image':'Drop an image here or browse')}</strong><small>{file?formatSize(file.size):url?'Select to replace image':'Select one image'}</small></span>
    </button>
    {phase==='compressing'&&<p role="status">Compressing image…</p>}
    {phase==='uploading'&&<p role="status">Uploading image… {progress}%</p>}
    {phase==='review'&&prepared&&<div className="notification-image-review"><strong role="status">Compressed to {formatSize(prepared.size)}</strong><p>Review the image before uploading. The image will be saved as a JPG with a white background.</p>{thumbnail&&<><img className="notification-compressed-preview" src={thumbnail} alt="Compressed image preview"/><a href={thumbnail} target="_blank" rel="noopener noreferrer">Open full-size preview<span className="sr-only"> (opens in a new tab)</span></a></>}<Button type="button" onClick={confirmUpload}>Upload compressed image</Button></div>}
    {error&&<div role="alert">{error}{file&&validTypes.includes(file.type)&&<Button type="button" variant="outline" onClick={retry}>Retry image upload</Button>}</div>}
    {(url||file||working||error)&&<Button type="button" variant="outline" onClick={remove}>{working?'Cancel image upload':'Remove image'}</Button>}
    {url&&<><label htmlFor="notification-image-alt">Image description (optional)</label><Input id="notification-image-alt" maxLength={250} value={alt} onChange={event=>onAltChange(event.target.value)} placeholder="Describe the information in the image" aria-describedby="notification-image-alt-help"/><p id="notification-image-alt-help">A description helps patrons who use screen readers understand the image.</p></>}
  </div>;
}

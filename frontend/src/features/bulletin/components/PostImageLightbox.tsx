import {useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {ChevronLeft,ChevronRight,Download,X,ZoomIn,ZoomOut} from 'lucide-react';
import type {PostImage} from '../types';
export default function PostImageLightbox({images,title,index,onIndexChange,onClose,onRestoreFocus}:{images:PostImage[];title:string;index:number|null;onIndexChange:(index:number)=>void;onClose:()=>void;onRestoreFocus:()=>void}){
 const [zoom,setZoom]=useState(false),[failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
 const start=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{setZoom(false);setFailed(false);setLoaded(false);},[index]);
 const current=index===null?null:images[index];
 const move=(delta:number)=>{if(index!==null)onIndexChange((index+delta+images.length)%images.length);};
 return <Dialog open={index!==null} onOpenChange={open=>{if(!open)onClose();}}><DialogContent hideClose className="post-image-viewer" onCloseAutoFocus={event=>{event.preventDefault();onRestoreFocus();}} onKeyDown={event=>{if(event.target instanceof HTMLInputElement)return;if(event.key==='ArrowRight'){event.preventDefault();move(1);}if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}}}>
  <DialogTitle className="sr-only">{title} image viewer</DialogTitle><DialogDescription className="sr-only">Use the arrow keys or previous and next buttons to browse. Escape closes the viewer.</DialogDescription>
  <header><span aria-live="polite">Image {(index??0)+1} of {images.length}</span><div><button type="button" disabled={failed} onClick={()=>setZoom(value=>!value)} aria-label={zoom?'Zoom out':'Zoom in'}>{zoom?<ZoomOut/>:<ZoomIn/>}<span>{zoom?'Fit image':'Zoom in'}</span></button>{current&&<a href={current.url.includes('/upload/')?current.url.replace('/upload/','/upload/fl_attachment/'):current.url} target="_blank" rel="noopener noreferrer" aria-label="Download selected image"><Download/><span>Download</span></a>}<button type="button" onClick={onClose} aria-label="Close image viewer"><X/></button></div></header>
  <div className="post-viewer-stage" data-zoomed={zoom} onTouchStart={event=>{const t=event.touches[0];start.current={x:t.clientX,y:t.clientY};}} onTouchEnd={event=>{const t=event.changedTouches[0],origin=start.current;start.current=null;if(!zoom&&origin&&Math.abs(t.clientX-origin.x)>50&&Math.abs(t.clientY-origin.y)<60){event.preventDefault();move(t.clientX<origin.x?1:-1);}}}>
   {current&&<><div className="post-viewer-image-scroll">{!loaded&&!failed&&<p role="status">Loading image…</p>}{failed?<div role="alert"><p>This image could not be loaded.</p><a href={current.url} target="_blank" rel="noopener noreferrer">Open original image</a></div>:<img key={current.url} src={current.url} alt={current.alt||`${title}, image ${(index??0)+1}`} data-zoomed={zoom} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} onClick={()=>setZoom(value=>!value)} draggable={false}/>}</div>{images.length>1&&<><button className="post-viewer-prev" type="button" onClick={()=>move(-1)} aria-label="Previous image"><ChevronLeft/></button><button className="post-viewer-next" type="button" onClick={()=>move(1)} aria-label="Next image"><ChevronRight/></button></>}</>}
  </div>
  <footer>{current?.alt&&<p>{current.alt}</p>}<div className="post-viewer-thumbnails" aria-label="Choose image">{images.map((image,i)=><button type="button" key={i} onClick={()=>onIndexChange(i)} aria-label={`View image ${i+1}`} aria-pressed={index===i}><img src={image.url} alt=""/></button>)}</div></footer>
 </DialogContent></Dialog>;
}

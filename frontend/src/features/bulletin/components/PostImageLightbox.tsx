import {useLayoutEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {ChevronLeft,ChevronRight,Download,X,ZoomIn,ZoomOut} from 'lucide-react';
import type {PostImage} from '../types';
export default function PostImageLightbox({images,title,index,onIndexChange,onClose,onRestoreFocus}:{images:PostImage[];title:string;index:number|null;onIndexChange:(index:number)=>void;onClose:()=>void;onRestoreFocus:()=>void}){
 const [zoom,setZoom]=useState(false),[failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
 const start=useRef<{x:number;y:number}|null>(null);
 const scroll=useRef<HTMLDivElement>(null),focusPoint=useRef({x:.5,y:.5});
 useLayoutEffect(()=>{setZoom(false);setFailed(false);setLoaded(false);},[index]);
 useLayoutEffect(()=>{
  const viewport=scroll.current;if(!viewport)return;
  if(!zoom){viewport.scrollLeft=0;viewport.scrollTop=0;return;}
  if(!loaded)return;
  const image=viewport.querySelector('img');if(!image)return;
  const viewportRect=viewport.getBoundingClientRect(),imageRect=image.getBoundingClientRect();
  const x=imageRect.left-viewportRect.left+viewport.scrollLeft+imageRect.width*focusPoint.current.x;
  const y=imageRect.top-viewportRect.top+viewport.scrollTop+imageRect.height*focusPoint.current.y;
  viewport.scrollLeft=x-viewport.clientWidth/2;viewport.scrollTop=y-viewport.clientHeight/2;
 },[zoom,index,loaded]);
 const current=index===null?null:images[index];
 const move=(delta:number)=>{if(index!==null)onIndexChange((index+delta+images.length)%images.length);};
 const toggleZoom=(point={x:.5,y:.5})=>{if(zoom){setZoom(false);return;}focusPoint.current=point;setZoom(true);};
 const zoomAtImagePoint=(event:React.MouseEvent<HTMLImageElement>)=>{
  if(zoom){setZoom(false);return;}
  const image=event.currentTarget,rect=image.getBoundingClientRect();
  let x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
  if(image.naturalWidth&&image.naturalHeight){
   const scale=Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight);
   const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
   x=(event.clientX-rect.left-(rect.width-width)/2)/width;
   y=(event.clientY-rect.top-(rect.height-height)/2)/height;
  }
  focusPoint.current={x:Math.min(1,Math.max(0,x)),y:Math.min(1,Math.max(0,y))};setZoom(true);
 };
 return <Dialog open={index!==null} onOpenChange={open=>{if(!open)onClose();}}><DialogContent hideClose className="post-image-viewer" onCloseAutoFocus={event=>{event.preventDefault();onRestoreFocus();}} onKeyDown={event=>{if(event.target instanceof HTMLInputElement)return;if(event.key==='ArrowRight'){event.preventDefault();move(1);}if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}}}>
  <DialogTitle className="sr-only">{title} image viewer</DialogTitle><DialogDescription className="sr-only">Use the arrow keys or previous and next buttons to browse. Escape closes the viewer.</DialogDescription>
  <header><span aria-live="polite">Image {(index??0)+1} of {images.length}</span><div><button type="button" disabled={failed} onClick={()=>toggleZoom()} aria-label={zoom?'Zoom out':'Zoom in'}>{zoom?<ZoomOut/>:<ZoomIn/>}<span>{zoom?'Fit image':'Zoom in'}</span></button>{current&&<a href={current.url.includes('/upload/')?current.url.replace('/upload/','/upload/fl_attachment/'):current.url} target="_blank" rel="noopener noreferrer" aria-label="Download selected image"><Download/><span>Download</span></a>}<button type="button" onClick={onClose} aria-label="Close image viewer"><X/></button></div></header>
  <div className="post-viewer-stage" data-zoomed={zoom} onTouchStart={event=>{const t=event.touches[0];start.current={x:t.clientX,y:t.clientY};}} onTouchEnd={event=>{const t=event.changedTouches[0],origin=start.current;start.current=null;if(!zoom&&origin&&Math.abs(t.clientX-origin.x)>50&&Math.abs(t.clientY-origin.y)<60){event.preventDefault();move(t.clientX<origin.x?1:-1);}}}>
   {current&&<><div ref={scroll} className="post-viewer-image-scroll">{!loaded&&!failed&&<p role="status">Loading image…</p>}{failed?<div role="alert"><p>This image could not be loaded.</p><a href={current.url} target="_blank" rel="noopener noreferrer">Open original image</a></div>:<img key={current.url} src={current.url} alt={current.alt||`${title}, image ${(index??0)+1}`} data-zoomed={zoom} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} onClick={zoomAtImagePoint} draggable={false}/>}</div>{images.length>1&&<><button className="post-viewer-prev" type="button" onClick={()=>move(-1)} aria-label="Previous image"><ChevronLeft/></button><button className="post-viewer-next" type="button" onClick={()=>move(1)} aria-label="Next image"><ChevronRight/></button></>}</>}
  </div>
  <footer>{current?.alt&&<p>{current.alt}</p>}<div className="post-viewer-thumbnails" aria-label="Choose image">{images.map((image,i)=><button type="button" key={i} onClick={()=>onIndexChange(i)} aria-label={`View image ${i+1}`} aria-pressed={index===i}><img src={image.url} alt=""/></button>)}</div></footer>
 </DialogContent></Dialog>;
}

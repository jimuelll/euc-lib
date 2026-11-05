import {LibraryDesignProvider} from '@/components/ui/library-design';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ImageOff} from 'lucide-react';
import type {PostImage} from '../types';
import PostImageLightbox from './PostImageLightbox';
const LIMIT=5;
function TileImage({image}:{image:PostImage}){const [error,setError]=useState(false);return error?<span className="post-tile-error"><ImageOff/>Image unavailable</span>:<img src={image.url} alt={image.alt} loading="lazy" onError={()=>setError(true)}/>;}
// A lone portrait image (poster, infographic) is shown whole beside the text; everything else leads the post.
function useIsTall(url:string|undefined){
 const [tall,setTall]=useState(false);
 useEffect(()=>{setTall(false);if(!url)return;let live=true;const probe=new Image();probe.onload=()=>{if(live)setTall(probe.naturalHeight>probe.naturalWidth*1.25);};probe.src=url;return()=>{live=false;};},[url]);
 return tall;
}
export default function PostMediaGallery({images,title,children}:{images:PostImage[];title:string;children:ReactNode}){
 const [index,setIndex]=useState<number|null>(null),opener=useRef<HTMLButtonElement|null>(null),tall=useIsTall(images.length===1?images[0].url:undefined);
 if(!images.length)return <>{children}</>;
 const open=(i:number)=>(event:React.MouseEvent<HTMLButtonElement>)=>{opener.current=event.currentTarget;setIndex(i);};
 const label=(i:number)=>`Open image ${i+1} of ${images.length}: ${images[i].alt||title}`;
 const thumbs=images.slice(1,LIMIT);
 const lightbox=<LibraryDesignProvider enabled={false}><PostImageLightbox images={images} title={title} index={index} onIndexChange={setIndex} onClose={()=>setIndex(null)} onRestoreFocus={()=>opener.current?.focus()}/></LibraryDesignProvider>;
 const hero=<div className="post-media" aria-label="Post images">
  <button type="button" className="post-media-hero" onClick={open(0)} aria-label={label(0)}><TileImage image={images[0]}/><span className="post-media-pill">{images.length>1?`1 of ${images.length}`:'View full image'}</span></button>
  {thumbs.length>0&&<div className="post-media-thumbs">{thumbs.map((image,k)=>{const i=k+1;return <button type="button" key={`${image.url}:${i}`} onClick={open(i)} aria-label={label(i)}><TileImage image={image}/>{i===LIMIT-1&&images.length>LIMIT?<span className="post-media-more">+{images.length-LIMIT}<span className="sr-only"> more images. View all images</span></span>:null}</button>;})}</div>}
 </div>;
 if(images.length===1&&tall)return <><div className="post-drawer-split">{children}<div className="post-media post-media-side" aria-label="Post images"><button type="button" onClick={open(0)} aria-label={label(0)}><TileImage image={images[0]}/><span className="post-media-pill">View full</span></button></div></div>{lightbox}</>;
 return <>{hero}{children}{lightbox}</>;
}

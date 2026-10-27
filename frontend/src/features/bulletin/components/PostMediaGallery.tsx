import {LibraryDesignProvider} from '@/components/ui/library-design';
import {useRef,useState} from 'react';
import {ImageOff} from 'lucide-react';
import type {PostImage} from '../types';
import PostImageLightbox from './PostImageLightbox';
function TileImage({image}:{image:PostImage}){const [error,setError]=useState(false);return error?<span className="post-tile-error"><ImageOff/>Image unavailable</span>:<img src={image.url} alt={image.alt} loading="lazy" onError={()=>setError(true)}/>;}
export default function PostMediaGallery({images,title,compact=false}:{images:PostImage[];title:string;compact?:boolean}){
 const [index,setIndex]=useState<number|null>(null),opener=useRef<HTMLButtonElement|null>(null);
 const limit=compact?4:5;
 if(!images.length)return null;
 return <><div className="post-media-grid" data-count={Math.min(images.length,limit)} data-compact={compact} aria-label="Post images">{images.slice(0,limit).map((image,i)=><button type="button" key={`${image.url}:${i}`} onClick={event=>{opener.current=event.currentTarget;setIndex(i);}} aria-label={`Open image ${i+1} of ${images.length}: ${image.alt||title}`}><TileImage image={image}/>{i===limit-1&&images.length>limit?<span className="post-media-more">+{images.length-limit}<span className="sr-only"> more images. View all images</span></span>:null}</button>)}</div><LibraryDesignProvider enabled={false}><PostImageLightbox images={images} title={title} index={index} onIndexChange={setIndex} onClose={()=>setIndex(null)} onRestoreFocus={()=>opener.current?.focus()}/></LibraryDesignProvider></>;
}

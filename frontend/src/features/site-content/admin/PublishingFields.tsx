import ReactCrop, {centerCrop,makeAspectCrop,type PercentCrop} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import { cloneElement, createContext, useContext, useEffect, useId, useState, useRef, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminIcon } from "@/features/admin";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
export const UploadActivityContext = createContext<(id: string, active: boolean) => void>(() => { });
export function formatContentDate(value: unknown, includeTime = true) { if (!value)
    return "Not recorded"; const date = new Date(String(value)); return Number.isFinite(date.getTime()) ? (includeTime ? timeFormat : dateFormat).format(date) : "Date unavailable"; }
export function ContentField({ label, hint, children }: {
    label: string;
    hint?: string;
    children: ReactElement;
}) { const id = useId(); return <div className="content-field"><Label htmlFor={id}>{label}</Label>{cloneElement(children, { id, "aria-describedby": hint ? id + "-hint" : undefined })}{hint && <p id={id + "-hint"} className="content-secondary">{hint}</p>}</div>; }
export {AdminDateTime as ContentDateTime} from '@/features/admin';

export function ContentImageUpload({label,value,onChange,alt="",onAltChange}:{label:string;value:string|null;onChange:(url:string|null,publicId?:string|null)=>void;alt?:string;onAltChange?:(alt:string)=>void}) {
 const id=useId(),upload=useCloudinaryUpload("library/website"),report=useContext(UploadActivityContext);
 const [error,setError]=useState(""),[source,setSource]=useState(""),[aspect,setAspect]=useState<number|undefined>(16/9);
 const [crop,setCrop]=useState<PercentCrop>({unit:"%",x:0,y:0,width:100,height:100});const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{report(id,upload.uploading||Boolean(source));return()=>report(id,false);},[report,id,upload.uploading,source]);
 useEffect(()=>()=>{if(source)URL.revokeObjectURL(source);},[source]);
 const resetCrop=(ratio:number|undefined)=>{setAspect(ratio);const element=image.current;if(element)setCrop(ratio?centerCrop(makeAspectCrop({unit:"%",width:100},ratio,element.width,element.height),element.width,element.height):{unit:"%",x:0,y:0,width:100,height:100});};
 const send=async()=>{const element=image.current;if(!element)return;setError("");try{const width=element.naturalWidth*crop.width/100,height=element.naturalHeight*crop.height/100;if(width<64||height<64)throw new Error("Choose a crop at least 64 pixels wide and high.");const scale=Math.min(1,2400/Math.max(width,height));const canvas=document.createElement("canvas");canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);const context=canvas.getContext("2d");if(!context)throw new Error("Image cropping is unavailable. Try another browser.");context.drawImage(element,element.naturalWidth*crop.x/100,element.naturalHeight*crop.y/100,width,height,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(next=>next?resolve(next):reject(new Error("Could not crop this image.")),"image/jpeg",.9));const result=await upload.upload(blob);if(result){onChange(result.secure_url,result.public_id);setSource("");}}catch(next){setError(next instanceof Error?next.message:"Could not process this image.");}};
 return <div className="content-field"><Label htmlFor={id}>{label}</Label>{value?<img className="publishing-image-thumb" src={value} alt={alt||label+" preview"}/>:<div className="publishing-image-placeholder"><AdminIcon name="image"/><span>No image selected</span></div>}
 <Input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={upload.uploading} onChange={event=>{const file=event.target.files?.[0];if(!file)return;event.target.value="";setError("");upload.reset();if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024){setError("Choose a JPG, PNG, or WebP image up to 5 MB.");return;}setSource(URL.createObjectURL(file));}}/>
 <p className="content-secondary">JPG, PNG or WebP · up to 5 MB · crop before upload</p>
 {onAltChange&&(value||source)&&<ContentField label="Image description" hint="Describe what the image shows. Leave blank for a decorative image."><Input maxLength={500} value={alt} onChange={event=>onAltChange(event.target.value)}/></ContentField>}
 {(error||upload.error)&&<p role="alert" className="content-notice">{error||upload.error}</p>}{value&&<Button variant="outline" className="self-start" onClick={()=>onChange(null,null)}>Remove image</Button>}
 <Dialog open={Boolean(source)} onOpenChange={open=>{if(!open&&!upload.uploading)setSource("");}}><DialogContent className="publishing-crop-dialog"><DialogHeader><DialogTitle>Crop {label.toLowerCase()}</DialogTitle><DialogDescription>Choose the area to keep, then upload it.</DialogDescription></DialogHeader>
 <ContentField label="Crop shape"><select value={aspect||"free"} onChange={event=>resetCrop(event.target.value==="free"?undefined:Number(event.target.value))}><option value="1.7777777777777777">Landscape (16:9)</option><option value="1">Square</option><option value="1.3333333333333333">Photo (4:3)</option><option value="free">Free crop</option></select></ContentField>
 <div className="publishing-crop-area"><ReactCrop crop={crop} aspect={aspect} onChange={(_,percent)=>setCrop(percent)} disabled={upload.uploading}><img ref={image} src={source} alt="Image to crop" onLoad={event=>{const element=event.currentTarget;if(element.naturalWidth<64||element.naturalHeight<64||element.naturalWidth*element.naturalHeight>40000000){setError("Choose an image at least 64 × 64 pixels and below 40 megapixels.");setSource("");return;}resetCrop(aspect);}} onError={()=>{setError("This file could not be read as an image.");setSource("");}}/></ReactCrop></div>
 {(error||upload.error)&&<p role="alert">{error||upload.error}</p>}<div className="publishing-crop-actions"><Button variant="outline" disabled={upload.uploading} onClick={()=>setSource("")}>Cancel</Button><Button className="publishing-primary" disabled={upload.uploading} onClick={()=>void send()}>{upload.uploading?"Uploading "+upload.progress+"%":"Use cropped image"}</Button></div>
 </DialogContent></Dialog></div>;
}

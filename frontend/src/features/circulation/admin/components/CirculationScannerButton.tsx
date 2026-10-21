import {useEffect,useRef,useState} from "react";
import {useZxingScanner} from "@/features/scan-qr";
import {QrCode} from "@/components/ui/library-glyphs";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
function Camera({onScan,onClose}:{onScan:(value:string)=>void;onClose:()=>void}) {
 const consumed=useRef(false);
 const {videoRef,error}=useZxingScanner({active:true,facingMode:"environment",onResult:value=>{
  const identifier=value.trim();
  if(consumed.current||!identifier)return;
  consumed.current=true;onClose();onScan(identifier);
 }});
 return <div className="space-y-3"><video ref={videoRef} autoPlay muted playsInline style={{transform:"scaleX(-1)"}} className="aspect-video w-full rounded-md bg-black object-cover" aria-label="Scanner camera preview"/>
 {error?<div role="alert"><p>{error}. Allow camera access and use HTTPS or localhost. You can also type the identifier or use a USB scanner.</p><Button variant="outline" onClick={onClose}>Close scanner</Button></div>:<p role="status" className="text-sm text-muted-foreground">Point the camera at the ID barcode or copy QR code. The first readable code will be used.</p>}</div>;
}
export default function CirculationScannerButton({label,onScan,disabled=false}:{label:string;onScan:(value:string)=>void;disabled?:boolean}) {
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 return <><Button type="button" variant="outline" disabled={disabled} onClick={()=>setOpen(true)}><QrCode className="mr-2 h-4 w-4"/>{label}</Button>
 <Dialog open={open&&!disabled} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>Scan a barcode or QR code to look up the record. Review the details before confirming the transaction.</DialogDescription></DialogHeader>{open&&!disabled&&<Camera onScan={onScan} onClose={()=>setOpen(false)}/>}</DialogContent></Dialog></>;
}

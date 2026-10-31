import { useState, useEffect } from "react";
import { Download, Printer } from "@/components/ui/library-glyphs";
import { toast } from "@/components/ui/sonner";
import type { QrTarget } from "../AdminManage.types";
import { fetchUserBarcode } from "../../api";
import { printCodeLabel } from "@/utils/printCodeLabel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ─── QR Modal ─────────────────────────────────────────────────────────────────

interface QrModalProps {
  target:  QrTarget;
  onClose: () => void;
}

export const QrModal = ({ target, onClose }: QrModalProps) => {
 const [qrUrl,setQrUrl]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let url:string|null=null;let active=true;setLoading(true);setQrUrl(null);fetchUserBarcode(target.studentId).then(blob=>{url=URL.createObjectURL(blob);if(active)setQrUrl(url);else URL.revokeObjectURL(url);}).catch(()=>{if(active)toast.error("Could not load QR code");}).finally(()=>{if(active)setLoading(false);});return ()=>{active=false;if(url)URL.revokeObjectURL(url);};},[target.studentId]);
 const handleDownload=()=>{if(!qrUrl)return;const link=document.createElement("a");link.href=qrUrl;link.download=`qr-${target.studentId}.png`;link.click();};
 const handlePrint=()=>{if(!qrUrl)return;if(!printCodeLabel({imageUrl:qrUrl,title:target.name,code:target.studentId,kind:"Library patron"}))toast.error("Allow pop-ups to print this label.");};
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{target.name}</DialogTitle><DialogDescription>{target.studentId} / Library QR identity</DialogDescription></DialogHeader><div className="grid justify-items-center gap-4">{loading ? <p>Loading library QR...</p> : qrUrl ? <img src={qrUrl} alt={`QR code for ${target.studentId}`} className="h-48 w-48" /> : <p role="alert">Could not load this QR code.</p>}<Button onClick={handleDownload} disabled={!qrUrl}><Download className="mr-2 h-4 w-4" />Download PNG</Button><Button variant="outline" onClick={handlePrint} disabled={!qrUrl}><Printer className="mr-2 h-4 w-4" />Print label</Button></div></DialogContent></Dialog>;
};

import { fetchCatalogBarcode } from "./catalog.api";
import { toast } from "@/components/ui/sonner";
import { qrLabelSheetHtml } from "@/utils/qrLabelSheet";
export async function printCatalogLabels(barcodes:string[]) {
 const popup=window.open("","_blank","width=700,height=600"); if(!popup){toast.error("Allow pop-ups to print labels.");return;} popup.opener=null;popup.document.write("<p>Preparing copy labels...</p>");const urls:string[]=[];
 try { for(const barcode of barcodes) urls.push(await fetchCatalogBarcode(barcode)); if(!urls.length){popup.close();return;} popup.document.open();popup.document.write(qrLabelSheetHtml(urls,"Copy labels"));popup.document.close();await Promise.all(Array.from(popup.document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;})));popup.onafterprint=()=>{urls.forEach(URL.revokeObjectURL);popup.close();};popup.print(); } catch {urls.forEach(URL.revokeObjectURL);popup.close();toast.error("Could not prepare labels. Try again.");}
}

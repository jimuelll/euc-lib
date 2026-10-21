import type { CatalogHolding } from "./catalog.api";
import { toast } from "@/components/ui/sonner";
export function holdingPrintRows(holding:CatalogHolding):[string,string][] {
 const rows:[string,unknown][] = [
  ["Title",holding.title],["Author",holding.author],["ISBN",holding.isbn],
  ["Copy ID",holding.copy_id],["Barcode",holding.barcode],["Accession number",holding.accession_number],
  ["Accession status",holding.accession_voided?"Voided":holding.accession_number?"Assigned":"Not assigned"],
  ["Condition",holding.condition],["Copy status",holding.is_active?"Active":"Inactive"],
  ["Circulation status",holding.circulation_status],["Loan policy",holding.book_type],
  ["Price (PHP)",holding.price],["Course / program",holding.course],["Course code",holding.course_code],
  ["Location",holding.location],["Date acquired",holding.date_acquired?String(holding.date_acquired).slice(0,10):null],
  ["Distributor",holding.distributor],["Invoice / O.R.",holding.invoice_reference],
 ];
 return rows.map(([label,value])=>[label,value===null||value===undefined||value===""?"—":String(value)]);
}
/** Rasterize text with the browser's fonts so non-Latin catalog titles remain readable. */
export function holdingCardCanvas(holding:CatalogHolding):HTMLCanvasElement {
 const canvas=document.createElement("canvas");
 const context=canvas.getContext("2d");
 if(!context)throw new Error("Canvas is unavailable");
 const width=352,padding=16,labelWidth=112,lineHeight=12,scale=3;
 context.font="10px Arial, sans-serif";
 const wrap=(text:string,maxWidth:number)=>{
  const lines:string[]=[];
  for(const paragraph of text.split(/\r?\n/)){
   let line="";
   for(const char of Array.from(paragraph)){
    if(line && context.measureText(line+char).width>maxWidth){lines.push(line);line="";}
    line+=char;
   }
   lines.push(line||" ");
  }
  return lines;
 };
 const rows=holdingPrintRows(holding).map(([label,value])=>({label:wrap(label,labelWidth-8),value:wrap(value,width-2*padding-labelWidth-8)}));
 const heights=rows.map(row=>Math.max(row.label.length,row.value.length)*lineHeight+6);
 const height=54+heights.reduce((sum,value)=>sum+value,0)+32;
 canvas.width=width*scale;canvas.height=height*scale;
 context.scale(scale,scale);context.fillStyle="#fff";context.fillRect(0,0,width,height);
 context.strokeStyle="#888";context.lineWidth=.6;context.strokeRect(.5,.5,width-1,height-1);
 context.fillStyle="#111";context.textBaseline="top";context.font="bold 15px Arial, sans-serif";context.fillText("EUC Library",padding,14);
 context.font="10px Arial, sans-serif";context.fillText("Physical copy holdings record",padding,33);
 let y=54;
 rows.forEach((row,index)=>{
  context.fillStyle="#111";context.font="bold 10px Arial, sans-serif";
  row.label.forEach((line,i)=>context.fillText(line,padding,y+3+i*lineHeight));
  context.font="10px Arial, sans-serif";
  row.value.forEach((line,i)=>context.fillText(line,padding+labelWidth,y+3+i*lineHeight));
  y+=heights[index];context.strokeStyle="#ddd";context.beginPath();context.moveTo(padding,y);context.lineTo(width-padding,y);context.stroke();
 });
 context.font="8px Arial, sans-serif";context.fillStyle="#555";context.fillText(`Printed ${new Date().toLocaleString()}`,padding,y+12);
 return canvas;
}
export async function holdingCardPdf(canvas:HTMLCanvasElement) {
 const {jsPDF}=await import("jspdf");
 const cardWidth=93,cardHeight=cardWidth*canvas.height/canvas.width;
 // A normal sheet keeps printer drivers from centering a small custom-size page.
 // Draw the entire card as one image at the top left, so it cannot paginate.
 const margin=8,scale=Math.min(1,(297-2*margin)/cardHeight);
 const widthMm=cardWidth*scale,heightMm=cardHeight*scale;
 const pdf=new jsPDF({unit:"mm",format:"a4",orientation:"portrait",compress:true});
 pdf.setProperties({title:"EUC Library — Holdings card"});
 pdf.addImage(canvas.toDataURL("image/png"),"PNG",margin,margin,widthMm,heightMm);
 return pdf;
}
export async function printHolding(holding:CatalogHolding):Promise<void> {
 const popup=window.open("","_blank","width=600,height=800");
 if(!popup){toast.error("Allow pop-ups to print holdings.");return;}
 popup.opener=null;
 try {
  popup.document.body.textContent="Preparing holdings card PDF…";
  await document.fonts.ready;
  const pdf=await holdingCardPdf(holdingCardCanvas(holding));
  const url=URL.createObjectURL(pdf.output("blob"));
  popup.location.replace(url);
  // Keep the PDF available to the viewer; release it after the user closes the tab.
  const timer=window.setInterval(()=>{if(popup.closed){window.clearInterval(timer);URL.revokeObjectURL(url);}},1000);
 }catch{popup.close();toast.error("Could not prepare the holdings record. Try again.");}
}

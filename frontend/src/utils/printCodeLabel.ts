import { qrLabelSheetHtml } from "./qrLabelSheet";

/** Prints a QR label on the shared A4 label sheet (30 x 30 mm cell, top left). */
export function printCodeLabel({ imageUrl }: { imageUrl: string; title?: string; code?: string; kind?: string }) {
  // `noopener` deliberately returns null in some browsers, which looks exactly like a blocked popup.
  const printWindow = window.open("", "_blank", "width=700,height=600");
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.write(qrLabelSheetHtml([imageUrl]) + "<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>");
  printWindow.document.close();
  return true;
}

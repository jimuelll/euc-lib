/** Prints a QR-only label at 30 x 30 mm, suitable for square thermal labels or plain paper. */
export function printCodeLabel({ imageUrl }: { imageUrl: string; title?: string; code?: string; kind?: string }) {
  // `noopener` deliberately returns null in some browsers, which looks exactly like a blocked popup.
  const printWindow = window.open("", "_blank", "width=420,height=320");
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.write(`<!doctype html><html><head><title>Print label</title><style>
    @page { size: 30mm 30mm; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; }
    .label { width: 30mm; height: 30mm; padding: 1.5mm; display: grid; place-items: center; overflow: hidden; }
    img { width: 27mm; height: 27mm; object-fit: contain; image-rendering: pixelated; }
    @media print { body { width: 30mm; height: 30mm; } }
  </style></head><body><main class="label"><img src="${imageUrl}" alt="" /></main><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
  printWindow.document.close();
  return true;
}

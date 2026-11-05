/**
 * Shared A4 sheet layout for QR labels: 30 x 30 mm cells tiled 6 across x 9 down (54 per page),
 * so one or many labels share a page instead of using a page each. Dashed borders are cut guides.
 */
export const QR_LABEL_MM = 30;

export function qrLabelSheetHtml(imageUrls: string[], title = "Print labels") {
  const cells = imageUrls.map((url) => `<div class="label"><img alt="" src="${url}"/></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    .sheet { display: grid; grid-template-columns: repeat(6, ${QR_LABEL_MM}mm); grid-auto-rows: ${QR_LABEL_MM}mm; }
    .label { width: ${QR_LABEL_MM}mm; height: ${QR_LABEL_MM}mm; padding: 1.5mm; display: grid; place-items: center; overflow: hidden; border: 0.2mm dashed #aaa; break-inside: avoid; }
    img { width: 27mm; height: 27mm; object-fit: contain; image-rendering: pixelated; }
  </style></head><body><main class="sheet">${cells}</main></body></html>`;
}

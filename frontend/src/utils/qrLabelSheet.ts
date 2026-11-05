/**
 * Shared A4 sheet layout for QR labels: 30 x 30 mm cells tiled 6 across x 9 down (54 per page),
 * so one or many labels share a page instead of using a page each. Dashed borders are cut guides.
 */
export const QR_LABEL_MM = 30;

export function qrLabelSheetHtml(imageUrls: string[], title = "Print labels") {
  // @page margin is 0 so browsers drop their date/URL header and footer; each page carries its own 10 mm inset.
  const pages: string[] = [];
  for (let i = 0; i < imageUrls.length; i += 54) {
    const cells = imageUrls.slice(i, i + 54).map((url) => `<div class="label"><img alt="" src="${url}"/></div>`).join("");
    pages.push(`<main class="sheet">${cells}</main>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    .sheet:last-child { break-after: auto; }
    body { margin: 0; }
    .sheet { height: 296mm; padding: 10mm; break-after: page; display: grid; align-content: start; grid-template-columns: repeat(6, ${QR_LABEL_MM}mm); grid-auto-rows: ${QR_LABEL_MM}mm; }
    .label { width: ${QR_LABEL_MM}mm; height: ${QR_LABEL_MM}mm; padding: 1.5mm; display: grid; place-items: center; overflow: hidden; border: 0.2mm dashed #aaa; break-inside: avoid; }
    img { width: 27mm; height: 27mm; object-fit: contain; image-rendering: pixelated; }
  </style></head><body>${pages.join("")}</body></html>`;
}

import fs from "node:fs";
import path from "node:path";
const qr = require("qrcode") as {
  create: (value: string, options: { errorCorrectionLevel: "H" }) => { modules: { size: number } };
  toBuffer: (value: string, options: { type: "png"; scale: number; margin: number; errorCorrectionLevel: "H" }) => Promise<Buffer>;
};
const sharp = require("sharp") as typeof import("sharp");

const QUIET_ZONE_MODULES = 2;
const TARGET_PX = 600;     // hi-res source; printed at 27 mm this is well above printer resolution
const LOGO_WIDTH_RATIO = 0.22; // of the whole image; ~5% of the area, far below level H's 30% recovery

// Runs from backend/ (ts-node) and backend/dist/ (compiled), so look in both places for assets/.
const logoPath = [path.resolve(__dirname, "../../assets/qr-logo.png"), path.resolve(__dirname, "../../../assets/qr-logo.png")].find((p) => fs.existsSync(p));
let logo: Promise<Buffer> | undefined;
const logoOfSize = (px: number) => { logo ??= fs.promises.readFile(logoPath!); return logo.then((buf) => sharp(buf).resize(px, px).png().toBuffer()); };

/**
 * PNG QR code with the library logo in the centre.
 * Uses error correction H so the scanner can recover the modules the logo covers, and an
 * integer pixel size per module so the edges stay sharp when printed.
 */
export async function renderQrPng(value: string): Promise<Buffer> {
  const modules = qr.create(value, { errorCorrectionLevel: "H" }).modules.size;
  const scale = Math.max(1, Math.round(TARGET_PX / (modules + QUIET_ZONE_MODULES * 2)));
  const base = await qr.toBuffer(value, { type: "png", scale, margin: QUIET_ZONE_MODULES, errorCorrectionLevel: "H" });
  if (!logoPath) return base; // never fail a print because the logo file is missing
  const size = (modules + QUIET_ZONE_MODULES * 2) * scale;
  const logoPx = Math.round(size * LOGO_WIDTH_RATIO);
  const offset = Math.round((size - logoPx) / 2);
  return sharp(base).composite([{ input: await logoOfSize(logoPx), left: offset, top: offset }]).png().toBuffer();
}

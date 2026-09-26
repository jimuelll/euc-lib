const multer = require("multer");
import type { NextFunction, Request, Response } from "express";

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
interface UploadFileLike { mimetype: string }
const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req: Request, file: UploadFileLike, callback: (error: Error | null, accept?: boolean) => void) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      return callback(Object.assign(new Error("Upload a JPG, PNG, or WebP image"), { status: 415 }));
    }
    return callback(null, true);
  },
}).single("image");

function parseCatalogImage(req: Request, res: Response, next: NextFunction): void {
  parser(req, res, (error: any) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "Images must be 5 MB or smaller" });
    }
    return res.status(error.status ?? 400).json({ message: error.message ?? "Invalid image upload" });
  });
}

export = { parseCatalogImage };

const multer = require("multer");

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      return callback(Object.assign(new Error("Upload a JPG, PNG, or WebP image"), { status: 415 }));
    }
    return callback(null, true);
  },
}).single("image");

function parseCatalogImage(req, res, next) {
  parser(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "Images must be 5 MB or smaller" });
    }
    return res.status(error.status ?? 400).json({ message: error.message ?? "Invalid image upload" });
  });
}

module.exports = { parseCatalogImage };

const service = require("./recommendations.service");
const sendError = (res, error, fallback) => res.status(error.status || 500).json({ message: error.message || fallback });
const forBook = async (req, res) => { try { res.json(await service.recommendationsForSeed(Number(req.params.bookId))); } catch (error) { sendError(res, error, "Failed to fetch recommendations"); } };
const mine = async (req, res) => { try { res.json(await service.personalized(req.user.id, String(req.query.materialType || "book"))); } catch (error) { sendError(res, error, "Failed to fetch recommendations"); } };
const dismiss = async (req, res) => { try { await service.dismiss(req.user.id, Number(req.params.bookId)); res.status(204).end(); } catch (error) { sendError(res, error, "Failed to dismiss recommendation"); } };
const backfill = async (_req, res) => {
  try {
    const result = await service.startBackfill();
    res.locals.auditDetails = { affectedCount: result.total };
    res.status(202).json(result);
  } catch (error) { sendError(res, error, "Embedding backfill failed"); }
};
const backfillProgress = async (_req, res) => { try { res.json(service.backfillProgress()); } catch (error) { sendError(res, error, "Failed to fetch embedding progress"); } };
const status = async (_req, res) => { try { res.json(await service.embeddingStatus()); } catch (error) { sendError(res, error, "Failed to fetch embedding status"); } };
const metadataBooks = async (req, res) => {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit) || 25)));
    res.json(await service.listMetadataBooks({ query: String(req.query.q || "").slice(0, 160), needsAttention: req.query.needsAttention === "true", page, limit }));
  } catch (error) { sendError(res, error, "Failed to find books"); }
};
const getBookMetadata = async (req, res) => {
  try { res.json(await service.getManualMetadata(Number(req.params.bookId))); }
  catch (error) { sendError(res, error, "Failed to load book details"); }
};
const saveBookMetadata = async (req, res) => {
  try { res.json(await service.saveManualMetadata(Number(req.params.bookId), req.body)); }
  catch (error) { sendError(res, error, "Failed to save book details"); }
};
module.exports = { forBook, mine, dismiss, backfill, backfillProgress, status, metadataBooks, getBookMetadata, saveBookMetadata };

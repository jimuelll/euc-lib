const service = require("./recommendations.service");
const sendError = (res, error, fallback) => res.status(error.status || 500).json({ message: error.message || fallback });
const forBook = async (req, res) => { try { res.json(await service.recommendationsForSeed(Number(req.params.bookId))); } catch (error) { sendError(res, error, "Failed to fetch recommendations"); } };
const mine = async (req, res) => { try { res.json(await service.personalized(req.user.id, String(req.query.materialType || "book"))); } catch (error) { sendError(res, error, "Failed to fetch recommendations"); } };
const dismiss = async (req, res) => { try { await service.dismiss(req.user.id, Number(req.params.bookId)); res.status(204).end(); } catch (error) { sendError(res, error, "Failed to dismiss recommendation"); } };
const backfill = async (_req, res) => { try { res.status(202).json(await service.startBackfill()); } catch (error) { sendError(res, error, "Embedding backfill failed"); } };
const backfillProgress = async (_req, res) => { try { res.json(service.backfillProgress()); } catch (error) { sendError(res, error, "Failed to fetch embedding progress"); } };
const status = async (_req, res) => { try { res.json(await service.embeddingStatus()); } catch (error) { sendError(res, error, "Failed to fetch embedding status"); } };
module.exports = { forBook, mine, dismiss, backfill, backfillProgress, status };

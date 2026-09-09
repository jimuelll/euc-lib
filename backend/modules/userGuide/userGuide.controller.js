const service = require("./userGuide.service");

const respond = (handler) => async (req, res) => {
  try {
    const result = await handler(req, res);
    if (!res.headersSent) res.json({ success: true, data: result });
  } catch (error) {
    console.error("[user-guide]", error);
    res.status(error.status || 500).json({ success: false, message: error.message || "User guide request failed." });
  }
};

exports.listPublished = respond((req) => service.listPublished(req.user.role));
exports.listForAdmin = respond(() => service.listForAdmin());
exports.createDraft = respond(async (req, res) => {
  const item = await service.createDraft(req.body, req.user.id);
  res.status(201).json({ success: true, data: item });
});
exports.updateDraft = respond((req) => service.updateDraft(Number(req.params.id), req.body, req.user.id));
exports.publish = respond((req) => service.publish(Number(req.params.id), req.user.id));
exports.unpublish = respond((req) => service.unpublish(Number(req.params.id), req.user.id));
exports.archive = respond(async (req, res) => {
  await service.archive(Number(req.params.id), req.user.id);
  res.json({ success: true, message: "Guide module archived." });
});
exports.reorder = respond(async (req, res) => {
  await service.reorder(req.body?.ids, req.user.id);
  res.json({ success: true, message: "Guide order updated." });
});

const service = require("./site-content.service");

async function getSiteContent(_req, res) {
  try { res.json(await service.get()); }
  catch (error) { res.status(error.status || 500).json({ message: error.message || "Failed to load site content" }); }
}

async function updateSiteContent(req, res) {
  try { res.json(await service.update(req.body, req.user?.id)); }
  catch (error) { res.status(error.status || 500).json({ message: error.message || "Failed to save site content" }); }
}

module.exports = { getSiteContent, updateSiteContent };

const service = require("./events.service");

async function listEvents(_req, res) {
  try { res.json(await service.listUpcomingEvents()); }
  catch { res.status(500).json({ message: "Could not load events" }); }
}

async function createEvent(req, res) {
  try {
    res.status(201).json(await service.createEvent({ title: req.body?.title, startsAt: req.body?.starts_at, endsAt: req.body?.ends_at, createdBy: req.user.id }));
  } catch (error) { res.status(error.status || 500).json({ message: error.message || "Could not create event" }); }
}

async function deleteEvent(req, res) {
  try { await service.deleteEvent(req.params.id); res.status(204).end(); }
  catch (error) { res.status(error.status || 500).json({ message: error.message || "Could not delete event" }); }
}

module.exports = { listEvents, createEvent, deleteEvent };

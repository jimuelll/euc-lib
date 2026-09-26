import type { Request, RequestHandler } from "express";
import service = require("./events.service");

type AuthenticatedRequest = Request & { user: { id: number } };
type ServiceError = { status?: number; message?: string };

const listEvents: RequestHandler = async (_req, res) => {
  try {
    res.json(await service.listUpcomingEvents());
  } catch {
    res.status(500).json({ message: "Could not load events" });
  }
};

const createEvent: RequestHandler = async (req, res) => {
  try {
    res.status(201).json(await service.createEvent({
      title: req.body?.title,
      startsAt: req.body?.starts_at,
      endsAt: req.body?.ends_at,
      createdBy: (req as AuthenticatedRequest).user.id,
    }));
  } catch (err) {
    const error = err as ServiceError;
    res.status(error.status || 500).json({ message: error.message || "Could not create event" });
  }
};

const deleteEvent: RequestHandler = async (req, res) => {
  try {
    await service.deleteEvent(req.params.id);
    res.status(204).end();
  } catch (err) {
    const error = err as ServiceError;
    res.status(error.status || 500).json({ message: error.message || "Could not delete event" });
  }
};

export = { listEvents, createEvent, deleteEvent };

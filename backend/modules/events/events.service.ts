import repository = require("./events.repository");
import {publishWithNotice} from "../notifications/publication-notification.service";
import type { CreateEventInput } from "./events.types";

function toSqlDateTime(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function listUpcomingEvents() {
  return repository.listUpcomingEvents();
}

async function createEvent({ title, startsAt, endsAt, createdBy, notifyUsers }: CreateEventInput) {
  const normalizedTitle = title?.trim();
  const normalizedStart = toSqlDateTime(startsAt);
  const normalizedEnd = endsAt === undefined || endsAt === null || endsAt === ""
    ? null
    : toSqlDateTime(endsAt);

  if (!normalizedTitle || !normalizedStart) {
    throw Object.assign(new Error("A title and valid start time are required"), { status: 400 });
  }
  if (endsAt && !normalizedEnd) {
    throw Object.assign(new Error("End time must be a valid date and time"), { status: 400 });
  }
  if (normalizedEnd && new Date(normalizedEnd).getTime() <= new Date(normalizedStart).getTime()) {
    throw Object.assign(new Error("End time must be after the start time"), { status: 400 });
  }

  const record={title:normalizedTitle,startsAt:normalizedStart,endsAt:normalizedEnd,createdBy};
  if(notifyUsers){const date=(value:string)=>new Date(value.replace(" ","T")+"Z").toLocaleString("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"});return publishWithNotice("events",createdBy,notifyUsers,normalizedTitle,`Event starts ${date(normalizedStart)}${normalizedEnd?` and ends ${date(normalizedEnd)}`:""}.`,{},conn=>repository.createEvent(record,conn));}
  return {id:await repository.createEvent(record)};
}

async function deleteEvent(id: string | string[] | number): Promise<void> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) {
    throw Object.assign(new Error("Invalid event ID"), { status: 400 });
  }
  await repository.deleteEvent(numericId);
}

export = { listUpcomingEvents, createEvent, deleteEvent };

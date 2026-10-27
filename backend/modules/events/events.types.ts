import type { RowDataPacket } from "mysql2/promise";

export interface LibraryEvent extends RowDataPacket {
  id: number;
  title: string;
  starts_at: Date | string;
  ends_at: Date | string | null;
}

export interface CreateEventInput {
  notifyUsers?: import("../notifications/publication-notification.service").PublicationNotice;
  title?: string | null;
  startsAt?: unknown;
  endsAt?: unknown;
  createdBy: number;
}

export interface EventWrite {
  title: string;
  startsAt: string;
  endsAt: string | null;
  createdBy: number;
}

import type { RowDataPacket } from "mysql2/promise";

export type DeliveryEventType = "notification" | "audit";

export interface DeliveryOutboxRow extends RowDataPacket {
  id: string;
  event_type: DeliveryEventType;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface DeliveryOutboxStoredRow extends RowDataPacket {
  id: string;
  event_type: DeliveryEventType;
  payload: unknown;
  attempts: number | string;
}

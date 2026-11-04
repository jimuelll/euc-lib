import type { Pool, RowDataPacket } from "mysql2/promise";
import type { PaginationOptions, SubscriptionPage, SubscriptionRecord } from "./subscriptions.types";

const db = require("../../db") as Pool;

interface SubscriptionCountRow extends RowDataPacket {
  total: number | string;
}

const getActiveSubscriptions = async (
  { page, limit }: PaginationOptions = {},
): Promise<SubscriptionRecord[] | SubscriptionPage> => {
  if (page !== undefined) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const [[{ total }]] = await db.query<SubscriptionCountRow[]>(
      "SELECT COUNT(*) AS total FROM academic_subscriptions WHERE is_active = 1 AND deleted_at IS NULL",
    );
    const [rows] = await db.query<SubscriptionRecord[]>(
      "SELECT * FROM academic_subscriptions WHERE is_active = 1 AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?",
      [safeLimit, (safePage - 1) * safeLimit],
    );
    return {
      rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: Number(total),
        totalPages: Math.max(1, Math.ceil(Number(total) / safeLimit)),
      },
    };
  }
  const [rows] = await db.query<SubscriptionRecord[]>(
    `SELECT * FROM academic_subscriptions
     WHERE is_active = 1 AND deleted_at IS NULL
     ORDER BY sort_order ASC, id ASC`,
  );
  return rows;
};

export = { getActiveSubscriptions };

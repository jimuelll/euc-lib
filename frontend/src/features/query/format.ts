import type { QueryColumn } from "./api";

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
});
const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
});

export function formatQueryValue(value: unknown, type: QueryColumn["type"] = "text") {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "text") return String(value);
  if (type === "number") return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(Number(value));
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return type === "date" ? dateFormatter.format(date) : dateTimeFormatter.format(date);
}

export const formatQueryGeneratedAt = (date: Date) => dateTimeFormatter.format(date);

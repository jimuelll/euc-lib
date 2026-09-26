type DateFormat = "date" | "dateTime";

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const formatQueryValue = (value: unknown, type: string): string => {
  if (value === null || value === undefined || value === "") return "";
  if (type !== "date" && type !== "dateTime") return String(value);
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value);
  return type === "date" ? dateFormatter.format(date) : dateTimeFormatter.format(date);
};

export = { formatQueryValue };

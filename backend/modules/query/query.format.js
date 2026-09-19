const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
});
const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
});

function formatQueryValue(value, type) {
  if (value === null || value === undefined || value === "") return "";
  if (type !== "date" && type !== "dateTime") return String(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return type === "date" ? dateFormatter.format(date) : dateTimeFormatter.format(date);
}

module.exports = { formatQueryValue };

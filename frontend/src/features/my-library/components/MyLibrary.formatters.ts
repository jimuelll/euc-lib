import {
  CalendarDays,
  GraduationCap,
  Search,
  UserRound,
} from "lucide-react";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import type { ActiveBorrow, ActiveReservation } from "../types";

const borrowStatusConfig: Record<ActiveBorrow["status"], { label: string; className: string }> = {
  borrowed: { label: "Borrowed", className: "bg-info/10 text-info border-info/20" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const reservationStatusConfig: Record<ActiveReservation["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-info/10 text-info border-info/20" },
  ready: { label: "Ready", className: "bg-success/10 text-success border-success/20" },
};

const notificationStyles: Record<string, string> = {
  announcement: "bg-info/50",
  overdue_fine: "bg-destructive/60",
  reservation_ready: "bg-success/60",
  reservation_fulfilled: "bg-info/50",
  reservation_cancelled: "bg-warning/60",
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const formatDate = (value?: string | null, pattern = "MMM d, yyyy") => {
  if (!value) return "-";
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, pattern) : "-";
};

const relativeTime = (value?: string | null) => {
  if (!value) return "Recently";
  const parsed = parseISO(value);
  return isValid(parsed) ? formatDistanceToNowStrict(parsed, { addSuffix: true }) : "Recently";
};

const dueLabel = (value: string) => {
  const parsed = parseISO(value);
  if (!isValid(parsed)) return "Due date unavailable";
  const now = new Date();
  if (parsed < now) return `${formatDistanceToNowStrict(parsed)} overdue`;
  return `Due in ${formatDistanceToNowStrict(parsed)}`;
};

const formatCurrency = (value?: number | null) => currencyFormatter.format(Number(value || 0));

const quickLinks = [
  { to: "/catalogue", icon: Search, label: "Browse Catalogue" },
  { to: "/services/borrowing", icon: CalendarDays, label: "Reservations" },
  { to: "/services/subscriptions", icon: GraduationCap, label: "Digital Resources" },
  { to: "/edit-profile", icon: UserRound, label: "Edit Profile" },
];


export {
  borrowStatusConfig,
  reservationStatusConfig,
  notificationStyles,
  formatDate,
  relativeTime,
  dueLabel,
  formatCurrency,
  quickLinks,
};

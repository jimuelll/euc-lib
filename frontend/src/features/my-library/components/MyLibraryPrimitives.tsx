import { Link } from "react-router-dom";
import { ExternalLink, GraduationCap, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "./MyLibrary.formatters";
import type { AttendanceSession, DashboardSubscription } from "../types";

const Surface = ({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section className="overflow-hidden border border-border/80 bg-card/95">
    <div className="h-[2px] w-full bg-[linear-gradient(90deg,hsl(var(--warning)),transparent_78%)]" />
    <div className="flex flex-col gap-3 border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary)/0.05),transparent)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2
          className="text-base font-semibold tracking-[-0.01em] text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h2>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
    <div>{children}</div>
  </section>
);

const MetricCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) => (
  <div className="border border-border/80 bg-card px-4 py-4">
    <p
      className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {label}
    </p>
    <p
      className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {value}
    </p>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
  </div>
);

const EmptyPanel = ({ message }: { message: string }) => (
  <div className="px-5 py-10 text-sm leading-6 text-muted-foreground">{message}</div>
);

const PanelList = ({ children }: { children: ReactNode }) => (
  <div className="divide-y divide-border/70">{children}</div>
);

const SnapshotRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 px-5 py-3.5">
    <span
      className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {label}
    </span>
    <span className="text-sm text-foreground">{value}</span>
  </div>
);

const QuickAccessRow = ({
  icon: Icon,
  to,
  label,
}: {
  icon: typeof Search;
  to: string;
  label: string;
}) => (
  <Link to={to} className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/10">
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground/60" />
      <span
        className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </span>
    </div>
    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />
  </Link>
);

const AttendanceRow = ({ session }: { session: AttendanceSession }) => (
  <tr className="transition-colors hover:bg-muted/10">
    <td
      className="px-5 py-3 text-[12px] font-bold text-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {formatDate(session.date)}
    </td>
    <td
      className="px-5 py-3 text-[12px] text-success"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {formatDate(session.time_in, "h:mm a")}
    </td>
    <td className="px-5 py-3 text-[12px] text-muted-foreground">
      {formatDate(session.time_out, "h:mm a")}
    </td>
  </tr>
);

const HistoryItem = ({
  title,
  subtitle,
  meta,
  badgeLabel,
}: {
  title: string;
  subtitle: string;
  meta: string;
  badgeLabel: string;
}) => (
  <div className="flex items-start justify-between gap-3 px-5 py-4">
    <div className="min-w-0">
      <p
        className="truncate text-[13px] font-bold text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground/70">{meta}</p>
    </div>
    <Badge
      variant="outline"
      className="text-[10px] font-bold uppercase tracking-[0.08em]"
      style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
    >
      {badgeLabel}
    </Badge>
  </div>
);

const SubscriptionItem = ({ subscription }: { subscription: DashboardSubscription }) => (
  <a
    href={subscription.url}
    target="_blank"
    rel="noreferrer"
    className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/10"
  >
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden border border-border bg-muted shrink-0">
      {subscription.image_url ? (
        <img src={subscription.image_url} alt={subscription.title} className="h-full w-full object-cover" />
      ) : (
        <GraduationCap className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <p
          className="truncate text-[13px] font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {subscription.title}
        </p>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
      <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">
        {subscription.description || "Academic resource for online research and study."}
      </p>
      {subscription.category ? (
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
          {subscription.category}
        </p>
      ) : null}
    </div>
  </a>
);



export {
  Surface,
  MetricCard,
  EmptyPanel,
  PanelList,
  SnapshotRow,
  QuickAccessRow,
  AttendanceRow,
  HistoryItem,
  SubscriptionItem,
};

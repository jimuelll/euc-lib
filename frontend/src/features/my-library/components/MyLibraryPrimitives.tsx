import { Link } from "react-router-dom";
import { ExternalLink, GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { DashboardSubscription } from "../types";

export function Surface({
  title,
  count,
  id,
  actions,
  children,
}: {
  title: string;
  count?: number;
  id?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className="min-w-0 scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6">
        <h2 className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          {title}
          {count !== undefined && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-medium tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function EmptyPanel({
  message,
  to,
  action,
}: {
  message: string;
  to?: string;
  action?: string;
}) {
  return (
    <div className="px-5 py-8 sm:px-6">
      <p className="max-w-prose text-sm leading-6 text-muted-foreground">
        {message}
      </p>
      {to && action && (
        <Button asChild variant="outline" className="mt-4 min-h-11">
          <Link to={to}>{action}</Link>
        </Button>
      )}
    </div>
  );
}

export function PanelList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border">{children}</div>;
}

export function LoadingPanel({
  label = "Loading library activity",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="space-y-5 rounded-xl border border-border bg-card p-6"
    >
      <span className="sr-only">{label}</span>
      <div className="h-6 w-36 animate-pulse rounded bg-muted" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-3 border-t border-border pt-5">
          <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function RetryNotice({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="min-w-0 flex-1 text-sm leading-6 text-foreground">
        {message}
      </p>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={onRetry}
        disabled={retrying}
      >
        {retrying ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  busy,
  onPage,
}: {
  page: number;
  totalPages: number;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Activity pages"
      className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4 sm:px-6"
    >
      <span
        aria-live="polite"
        className="text-sm tabular-nums text-muted-foreground"
      >
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="min-h-11"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={busy || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

export function SubscriptionItem({
  subscription,
}: {
  subscription: DashboardSubscription;
}) {
  return (
    <a
      href={subscription.url}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-11 items-start gap-4 px-5 py-5 transition-colors hover:bg-muted/40 sm:px-6"
    >
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {subscription.image_url ? (
          <img
            src={subscription.image_url}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <GraduationCap
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="break-words text-sm font-semibold">
            {subscription.title}
          </p>
          <ExternalLink
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {subscription.description ||
            "Academic resource for online research and study."}
        </p>
        {subscription.category && (
          <p className="mt-2 text-sm text-muted-foreground">
            {subscription.category}
          </p>
        )}
        <span className="sr-only"> (opens in a new tab)</span>
      </div>
    </a>
  );
}

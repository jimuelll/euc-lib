import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminPageProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentWidth?: "workspace" | "wide" | "form";
}

interface AdminPanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}

interface AdminStatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  helperText?: string;
}

export function AdminPage({
  title,
  description,
  actions,
  children,
  className,
  contentWidth = "workspace",
}: AdminPageProps) {
  const widthClass =
    contentWidth === "form"
      ? "max-w-4xl"
      : contentWidth === "wide"
        ? "max-w-6xl"
        : "max-w-none";

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-4 md:gap-6", widthClass, className)}>
      <header className="flex min-w-0 flex-col gap-3 border-b border-border pb-4 md:gap-4 md:pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0"><h1
          className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h1>{description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}</div>
        {actions ? <div className="admin-page-actions flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
      </header>

      {children}
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: AdminPanelProps) {
  const hasHeader = title || description || actions;

  return (
    <Card className={cn("admin-panel-surface admin-etched-border min-w-0 rounded-lg border-border bg-card shadow-none", className)}>
      {hasHeader ? (
        <CardHeader className="flex flex-col gap-3 border-b border-border/70 bg-card px-4 py-4 md:px-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <CardTitle
                className="text-base font-semibold tracking-[-0.01em] text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {title}
              </CardTitle>
            ) : null}
            {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>

          {actions ? <div className="admin-panel-actions flex flex-wrap items-center gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}

      <CardContent className={cn("min-w-0 p-4 md:p-5", hasHeader && "pt-4 md:pt-5", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

export function AdminStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function AdminStatCard({ label, value, icon, helperText }: AdminStatCardProps) {
  return (
    <Card className="admin-panel-surface admin-etched-border rounded-lg border-border bg-card shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2.5">
            <p
              className="text-sm font-medium text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {label}
            </p>
            <p
              className="text-2xl font-semibold tracking-[-0.02em] text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {value}
            </p>
          </div>
          {icon ? (
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-md bg-muted text-action">
              {icon}
            </div>
          ) : null}
        </div>
        {helperText ? <p className="mt-4 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">{helperText}</p> : null}
      </CardContent>
    </Card>
  );
}

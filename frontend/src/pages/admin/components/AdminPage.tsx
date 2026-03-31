import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  eyebrow = "Admin Workspace",
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
    <div className={cn("flex w-full flex-col gap-7", widthClass, className)}>
      <section className="admin-panel-surface admin-etched-border relative overflow-hidden border border-border/80 bg-card/95">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-warning" />
        <div className="absolute right-0 top-0 hidden h-full w-40 bg-[linear-gradient(180deg,hsl(var(--primary)/0.08),transparent)] lg:block" />

        <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-7">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-warning" />
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {eyebrow}
              </p>
            </div>
            <div className="space-y-2">
              <h1
                className="max-w-4xl text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {title}
              </h1>
              {description ? (
                <p className="max-w-4xl text-sm leading-7 text-muted-foreground sm:text-[15px]">{description}</p>
              ) : null}
            </div>
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
        </div>
      </section>

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
    <Card className={cn("admin-panel-surface admin-etched-border min-w-0 rounded-sm border-border/80 bg-card/95 shadow-none", className)}>
      <div className="h-[2px] w-full bg-[linear-gradient(90deg,hsl(var(--warning)),transparent_72%)]" />
      {hasHeader ? (
        <CardHeader className="flex flex-col gap-3 border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary)/0.06),transparent)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <CardTitle
                className="text-base font-semibold tracking-[-0.01em] text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {title}
              </CardTitle>
            ) : null}
            {description ? <CardDescription className="leading-6">{description}</CardDescription> : null}
          </div>

          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}

      <CardContent className={cn("p-5", hasHeader && "pt-5", contentClassName)}>
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
    <Card className="admin-panel-surface admin-etched-border rounded-sm border-border/80 bg-card/95 shadow-none">
      <div className="h-[2px] w-full bg-[linear-gradient(90deg,hsl(var(--warning)),transparent_78%)]" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2.5">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
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
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center border border-warning/25 bg-warning/10 text-warning">
              {icon}
            </div>
          ) : null}
        </div>
        {helperText ? <p className="mt-4 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">{helperText}</p> : null}
      </CardContent>
    </Card>
  );
}

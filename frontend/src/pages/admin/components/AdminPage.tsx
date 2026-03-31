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
    <div className={cn("flex w-full flex-col gap-6", widthClass, className)}>
      <section className="border-b border-border/70 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {eyebrow}
            </p>
            <div className="space-y-1.5">
              <h1
                className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {title}
              </h1>
              {description ? (
                <p className="max-w-5xl text-sm leading-6 text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
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
    <Card className={cn("min-w-0 border-border/80 shadow-none", className)}>
      {hasHeader ? (
        <CardHeader className="flex flex-col gap-3 border-b border-border/70 bg-muted/20 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <CardTitle
                className="text-base font-semibold tracking-tight text-foreground"
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
    <Card className="border-border/80 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p
              className="text-2xl font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {value}
            </p>
          </div>
          {icon ? <div className="mt-0.5 text-muted-foreground">{icon}</div> : null}
        </div>
        {helperText ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{helperText}</p> : null}
      </CardContent>
    </Card>
  );
}

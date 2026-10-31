import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "./AdminDeskSystem";

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

// Uses the desk header so these pages match the rest of the admin workspace.
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
    <div className={cn("admin-panel-page flex w-full min-w-0 flex-col gap-4 md:gap-6", widthClass, className)}>
      <AdminPageHeader title={title} subtitle={description} actions={actions} />
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

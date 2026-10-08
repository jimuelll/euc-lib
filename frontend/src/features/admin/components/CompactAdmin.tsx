import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminIcon, type AdminIconName } from "./AdminIcon";

/** Opt-in compact patterns; existing admin pages keep their current layout. */
export function CompactPanel({ title, id, actions, children, className }: {
  title: string; id: string; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={cn("admin-compact-panel", className)} aria-labelledby={id}>
    <CompactSectionHeader title={title} id={id} actions={actions} />{children}
  </section>;
}

export function CompactSectionHeader({ title, id, actions }: { title: string; id: string; actions?: ReactNode }) {
  return <header className="admin-compact-section-header"><h2 id={id}>{title}</h2>{actions}</header>;
}

export function CompactAction({ href, icon, children, primary = false }: {
  href: string; icon: AdminIconName; children: ReactNode; primary?: boolean;
}) {
  return <Button asChild variant={primary ? "default" : "outline"} className="admin-compact-button">
    <Link to={href}><AdminIcon name={icon} />{children}<AdminIcon name="arrowRight" className="admin-compact-action-arrow" /></Link>
  </Button>;
}

export function CompactMetric({ label, value, icon, href, tone = "neutral" }: {
  label: string; value: number; icon: AdminIconName; href?: string; tone?: "neutral" | "borrowed" | "returned" | "reserved" | "attendance";
}) {
  const content = <><span className="admin-compact-metric-icon"><AdminIcon name={icon} /></span><span className="admin-compact-metric-copy">
    <span className="admin-compact-metric-label">{label}</span>
    <span className="admin-compact-metric-value">{value.toLocaleString("en-PH")}</span>
  </span>{href && <AdminIcon name="arrowRight" className="admin-compact-metric-arrow" />}</>;
  const visibleTone = value === 0 ? "neutral" : tone;
  return href ? <Link to={href} className="admin-compact-metric" data-tone={visibleTone}>{content}</Link>
    : <div className="admin-compact-metric" data-tone={visibleTone}>{content}</div>;
}

export function CompactTextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link to={href} className="admin-compact-text-link">{children}<AdminIcon name="arrowRight" /></Link>;
}

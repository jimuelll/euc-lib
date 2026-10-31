import { useEffect, useId, useState, type ReactNode } from "react";
import { registerInlineConfirm, type ConfirmOptions } from "./useAdminConfirmDialog";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AdminIcon, type AdminIconName } from "./AdminIcon";
import { AdminPageHelp } from "./AdminPageHelp";

export type AdminTone = "red" | "amber" | "green" | "blue" | "neutral";
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", currencyDisplay: "narrowSymbol" });
export const formatPeso = (value: number) => peso.format(value);
export function AdminPageHeader({ title, subtitle, updatedAt, loading, onRefresh, actions }: { title: string; subtitle?: ReactNode; updatedAt?: number; loading?: boolean; onRefresh?: () => void; actions?: ReactNode }) {
  return <header className="admin-desk-header"><div><div className="admin-desk-title-row"><h1>{title}</h1><AdminPageHelp /></div>{subtitle && <p>{subtitle}</p>}</div><div className="admin-desk-header-actions">{onRefresh && <><span className="admin-desk-secondary">{updatedAt ? <>Updated <time dateTime={new Date(updatedAt).toISOString()}>{new Date(updatedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}</time></> : "Not yet updated"}</span><Button variant="outline" className="admin-compact-button" disabled={loading} onClick={onRefresh}><AdminIcon name="refresh" className={loading ? "animate-spin motion-reduce:animate-none" : undefined} />Refresh</Button></>}{actions}</div></header>;
}
export function AdminSummaryTile({ label, value, currency, icon, tone, hint, selected, onSelect, href, disabled, ariaLabel, heading, appearance = "shelf", className = "" }: { label: string; value?: number; currency?: boolean; icon: AdminIconName; tone: AdminTone; hint?: ReactNode; selected?: boolean; onSelect?: () => void; href?: string; disabled?: boolean; ariaLabel?: string; heading?: boolean; appearance?: "shelf" | "slip"; className?: string }) {
  const formatted = value === undefined ? "—" : currency ? formatPeso(value) : value.toLocaleString("en-PH");
  const props = { className: `${appearance === "slip" ? "library-record-summary" : "admin-desk-tile"} ${className}`, "aria-label": ariaLabel || (href ? `${label} ${formatted}` : undefined), "data-tone": value ? tone : "neutral", "data-library-currency": currency || undefined, "data-library-long-value": currency && value !== undefined && formatPeso(value).length > 14 ? true : undefined };
  const footer = <span className="library-shelf-footer"><span>{hint || (href ? "View details" : "Show records")}</span><AdminIcon name="arrowRight" /></span>;
  const content = appearance === "slip" ? <><span className="library-record-summary-heading"><span>{label}</span><AdminIcon name={icon} /></span><span className="library-record-summary-value"><strong>{formatted}</strong><span className="library-status-stamp">{value === undefined ? "Unavailable" : value === 0 ? "Clear" : "Overdue"}</span></span>{footer}</> : <><span className="admin-desk-tile-icon"><AdminIcon name={icon} /></span><span className="admin-desk-tile-copy">{heading ? <h3>{label}</h3> : <span>{label}</span>}<strong>{formatted}</strong></span>{footer}</>;
  return href ? <Link {...props} to={href}>{content}</Link> : <button {...props} type="button" aria-pressed={selected} disabled={disabled} onClick={onSelect}>{content}</button>;
}
export function AdminPageTabs({ value, onChange, label, items, children }: { value: string; onChange: (value: string) => void; label: string; items: { value: string; label: string; icon: AdminIconName; badge?: number; badgeTone?: "neutral" | "attention"; badgeDescription?: string; descriptionId?: string; unsaved?:boolean }[]; children: ReactNode }) {
  return <Tabs className="admin-desk-tabs" value={value} onValueChange={onChange}><TabsList className="admin-desk-page-tabs" aria-label={label}>{items.map(item => <TabsTrigger key={item.value} value={item.value} aria-label={item.label} aria-describedby={item.badge !== undefined || item.unsaved ? item.descriptionId : undefined}><AdminIcon name={item.icon} />{item.label}{item.badge !== undefined && item.badge > 0 && <span className="admin-desk-tab-badge" data-tone={item.badge && item.badgeTone === "attention" ? "attention" : "neutral"} aria-hidden="true">{item.badge.toLocaleString("en-PH")}</span>}{item.unsaved&&<span className="publishing-unsaved-dot" aria-hidden="true" />}{(item.badge!==undefined||item.unsaved)&&<span className="sr-only" id={item.descriptionId}>{item.badge!==undefined?`${item.badge} ${item.badgeDescription||"items"}. `:""}{item.unsaved?"Unsaved changes.":""}</span>}</TabsTrigger>)}</TabsList>{children}</Tabs>;
}
export function AdminFilterChips({ label, value, onChange, items, disabled }: { label: string; value: string; onChange: (value: string) => void; items: { value: string; label: string; count?: number; tone?: AdminTone }[]; disabled?: boolean }) {
  return <div role="group" aria-label={label} className="admin-desk-filter-chips">{[...items].sort((a, b) => Number(a.value === "all") - Number(b.value === "all")).map(item => <button key={item.value} type="button" aria-label={`${item.label} ${item.count ?? "unavailable"}`} aria-pressed={value === item.value} data-tone={item.count ? item.tone : undefined} disabled={disabled} onClick={() => onChange(item.value)}>{item.label}<span>{item.count === undefined ? "—" : item.count.toLocaleString("en-PH")}</span></button>)}</div>;
}
const statusTones: Record<string, AdminTone> = { blocked: "red", overdue: "red", expired: "red", pending: "amber", ready: "green", eligible: "green", returned: "green", borrowed: "blue", fulfilled: "blue", cancelled: "neutral", fines_only: "amber" };
export function AdminStatusBadge({ status, tone, title, children }: { status?: string; tone?: AdminTone; title?: string; children: ReactNode }) { return <span className="admin-desk-status" data-tone={tone || (status && statusTones[status]) || "neutral"} title={title}>{children}</span>; }
export function AdminRowMenu({ label, items, disabled }: { label: string; disabled?: boolean; items: { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean }[] }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={label} disabled={disabled}><AdminIcon name="more" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{items.map(item => <DropdownMenuItem key={item.label} className={item.destructive ? "text-destructive" : undefined} disabled={item.disabled} onSelect={item.onSelect}>{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}
export function AdminEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="admin-desk-empty"><AdminIcon name="clearance" /><h2>{title}</h2><p className="admin-desk-secondary">{description}</p>{action}</div>; }
export function AdminSelectionCheckbox({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) { return <label className="admin-desk-selection"><input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /></label>; }
export type AdminDrawerVariant = "view" | "edit" | "new";
export type AdminDrawerSize = "sm" | "md" | "lg";
const drawerModeLabel: Record<AdminDrawerVariant, string | null> = { view: null, edit: "Editing", new: "New" };

/** One record drawer: View reads a record, Edit changes it, New creates one. Sizes: sm 480, md 640, lg 880px. */
export function AdminDetailDrawer({ open, onClose, title, description, children, footer, headerActions, onAfterClose, className = "", variant = "view", size = "md", dirty = false }: {
  open: boolean; onClose: () => void; title: string; description: ReactNode; children: ReactNode; footer?: ReactNode; headerActions?: ReactNode;
  onAfterClose?: () => void; className?: string; variant?: AdminDrawerVariant; size?: AdminDrawerSize; dirty?: boolean;
}) {
  const mode = drawerModeLabel[variant];
  const confirmId = useId();
  const [pending, setPending] = useState<{ options: Required<ConfirmOptions>; resolve: (value: boolean) => void } | null>(null);
  // While open, confirmations (discard changes, archive, delete…) replace the footer instead of stacking a dialog.
  useEffect(() => {
    if (!open) return;
    return registerInlineConfirm((options, resolve) => setPending(current => { current?.resolve(false); return { options, resolve }; }));
  }, [open]);
  useEffect(() => { if (!open) setPending(current => { current?.resolve(false); return null; }); }, [open]);
  const settle = (value: boolean) => setPending(current => { current?.resolve(value); return null; });
  return <Sheet open={open} onOpenChange={value => { if (value) return; if (pending) settle(false); else onClose(); }}>
    <SheetContent data-variant={variant} data-size={size} className={`admin-desk-drawer w-full p-0 gap-0 ${className}`} onCloseAutoFocus={onAfterClose ? event => { event.preventDefault(); onAfterClose(); } : undefined}>
      <SheetHeader className="admin-record-header">
        {mode && <p className="admin-record-mode">{mode}{dirty && <span className="admin-record-dirty"><span aria-hidden="true" /> Unsaved</span>}</p>}
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
        {headerActions && <div className="admin-record-header-actions">{headerActions}</div>}
      </SheetHeader>
      <div className="admin-record-body">{children}</div>
      {pending ? <footer className="admin-record-footer admin-record-confirm" data-tone={pending.options.tone} role="alertdialog" aria-labelledby={`${confirmId}-title`} aria-describedby={`${confirmId}-description`}>
        <div className="admin-record-confirm-copy"><strong id={`${confirmId}-title`}>{pending.options.title}</strong><p id={`${confirmId}-description`}>{pending.options.description}</p></div>
        <div className="admin-record-confirm-actions">
          <Button type="button" variant="outline" autoFocus onClick={() => settle(false)}>{pending.options.cancelLabel}</Button>
          <Button type="button" variant={pending.options.tone === "danger" ? "destructive" : "default"} onClick={() => settle(true)}>{pending.options.actionLabel}</Button>
        </div>
      </footer> : footer && <footer className="admin-record-footer">{footer}</footer>}
    </SheetContent>
  </Sheet>;
}

/**
 * The Records-page control row: counted filter chips, a live search and a Filters popover for secondary filters.
 * It wraps on narrow screens, with search taking a full line.
 */
export function AdminControlRow({ chips, search, filters, activeFilters = 0, children }: {
  chips?: ReactNode;
  search?: { label: string; placeholder: string; value: string; onChange: (value: string) => void; id?: string };
  filters?: ReactNode;
  activeFilters?: number;
  /** Extra controls such as a date range, placed after Filters. */
  children?: ReactNode;
}) {
  return <div className="admin-control-row">
    {chips}
    {search && <label className="admin-control-search"><AdminIcon name="search" /><span className="sr-only">{search.label}</span>
      <Input id={search.id} placeholder={search.placeholder} value={search.value} onChange={event => search.onChange(event.target.value)} />
    </label>}
    {filters && <Popover><PopoverTrigger asChild>
      <Button variant="outline" className="admin-control-filters" aria-label={activeFilters ? `Filters, ${activeFilters} active` : "Filters"}>
        <AdminIcon name="filter" />Filters{activeFilters > 0 && <span className="admin-control-count" aria-hidden="true">{activeFilters}</span>}
      </Button>
    </PopoverTrigger><PopoverContent align="end" className="admin-control-popover">{filters}</PopoverContent></Popover>}
    {children}
  </div>;
}

/** One-line, collapsed explanation for things staff need to read once, not on every visit. */
export function AdminHelpNote({ summary, children }: { summary: string; children: ReactNode }) {
  return <details className="admin-help-note"><summary><AdminIcon name="information" />{summary}</summary><div>{children}</div></details>;
}


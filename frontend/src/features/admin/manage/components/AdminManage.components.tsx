import { useState, useEffect } from "react";
import { QrCode, Download, Printer, Archive, MoreHorizontal } from "@/components/ui/library-glyphs";
import { toast } from "@/components/ui/sonner";
import type { User, QrTarget } from "../AdminManage.types";
import { fetchUserBarcode } from "../../api";
import { formatRole } from "../AdminManage.data";
import { printCodeLabel } from "@/utils/printCodeLabel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// ─── QR Modal ─────────────────────────────────────────────────────────────────

interface QrModalProps {
  target:  QrTarget;
  onClose: () => void;
}

export const QrModal = ({ target, onClose }: QrModalProps) => {
 const [qrUrl,setQrUrl]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let url:string|null=null;let active=true;setLoading(true);setQrUrl(null);fetchUserBarcode(target.studentId).then(blob=>{url=URL.createObjectURL(blob);if(active)setQrUrl(url);else URL.revokeObjectURL(url);}).catch(()=>{if(active)toast.error("Could not load QR code");}).finally(()=>{if(active)setLoading(false);});return ()=>{active=false;if(url)URL.revokeObjectURL(url);};},[target.studentId]);
 const handleDownload=()=>{if(!qrUrl)return;const link=document.createElement("a");link.href=qrUrl;link.download=`qr-${target.studentId}.png`;link.click();};
 const handlePrint=()=>{if(!qrUrl)return;if(!printCodeLabel({imageUrl:qrUrl,title:target.name,code:target.studentId,kind:"Library patron"}))toast.error("Allow pop-ups to print this label.");};
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{target.name}</DialogTitle><DialogDescription>{target.studentId} / Library QR identity</DialogDescription></DialogHeader><div className="grid justify-items-center gap-4">{loading ? <p>Loading library QR...</p> : qrUrl ? <img src={qrUrl} alt={`QR code for ${target.studentId}`} className="h-48 w-48" /> : <p role="alert">Could not load this QR code.</p>}<Button onClick={handleDownload} disabled={!qrUrl}><Download className="mr-2 h-4 w-4" />Download PNG</Button><Button variant="outline" onClick={handlePrint} disabled={!qrUrl}><Printer className="mr-2 h-4 w-4" />Print label</Button></div></DialogContent></Dialog>;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

export const StatusBadge = ({ status }: { status: "active" | "inactive" | "archived" }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold  border ${
      status === "archived"
        ? "bg-warning/10 text-warning border-warning/30"
        : status === "active"
          ? "bg-success/10 text-success border-success/30"
          : "bg-muted text-muted-foreground border-border"
    }`}
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {status === "archived" ? <Archive className="h-2.5 w-2.5" /> : null}
    {status === "archived" ? "Archived" : status === "active" ? "Active" : "Inactive"}
  </span>
);

// ─── Search Results Table ─────────────────────────────────────────────────────

interface SearchResultsTableProps {
  results:      User[];
  showArchived: boolean;
  onSelect:     (u: User) => void;
  onViewQr:     (u: User) => void;
}

export const SearchResultsTable = ({ results, showArchived, onSelect, onViewQr }: SearchResultsTableProps) => (
  <>
  <div className="admin-mobile-records divide-y divide-border md:hidden" aria-label="User records">
    {results.map((u) => <article key={u.student_employee_id} className="min-w-0 space-y-3 p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="break-words text-base font-semibold text-foreground">{u.name}</h3><p className="mt-1 break-all text-sm text-muted-foreground">{u.student_employee_id}</p></div>
        <StatusBadge status={showArchived ? "archived" : u.is_active === 0 ? "inactive" : "active"} />
      </div>
      <dl className="grid gap-2 text-sm"><div><dt className="text-muted-foreground">Role</dt><dd className="font-medium capitalize">{formatRole(u.role)}</dd></div><div><dt className="text-muted-foreground">Program / course</dt><dd className="break-words">{u.program_course ?? "—"}</dd></div></dl>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => onSelect(u)}>{showArchived ? "Review account" : "Edit account"}</Button>{!showArchived && <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => onViewQr(u)}><QrCode className="mr-2 h-4 w-4" />View QR</Button>}</div>
    </article>)}
  </div>
  <div className="admin-desktop-table overflow-x-auto">
    <table className="w-full min-w-[700px] text-left text-sm">
      <thead className="border-b border-border bg-secondary/40">
        <tr>
          {["User", "Program / Course", "Role", "Account", ""].map((h) => (
            <th
              key={h}
              className="px-4 py-2.5 text-xs font-bold  text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {results.map((u) => (
          <tr
            key={u.student_employee_id}
            tabIndex={0}
            className={`border-t border-border cursor-pointer transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none ${showArchived ? "bg-muted/20 text-muted-foreground" : "bg-background"}`}
            onClick={() => onSelect(u)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(u); } }}
          >
            <td className="max-w-[320px] px-4 py-3"><p className="truncate text-sm font-semibold text-foreground">{u.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{u.student_employee_id}</p></td>
            <td className="px-4 py-3 text-sm text-muted-foreground">{u.program_course ?? "—"}</td>
            <td
              className="px-4 py-3 text-xs font-medium capitalize text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {formatRole(u.role)}
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={showArchived ? "archived" : u.is_active === 0 ? "inactive" : "active"} />
            </td>
            <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${u.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onSelect(u)}>{showArchived ? "Review account" : "Edit account"}</DropdownMenuItem>{!showArchived ? <DropdownMenuItem onClick={() => onViewQr(u)}><QrCode className="mr-2 h-4 w-4" />View QR code</DropdownMenuItem> : null}</DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  </>
);

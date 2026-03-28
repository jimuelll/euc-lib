import { AlertTriangle, BookOpen, Loader2 } from "lucide-react";

// ─── Loading ──────────────────────────────────────────────────────────────────

export const LoadingState = () => (
  <div className="border border-border border-t-0 flex items-center justify-center gap-3 py-20 text-muted-foreground bg-background">
    <Loader2 className="h-5 w-5 animate-spin" />
    <span
      className="text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      Loading…
    </span>
  </div>
);

// ─── Error ────────────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
}

export const ErrorState = ({ message }: ErrorStateProps) => (
  <div className="border border-border border-t-0 flex items-center justify-center gap-3 py-20 text-destructive/70 bg-background">
    <AlertTriangle className="h-5 w-5" />
    <span className="text-sm">{message}</span>
  </div>
);

// ─── Empty ────────────────────────────────────────────────────────────────────

export const EmptyState = () => (
  <div className="border border-border border-t-0 flex flex-col items-center justify-center gap-2 py-20 bg-background">
    <BookOpen className="h-8 w-8 text-muted-foreground/20" />
    <p
      className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/30"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      No subscriptions available
    </p>
  </div>
);

// ─── Footer Notice ────────────────────────────────────────────────────────────

export const FooterNotice = () => (
  <div className="border border-border border-t-0 border-dashed bg-card px-6 py-4 flex items-center gap-3">
    <div className="h-px w-4 bg-border shrink-0" />
    <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
      This list is managed by the library administration and will be updated as new
      subscriptions are added.
    </p>
  </div>
);
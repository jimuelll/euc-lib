interface CountBarProps {
  count: number;
  loading: boolean;
}

export const CountBar = ({ count, loading }: CountBarProps) => (
  <div className="border border-border border-t-0 px-6 sm:px-8 py-3 bg-muted/30 flex items-center justify-between">
    <span
      className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {loading ? "—" : `${count} Active Database${count !== 1 ? "s" : ""}`}
    </span>
    <div className="h-px flex-1 mx-4 bg-border" />
    <span
      className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      24/7 Access
    </span>
  </div>
);
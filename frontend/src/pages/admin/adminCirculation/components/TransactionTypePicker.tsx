import { TRANSACTION_CONFIG } from "../circulation.types";
import type { TransactionType } from "../circulation.types";

interface Props {
  value: TransactionType;
  onChange: (t: TransactionType) => void;
}

const TransactionTypePicker = ({ value, onChange }: Props) => (
  <div className="space-y-2">
    <label
      className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      Transaction Type
    </label>

    {/* Sharp segmented control — no rounded corners */}
    <div className="flex gap-0 border border-border overflow-hidden">
      {(Object.keys(TRANSACTION_CONFIG) as TransactionType[]).map((t, i) => {
        const cfg    = TRANSACTION_CONFIG[t];
        const Icon   = cfg.icon;
        const active = value === t;

        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`
              flex-1 flex items-center justify-center gap-2 h-10
              text-[11px] font-bold uppercase tracking-[0.15em]
              border-r last:border-r-0 border-border
              transition-colors
              ${active
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }
            `}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {cfg.label}
          </button>
        );
      })}
    </div>
  </div>
);

export default TransactionTypePicker;
import { Label } from "@/components/ui/label";
import { TRANSACTION_CONFIG } from "../circulation.types";
import type { TransactionType } from "../circulation.types";

interface Props {
  value: TransactionType;
  onChange: (t: TransactionType) => void;
}

const TransactionTypePicker = ({ value, onChange }: Props) => (
  <div className="space-y-2">
    <Label>Transaction Type</Label>
    <div className="flex gap-2">
      {(Object.keys(TRANSACTION_CONFIG) as TransactionType[]).map((t) => {
        const cfg = TRANSACTION_CONFIG[t];
        const Icon = cfg.icon;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
              value === t
                ? `${cfg.bg} ${cfg.color}`
                : "border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            <Icon className="h-4 w-4" />
            {cfg.label}
          </button>
        );
      })}
    </div>
  </div>
);

export default TransactionTypePicker;
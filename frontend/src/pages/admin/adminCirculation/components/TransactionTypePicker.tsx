import { TRANSACTION_CONFIG } from "../circulation.types";
import type { TransactionType } from "../circulation.types";
import { SegmentedNavigation } from "../../components/SegmentedNavigation";

interface Props {
  value: TransactionType;
  onChange: (t: TransactionType) => void;
}

const TransactionTypePicker = ({ value, onChange }: Props) => (
  <div className="space-y-2">
    <label
      className="block text-sm font-medium text-muted-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      Transaction Type
    </label>

    <SegmentedNavigation
      ariaLabel="Transaction type"
      value={value}
      onChange={onChange}
      segments={(Object.keys(TRANSACTION_CONFIG) as TransactionType[]).map((type) => ({
        value: type,
        label: TRANSACTION_CONFIG[type].label,
        icon: TRANSACTION_CONFIG[type].icon,
      }))}
    />
  </div>
);

export default TransactionTypePicker;

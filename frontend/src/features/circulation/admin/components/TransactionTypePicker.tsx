import { AdminIcon } from "@/features/admin";
import type { TransactionType } from "../circulation.types";

export default function TransactionTypePicker({ value, onChange, disabled }: { value: TransactionType; onChange: (value: TransactionType) => void; disabled?: boolean }) {
  return <div className="circulation-mode" role="group" aria-label="Transaction type">
    {(["borrow", "return"] as const).map(mode => <button key={mode} type="button" data-mode={mode} aria-pressed={value === mode} disabled={disabled} onClick={() => onChange(mode)}><AdminIcon name={mode} />{mode === "borrow" ? "Borrow" : "Return"}</button>)}
  </div>;
}

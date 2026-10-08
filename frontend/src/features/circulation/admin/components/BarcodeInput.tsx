import { AdminIcon } from "@/features/admin";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputId?: string;
  autoFocus?: boolean;
}

/** Keyboard scanners submit with Enter; manual entry follows the same flow. */
export default function BarcodeInput({ value, onChange, onSubmit, loading, disabled, placeholder = "Scan or type a copy identifier", inputId, autoFocus }: Props) {
  return <div className="circulation-scan-field circulation-copy-field" aria-busy={loading}>
    <AdminIcon name={loading ? "refresh" : "catalog"} className={loading ? "animate-spin" : undefined} />
    <input id={inputId} autoFocus={autoFocus} autoComplete="off" value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => {
      if (event.key === "Enter" && !loading && !disabled && value.trim()) { event.preventDefault(); onSubmit(value); }
    }} placeholder={placeholder} disabled={disabled} />
  </div>;
}

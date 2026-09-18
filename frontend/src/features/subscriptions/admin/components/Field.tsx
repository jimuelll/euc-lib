import { FONT, LABEL_CLS } from "../subscriptions.styles";

// ─── Props ────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  required?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false,
  required = false,
}: FieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label className={`${LABEL_CLS} text-muted-foreground`} style={FONT}>
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors resize-none"
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors"
      />
    )}
  </div>
);
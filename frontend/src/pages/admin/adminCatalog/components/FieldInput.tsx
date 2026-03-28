import { Input } from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import { FormField } from "../AdminCatalog.types";

type Props = {
  field: FormField;
  value: any;
  onChange: (key: string, value: any) => void;
};

// Slightly taller inputs for admin readability — h-9 instead of h-8
const inputClass =
  "rounded-none border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-primary transition-colors h-9";

const FieldInput = ({ field, value, onChange }: Props) => {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          rows={4}
          className="rounded-none border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-primary transition-colors resize-none leading-relaxed"
        />
      );
    case "select":
      return (
        <Select value={value ?? ""} onValueChange={(v) => onChange(field.key, v)}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder={`Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent className="rounded-none border-border">
            {(field.options ?? []).map((o) => (
              <SelectItem key={o} value={o} className="rounded-none text-sm">
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "number":
      return (
        <Input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          min={field.key === "copies" ? 0 : undefined}
          className={inputClass}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={inputClass}
        />
      );
    default:
      return (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={inputClass}
        />
      );
  }
};

export default FieldInput;
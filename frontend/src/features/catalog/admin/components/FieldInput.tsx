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
import { Plus, X } from "lucide-react";

type Props = {
  field: FormField;
  value: any;
  onChange: (key: string, value: any) => void;
  id?: string;
  error?: string;
};

// Slightly taller inputs for admin readability — h-9 instead of h-8
const inputClass =
  "rounded-none border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-primary transition-colors h-9";

const FieldInput = ({ field, value, onChange, id, error }: Props) => {
  const accessibility = { "aria-invalid": Boolean(error), "aria-describedby": error && `${id}-error` };
  const classes = `${inputClass} ${error ? "border-destructive focus-visible:border-destructive" : ""}`;
  switch (field.type) {
    case "repeatable": {
      const items = Array.isArray(value) ? value : [];
      const update = (index: number, next: string) => onChange(field.key, items.map((item, itemIndex) => itemIndex === index ? next : item));
      return <div className="space-y-2">{items.map((item, index) => <div className="flex gap-2" key={`${field.key}-${index}`}><Input id={index === 0 ? id : undefined} value={item} onChange={(event) => update(index, event.target.value)} className={classes} /><button type="button" aria-label={`Remove ${field.label} ${index + 1}`} onClick={() => onChange(field.key, items.filter((_, itemIndex) => itemIndex !== index))} className="border border-border px-2 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button></div>)}<button type="button" onClick={() => onChange(field.key, [...items, ""])} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Plus className="h-4 w-4" />Add {field.label.slice(0, -1) || "entry"}</button></div>;
    }
    case "textarea":
      return (
        <Textarea
          id={id}
          {...accessibility}
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          rows={4}
          className={`rounded-none border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-primary transition-colors resize-none leading-relaxed ${error ? "border-destructive focus-visible:border-destructive" : ""}`}
        />
      );
    case "select":
      return (
        <Select value={value ?? ""} onValueChange={(v) => onChange(field.key, v)}>
          <SelectTrigger id={id} {...accessibility} className={classes}>
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
          id={id}
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          min={field.key === "copies" ? 0 : undefined}
          {...accessibility}
          className={classes}
        />
      );
    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          {...accessibility}
          className={classes}
        />
      );
    default:
      return (
        <Input
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          {...accessibility}
          className={classes}
        />
      );
  }
};

export default FieldInput;

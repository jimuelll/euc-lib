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

const FieldInput = ({ field, value, onChange }: Props) => {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          rows={3}
        />
      );
    case "select":
      return (
        <Select value={value ?? ""} onValueChange={(v) => onChange(field.key, v)}>
          <SelectTrigger><SelectValue placeholder={`Select ${field.label}`} /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
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
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
    default:
      return (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
  }
};

export default FieldInput;
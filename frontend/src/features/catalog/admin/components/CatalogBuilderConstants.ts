export const toKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

export const inputClass =
  "rounded-none border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-primary transition-colors h-9";

export const SYSTEM_LOCKED_KEYS = new Set(["title", "author"]);


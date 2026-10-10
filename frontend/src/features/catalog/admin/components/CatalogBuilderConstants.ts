export const toKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

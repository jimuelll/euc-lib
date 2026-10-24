export function copyCount(available: number, total?: number | null) {
  const count = Math.max(0, Number(available) || 0);
  if (total == null) return `${count} ${count === 1 ? "copy" : "copies"}`;
  const copies = Math.max(0, Number(total) || 0);
  return copies === 1 && count === 1 ? "1 copy" : `${count} of ${copies} ${copies === 1 ? "copy" : "copies"}`;
}


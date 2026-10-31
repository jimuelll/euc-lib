export const isOperationsRole = (role?: string): boolean => role === "scanner" || role === "opac";
export const operationsHome = (role?: string): string | null => role === "scanner" ? "/scan-qr" : role === "opac" ? "/catalogue" : null;
export function operationsPasswordError(password: string): string | undefined {
  if (password.length < 8 || new TextEncoder().encode(password).length > 72) return "Use at least 8 characters and no more than 72 UTF-8 bytes.";
}

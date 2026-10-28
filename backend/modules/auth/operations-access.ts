/** Dedicated terminal accounts have an explicit, method-specific API allowlist. */
export const isOperationsRole = (role?: string): boolean => role === "scanner" || role === "opac";
export function operationsRequestAllowed(role: string | undefined, method: string, url: string = ""): boolean {
  if (!isOperationsRole(role)) return true;
  const path = url.split("?")[0].replace(/\/+$/, "").toLowerCase();
  if (method === "POST" && ["/api/auth/login", "/api/auth/refresh", "/api/auth/logout"].includes(path)) return true;
  if (role === "scanner") return method === "POST" && path === "/api/attendance/scan";
  return method === "GET" && (["/api/catalogue/schema", "/api/catalogue/search"].includes(path) || /^\/api\/catalogue\/books\/\d+\/recommendations$/.test(path));
}

export type NavigationLink = { label: string; to: string; matchPrefix: boolean };

const rolesWithMyLibrary = new Set(["student", "employee", "alumni", "scanner", "staff", "admin", "super_admin"]);
const rolesWithScanner = new Set(["scanner"]);
const rolesWithAdminPanel = new Set(["admin", "super_admin", "staff"]);

export function getNavigationPermissions(role: string) {
  return { showAdminPanel: rolesWithAdminPanel.has(role), showMyLibrary: rolesWithMyLibrary.has(role), showScannerTools: rolesWithScanner.has(role) };
}

export function getUserInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function isNavigationLinkActive(pathname: string, link: NavigationLink): boolean {
  if (!link.matchPrefix || link.to === "/") return pathname === link.to;
  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}

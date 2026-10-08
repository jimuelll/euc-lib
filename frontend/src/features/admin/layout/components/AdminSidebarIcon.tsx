import type { SVGProps } from "react";
import { AdminIcon, type AdminIconName } from "../../components/AdminIcon";

// Sidebar accents are independent of dashboard status/category colors.
export function AdminSidebarIcon(props: SVGProps<SVGSVGElement> & { name: AdminIconName }) {
  return <AdminIcon {...props} accent />;
}
export { adminIconByUrl as adminSidebarIconByUrl } from "../../components/AdminIcon";
export type { AdminIconName as AdminSidebarIconName } from "../../components/AdminIcon";

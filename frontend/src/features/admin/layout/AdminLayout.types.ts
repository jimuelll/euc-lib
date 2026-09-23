import type { Home } from "lucide-react";

export interface SidebarItem {
  title: string;
  url:   string;
  icon:  typeof Home;
  roles?: string[];
  aliases?: string[];
}

export interface SidebarSection {
  label: string;
  alwaysOpen?: boolean;
  items: SidebarItem[];
}

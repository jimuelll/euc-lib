import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { AdminIcon } from "./AdminIcon";

export function AdminThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return <Button variant="ghost" size="icon" className="h-11 w-11 md:h-9 md:w-9" onClick={toggleTheme} aria-label="Toggle theme">
    <AdminIcon name={theme === "dark" ? "sun" : "moon"} />
  </Button>;
}

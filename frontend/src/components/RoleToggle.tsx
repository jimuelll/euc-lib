import { useRole, UserRole } from "@/hooks/use-role";
import { Shield, User, QrCode, GraduationCap, Briefcase } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const roles: { value: UserRole; label: string; icon: typeof User; description: string }[] = [
  { value: "guest", label: "Guest", icon: User, description: "Public visitor" },
  { value: "student", label: "Student", icon: GraduationCap, description: "Logged-in student" },
  { value: "employee", label: "Employee", icon: Briefcase, description: "Logged-in employee" },
  { value: "scanner", label: "Scanner", icon: QrCode, description: "Library entrance kiosk" },
  { value: "admin", label: "Admin", icon: Shield, description: "Administrator" },
];

const RoleToggle = () => {
  const { role, setRole } = useRole();
  const current = roles.find((r) => r.value === role)!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 border-dashed">
          <current.icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{current.label}</span>
          <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px] leading-tight">
            Demo
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Switch Demo Role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((r) => (
          <DropdownMenuItem
            key={r.value}
            onClick={() => setRole(r.value)}
            className={role === r.value ? "bg-primary/10 text-primary" : ""}
          >
            <r.icon className="mr-2 h-4 w-4" />
            <div>
              <p className="text-sm font-medium">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleToggle;

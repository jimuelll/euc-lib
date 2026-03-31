import { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "guest" | "student" | "employee" | "scanner" | "admin";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isLoggedIn: boolean;
  userName: string;
  userInitials: string;
}

const roleProfiles: Record<UserRole, { name: string; initials: string }> = {
  guest: { name: "Guest", initials: "G" },
  student: { name: "Maria Santos", initials: "MS" },
  employee: { name: "Elena Reyes", initials: "ER" },
  scanner: { name: "Library Scanner", initials: "LS" },
  admin: { name: "Admin User", initials: "AD" },
};

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole>(() => {
    const stored = localStorage.getItem("demo-role") as UserRole;
    return stored && ["guest", "student", "employee", "scanner", "admin"].includes(stored) ? stored : "guest";
  });

  const handleSetRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem("demo-role", newRole);
  };

  const profile = roleProfiles[role];

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole: handleSetRole,
        isLoggedIn: role !== "guest",
        userName: profile.name,
        userInitials: profile.initials,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used within RoleProvider");
  return context;
};

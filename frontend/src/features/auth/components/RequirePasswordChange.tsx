// src/components/guards/RequirePasswordChange.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const RequirePasswordChange = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  // If user is logged in AND must change password, force them to the change-password page
  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
};

export default RequirePasswordChange;
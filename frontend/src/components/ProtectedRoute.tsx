import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

const ProtectedRoute = ({ children, roles = [] }: Props) => {
  const { user, loading } = useAuth();

  // Wait for auth to settle — prevents flicker
  if (loading) return null;

  // Not logged in
  if (!user) return <Navigate to="/login" replace />;

  // Role check
  if (roles.length && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;


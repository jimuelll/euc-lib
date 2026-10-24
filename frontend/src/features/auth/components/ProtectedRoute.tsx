import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

import { loginDestination } from "@/utils/authDestination";

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

const ProtectedRoute = ({ children, roles = [] }: Props) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait for auth to settle — prevents flicker
  if (loading) return null;

  // Not logged in
  if (!user) return <Navigate to={loginDestination(location.pathname + location.search + location.hash)} replace />;

  // Role check
  if (roles.length && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;


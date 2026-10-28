import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { operationsHome } from "@/utils/operationsAccess";

export default function OperationsRouteGate({children}:{children:ReactNode}) {
  const {user,loading}=useAuth();
  const {pathname}=useLocation();
  const home=operationsHome(user?.role);
  if (loading) return <div role="status" aria-label="Restoring session" />;
  if (home && pathname!==home) return <Navigate to={home} replace />;
  return <>{children}</>;
}

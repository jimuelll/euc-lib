import { Navigate } from "react-router-dom";

function decodeToken(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

const ProtectedRoute = ({ children, roles = [] }: Props) => {
  const token = localStorage.getItem("token");

  // ❌ Not logged in
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const decoded = decodeToken(token);

  // ❌ Invalid token
  if (!decoded) {
    return <Navigate to="/login" replace />;
  }

  // 🚨 FORCE PASSWORD CHANGE (THIS IS YOUR GUARD)
  if (decoded.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  // 🔐 Role check
  if (roles.length && !roles.includes(decoded.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
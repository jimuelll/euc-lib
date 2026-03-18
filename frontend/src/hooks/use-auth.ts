// src/hooks/use-auth.ts (or inside your RoleProvider/AuthContext)
import { useNavigate } from "react-router-dom";

export const useAuth = () => {
  const navigate = useNavigate();

  const logout = () => {
    // Remove the JWT from localStorage
    localStorage.removeItem("token");

    // Optionally remove any user info stored
    localStorage.removeItem("role");
    localStorage.removeItem("userName");

    // Redirect to login page
    navigate("/login", { replace: true });
  };

  return { logout };
};
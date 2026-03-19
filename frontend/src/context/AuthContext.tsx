import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axiosInstance, { setInMemoryToken } from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";

interface User {
  id: number;
  role: string;
  name: string;
  must_change_password: boolean;
}

interface AuthContextProps {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  mustChangePassword: boolean;
  login: (employeeId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const decodeToken = (token: string): User | null => {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return null;
    }
  };

  const logout = useCallback(async () => {
    try {
      await axiosInstance.post("/auth/logout", {}, { withCredentials: true });
    } catch {
      // ignore — clear state regardless
    }
    setUser(null);
    setAccessToken(null);
    setInMemoryToken(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const refreshToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.post("/auth/refresh", {}, { withCredentials: true });
      const token = res.data.accessToken;

      setAccessToken(token);
      setInMemoryToken(token);

      const decodedUser = decodeToken(token);
      if (decodedUser) setUser(decodedUser);

      return token;
    } catch {
      // No valid refresh token — guest user, silently clear state
      setUser(null);
      setAccessToken(null);
      setInMemoryToken(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  const login = useCallback(async (employeeId: string, password: string) => {
    try {
      const res = await axiosInstance.post(
        "/auth/login",
        { student_employee_id: employeeId, password },
        { withCredentials: true }
      );

      const token = res.data.token;

      setAccessToken(token);
      setInMemoryToken(token);

      const decodedUser = decodeToken(token);
      if (decodedUser) setUser(decodedUser);

      if (res.data.mustChangePassword) {
        toast.warning("You must change your password before continuing.");
        navigate("/change-password", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.message || "Login failed");
    }
  }, [navigate]);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!user) throw new Error("Not logged in");

    try {
      const res = await axiosInstance.post("/auth/change-password", { oldPassword, newPassword });
      const token = res.data.token;

      setAccessToken(token);
      setInMemoryToken(token);

      const decodedUser = decodeToken(token);
      if (decodedUser) setUser(decodedUser);

      toast.success("Password changed successfully!");
      navigate("/", { replace: true });
    } catch (err: any) {
      throw new Error(err.response?.data?.message || "Failed to change password");
    }
  }, [user, navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loading,
        login,
        logout,
        changePassword,
        mustChangePassword: user?.must_change_password ?? false,
        getToken: () => accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
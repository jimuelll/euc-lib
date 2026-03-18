import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axiosInstance from "@/utils/AxiosInstance";
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
  login: (employeeId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  mustChangePassword: boolean;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const navigate = useNavigate();

  // Decode JWT helper
  const decodeToken = (token: string): User | null => {
    try {
      const decoded = JSON.parse(atob(token.split(".")[1]));
      return decoded;
    } catch {
      return null;
    }
  };

  // Refresh access token
  const refreshToken = useCallback(async () => {
    try {
      const res = await axiosInstance.post("/auth/refresh", {}, { withCredentials: true });
      const token = res.data.accessToken;
      setAccessToken(token);
      const decodedUser = decodeToken(token);
      if (decodedUser) setUser(decodedUser);
      return token;
    } catch {
      logout(); // invalid refresh token
      return null;
    }
  }, []);

  // Initial load: try refresh token
  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  const login = async (employeeId: string, password: string) => {
    try {
      const res = await axiosInstance.post(
        "/auth/login",
        { student_employee_id: employeeId, password },
        { withCredentials: true } // receive refresh cookie
      );

      const token = res.data.token;
      setAccessToken(token);
      const decodedUser = decodeToken(token);
      if (decodedUser) setUser(decodedUser);

      if (res.data.mustChangePassword) {
        toast.warning("You must change your password!");
        navigate("/change-password", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.message || "Login failed");
    }
  };

  const logout = async () => {
    try {
      await axiosInstance.post("/auth/logout", {}, { withCredentials: true });
    } catch {
      // ignore
    }
    setUser(null);
    setAccessToken(null);
    navigate("/login", { replace: true });
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!user) throw new Error("Not logged in");

    const res = await axiosInstance.post("/auth/change-password", { oldPassword, newPassword });
    const token = res.data.token;
    setAccessToken(token);
    const decodedUser = decodeToken(token);
    if (decodedUser) setUser(decodedUser);

    toast.success("Password changed successfully!");
    navigate("/", { replace: true });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        login,
        logout,
        changePassword,
        mustChangePassword: user?.must_change_password || false,
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
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

const decodeToken = (token: string): User | null => {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
};

// ✅ decode stored refresh token immediately to pre-populate user before first render
const getInitialUser = (): User | null => {
  try {
    const stored = localStorage.getItem("refreshToken");
    if (!stored) return null;
    return decodeToken(stored);
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getInitialUser); // ✅ sync init, no flicker
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    try {
      await axiosInstance.post("/api/auth/logout", {});
    } catch {
      // ignore — clear state regardless
    }
    localStorage.removeItem("refreshToken");
    setUser(null);
    setAccessToken(null);
    setInMemoryToken(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const refreshToken = useCallback(async () => {
    setLoading(true);
    try {
      const storedRefreshToken = localStorage.getItem("refreshToken");
      if (!storedRefreshToken) {
        setLoading(false);
        return null;
      }

      const res = await axiosInstance.post("/api/auth/refresh", {
        refreshToken: storedRefreshToken,
      });

      const token = res.data.accessToken;

      setAccessToken(token);
      setInMemoryToken(token);

      const decodedUser = decodeToken(token);
      if (decodedUser) setUser(decodedUser);

      return token;
    } catch {
      localStorage.removeItem("refreshToken");
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
      const res = await axiosInstance.post("/api/auth/login", {
        student_employee_id: employeeId,
        password,
      });

      const { token, refreshToken: newRefreshToken } = res.data;

      localStorage.setItem("refreshToken", newRefreshToken);
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
      const res = await axiosInstance.post("/api/auth/change-password", { oldPassword, newPassword });
      const { token, refreshToken: newRefreshToken } = res.data;

      localStorage.setItem("refreshToken", newRefreshToken);
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
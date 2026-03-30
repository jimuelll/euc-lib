import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  setAuthFailureHandler,
  setAuthRefreshHandler,
  setInMemoryToken,
} from "@/utils/AxiosInstance";
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
  loading: boolean;
  mustChangePassword: boolean;
  login: (employeeId: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

const decodeAccessToken = (token: string): User | null => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (
      typeof payload?.id !== "number" ||
      typeof payload?.role !== "string" ||
      typeof payload?.name !== "string"
    ) {
      return null;
    }

    return {
      id: payload.id,
      role: payload.role,
      name: payload.name,
      must_change_password: Boolean(payload.must_change_password),
    };
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const applyAccessToken = useCallback((token: string | null) => {
    setAccessToken(token);
    setInMemoryToken(token);
    setUser(token ? decodeAccessToken(token) : null);
  }, []);

  const clearSession = useCallback(() => {
    applyAccessToken(null);
  }, [applyAccessToken]);

  const refreshSession = useCallback(async () => {
    const res = await axiosInstance.post("/api/auth/refresh", {});

    const token = res.data.accessToken;
    applyAccessToken(token);
    return token;
  }, [applyAccessToken]);

  useEffect(() => {
    setAuthRefreshHandler((token) => {
      applyAccessToken(token);
    });

    setAuthFailureHandler(() => {
      clearSession();
    });

    return () => {
      setAuthRefreshHandler(null);
      setAuthFailureHandler(null);
    };
  }, [applyAccessToken, clearSession]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      setLoading(true);
      try {
        await refreshSession();
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [refreshSession, clearSession]);

  const logout = useCallback(async () => {
    try {
      await axiosInstance.post("/api/auth/logout", {});
    } catch {
      // Ignore server logout failures and clear local session anyway.
    }

    clearSession();
    navigate("/login", { replace: true });
  }, [clearSession, navigate]);

  const login = useCallback(async (employeeId: string, password: string, rememberMe = true) => {
    try {
      const res = await axiosInstance.post("/api/auth/login", {
        student_employee_id: employeeId,
        password,
        rememberMe,
      });

      const token = res.data.accessToken ?? res.data.token;
      if (!token) throw new Error("Invalid login response");
      applyAccessToken(token);

      if (res.data.mustChangePassword) {
        toast.warning("Change your password to unlock library features.");
      }

      navigate("/", { replace: true });
    } catch (err: any) {
      throw new Error(err.response?.data?.message || "Login failed");
    }
  }, [applyAccessToken, navigate]);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!user) throw new Error("Not logged in");

    try {
      const res = await axiosInstance.post("/api/auth/change-password", {
        oldPassword,
        newPassword,
      });

      const token = res.data.accessToken ?? res.data.token;
      if (!token) throw new Error("Invalid password change response");
      applyAccessToken(token);

      toast.success("Password changed successfully!");
      navigate("/", { replace: true });
    } catch (err: any) {
      throw new Error(err.response?.data?.message || "Failed to change password");
    }
  }, [applyAccessToken, navigate, user]);

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

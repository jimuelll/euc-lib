import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/services/notifications.service";

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

const getWebSocketUrl = (baseUrl: string, token: string) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.searchParams.set("token", token);
  return url.toString();
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading, getToken } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const refresh = async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [items, unread] = await Promise.all([
        fetchNotifications(),
        fetchUnreadCount(),
      ]);
      setNotifications(items);
      setUnreadCount(unread);
    } finally {
      setLoading(false);
    }
  };

  refreshRef.current = refresh;

  useEffect(() => {
    if (authLoading) return;

    void refresh();
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      const token = getToken();
      if (!token || cancelled) return;

      const socket = new WebSocket(getWebSocketUrl(import.meta.env.VITE_BASE_URL, token));
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        void refreshRef.current();
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "notification.bootstrap") {
            setUnreadCount(payload.unreadCount ?? 0);
            void refreshRef.current();
            return;
          }

          if (payload.type === "notification.unread_count") {
            setUnreadCount(payload.unreadCount ?? 0);
            return;
          }

          if (payload.type === "notification.created" && payload.notification) {
            setNotifications((current) => {
              const deduped = current.filter((notification) => notification.id !== payload.notification.id);
              return [payload.notification, ...deduped].slice(0, 20);
            });
            setUnreadCount(payload.unreadCount ?? 0);
          }
        } catch {
          // Ignore malformed socket payloads.
        }
      };

      socket.onclose = () => {
        if (cancelled) return;

        const attempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempt;
        const delay = Math.min(1000 * 2 ** Math.min(attempt - 1, 4), 15000);

        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [authLoading, user?.id, getToken]);

  useEffect(() => {
    if (!user) return;

    const syncNotifications = () => {
      void refreshRef.current();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncNotifications();
      }
    };

    window.addEventListener("focus", syncNotifications);
    window.addEventListener("online", syncNotifications);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", syncNotifications);
      window.removeEventListener("online", syncNotifications);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id]);

  const markAsRead = async (notificationId: number) => {
    await markNotificationRead(notificationId);
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true, read_at: new Date().toISOString() }
          : notification
      )
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  const markAllAsRead = async () => {
    await markAllNotificationsRead();
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
        read_at: notification.read_at ?? new Date().toISOString(),
      }))
    );
    setUnreadCount(0);
  };

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      refresh,
    }),
    [notifications, unreadCount, loading]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used within NotificationsProvider");
  return context;
};

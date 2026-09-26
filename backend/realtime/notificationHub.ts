import type { SocketLike } from "./socket.types";

interface UserConnection {
  socket: SocketLike;
  role: string;
}

const userSockets = new Map<string, Set<UserConnection>>();

const ensureSocketSet = (userId: string | number): Set<UserConnection> => {
  const key = String(userId);
  if (!userSockets.has(key)) {
    userSockets.set(key, new Set());
  }
  return userSockets.get(key)!;
};

const registerConnection = (userId: string | number, socket: SocketLike, role: string): void => {
  const sockets = ensureSocketSet(userId);
  sockets.add({ socket, role });
};

const unregisterConnection = (userId: string | number, socket: SocketLike): void => {
  const key = String(userId);
  const sockets = userSockets.get(key);
  if (!sockets) return;

  for (const connection of sockets) {
    if (connection.socket === socket) sockets.delete(connection);
  }
  if (sockets.size === 0) {
    userSockets.delete(key);
  }
};

const send = (socket: SocketLike, payload: unknown): void => {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(payload));
};

const pushToUser = (userId: string | number, payload: unknown): void => {
  const sockets = userSockets.get(String(userId));
  if (!sockets) return;

  for (const connection of sockets) {
    send(connection.socket, payload);
  }
};

const pushUnreadCount = (userId: string | number, unreadCount: number): void => {
  pushToUser(userId, {
    type: "notification.unread_count",
    unreadCount,
  });
};

const pushNotification = (userId: string | number, payload: unknown): void => {
  pushToUser(userId, payload);
};

const pushAudienceChanged = ({ audienceType, audienceRole }: { audienceType: string; audienceRole?: string | null }): void => {
  for (const connections of userSockets.values()) {
    for (const connection of connections) {
      if (audienceType === "all" || (audienceType === "role" && connection.role === audienceRole)) {
        send(connection.socket, { type: "notification.audience_changed" });
      }
    }
  }
};

const closeAllConnections = (payload: unknown): void => {
  for (const connections of userSockets.values()) {
    for (const connection of connections) {
      send(connection.socket, payload);
      try {
        connection.socket.close(1012, "System restored; sign in again");
      } catch {
        /* Socket may already be closing. */
      }
    }
  }
  userSockets.clear();
};

export = {
  registerConnection,
  unregisterConnection,
  pushUnreadCount,
  pushNotification,
  pushAudienceChanged,
  closeAllConnections,
};

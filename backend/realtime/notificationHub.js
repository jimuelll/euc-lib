const userSockets = new Map();

const ensureSocketSet = (userId) => {
  const key = String(userId);
  if (!userSockets.has(key)) {
    userSockets.set(key, new Set());
  }
  return userSockets.get(key);
};

const registerConnection = (userId, socket, role) => {
  const sockets = ensureSocketSet(userId);
  sockets.add({ socket, role });
};

const unregisterConnection = (userId, socket) => {
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

const send = (socket, payload) => {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(payload));
};

const pushToUser = (userId, payload) => {
  const sockets = userSockets.get(String(userId));
  if (!sockets) return;

  for (const connection of sockets) {
    send(connection.socket, payload);
  }
};

const pushUnreadCount = (userId, unreadCount) => {
  pushToUser(userId, {
    type: "notification.unread_count",
    unreadCount,
  });
};

const pushNotification = (userId, payload) => {
  pushToUser(userId, payload);
};

const pushAudienceChanged = ({ audienceType, audienceRole }) => {
  for (const connections of userSockets.values()) {
    for (const connection of connections) {
      if (audienceType === "all" || (audienceType === "role" && connection.role === audienceRole)) {
        send(connection.socket, { type: "notification.audience_changed" });
      }
    }
  }
};

const closeAllConnections = (payload) => {
  for (const connections of userSockets.values()) {
    for (const connection of connections) {
      send(connection.socket, payload);
      try { connection.socket.close(1012, "System restored; sign in again"); } catch { /* Socket may already be closing. */ }
    }
  }
  userSockets.clear();
};

module.exports = {
  registerConnection,
  unregisterConnection,
  pushUnreadCount,
  pushNotification,
  pushAudienceChanged,
  closeAllConnections,
};

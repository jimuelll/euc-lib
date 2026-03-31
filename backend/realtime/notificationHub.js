const userSockets = new Map();

const ensureSocketSet = (userId) => {
  const key = String(userId);
  if (!userSockets.has(key)) {
    userSockets.set(key, new Set());
  }
  return userSockets.get(key);
};

const registerConnection = (userId, socket) => {
  const sockets = ensureSocketSet(userId);
  sockets.add(socket);
};

const unregisterConnection = (userId, socket) => {
  const key = String(userId);
  const sockets = userSockets.get(key);
  if (!sockets) return;

  sockets.delete(socket);
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

  for (const socket of sockets) {
    send(socket, payload);
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

module.exports = {
  registerConnection,
  unregisterConnection,
  pushUnreadCount,
  pushNotification,
};

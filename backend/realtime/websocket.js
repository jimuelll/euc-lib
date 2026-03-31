const { WebSocketServer } = require("ws");
const url = require("url");
const hub = require("./notificationHub");
const { verifyAccessToken } = require("../modules/auth/jwt.util");
const notificationsService = require("../modules/notifications/notifications.service");

const attachWebSocketServer = (server) => {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (socket, request) => {
    try {
      const parsed = url.parse(request.url, true);
      const token = parsed.query?.token;

      if (!token || typeof token !== "string") {
        socket.close(4001, "Authentication required");
        return;
      }

      const user = verifyAccessToken(token);
      socket.user = user;
      hub.registerConnection(user.id, socket);

      const unreadCount = await notificationsService.getUnreadCountForUser({
        userId: user.id,
        role: user.role,
      });

      socket.send(JSON.stringify({
        type: "notification.bootstrap",
        unreadCount,
      }));

      socket.on("close", () => {
        hub.unregisterConnection(user.id, socket);
      });
    } catch (err) {
      socket.close(4002, "Invalid session");
    }
  });

  return wss;
};

module.exports = {
  attachWebSocketServer,
};

import type { IncomingMessage, Server } from "http";
import url = require("url");
import hub = require("./notificationHub");
import auth = require("../modules/auth/jwt.util");
import notificationsService = require("../modules/notifications/notifications.service");
import type { AuthenticatedSocket, AuthenticatedUser } from "./socket.types";

const { WebSocketServer } = require("ws");
const { verifyAccessToken } = auth;

const attachWebSocketServer = (server: Server) => {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (socket: AuthenticatedSocket, request: IncomingMessage) => {
    try {
      const parsed = url.parse(request.url as string, true);
      const token = parsed.query?.token;

      if (!token || typeof token !== "string") {
        socket.close(4001, "Authentication required");
        return;
      }

      const user = verifyAccessToken(token) as AuthenticatedUser;
      socket.user = user;
      hub.registerConnection(user.id, socket, user.role);

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
    } catch {
      socket.close(4002, "Invalid session");
    }
  });

  return wss;
};

export = { attachWebSocketServer };

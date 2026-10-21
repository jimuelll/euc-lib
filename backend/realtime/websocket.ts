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
      const sessions = require("../modules/auth/authSession.service");
      if (!await sessions.isAccessTokenCurrent(user) || !await sessions.isUserAccessActive(user.id) || user.must_change_password) { socket.close(4002,"Session ended"); return; }
      const sessionCheck = setInterval(async () => {
        try { if (!await sessions.isAccessTokenCurrent(user) || !await sessions.isUserAccessActive(user.id) || (user.exp && Number(user.exp)*1000<=Date.now())) socket.close(4002,"Session ended"); } catch { socket.close(4002,"Unable to validate session"); }
      },15_000);
      sessionCheck.unref();
      socket.on("close",()=>clearInterval(sessionCheck));
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

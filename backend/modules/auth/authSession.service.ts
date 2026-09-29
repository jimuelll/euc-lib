import { randomUUID } from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import repository = require("./auth-session.repository");
import auth = require("./jwt.util");
import type { AuthTokenPayload } from "./auth.types";

function toMySqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function issueRefreshSession(userId: number, expiresAt: Date, rememberMe = false): Promise<string> {
  const jti = randomUUID();
  await repository.createRefreshSession(userId, jti, toMySqlDateTime(expiresAt));
  return auth.signRefreshToken({ id: userId, jti, remember_me: Boolean(rememberMe) });
}

const getActiveRefreshSession = (userId: number, jti: string) => repository.getActiveRefreshSession(userId, jti);
const revokeRefreshSession = (userId: number, jti: string) => repository.revokeRefreshSession(userId, jti);

async function rotateRefreshSession(userId: number, oldJti: string, nextExpiresAt: Date, rememberMe = false): Promise<string> {
  const jti = randomUUID();
  const rotated = await repository.rotateRefreshSession(userId, oldJti, jti, toMySqlDateTime(nextExpiresAt));
  if (!rotated) throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  return auth.signRefreshToken({ id: userId, jti, remember_me: Boolean(rememberMe) });
}

const revokeAllRefreshSessionsForUser = (userId: number) => repository.revokeAllRefreshSessionsForUser(userId);
const purgeStaleRefreshSessions = () => repository.purgeStaleRefreshSessions();
const invalidateAllSessionsAfterRestore = (conn?: PoolConnection) => repository.invalidateAllSessionsAfterRestore(conn);

async function isAccessTokenCurrent(payload: unknown): Promise<boolean> {
  const invalidBeforeSeconds = await repository.getInvalidBefore();
  if (!invalidBeforeSeconds) return true;
  const issuedAt = payload !== null && (typeof payload === "object" || typeof payload === "function")
    ? (payload as { iat?: unknown }).iat
    : undefined;
  return Number(issuedAt || 0) > Number(invalidBeforeSeconds);
}

const isUserAccessActive = (userId: number) => repository.isUserAccessActive(userId);

export = {
  issueRefreshSession,
  getActiveRefreshSession,
  revokeRefreshSession,
  rotateRefreshSession,
  revokeAllRefreshSessionsForUser,
  purgeStaleRefreshSessions,
  invalidateAllSessionsAfterRestore,
  isAccessTokenCurrent,
  isUserAccessActive,
};

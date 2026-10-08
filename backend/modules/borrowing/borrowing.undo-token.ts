import { randomUUID } from "node:crypto";
import jwt = require("jsonwebtoken");

const audience = "circulation-desk-undo";
interface DeskUndo extends jwt.JwtPayload { actorId: number; borrowingId: number; kind: "borrow" | "return"; returnedAt?: string }
function issueDeskUndo(actorId: number, borrowingId: number, kind: DeskUndo["kind"], returnedAt?: Date | string) {
  if (!process.env.JWT_SECRET) return {};
  const undoExpiresAt = new Date(Date.now() + 60_000).toISOString();
  const undoToken = jwt.sign({ actorId, borrowingId, kind, returnedAt: returnedAt ? new Date(returnedAt).toISOString() : undefined }, process.env.JWT_SECRET, { audience, issuer: audience, jwtid: randomUUID(), algorithm: "HS256", expiresIn: 60 });
  return { undoToken, undoExpiresAt };
}
function verifyDeskUndo(token: string, actorId: number): DeskUndo {
  try {
    const value = jwt.verify(token, process.env.JWT_SECRET || "", { audience, issuer: audience, algorithms: ["HS256"] }) as DeskUndo;
    if (typeof value.jti !== "string" || value.actorId !== actorId || !Number.isSafeInteger(value.borrowingId) || !["borrow", "return"].includes(value.kind)) throw new Error("Invalid desk reversal");
    return value;
  } catch { throw Object.assign(new Error("Undo expired or is unavailable for this staff member."), { status: 409 }); }
}
export = { issueDeskUndo, verifyDeskUndo };

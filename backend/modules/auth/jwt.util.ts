import jwt = require("jsonwebtoken");
import dotenv = require("dotenv");
import type { SignOptions } from "jsonwebtoken";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "15m") as NonNullable<SignOptions["expiresIn"]>;
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as NonNullable<SignOptions["expiresIn"]>;

const requireSecret = (secret: string | undefined, envName: string): string => {
  if (!secret) {
    throw new Error(`${envName} is not configured`);
  }
  return secret;
};

function signToken(payload: object): string {
  return jwt.sign(payload, requireSecret(JWT_SECRET, "JWT_SECRET"), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function signRefreshToken(payload: object): string {
  return jwt.sign(payload, requireSecret(JWT_REFRESH_SECRET, "JWT_REFRESH_SECRET"), {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });
}

function verifyAccessToken(token: string): string | jwt.JwtPayload {
  return jwt.verify(token, requireSecret(JWT_SECRET, "JWT_SECRET"));
}

function verifyRefreshToken(token: string): string | jwt.JwtPayload {
  return jwt.verify(token, requireSecret(JWT_REFRESH_SECRET, "JWT_REFRESH_SECRET"));
}

export = { signToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };

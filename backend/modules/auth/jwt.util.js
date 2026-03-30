const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

const requireSecret = (secret, envName) => {
  if (!secret) {
    throw new Error(`${envName} is not configured`);
  }
  return secret;
};

function signToken(payload) {
  return jwt.sign(payload, requireSecret(JWT_SECRET, "JWT_SECRET"), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, requireSecret(JWT_REFRESH_SECRET, "JWT_REFRESH_SECRET"), {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, requireSecret(JWT_SECRET, "JWT_SECRET"));
}

function verifyRefreshToken(token) {
  return jwt.verify(token, requireSecret(JWT_REFRESH_SECRET, "JWT_REFRESH_SECRET"));
}

module.exports = { signToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };

import type { CookieOptions, Request, Response } from "express";

const REFRESH_TOKEN_COOKIE = "refreshToken";
const REMEMBER_ME_COOKIE = "rememberMe";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type CookieRequest = Request & { cookies?: Record<string, string | undefined> };

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function buildCookieOptions(rememberMe = false): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    path: "/api/auth",
    ...(rememberMe ? { maxAge: SEVEN_DAYS_MS } : {}),
  };
}

function setRefreshAuthCookies(res: Response, refreshToken: string, rememberMe = false): void {
  const options = buildCookieOptions(rememberMe);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, options);
  res.cookie(REMEMBER_ME_COOKIE, rememberMe ? "1" : "0", options);
}

function clearRefreshAuthCookies(res: Response): void {
  const options = buildCookieOptions(false);
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
  res.clearCookie(REMEMBER_ME_COOKIE, options);
}

function getRefreshTokenFromCookies(req: CookieRequest): string | null {
  return req.cookies?.[REFRESH_TOKEN_COOKIE] || null;
}

function getRememberMeFromCookies(req: CookieRequest): boolean {
  return req.cookies?.[REMEMBER_ME_COOKIE] === "1";
}

export = {
  clearRefreshAuthCookies,
  getRememberMeFromCookies,
  getRefreshTokenFromCookies,
  setRefreshAuthCookies,
};

const REFRESH_TOKEN_COOKIE = "refreshToken";
const REMEMBER_ME_COOKIE = "rememberMe";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function buildCookieOptions(rememberMe = false) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    path: "/api/auth",
    ...(rememberMe ? { maxAge: SEVEN_DAYS_MS } : {}),
  };
}

function setRefreshAuthCookies(res, refreshToken, rememberMe = false) {
  const options = buildCookieOptions(rememberMe);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, options);
  res.cookie(REMEMBER_ME_COOKIE, rememberMe ? "1" : "0", options);
}

function clearRefreshAuthCookies(res) {
  const options = buildCookieOptions(false);
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
  res.clearCookie(REMEMBER_ME_COOKIE, options);
}

function getRefreshTokenFromCookies(req) {
  return req.cookies?.[REFRESH_TOKEN_COOKIE] || null;
}

function getRememberMeFromCookies(req) {
  return req.cookies?.[REMEMBER_ME_COOKIE] === "1";
}

module.exports = {
  clearRefreshAuthCookies,
  getRememberMeFromCookies,
  getRefreshTokenFromCookies,
  setRefreshAuthCookies,
};

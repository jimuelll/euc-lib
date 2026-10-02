const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { ipKeyGenerator } = require("express-rate-limit");
const { createLimiter, limiters, policies, rateLimitExposedHeaders } = require("../middlewares/rateLimiter");

const modulesRoot = path.join(__dirname, "..", "modules");
const readRoute = (relativePath) => fs.readFileSync(path.join(modulesRoot, relativePath), "utf8");

async function withServer(app, run) {
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function withAccount(app) {
  app.use((req, _res, next) => {
    req.user = { id: Number(req.get("x-test-account")) };
    next();
  });
}

test("central rate-limit policy values and account scopes match the documented plan", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(policies).map(([name, { windowMs, limit }]) => [name, { windowMs, limit }])),
    {
      api: { windowMs: 60_000, limit: 1_500 },
      login: { windowMs: 900_000, limit: 5 },
      passwordChange: { windowMs: 900_000, limit: 5 },
      refreshIp: { windowMs: 60_000, limit: 300 },
      refreshAccount: { windowMs: 60_000, limit: 30 },
      bulletinPost: { windowMs: 600_000, limit: 10 },
      bulletinComment: { windowMs: 300_000, limit: 20 },
      bulletinLike: { windowMs: 60_000, limit: 60 },
      visit: { windowMs: 60_000, limit: 120 },
      adminNotification: { windowMs: 600_000, limit: 20 },
      publicCatalogue: { windowMs: 60_000, limit: 300 },
      authenticatedCatalogue: { windowMs: 60_000, limit: 120 },
      studentTransaction: { windowMs: 60_000, limit: 30 },
      deskTransaction: { windowMs: 60_000, limit: 120 },
      attendance: { windowMs: 60_000, limit: 120 },
      aiReport: { windowMs: 600_000, limit: 10 },
      isbnLookup: { windowMs: 60_000, limit: 60 },
      imageUpload: { windowMs: 600_000, limit: 30 },
      embeddingBackfill: { windowMs: 900_000, limit: 10 },
      reportExport: { windowMs: 600_000, limit: 30 },
      backup: { windowMs: 900_000, limit: 20 },
    },
  );
});

test("account budgets are shared across resource IDs and aliases, but isolated by account", async () => {
  const likeLimiter = createLimiter("bulletinLike", { limit: 2, windowMs: 30_000 });
  const app = express();
  withAccount(app);
  app.post("/posts/:postId/like", likeLimiter, (_req, res) => res.sendStatus(204));
  app.post("/likes/:postId", likeLimiter, (_req, res) => res.sendStatus(204));

  await withServer(app, async (baseUrl) => {
    const request = (url, account) => fetch(`${baseUrl}${url}`, { method: "POST", headers: { "x-test-account": String(account) } });
    assert.equal((await request("/posts/1/like", 41)).status, 204);
    assert.equal((await request("/posts/2/like", 41)).status, 204);

    const blocked = await request("/likes/999", 41);
    assert.equal(blocked.status, 429);
    assert.deepEqual(await blocked.json(), {
      message: "Too many requests. Try again later.",
      code: "RATE_LIMITED",
      retryAfterSeconds: 30,
    });
    assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
    assert.ok(blocked.headers.get("ratelimit-limit"));

    assert.equal((await request("/posts/3/like", 42)).status, 204);
  });
});

test("independent limiter instances reset after their configured window", async () => {
  const shortLimiter = createLimiter("bulletinComment", { limit: 1, windowMs: 1_000 });
  const app = express();
  withAccount(app);
  app.post("/comments", shortLimiter, (_req, res) => res.sendStatus(204));

  await withServer(app, async (baseUrl) => {
    const request = () => fetch(`${baseUrl}/comments`, { method: "POST", headers: { "x-test-account": "51" } });
    assert.equal((await request()).status, 204);
    assert.equal((await request()).status, 429);
    await new Promise((resolve) => setTimeout(resolve, 1_050));
    assert.equal((await request()).status, 204);
  });
});

test("IP identity normalizes IPv6 subnets and keeps IPv4 clients distinct", async () => {
  const visitLimiter = createLimiter("visit");
  const app = express();
  app.set("trust proxy", 1);
  app.post("/visit", visitLimiter, (_req, res) => res.sendStatus(204));

  await withServer(app, async (baseUrl) => {
    const request = (ip) => fetch(`${baseUrl}/visit`, { method: "POST", headers: { "x-forwarded-for": ip } });
    await request("2001:db8:abcd:12a0::1");
    await request("2001:db8:abcd:12ff::2");
    await request("198.51.100.41");

    const sharedV6Key = ipKeyGenerator("2001:db8:abcd:12a0::1", 56);
    const secondV6Key = ipKeyGenerator("2001:db8:abcd:12ff::2", 56);
    const v4Key = ipKeyGenerator("198.51.100.41", 56);
    assert.equal(sharedV6Key, secondV6Key);
    assert.notEqual(sharedV6Key, v4Key);
    assert.equal((await visitLimiter.getKey(sharedV6Key)).totalHits, 2);
    assert.equal((await visitLimiter.getKey(v4Key)).totalHits, 1);
  });
});

test("attendance and desk transactions use separate operator-account budgets", async () => {
  const deskLimiter = createLimiter("deskTransaction");
  const attendanceLimiter = createLimiter("attendance");
  const app = express();
  withAccount(app);
  app.post("/desk/borrow", deskLimiter, (_req, res) => res.sendStatus(204));
  app.post("/attendance/scan", attendanceLimiter, (_req, res) => res.sendStatus(204));

  await withServer(app, async (baseUrl) => {
    const headers = { "x-test-account": "61" };
    assert.equal((await fetch(`${baseUrl}/desk/borrow`, { method: "POST", headers })).status, 204);
    assert.equal((await fetch(`${baseUrl}/attendance/scan`, { method: "POST", headers })).status, 204);
    assert.equal((await deskLimiter.getKey("account:61")).totalHits, 1);
    assert.equal((await attendanceLimiter.getKey("account:61")).totalHits, 1);
  });
});

test("CORS exposes rate-limit headers and preflight passes without consuming API quota", async () => {
  const apiLimiter = createLimiter("api");
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({ origin: "https://library.example", credentials: true, exposedHeaders: rateLimitExposedHeaders }));
  app.use("/api", apiLimiter);
  app.post("/api/visit", (_req, res) => res.sendStatus(204));

  await withServer(app, async (baseUrl) => {
    const ip = "198.51.100.73";
    const preflight = await fetch(`${baseUrl}/api/visit`, {
      method: "OPTIONS",
      headers: {
        origin: "https://library.example",
        "access-control-request-method": "POST",
        "x-forwarded-for": ip,
      },
    });
    assert.equal(preflight.status, 204);
    const exposedHeaders = preflight.headers.get("access-control-expose-headers");
    assert.match(exposedHeaders, /RateLimit-Limit/i);
    assert.match(exposedHeaders, /RateLimit-Policy/i);
    assert.match(exposedHeaders, /Retry-After/i);
    assert.equal(await apiLimiter.getKey(ipKeyGenerator(ip, 56)), undefined);

    const originlessOptions = await fetch(`${baseUrl}/api/visit`, {
      method: "OPTIONS",
      headers: { "x-forwarded-for": ip },
    });
    assert.notEqual(originlessOptions.status, 429);
    assert.equal(await apiLimiter.getKey(ipKeyGenerator(ip, 56)), undefined);

    await fetch(`${baseUrl}/api/visit`, { method: "POST", headers: { "x-forwarded-for": ip } });
    assert.equal((await apiLimiter.getKey(ipKeyGenerator(ip, 56))).totalHits, 1);
  });
});

test("refresh account identity is attached only from a successfully verified token", async () => {
  const { createRefreshIdentityMiddleware } = require("../modules/auth/auth.middleware");
  const identifyAccount = createRefreshIdentityMiddleware((token) => {
    if (token !== "signed-refresh-account-71") throw new Error("invalid signature");
    return { id: 71 };
  }, (req) => req.cookies?.refreshToken || null);

  const identify = (refreshToken) => new Promise((resolve) => {
    const req = { cookies: { refreshToken } };
    identifyAccount(req, {}, () => resolve(req.rateLimitUserId));
  });

  assert.equal(await identify("signed-refresh-account-71"), 71);
  assert.equal(await identify("{\"id\":999}"), undefined);
  assert.equal(await identify("signed-refresh-account-999"), undefined);

  const refreshLimiter = createLimiter("refreshAccount", { limit: 1, windowMs: 30_000 });
  const app = express();
  app.use((req, _res, next) => {
    req.cookies = { refreshToken: req.get("x-refresh-token") };
    next();
  });
  app.post("/refresh", identifyAccount, refreshLimiter, (req, res) => {
    res.sendStatus(req.rateLimitUserId ? 204 : 401);
  });

  await withServer(app, async (baseUrl) => {
    const request = (token) => fetch(`${baseUrl}/refresh`, { method: "POST", headers: { "x-refresh-token": token } });
    assert.equal((await request("signed-refresh-account-71")).status, 204);
    assert.equal((await request("{\"id\":999}")).status, 401);
    assert.equal((await request("signed-refresh-account-999")).status, 401);
    assert.equal((await refreshLimiter.getKey("account:71")).totalHits, 1);
    assert.equal((await request("signed-refresh-account-71")).status, 429);
    assert.equal((await refreshLimiter.getKey("account:71")).totalHits, 2);
  });
});

test("API rate limits are attached after authentication and before protected handlers", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.ts"), "utf8");
  assert.match(app, /app\.use\("\/api", limiters\.api\);[\s\S]*app\.use\(express\.json/);
  assert.match(app, /exposedHeaders:\s*rateLimitExposedHeaders/);

  const cases = [
    ["auth/auth.routes.ts", /"\/change-password", authMiddleware\(\), limiters\.passwordChange/],
    ["bulletin/bulletin.routes.ts", /"\/", authMiddleware\(CAN_POST\), limiters\.bulletinPost/],
    ["bulletin/bulletin.routes.ts", /"\/:postId\/comments", authMiddleware\(\), limiters\.bulletinComment/],
    ["analytics/analytics.routes.ts", /"\/visit", limiters\.visit/],
    ["analytics/analytics.admin.routes.ts", /limiters\.aiReport,\s*handleCreateAiAnalyticsReport/],
    ["catalog/catalog.public.routes.ts", /"\/catalogue\/search", limiters\.publicCatalogue/],
    ["catalog/catalog.routes.ts", /"\/books\/isbn\/:isbn", requireCatalogRole, limiters\.isbnLookup/],
    ["catalog/catalog.routes.ts", /"\/books\/:id\/image", requireCatalogRole, limiters\.imageUpload, validateBookId, parseCatalogImage/],
    ["recommendations/recommendations.routes.ts", /"\/admin\/recommendations\/embeddings\/backfill", requireSuperAdminRole, limiters\.embeddingBackfill/],
    ["borrowing/borrowing.routes.ts", /"\/borrows\/:bookId",\s*limiters\.studentTransaction/],
    ["borrowing/borrowing.routes.ts", /"\/scan\/borrow",\s*scannerOrAbove, limiters\.deskTransaction/],
    ["reservation/reservation.routes.ts", /"\/:bookId",\s*limiters\.studentTransaction/],
    ["reservation/adminReservation.routes.ts", /"\/reservations\/:reservationId\/fulfill",\s*adminOnly, limiters\.deskTransaction/],
    ["attendance/attendance.routes.ts", /"\/scan", scannerOrAbove, limiters\.attendance/],
    ["circulation/circulation.routes.ts", /"\/circulation\/renew",\s*limiters\.deskTransaction/],
    ["query/query.routes.ts", /"\/query\/reports\/export", limiters\.reportExport/],
    ["backup/backup.routes.ts", /"\/backup\/restore", superAdminOnly, limiters\.backup/],
    ["notifications/notifications.routes.ts", /"\/admin\/notifications", adminOnly, limiters\.adminNotification/],
  ];

  for (const [routeFile, expected] of cases) {
    assert.match(readRoute(routeFile), expected, `${routeFile} must attach its rate limit before the handler`);
  }

  const auth = readRoute("auth/auth.routes.ts");
  assert.match(auth, /"\/refresh", limiters\.refreshIp, identifyRefreshLimitAccount, limiters\.refreshAccount/);
  assert.equal(typeof limiters.api, "function");
});

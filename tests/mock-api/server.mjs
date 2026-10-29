// A small stand-in for the Pishkhan Api host, for UI work and smoke tests without the .NET stack.
// It follows backend/openapi/api.v1.json for the endpoints the panel uses, with fake Iranian data
// (phones 0912000xxxx). OTP code is always 123456. Not a contract test: the real backend is the source of truth.
//
//   node tests/mock-api/server.mjs            # listens on :5080 (PISHKHAN_API_URL default)
//   MOCK_PORT=5099 node tests/mock-api/server.mjs
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.MOCK_PORT ?? 5080);
const now = () => new Date();
const iso = (d) => d.toISOString();
const ago = (ms) => iso(new Date(Date.now() - ms));
const H = 3_600_000;

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const token = (sub, minutes) => `${b64url({ alg: "none" })}.${b64url({ sub, exp: Math.floor(Date.now() / 1000) + minutes * 60 })}.mock`;

const me = { id: "0199b000-0000-7000-8000-000000000001", displayName: "پارسا", phone: "09120001234", hasPassword: false, totpEnabled: false, createdAt: ago(40 * 24 * H) };
const teammate = { userId: "0199b000-0000-7000-8000-000000000002", displayName: "نگار", phone: "09120005678", role: "agent", joinedAt: ago(20 * 24 * H) };
const ws = { id: "0199b000-0000-7000-8000-0000000000aa", name: "گالری نیلوفر", slug: "niloofar", industry: "clothing", timeZone: "Asia/Tehran", status: "active", role: "owner", createdAt: ago(40 * 24 * H) };
const channel = { id: "0199b000-0000-7000-8000-0000000000c1", kind: "instagram", externalId: "17841400000000001", username: "niloofar.gallery", displayName: "گالری نیلوفر", status: "active", statusReason: null, tokenExpiresAt: iso(new Date(Date.now() + 50 * 24 * H)), createdAt: ago(30 * 24 * H) };

const previews = [
  "سلام قیمت این مانتو چنده؟",
  "سایز L موجود دارید؟",
  "برای شیراز ارسال دارید؟",
  "کارت به کارت کردم، رسید رو فرستادم",
  "رنگ مشکیش هم هست؟",
  "تخفیف برای خرید دوتایی دارید؟",
  "سلام وقت بخیر",
  "کی ارسال میشه؟",
];
const statuses = ["handed_off", "open", "open", "pending", "open", "closed", "open", "open"];

const conversations = Array.from({ length: 24 }, (_, i) => {
  const lastInbound = new Date(Date.now() - (i * 3 + 0.2) * H);
  return {
    id: `0199b000-0000-7000-8000-${String(1000 + i).padStart(12, "0")}`,
    channelAccountId: channel.id,
    channelKind: "instagram",
    contactId: `0199b000-0000-7000-9000-${String(5000 + i * 7).padStart(12, "0")}`,
    status: statuses[i % statuses.length],
    assigneeId: i % 4 === 1 ? me.id : i % 4 === 2 ? teammate.userId : null,
    aiPaused: statuses[i % statuses.length] === "handed_off",
    lastInboundAt: iso(lastInbound),
    lastOutboundAt: i % 3 === 0 ? null : iso(new Date(lastInbound.getTime() + 60_000)),
    windowExpiresAt: iso(new Date(lastInbound.getTime() + 24 * H)),
    humanAgentUntil: iso(new Date(lastInbound.getTime() + 7 * 24 * H)),
    unreadCount: i < 5 ? (i % 3) + 1 : 0,
    lastMessagePreview: previews[i % previews.length],
  };
});

const messages = new Map();
for (const c of conversations) {
  const base = new Date(c.lastInboundAt).getTime();
  const m = (offsetMin, direction, text, extra = {}) => ({
    id: randomUUID(),
    createdAt: iso(new Date(base + offsetMin * 60_000)),
    direction,
    kind: "text",
    text,
    status: direction === "inbound" ? "received" : "read",
    errorCode: null,
    handledBy: null,
    sentBy: null,
    tag: null,
    sentAt: null,
    readAt: null,
    ...extra,
  });
  messages.set(c.id, [
    m(-26 * 60, "inbound", "سلام، این مانتو کتان رو دیدم"),
    m(-26 * 60 + 1, "outbound", "سلام! خوش اومدید 🌸 قیمت مانتو کتان ۸۹۰ هزار تومانه و سایزهای M تا XL موجوده.", { handledBy: "ai" }),
    m(-30, "inbound", "رنگ کرم هم دارید؟", { kind: "text" }),
    m(-29, "outbound", "برای دیدن رنگ‌ها کلمه «رنگ» رو بفرستید.", { handledBy: "rule" }),
    m(-5, "inbound", "", { kind: "story_reply", text: "این استوری رو می‌خوام" }),
    m(-2, "outbound", "بله کرم موجوده، براتون رزرو کنم؟", { handledBy: "human", sentBy: teammate.userId }),
    m(0, "inbound", c.lastMessagePreview),
  ].reverse());
}
const notes = new Map([[conversations[0].id, [{ id: randomUUID(), authorId: teammate.userId, text: "مشتری قبلاً هم خرید داشته، تخفیف ۱۰٪ بدیم.", createdAt: ago(H) }]]]);
let quickReplies = [
  { id: randomUUID(), shortcut: "price", text: "قیمت‌ها در هایلایت «قیمت» هست. برای سفارش سایز و رنگ رو بفرستید 🙏", updatedAt: ago(H) },
  { id: randomUUID(), shortcut: "ارسال", text: "ارسال به سراسر ایران با پست پیشتاز، ۲ تا ۴ روز کاری.", updatedAt: ago(H) },
];
let businessHours = { days: [6, 0, 1, 2, 3].map((day) => ({ day, ranges: [{ from: "10:00:00", to: "21:00:00" }] })).concat([{ day: 4, ranges: [{ from: "10:00:00", to: "14:00:00" }] }]), closedDates: [] };
const members = [{ userId: me.id, displayName: me.displayName, phone: me.phone, role: "owner", joinedAt: me.createdAt }, teammate];

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": status >= 400 ? "application/problem+json" : "application/json", ...headers });
  res.end(body === undefined ? undefined : JSON.stringify(body));
};
const problem = (res, status, code, errors) => send(res, status, { type: "about:blank", title: code, status, code, ...(errors ? { errors } : {}) });
const readBody = (req) => new Promise((resolve) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    try {
      resolve(data ? JSON.parse(data) : {});
    } catch {
      resolve({});
    }
  });
});
const page = (items, cursor, limit) => {
  const start = cursor ? Number(cursor) : 0;
  const slice = items.slice(start, start + limit);
  return { items: slice, nextCursor: start + limit < items.length ? String(start + limit) : null };
};
const authed = (req) => /^Bearer .+/.test(req.headers.authorization ?? "");
const loginResponse = () => ({
  accessToken: token(me.id, 10),
  accessTokenExpiresAt: iso(new Date(Date.now() + 10 * 60_000)),
  refreshToken: `rt-${randomUUID()}`,
  refreshTokenExpiresAt: iso(new Date(Date.now() + 30 * 24 * H)),
  userId: me.id,
  isNewUser: false,
});

const routes = [
  ["GET", /^\/api\/v1\/public\/altcha\/challenge$/, (req, res) => {
    const salt = `${randomUUID().slice(0, 8)}?expires=${Math.floor(Date.now() / 1000) + 300}`;
    const n = Math.floor(Math.random() * 500);
    const challenge = createHash("sha256").update(salt + n).digest("hex");
    send(res, 200, { algorithm: "SHA-256", challenge, maxNumber: 1000, salt, signature: "mock" });
  }],
  ["POST", /^\/api\/v1\/auth\/otp\/request$/, async (req, res) => {
    const body = await readBody(req);
    if (!body.altcha) return problem(res, 400, "validation.altcha.invalid");
    send(res, 202, { expiresInSeconds: 120, resendAfterSeconds: 60 });
  }],
  ["POST", /^\/api\/v1\/auth\/otp\/verify$/, async (req, res) => {
    const body = await readBody(req);
    if (body.code !== "123456") return problem(res, 401, "auth.otp.invalid");
    send(res, 200, loginResponse());
  }],
  ["POST", /^\/api\/v1\/auth\/token\/refresh$/, (req, res) => {
    const { userId, isNewUser, ...tokens } = loginResponse();
    void userId;
    void isNewUser;
    send(res, 200, tokens);
  }],
  ["POST", /^\/api\/v1\/auth\/logout$/, (req, res) => send(res, 204)],
  ["POST", /^\/api\/v1\/auth\/realtime-token$/, (req, res) => send(res, 200, { token: token(me.id, 5), expiresAt: iso(new Date(Date.now() + 5 * 60_000)) })],
  ["GET", /^\/api\/v1\/me$/, (req, res) => send(res, 200, me)],
  ["PATCH", /^\/api\/v1\/me$/, async (req, res) => {
    Object.assign(me, { displayName: (await readBody(req)).displayName });
    send(res, 200, me);
  }],
  ["GET", /^\/api\/v1\/me\/sessions$/, (req, res) => send(res, 200, [
    { id: randomUUID(), createdAt: ago(2 * H), lastUsedAt: ago(60_000), ip: "5.200.0.10", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130 Mobile", current: true },
    { id: randomUUID(), createdAt: ago(5 * 24 * H), lastUsedAt: ago(26 * H), ip: "5.200.0.11", userAgent: "Mozilla/5.0 (Windows NT 10.0) Firefox/132", current: false },
  ])],
  ["GET", /^\/api\/v1\/workspaces$/, (req, res) => send(res, 200, [ws])],
  ["POST", /^\/api\/v1\/workspaces$/, async (req, res) => send(res, 201, { ...ws, ...(await readBody(req)), slug: "new" })],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/?$/, (req, res) => send(res, 200, ws)],
  ["PATCH", /^\/api\/v1\/workspaces\/[^/]+\/?$/, async (req, res) => {
    Object.assign(ws, await readBody(req));
    send(res, 200, ws);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/business-hours$/, (req, res) => send(res, 200, businessHours)],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/business-hours$/, async (req, res) => {
    businessHours = await readBody(req);
    send(res, 200, businessHours);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/members$/, (req, res) => send(res, 200, members)],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/invitations$/, async (req, res) => send(res, 201, { id: randomUUID(), role: (await readBody(req)).role, expiresAt: iso(new Date(Date.now() + 7 * 24 * H)), status: "pending" })],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/channels\/?$/, (req, res) => send(res, 200, [channel])],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/channels\/instagram\/connect$/, (req, res) => problem(res, 422, "channels.instagram.not_configured")],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/channels\/[^/]+\/media$/, (req, res) => send(res, 200, { items: [], nextCursor: null })],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/?$/, (req, res, url) => {
    const q = url.searchParams;
    let items = conversations;
    if (q.get("status")) items = items.filter((c) => c.status === q.get("status"));
    if (q.get("assignee") === "me") items = items.filter((c) => c.assigneeId === me.id);
    if (q.get("assignee") === "none") items = items.filter((c) => !c.assigneeId);
    if (q.get("unread") === "true") items = items.filter((c) => c.unreadCount > 0);
    send(res, 200, page(items, q.get("cursor"), Number(q.get("limit") ?? 30)));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)$/, (req, res, url, [id]) => {
    const c = conversations.find((x) => x.id === id);
    return c ? send(res, 200, c) : problem(res, 404, "common.not_found");
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)\/messages$/, (req, res, url, [id]) => send(res, 200, page(messages.get(id) ?? [], url.searchParams.get("cursor"), Number(url.searchParams.get("limit") ?? 40)))],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)\/messages$/, async (req, res, url, [id]) => {
    const body = await readBody(req);
    const msg = { id: randomUUID(), createdAt: iso(now()), direction: "outbound", kind: "text", text: body.text, status: "queued", errorCode: null, handledBy: "human", sentBy: me.id, tag: null, sentAt: null, readAt: null };
    messages.get(id)?.unshift(msg);
    setTimeout(() => (msg.status = "sent"), 500);
    send(res, 202, msg);
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)\/(assign|status|ai-pause)$/, async (req, res, url, [id, action]) => {
    const c = conversations.find((x) => x.id === id);
    if (!c) return problem(res, 404, "common.not_found");
    const body = await readBody(req);
    if (action === "assign") c.assigneeId = body.assigneeId;
    if (action === "status") Object.assign(c, { status: body.status }, body.status === "handed_off" ? { aiPaused: true } : {});
    if (action === "ai-pause") c.aiPaused = body.paused;
    send(res, 200, c);
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)\/read$/, (req, res, url, [id]) => {
    const c = conversations.find((x) => x.id === id);
    if (c) c.unreadCount = 0;
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)\/notes$/, (req, res, url, [id]) => send(res, 200, notes.get(id) ?? [])],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)\/notes$/, async (req, res, url, [id]) => {
    const note = { id: randomUUID(), authorId: me.id, text: (await readBody(req)).text, createdAt: iso(now()) };
    notes.set(id, [...(notes.get(id) ?? []), note]);
    send(res, 201, note);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/quick-replies\/?$/, (req, res) => send(res, 200, quickReplies)],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/quick-replies\/?$/, async (req, res) => {
    const body = await readBody(req);
    if (quickReplies.some((q) => q.shortcut === body.shortcut)) return problem(res, 409, "quick_reply.shortcut_taken");
    const q = { id: randomUUID(), ...body, updatedAt: iso(now()) };
    quickReplies.push(q);
    send(res, 201, q);
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/quick-replies\/([^/]+)$/, (req, res, url, [id]) => {
    quickReplies = quickReplies.filter((q) => q.id !== id);
    send(res, 204);
  }],
];

const anonymous = [/^\/api\/v1\/public\//, /^\/api\/v1\/auth\/(otp|token)\//];

createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock");
  if (!anonymous.some((r) => r.test(url.pathname)) && !authed(req)) return problem(res, 401, "auth.unauthorized");
  for (const [method, pattern, handler] of routes) {
    const match = req.method === method && url.pathname.match(pattern);
    if (match) return handler(req, res, url, match.slice(1));
  }
  problem(res, 404, "common.not_found");
}).listen(port, () => console.log(`mock Pishkhan API on http://localhost:${port}`));

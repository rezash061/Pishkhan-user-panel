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
const ws = { id: "0199b000-0000-7000-8000-0000000000aa", name: "گالری نیلوفر", slug: "niloofar", industry: "clothing", timeZone: "Asia/Tehran", status: "active", role: "owner", createdAt: ago(40 * 24 * H), deletionScheduledFor: null };
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

const svgThumb = (hue, label) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="hsl(${hue} 70% 85%)"/><text x="160" y="175" font-size="40" text-anchor="middle" fill="hsl(${hue} 60% 30%)">${label}</text></svg>`)}`;
const contacts = [["نیلوفر احمدی", "niloo.ahmadi"], [null, "sara_style"], ["مریم کاظمی", "maryam.k"], [null, null], ["زهرا رضایی", null], ["Ali Moradi", "ali.moradi"]];

const conversations = Array.from({ length: 24 }, (_, i) => {
  const lastInbound = new Date(Date.now() - (i * 3 + 0.2) * H);
  return {
    id: `0199b000-0000-7000-8000-${String(1000 + i).padStart(12, "0")}`,
    channelAccountId: channel.id,
    channelKind: "instagram",
    contactId: `0199b000-0000-7000-9000-${String(5000 + i * 7).padStart(12, "0")}`,
    contact: { id: `0199b000-0000-7000-9000-${String(5000 + i * 7).padStart(12, "0")}`, displayName: contacts[i % contacts.length][0], username: contacts[i % contacts.length][1] },
    status: statuses[i % statuses.length],
    assigneeId: i % 4 === 1 ? me.id : i % 4 === 2 ? teammate.userId : null,
    aiPaused: statuses[i % statuses.length] === "handed_off",
    lastInboundAt: iso(lastInbound),
    lastOutboundAt: i % 3 === 0 ? null : iso(new Date(lastInbound.getTime() + 60_000)),
    windowExpiresAt: iso(new Date(lastInbound.getTime() + 24 * H)),
    humanAgentUntil: iso(new Date(lastInbound.getTime() + 7 * 24 * H)),
    unreadCount: i < 5 ? (i % 3) + 1 : 0,
    lastMessagePreview: previews[i % previews.length],
    handoff: statuses[i % statuses.length] === "handed_off" ? { reason: "مشتری درخواست تخفیف عمده دارد", suggestedReply: "سلام! برای خرید عمده ۱۰٪ تخفیف داریم، چند عدد لازم دارید؟", at: iso(lastInbound) } : null,
  };
});

const invitations = [{ id: randomUUID(), role: "agent", phone: "+98912***4567", invitedBy: me.id, createdAt: ago(5 * H), expiresAt: iso(new Date(Date.now() + 6 * 24 * H)) }];

const notifications = [
  { id: randomUUID(), kind: "handoff", title: "نیلوفر احمدی منتظر پاسخ شماست", body: "مشتری درخواست تخفیف عمده دارد", link: `/inbox/${conversations[0].id}`, createdAt: ago(20 * 60_000), readAt: null },
  { id: randomUUID(), kind: "automation", title: "قانون «قیمت زیر پست» به تیم خبر داد", body: "سفارش عمده", link: null, createdAt: ago(2 * H), readAt: null },
  { id: randomUUID(), kind: "channel", title: "اتصال @niloofar.gallery به‌زودی منقضی می‌شود", body: null, link: "/settings/channels", createdAt: ago(26 * H), readAt: ago(20 * H) },
];
const preferences = [
  { kind: "handoff", label: "Handoff", inApp: true, push: true, sms: false, smsAvailable: true },
  { kind: "automation", label: "Automation", inApp: true, push: false, sms: false, smsAvailable: false },
  { kind: "channel", label: "Channel", inApp: true, push: true, sms: true, smsAvailable: true },
];

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
    attachments: [],
    ...extra,
  });
  messages.set(c.id, [
    m(-26 * 60, "inbound", "سلام، این مانتو کتان رو دیدم"),
    m(-26 * 60 + 1, "outbound", "سلام! خوش اومدید 🌸 قیمت مانتو کتان ۸۹۰ هزار تومانه و سایزهای M تا XL موجوده.", { handledBy: "ai" }),
    m(-30, "inbound", "رنگ کرم هم دارید؟", { kind: "text" }),
    m(-29, "outbound", "برای دیدن رنگ‌ها کلمه «رنگ» رو بفرستید.", { handledBy: "rule" }),
    m(-40, "inbound", null, { kind: "attachment", attachments: [{ type: "image", url: svgThumb(330, "عکس مشتری") }] }),
    m(-5, "inbound", "این استوری رو می‌خوام", { kind: "story_reply", attachments: [{ type: "story_reply", url: svgThumb(20, "استوری") }] }),
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

// Automation (BE-1.3) and catalog (BE-1.6).
const media = Array.from({ length: 8 }, (_, i) => ({
  id: `1790000000000${i}`,
  caption: ["مانتو کتان تابستانه 🌸 قیمت در کامنت", "شومیز حریر، ۴ رنگ", "ریلز پشت صحنه", "تخفیف یلدا", "شلوار بگ جین", "کیف چرم دست‌دوز", "معرفی کالکشن پاییز", "ارسال رایگان این هفته"][i],
  mediaType: i === 2 ? "VIDEO" : "IMAGE",
  mediaUrl: svgThumb(i * 40, `پست ${i + 1}`),
  thumbnailUrl: svgThumb(i * 40, `پست ${i + 1}`),
  permalink: `https://www.instagram.com/p/mock${i}/`,
  timestamp: ago((i + 1) * 30 * H),
}));
let rules = [
  {
    id: randomUUID(), name: "قیمت زیر پست", channelAccountId: channel.id, triggerKind: "comment_keyword",
    trigger: { match: "contains", keywords: ["قیمت", "price"], scope: "post", postId: media[0].id }, postId: media[0].id,
    actions: [{ kind: "private_reply", message: { text: "سلام {{contact.first_name|عزیز}} 🌸 قیمت مانتو کتان ۸۹۰ هزار تومانه." } }, { kind: "public_reply", replies: ["دایرکت رو چک کنید 💌", "جوابتون رو دایرکت دادم 🌸"] }],
    priority: 0, enabled: true, revision: 1, createdAt: ago(5 * 24 * H), updatedAt: ago(5 * 24 * H),
  },
  {
    id: randomUUID(), name: "خوش‌آمد", channelAccountId: null, triggerKind: "new_conversation", trigger: {}, postId: null,
    actions: [{ kind: "send_message", message: { text: "سلام! به گالری نیلوفر خوش اومدید 🌸", quickReplies: [{ title: "قیمت‌ها", payload: "قیمت‌ها" }, { title: "ارسال", payload: "ارسال" }] } }],
    priority: 0, enabled: true, revision: 1, createdAt: ago(9 * 24 * H), updatedAt: ago(9 * 24 * H),
  },
];
const backlogRuns = new Map();
let flows = [];
let automationSettings = { aiEnabled: true, fallbackText: null, fallbackCooldownMinutes: 720 };
let categories = [
  { id: randomUUID(), name: "مانتو", parentId: null, sortOrder: 0 },
  { id: randomUUID(), name: "شلوار", parentId: null, sortOrder: 1 },
];
const money = (toman) => (toman === null ? null : { amount: toman * 10, currency: "IRR" });
const files = new Map();
const productView = (p) => {
  const variants = p.variants.map((v) => {
    const effective = v.price ?? p.price;
    return { ...v, effectivePrice: effective, inStock: v.stockPolicy === "unlimited" || (v.stock ?? 0) > 0 };
  });
  const prices = variants.map((v) => v.effectivePrice?.amount).filter((x) => x !== undefined && x !== null);
  const minA = prices.length ? Math.min(...prices) : (p.price?.amount ?? null);
  const maxA = prices.length ? Math.max(...prices) : (p.price?.amount ?? null);
  return {
    ...p,
    pricingMode: "fixed",
    minPrice: minA === null ? null : { amount: minA, currency: "IRR" },
    maxPrice: maxA === null ? null : { amount: maxA, currency: "IRR" },
    inStock: variants.length === 0 || variants.some((v) => v.inStock),
    images: p.imageFileIds.map((id) => ({ fileId: id, status: "clean", url: files.get(id)?.url ?? svgThumb(200, "عکس") })),
    variants,
  };
};
const v = (attributes, toman, stock) => ({ id: randomUUID(), sku: null, attributes, price: money(toman), stock, stockPolicy: "track" });
let products = [
  { id: randomUUID(), title: "مانتو کتان تابستانه", description: "کتان ۱۰۰٪، مناسب تابستان.", categoryId: categories[0].id, tags: ["تابستانه", "پرفروش"], status: "active", price: money(890_000), imageFileIds: [], linkUrl: null, variants: [v({ سایز: "M" }, null, 4), v({ سایز: "L" }, null, 0), v({ سایز: "XL" }, 950_000, 2)], revision: 1, createdAt: ago(20 * 24 * H), updatedAt: ago(2 * H) },
  { id: randomUUID(), title: "شلوار بگ جین", description: null, categoryId: categories[1].id, tags: [], status: "active", price: money(1_250_000), imageFileIds: [], linkUrl: null, variants: [], revision: 1, createdAt: ago(18 * 24 * H), updatedAt: ago(5 * H) },
  { id: randomUUID(), title: "شومیز حریر", description: null, categoryId: null, tags: ["حراج"], status: "draft", price: null, imageFileIds: [], linkUrl: null, variants: [], revision: 1, createdAt: ago(3 * 24 * H), updatedAt: ago(3 * 24 * H) },
];
let cardSets = [];
const imports = new Map();

/** A small stand-in for backend `FlowValidator`: enough for the editor to show errors and warnings. */
const validateFlow = (graph) => {
  const errors = [];
  const warnings = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (!ids.has(graph.start)) errors.push({ code: "flow.start_missing", nodeId: null });
  for (const n of graph.nodes) {
    if ((n.type === "message" || n.type === "question") && !n.message?.text?.trim()) errors.push({ code: n.type === "message" ? "flow.message_required" : "flow.prompt_required", nodeId: n.id });
    if (n.type === "question" && !/^[a-z][a-z0-9_]{0,39}$/.test(n.variable ?? "")) errors.push({ code: "flow.variable_invalid", nodeId: n.id });
  }
  const seen = new Set([graph.start]);
  const queue = [graph.start];
  while (queue.length) {
    const id = queue.shift();
    for (const e of graph.edges.filter((x) => x.from === id)) if (!seen.has(e.to)) (seen.add(e.to), queue.push(e.to));
  }
  for (const n of graph.nodes) if (!seen.has(n.id)) warnings.push({ code: "flow.node_unreachable", nodeId: n.id });
  return { errors, warnings, isValid: errors.length === 0 };
};
const flowView = (f) => ({ ...f, validation: validateFlow(f.graph) });

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
const usedSupportTokens = new Set();
const auditEntry = (minutesAgo, actorType, actorName, action, entityType, extra = {}) => ({
  id: randomUUID(), occurredAt: ago(minutesAgo * 60_000), actorType, actorId: actorType === "user" ? me.id : null, actorName, onBehalfOf: null,
  workspaceId: ws.id, action, entityType, entityId: null, reason: null, ip: null, before: null, after: null, ...extra,
});
const auditEntries = [
  auditEntry(5, "staff", "support", "workspace.update", "workspace", { before: { name: "گالری نیلو" }, after: { name: "گالری نیلوفر" } }),
  auditEntry(6, "staff", "support", "support_session.start", "support_session", { reason: "تیکت ۴۲۱: اتصال اینستاگرام" }),
  auditEntry(7, "staff", "support", "support_session.grant", "support_session", { reason: "تیکت ۴۲۱: اتصال اینستاگرام" }),
  auditEntry(60, "user", "پارسا", "member.role_change", "member", { before: { role: "viewer" }, after: { role: "agent" } }),
  auditEntry(120, "user", "پارسا", "member.invite", "invitation"),
  auditEntry(40 * 24 * 60, "user", "پارسا", "workspace.create", "workspace"),
];
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
  // Support sessions (backend #18): tokens starting "sup-" work once; anything else is invalid.
  ["POST", /^\/api\/v1\/auth\/support-session$/, async (req, res) => {
    const body = await readBody(req);
    if (typeof body.token !== "string" || !body.token.startsWith("sup-") || usedSupportTokens.has(body.token)) return problem(res, 401, "auth.support_session.invalid");
    usedSupportTokens.add(body.token);
    send(res, 200, {
      accessToken: token(me.id, 30),
      accessTokenExpiresAt: iso(new Date(Date.now() + 30 * 60_000)),
      workspaceId: ws.id,
      userId: me.id,
      staffUsername: "support.ali",
      reason: "تیکت ۴۲۱",
    });
  }],
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
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/?$/, (req, res) => (ws.status === "pending_deletion" ? problem(res, 404, "common.not_found") : send(res, 200, ws))],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/deletion$/, async (req, res) => {
    const { confirmName } = await readBody(req);
    if (confirmName !== ws.name) return problem(res, 400, "tenancy.deletion.confirm_mismatch", { confirmName: ["tenancy.deletion.confirm_mismatch"] });
    Object.assign(ws, { status: "pending_deletion", deletionScheduledFor: iso(new Date(Date.now() + 30 * 24 * H)) });
    send(res, 202, ws);
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/deletion$/, (req, res) => {
    if (ws.status !== "pending_deletion") return problem(res, 409, "tenancy.deletion.not_pending");
    Object.assign(ws, { status: "active", deletionScheduledFor: null });
    send(res, 200, ws);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/dashboard$/, (req, res, url) => {
    const range = url.searchParams.get("range") ?? "today";
    const n = range === "30d" ? 30 : range === "7d" ? 7 : 1;
    const days = Array.from({ length: n }, (_, i) => {
      const day = new Date(Date.now() - (n - 1 - i) * 24 * H).toISOString().slice(0, 10);
      const k = (i * 7) % 11;
      return { day, messagesReceived: 40 + k * 6, newConversations: 8 + k, repliesByRule: 14 + k * 2, repliesByAi: 9 + (k % 5) * 3, repliesByHuman: 6 + (k % 4), handoffs: 1 + (k % 3) };
    });
    const sum = (key) => days.reduce((a, d) => a + d[key], 0);
    const auto = sum("repliesByRule") + sum("repliesByAi");
    send(res, 200, {
      range, from: iso(new Date(Date.now() - n * 24 * H)), to: iso(now()),
      totals: { messagesReceived: sum("messagesReceived"), newConversations: sum("newConversations"), repliesByRule: sum("repliesByRule"), repliesByAi: sum("repliesByAi"), repliesByHuman: sum("repliesByHuman"), handoffs: sum("handoffs"), automatedShare: auto / (auto + sum("repliesByHuman")) },
      days,
      overnight: { from: ago(14 * H), to: ago(5 * H), ongoing: false, messagesReceived: 23, automatedReplies: 19, handoffs: 2, text: "دیشب ۲۳ پیام رسید؛ ۱۹ تا را پاسخ خودکار جواب داد و ۲ گفتگو منتظر شماست." },
      inbox: { open: conversations.filter((c) => c.status === "open").length, handedOff: conversations.filter((c) => c.status === "handed_off").length, unread: conversations.filter((c) => c.unreadCount > 0).length, oldestHandoffAt: ago(3 * H) },
      channels: [{ id: channel.id, kind: "instagram", username: channel.username, status: channel.status, healthy: channel.status === "active" }],
    });
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/notifications$/, (req, res, url) => {
    const items = url.searchParams.get("unread") === "true" ? notifications.filter((x) => !x.readAt) : notifications;
    send(res, 200, { ...page(items, url.searchParams.get("cursor"), Number(url.searchParams.get("limit") ?? 20)), unreadCount: notifications.filter((x) => !x.readAt).length });
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/notifications\/read-all$/, (req, res) => {
    for (const x of notifications) x.readAt ??= iso(now());
    send(res, 204);
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/notifications\/([^/]+)\/read$/, (req, res, url, [id]) => {
    const x = notifications.find((n) => n.id === id);
    if (!x) return problem(res, 404, "common.not_found");
    x.readAt ??= iso(now());
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/billing\/subscription$/, (req, res) => send(res, 200, {
    source: "subscription", planId: randomUUID(), planCode: "growth", planName: "رشد", planVersion: 2, trial: true, endsAt: iso(new Date(Date.now() + 12 * 24 * H)),
    limits: { seats: 3, channel_accounts: 1, ai_conversations: 500, sms: null },
    subscription: null,
  })],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/billing\/usage$/, (req, res) => send(res, 200, {
    periodStart: "2026-10-22T20:30:00Z", periodEnd: "2026-11-21T20:30:00Z",
    meters: [
      { meter: "seats", used: 2, limit: 3 },
      { meter: "channel_accounts", used: 1, limit: 1 },
      { meter: "ai_conversations", used: 412, limit: 500 },
      { meter: "sms", used: 37, limit: null },
    ],
  })],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/audit$/, (req, res, url) => {
    const action = url.searchParams.get("Action") ?? "";
    const pageNo = Math.max(1, Number(url.searchParams.get("Page") ?? 1));
    const size = Number(url.searchParams.get("PageSize") ?? 20);
    const items = auditEntries.filter((e) => e.action.includes(action));
    send(res, 200, { items: items.slice((pageNo - 1) * size, pageNo * size), totalCount: items.length, page: pageNo, pageSize: size });
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/notification-preferences$/, (req, res) => send(res, 200, preferences)],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/notification-preferences$/, async (req, res) => {
    const { items } = await readBody(req);
    for (const item of items) {
      const p = preferences.find((x) => x.kind === item.kind);
      if (!p) return problem(res, 400, "validation.failed", { kind: ["notifications.kind_unknown"] });
      if (item.sms && !p.smsAvailable) return problem(res, 400, "validation.failed", { sms: ["notifications.sms_unavailable"] });
      Object.assign(p, { inApp: item.inApp, push: item.push, sms: item.sms });
    }
    send(res, 200, preferences);
  }],
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
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/invitations$/, async (req, res) => {
    const body = await readBody(req);
    // e2e hook: this number stands for "the plan's seats are full".
    if (String(body.phone).replace(/\D/g, "").endsWith("9120009999")) return send(res, 402, { type: "about:blank", title: "billing.plan_limit", status: 402, detail: "seats", code: "billing.plan_limit" });
    const invitation = { id: randomUUID(), role: body.role, phone: `+98${String(body.phone).replace(/\D/g, "").slice(-10, -7)}***${String(body.phone).slice(-4)}`, invitedBy: me.id, createdAt: iso(now()), expiresAt: iso(new Date(Date.now() + 7 * 24 * H)) };
    invitations.push(invitation);
    send(res, 201, { id: invitation.id, role: invitation.role, expiresAt: invitation.expiresAt, status: "pending" });
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/invitations$/, (req, res) => send(res, 200, invitations)],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/invitations\/([^/]+)$/, (req, res, url, [id]) => {
    const index = invitations.findIndex((i) => i.id === id);
    if (index < 0) return problem(res, 404, "common.not_found");
    invitations.splice(index, 1);
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/channels\/?$/, (req, res) => send(res, 200, [channel])],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/channels\/instagram\/connect$/, (req, res) => problem(res, 422, "channels.instagram.not_configured")],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/channels\/[^/]+\/media$/, (req, res, url) => send(res, 200, page(media, url.searchParams.get("cursor"), Number(url.searchParams.get("limit") ?? 12)))],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/?$/, (req, res, url) => {
    const q = url.searchParams;
    let items = conversations;
    if (q.get("status")) items = items.filter((c) => c.status === q.get("status"));
    if (q.get("assignee") === "me") items = items.filter((c) => c.assigneeId === me.id);
    if (q.get("assignee") === "none") items = items.filter((c) => !c.assigneeId);
    if (q.get("unread") === "true") items = items.filter((c) => c.unreadCount > 0);
    const term = q.get("q")?.trim().toLowerCase();
    if (term) items = items.filter((c) => [c.contact.displayName, c.contact.username].some((v) => v?.toLowerCase().includes(term)));
    send(res, 200, page(items, q.get("cursor"), Number(q.get("limit") ?? 30)));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)$/, (req, res, url, [id]) => {
    const c = conversations.find((x) => x.id === id);
    return c ? send(res, 200, c) : problem(res, 404, "common.not_found");
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)\/messages$/, (req, res, url, [id]) => send(res, 200, page(messages.get(id) ?? [], url.searchParams.get("cursor"), Number(url.searchParams.get("limit") ?? 40)))],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)\/messages$/, async (req, res, url, [id]) => {
    const body = await readBody(req);
    const msg = { id: randomUUID(), createdAt: iso(now()), direction: "outbound", kind: "text", text: body.text, status: "queued", errorCode: null, handledBy: "human", sentBy: me.id, tag: null, sentAt: null, readAt: null, attachments: [] };
    messages.get(id)?.unshift(msg);
    setTimeout(() => (msg.status = "sent"), 500);
    send(res, 202, msg);
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/conversations\/([^/]+)\/(assign|status|ai-pause)$/, async (req, res, url, [id, action]) => {
    const c = conversations.find((x) => x.id === id);
    if (!c) return problem(res, 404, "common.not_found");
    const body = await readBody(req);
    if (action === "assign") c.assigneeId = body.assigneeId;
    if (action === "status") Object.assign(c, { status: body.status, handoff: body.status === "handed_off" ? { reason: body.reason || "manual", suggestedReply: null, at: iso(now()) } : null }, body.status === "handed_off" ? { aiPaused: true } : {});
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
  // Automation
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/automation\/rules$/, (req, res) => send(res, 200, rules)],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/automation\/rules$/, async (req, res) => {
    const body = await readBody(req);
    if (["dm_keyword", "comment_keyword"].includes(body.triggerKind) && !body.trigger?.keywords?.length && !body.trigger?.pattern)
      return problem(res, 400, "validation.failed", { "trigger.keywords": ["automation.keywords_required"] });
    const rule = { ...body, id: randomUUID(), postId: body.trigger?.postId ?? null, revision: 1, createdAt: iso(now()), updatedAt: iso(now()) };
    rules.push(rule);
    send(res, 201, rule);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/automation\/rules\/([^/]+)$/, (req, res, url, [id]) => {
    const rule = rules.find((r) => r.id === id);
    return rule ? send(res, 200, rule) : problem(res, 404, "common.not_found");
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/automation\/rules\/([^/]+)$/, async (req, res, url, [id]) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return problem(res, 404, "common.not_found");
    Object.assign(rule, await readBody(req), { revision: rule.revision + 1, updatedAt: iso(now()) });
    rule.postId = rule.trigger?.postId ?? rule.postId;
    send(res, 200, rule);
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/automation\/rules\/([^/]+)$/, (req, res, url, [id]) => {
    rules = rules.filter((r) => r.id !== id);
    send(res, 204);
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/automation\/rules\/([^/]+)\/backlog-run$/, (req, res, url, [id]) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule?.postId) return problem(res, 422, "automation.backlog_needs_post");
    const run = { id: randomUUID(), status: "running", mediaId: rule.postId, pages: 0, commentsSeen: 0, commentsQueued: 0, error: null, createdAt: iso(now()), completedAt: null };
    backlogRuns.set(id, run);
    const tick = setInterval(() => {
      run.pages += 1;
      run.commentsSeen += 25;
      run.commentsQueued += 9;
      if (run.pages >= 3) (run.status = "completed"), (run.completedAt = iso(now())), clearInterval(tick);
    }, 1200);
    send(res, 202, run);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/automation\/rules\/([^/]+)\/stats$/, (req, res, url, [id]) => {
    const days = Number(url.searchParams.get("days") ?? 30);
    const perDay = Array.from({ length: days }, (_, i) => {
      const fired = (i * 7 + id.charCodeAt(0)) % 13;
      return { day: iso(new Date(Date.now() - (days - 1 - i) * 24 * H)).slice(0, 10), fired, privateReplies: fired, publicReplies: Math.floor(fired / 2), flowsStarted: 0 };
    });
    const sum = (k) => perDay.reduce((n, d) => n + d[k], 0);
    send(res, 200, { ruleId: id, days, fired: sum("fired"), privateReplies: sum("privateReplies"), publicReplies: sum("publicReplies"), flowsStarted: 0, commentsQueued: 3, perDay, latestBacklogRun: backlogRuns.get(id) ?? null });
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/automation\/flows$/, (req, res) => send(res, 200, flows.map(flowView))],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/automation\/flows$/, async (req, res) => {
    const body = await readBody(req);
    const flow = { id: randomUUID(), name: body.name, status: "draft", graph: body.graph, publishedVersion: null, publishedAt: null, updatedAt: iso(now()) };
    flows.unshift(flow);
    send(res, 201, flowView(flow));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/automation\/flows\/([^/]+)$/, (req, res, url, [id]) => {
    const flow = flows.find((f) => f.id === id);
    return flow ? send(res, 200, flowView(flow)) : problem(res, 404, "common.not_found");
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/automation\/flows\/([^/]+)$/, async (req, res, url, [id]) => {
    const flow = flows.find((f) => f.id === id);
    if (!flow) return problem(res, 404, "common.not_found");
    const body = await readBody(req);
    Object.assign(flow, { name: body.name, graph: body.graph, updatedAt: iso(now()) });
    send(res, 200, flowView(flow));
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/automation\/flows\/([^/]+)$/, (req, res, url, [id]) => {
    flows = flows.filter((f) => f.id !== id);
    send(res, 204);
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/automation\/flows\/([^/]+)\/publish$/, (req, res, url, [id]) => {
    const flow = flows.find((f) => f.id === id);
    if (!flow) return problem(res, 404, "common.not_found");
    const validation = validateFlow(flow.graph);
    if (!validation.isValid) return send(res, 422, validation);
    Object.assign(flow, { status: "published", publishedVersion: (flow.publishedVersion ?? 0) + 1, publishedAt: iso(new Date(Date.now() + 1000)), updatedAt: iso(now()) });
    send(res, 200, flowView(flow));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/automation\/settings$/, (req, res) => send(res, 200, automationSettings)],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/automation\/settings$/, async (req, res) => {
    const body = await readBody(req);
    automationSettings = { aiEnabled: body.aiEnabled, fallbackText: body.fallbackText, fallbackCooldownMinutes: body.fallbackCooldownMinutes };
    send(res, 200, automationSettings);
  }],
  // Dry runs: a small stand-in for the backend's sandbox (keyword "contains" matching, variables filled in).
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/automation\/test$/, async (req, res) => {
    const body = await readBody(req);
    const vars = { "contact.first_name": body.contact?.name?.split(" ")[0] ?? null, "comment.text": body.text };
    const fill = (text) => text?.replace(/\{\{\s*([a-z_.]+)\s*(?:\|([^}]*))?\}\}/g, (_, name, fallback) => vars[name] ?? fallback ?? "");
    const comment = body.source === "comment";
    const candidates = body.ruleId ? rules.filter((r) => r.id === body.ruleId) : rules.filter((r) => r.enabled).sort((a, b) => b.priority - a.priority);
    const matches = candidates.filter((r) => {
      if (comment !== ["comment_keyword", "comment_any", "live_comment"].includes(r.triggerKind)) return false;
      if (r.triggerKind === "new_conversation") return body.isNewConversation;
      if (r.postId && r.postId !== body.mediaId) return false;
      const keywords = r.trigger.keywords ?? [];
      return !keywords.length || keywords.some((k) => (body.text ?? "").toLowerCase().includes(k.toLowerCase()));
    });
    const [rule, ...others] = matches;
    const steps = (rule?.actions ?? []).map((a) => {
      if (a.message) return { type: a.kind, message: { ...a.message, text: fill(a.message.text) } };
      if (a.kind === "public_reply") return { type: a.kind, replies: a.replies };
      return { type: a.kind, tag: a.tag ?? null, reason: a.reason ?? null };
    });
    send(res, 200, { outcome: rule ? "rule" : automationSettings.aiEnabled && !comment ? "ai" : "none", ruleId: rule?.id ?? null, ruleName: rule?.name ?? null, businessOpen: true, otherMatches: others.map((r) => r.id), steps, flow: null });
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/automation\/flows\/([^/]+)\/test$/, async (req, res, url, [id]) => {
    const flow = flows.find((f) => f.id === id);
    if (!flow) return problem(res, 404, "common.not_found");
    const validation = validateFlow(flow.graph);
    if (!validation.isValid) return send(res, 422, validation);
    const body = await readBody(req);
    const answers = [...(body.answers ?? [])];
    const variables = {};
    const fill = (text) => text?.replace(/\{\{\s*flow\.([a-z0-9_]+)\s*(?:\|([^}]*))?\}\}/g, (_, name, fallback) => variables[name] ?? fallback ?? "");
    const next = (node, handle = "next") => flow.graph.edges.find((e) => e.from === node && (e.handle ?? "next") === handle)?.to ?? null;
    const turns = [{ input: null, steps: [] }];
    let current = flow.graph.start;
    let status = "completed";
    for (let guard = 0; current && guard < 200; guard++) {
      const node = flow.graph.nodes.find((n) => n.id === current);
      const steps = turns.at(-1).steps;
      if (!node || node.type === "end") break;
      if (node.type === "message") steps.push({ type: "send_message", message: { ...node.message, text: fill(node.message.text) } });
      if (node.type === "question") {
        steps.push({ type: "send_message", message: { ...node.message, text: fill(node.message.text) } });
        const answer = answers.shift();
        if (!answer) {
          status = "waiting_input";
          break;
        }
        variables[node.variable] = answer.text ?? answer.payload;
        turns.push({ input: answer, steps: [] });
      }
      if (node.type === "action") for (const a of node.actions) turns.at(-1).steps.push({ type: a.kind, tag: a.tag ?? null });
      current = next(node.id);
    }
    send(res, 200, { flowId: flow.id, version: body.published ? flow.publishedVersion : null, status, currentNode: status === "completed" ? null : current, variables, turns });
  }],

  // Files (scan finishes on the first read)
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/files$/, (req, res, url) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const purpose = url.searchParams.get("purpose");
      const body = Buffer.concat(chunks);
      const type = /image\/(png|jpeg|webp|gif)/.exec(body.toString("latin1", 0, 600))?.[0] ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const file = { id: randomUUID(), purpose, status: "pending_scan", contentType: type, size: body.length, originalName: null, url: null, thumbnailUrl: null, width: null, height: null, createdAt: iso(now()) };
      files.set(file.id, file);
      send(res, 202, file);
    });
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/files\/([^/]+)$/, (req, res, url, [id]) => {
    const file = files.get(id);
    if (!file) return problem(res, 404, "common.not_found");
    if (file.status === "pending_scan") Object.assign(file, { status: "clean", url: file.purpose === "product_image" ? svgThumb(280, "عکس") : null });
    send(res, 200, file);
  }],

  // Catalog
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/categories$/, (req, res) => send(res, 200, categories)],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/categories$/, async (req, res) => {
    const body = await readBody(req);
    if (categories.some((c) => c.name === body.name.trim() && c.parentId === body.parentId)) return problem(res, 409, "catalog.category_exists");
    const c = { id: randomUUID(), name: body.name.trim(), parentId: body.parentId ?? null, sortOrder: body.sortOrder ?? 0 };
    categories.push(c);
    send(res, 201, c);
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/categories\/([^/]+)$/, async (req, res, url, [id]) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return problem(res, 404, "common.not_found");
    Object.assign(c, await readBody(req));
    send(res, 200, c);
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/categories\/([^/]+)$/, (req, res, url, [id]) => {
    categories = categories.filter((c) => c.id !== id);
    for (const p of products) if (p.categoryId === id) p.categoryId = null;
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/products$/, (req, res, url) => {
    const q = url.searchParams;
    let items = [...products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (q.get("q")) items = items.filter((p) => `${p.title} ${p.description ?? ""} ${p.tags.join(" ")}`.includes(q.get("q")));
    if (q.get("categoryId")) items = items.filter((p) => p.categoryId === q.get("categoryId"));
    if (q.get("status")) items = items.filter((p) => p.status === q.get("status"));
    if (q.get("tag")) items = items.filter((p) => p.tags.includes(q.get("tag")));
    const result = page(items, q.get("cursor"), Number(q.get("limit") ?? 30));
    send(res, 200, { ...result, items: result.items.map(productView) });
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/products$/, async (req, res) => {
    const body = await readBody(req);
    if (!body.title?.trim()) return problem(res, 400, "validation.failed", { title: ["validation.required"] });
    if (body.status === "active" && !body.price && !(body.variants?.length && body.variants.every((x) => x.price))) return problem(res, 400, "validation.failed", { price: ["catalog.price_required"] });
    const p = { ...body, id: randomUUID(), tags: body.tags ?? [], imageFileIds: body.imageFileIds ?? [], variants: (body.variants ?? []).map((x) => ({ ...x, id: x.id ?? randomUUID(), attributes: x.attributes ?? {} })), revision: 1, createdAt: iso(now()), updatedAt: iso(now()) };
    products.push(p);
    send(res, 201, productView(p));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/products\/([^/]+)$/, (req, res, url, [id]) => {
    const p = products.find((x) => x.id === id);
    return p ? send(res, 200, productView(p)) : problem(res, 404, "common.not_found");
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/products\/([^/]+)$/, async (req, res, url, [id]) => {
    const p = products.find((x) => x.id === id);
    if (!p) return problem(res, 404, "common.not_found");
    const body = await readBody(req);
    Object.assign(p, body, { variants: (body.variants ?? []).map((x) => ({ ...x, id: x.id ?? randomUUID(), attributes: x.attributes ?? {} })), revision: p.revision + 1, updatedAt: iso(now()) });
    send(res, 200, productView(p));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/products\/([^/]+)\/images$/, async (req, res, url, [id]) => {
    const p = products.find((x) => x.id === id);
    if (!p) return problem(res, 404, "common.not_found");
    const { fileId } = await readBody(req);
    if (!p.imageFileIds.includes(fileId)) {
      if (p.imageFileIds.length >= 10) return problem(res, 400, "validation.failed", { fileId: ["catalog.too_many_images"] });
      p.imageFileIds.push(fileId);
    }
    send(res, 200, productView(p));
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/products\/([^/]+)\/images\/order$/, async (req, res, url, [id]) => {
    const p = products.find((x) => x.id === id);
    if (!p) return problem(res, 404, "common.not_found");
    const { fileIds } = await readBody(req);
    if (fileIds.length !== p.imageFileIds.length || !fileIds.every((f) => p.imageFileIds.includes(f))) return problem(res, 400, "validation.failed", { fileIds: ["catalog.image_order_invalid"] });
    p.imageFileIds = fileIds;
    send(res, 200, productView(p));
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/products\/([^/]+)\/images\/([^/]+)$/, (req, res, url, [id, fileId]) => {
    const p = products.find((x) => x.id === id);
    if (!p || !p.imageFileIds.includes(fileId)) return problem(res, 404, "common.not_found");
    p.imageFileIds = p.imageFileIds.filter((f) => f !== fileId);
    send(res, 200, productView(p));
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/products\/([^/]+)$/, (req, res, url, [id]) => {
    products = products.filter((p) => p.id !== id);
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/(export|import-template)$/, (req, res, url, [kind]) => {
    res.writeHead(200, { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename=${kind === "export" ? "catalog-20261029.xlsx" : "catalog-template.xlsx"}` });
    res.end(Buffer.from("PK mock sheet"));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/import$/, async (req, res) => {
    const body = await readBody(req);
    const job = { id: randomUUID(), fileId: body.fileId, status: "running", rows: 0, created: 0, updated: 0, skipped: 0, errors: [], error: null, createdAt: iso(now()), completedAt: null };
    imports.set(job.id, job);
    setTimeout(() => Object.assign(job, { status: "completed", rows: 12, created: 9, updated: 2, skipped: 1, errors: [{ row: 7, column: "قیمت", code: "catalog.price_invalid" }], completedAt: iso(now()) }), 1500);
    send(res, 202, job);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/imports\/([^/]+)$/, (req, res, url, [id]) => {
    const job = imports.get(id);
    return job ? send(res, 200, job) : problem(res, 404, "common.not_found");
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/storefront-cards$/, (req, res) => send(res, 200, cardSets)],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/storefront-cards$/, async (req, res) => {
    const body = await readBody(req);
    const set = { id: randomUUID(), name: body.name, items: body.items, updatedAt: iso(now()) };
    cardSets.unshift(set);
    send(res, 201, set);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/storefront-cards\/([^/]+)\/preview$/, (req, res, url, [id]) => {
    const set = cardSets.find((x) => x.id === id);
    if (!set) return problem(res, 404, "common.not_found");
    const cards = set.items
      .map((i) => products.find((p) => p.id === i.productId))
      .filter((p) => p && p.status === "active")
      .map((p) => {
        const view = productView(p);
        return { productId: p.id, title: p.title.slice(0, 80), subtitle: `${new Intl.NumberFormat("fa-IR").format((view.minPrice?.amount ?? 0) / 10)} تومان`, imageUrl: view.images[0]?.url ?? null, linkUrl: p.linkUrl, buttonTitle: set.items.find((i) => i.productId === p.id)?.buttonTitle || "سفارش", payload: `product:${p.id}` };
      });
    send(res, 200, { id: set.id, name: set.name, cards });
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/storefront-cards\/([^/]+)$/, async (req, res, url, [id]) => {
    const set = cardSets.find((x) => x.id === id);
    if (!set) return problem(res, 404, "common.not_found");
    Object.assign(set, await readBody(req), { updatedAt: iso(now()) });
    send(res, 200, set);
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/storefront-cards\/([^/]+)$/, (req, res, url, [id]) => {
    cardSets = cardSets.filter((x) => x.id !== id);
    send(res, 204);
  }],
];

const anonymous = [/^\/api\/v1\/public\//, /^\/api\/v1\/auth\/(otp|token)\//, /^\/api\/v1\/auth\/support-session$/];

createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock");
  if (!anonymous.some((r) => r.test(url.pathname)) && !authed(req)) return problem(res, 401, "auth.unauthorized");
  // e2e hooks: a token for user "revoked" is refused (401) and one for "broken" makes the backend fail (500).
  const sub = (() => { try { return JSON.parse(Buffer.from((req.headers.authorization ?? "").split(".")[1] ?? "", "base64url").toString()).sub; } catch { return null; } })();
  if (sub === "revoked") return problem(res, 401, "auth.unauthorized");
  if (sub === "broken") return problem(res, 500, "common.unexpected");
  for (const [method, pattern, handler] of routes) {
    const match = req.method === method && url.pathname.match(pattern);
    if (match) return handler(req, res, url, match.slice(1));
  }
  problem(res, 404, "common.not_found");
}).listen(port, () => console.log(`mock Pishkhan API on http://localhost:${port}`));

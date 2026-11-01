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
    handoff: statuses[i % statuses.length] !== "handed_off" ? null
      // Conversation 8 was handed off by the AI agent (BE-1.4 part 2), with its unsure draft as the suggestion.
      : i === 8 ? { reason: "ai:low_confidence", suggestedReply: "سلام! سایز M برای قد ۱۶۵ مناسب است.", at: iso(lastInbound) }
      : { reason: "مشتری درخواست تخفیف عمده دارد", suggestedReply: "سلام! برای خرید عمده ۱۰٪ تخفیف داریم، چند عدد لازم دارید؟", at: iso(lastInbound) },
  };
});

// CRM (BE-1.7): one contact per conversation contact, plus tags, field definitions and segments.
const crmContacts = [...new Map(conversations.map((c, i) => [c.contactId, {
  id: c.contactId, displayName: c.contact.displayName, username: c.contact.username,
  tags: i === 0 ? ["مشتری ویژه"] : i % 5 === 2 ? ["سفارش عمده"] : [],
  fields: i === 0 ? { city: "شیراز" } : {},
  channels: [channel.id], lastSeenAt: c.lastInboundAt, createdAt: ago((30 - i) * 24 * H),
}])).values()];
const crmFields = [
  { id: randomUUID(), key: "city", label: "شهر", type: "text", options: [], sortOrder: 10 },
  { id: randomUUID(), key: "orders", label: "تعداد سفارش", type: "number", options: [], sortOrder: 20 },
  { id: randomUUID(), key: "birthday", label: "تاریخ تولد", type: "date", options: [], sortOrder: 30 },
];
const crmTagDefs = new Map([["مشتری ویژه", { color: "purple", description: "خرید بالای ۵ میلیون" }]]);
const crmSegments = [];
const tagList = () => {
  const names = new Set([...crmTagDefs.keys(), ...crmContacts.flatMap((c) => c.tags)]);
  return [...names].map((name) => ({ name, color: crmTagDefs.get(name)?.color ?? null, description: crmTagDefs.get(name)?.description ?? null, defined: crmTagDefs.has(name), contactCount: crmContacts.filter((c) => c.tags.includes(name)).length }));
};
const matchesCondition = (c, cond) => {
  switch (cond.field) {
    case "tag": return cond.op === "has" ? c.tags.includes(cond.value) : !c.tags.includes(cond.value);
    case "name": return cond.op === "contains" ? (c.displayName ?? "").includes(cond.value) : (cond.op === "exists") === Boolean(c.displayName);
    case "username": return cond.op === "contains" ? (c.username ?? "").includes(cond.value) : (cond.op === "exists") === Boolean(c.username);
    case "field": {
      const v = c.fields[cond.key];
      if (cond.op === "exists" || cond.op === "not_exists") return (cond.op === "exists") === (v !== undefined);
      if (cond.op === "eq") return v === String(cond.value);
      if (cond.op === "neq") return v !== String(cond.value);
      if (cond.op === "contains") return (v ?? "").includes(cond.value);
      return v !== undefined && (cond.op === "gt" ? Number(v) > Number(cond.value) : Number(v) < Number(cond.value));
    }
    case "has_phone": return cond.value === false;
    case "consent": return (consentState(c.id).current[cond.value] === true) === (cond.op === "granted");
    default: return true;
  }
};
const segmentMatches = (rule, c) => rule.match === "any" ? rule.conditions.some((x) => matchesCondition(c, x)) : rule.conditions.every((x) => matchesCondition(c, x));
const validRule = (rule) => {
  const errors = {};
  if (!rule || !Array.isArray(rule.conditions) || rule.conditions.length === 0) errors["rule.conditions"] = ["validation.segment.conditions"];
  (rule?.conditions ?? []).forEach((c, i) => { if (c.field === "tag" && !String(c.value ?? "").trim()) errors[`rule.conditions[${i}].value`] = ["validation.segment.value"]; });
  return errors;
};
// BE-1.7 part 2: consents (history per contact), form submissions from one flow, and the caller's exports.
const crmConsents = new Map([[crmContacts[0].id, [{ id: randomUUID(), channel: "sms", granted: true, source: "manual", evidence: "در دایرکت گفت پیامک تخفیف بفرستید", recordedBy: me.id, createdAt: ago(3 * 24 * H) }]]]);
const consentState = (id) => {
  const current = {};
  for (const h of [...(crmConsents.get(id) ?? [])].reverse()) current[h.channel] = h.granted;
  return { current, history: crmConsents.get(id) ?? [] };
};
const orderFlowId = randomUUID();
const crmSubmissions = crmContacts.slice(0, 3).map((c, i) => ({
  id: randomUUID(), flowId: orderFlowId, flowName: "فرم سفارش", flowVersion: 2, contactId: c.id, contactName: c.displayName, contactUsername: c.username,
  conversationId: conversations.find((v) => v.contactId === c.id).id, answers: { size: ["M", "L", "S"][i], city: ["شیراز", "تهران", "رشت"][i], phone: `0912000${i}${i}${i}${i}` }, submittedAt: ago((i + 1) * 5 * H),
}));
const crmExports = [];
const toSegment = (s) => ({ ...s, contactCount: crmContacts.filter((c) => segmentMatches(s.rule, c)).length });

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
// AI agent (BE-1.4 part 2): profile (defaults until saved) and reply traces.
let agentProfile = null;
const agentDefaults = { name: "دستیار", tone: "friendly", brandVoice: null, replyInCustomerLanguage: false, neverSay: [], confidenceThreshold: 0.6, handoff: { humanRequest: true, complaint: true, discountRequest: true, repeatedLowConfidence: true, keywords: [], vipTags: ["vip"] }, handoffMessage: "سؤالتون رو به همکارم سپردم، به‌زودی جوابتون رو می‌ده 🙏", allowedDomains: [] };
let agentProfileUpdatedAt = null;
const traceBase = { messageId: randomUUID(), flowRunId: null, goal: null, language: "fa", sentiment: "neutral", classifierConfidence: 0.9, toolCalls: [], guardIssues: [], selfConfidence: 0.8, threshold: 0.6, prompts: "intent.classify@2, agent.reply@1", models: "gpt-4o-mini", inputTokens: 1840, outputTokens: 96, costIrr: 41_000, latencyMs: 2300 };
const agentTraces = [
  { ...traceBase, id: randomUUID(), conversationId: "0199b000-0000-7000-8000-000000001001", input: "ارسال به شیراز چند روز طول می‌کشه؟", intent: "shipping", outcome: "sent", handoffReason: null, reply: "سلام! ارسال به شهرستان‌ها با پست پیشتاز دو تا چهار روز کاری است 🌸", confidence: 0.88, facts: [{ chunkId: randomUUID(), sourceId: randomUUID(), sourceKind: "faq", title: "ارسال به شهرستان چند روز طول می‌کشد؟", score: 0.03, similarity: 0.91 }], createdAt: ago(40 * 60_000) },
  { ...traceBase, id: randomUUID(), conversationId: "0199b000-0000-7000-8000-000000001008", input: "قدم ۱۶۵ه، کدوم سایز رو بگیرم؟", intent: "other", outcome: "handed_off", handoffReason: "low_confidence", reply: "سلام! سایز M برای قد ۱۶۵ مناسب است.", selfConfidence: 0.5, classifierConfidence: 0.4, confidence: 0.45, facts: [], createdAt: ago(25 * H) },
  { ...traceBase, id: randomUUID(), conversationId: "0199b000-0000-7000-8000-000000001003", input: "مانتو کتان چنده؟", intent: "price_question", outcome: "handed_off", handoffReason: "guard_price", reply: null, confidence: null, toolCalls: [{ name: "get_product", arguments: "{\"query\":\"مانتو کتان\"}", result: "{\"title\":\"مانتو کتان تابستانه\",\"price\":\"۸۹۰٬۰۰۰ تومان\"}", error: null }], guardIssues: [{ attempt: 1, kind: "price", detail: "۷۹۰ هزار" }, { attempt: 2, kind: "price", detail: "۷۹۰ هزار" }], facts: [], createdAt: ago(30 * H) },
];
// Unanswered questions (BE-1.4 part 3), counted by repeats.
const kbUnanswered = [
  { id: randomUUID(), question: "برای کیش هم ارسال دارید؟", count: 4, status: "open", firstAskedAt: ago(6 * 24 * H), lastAskedAt: ago(3 * H), lastConversationId: "0199b000-0000-7000-8000-000000001002", answerSourceId: null },
  { id: randomUUID(), question: "جنس آستر مانتو چیه؟", count: 1, status: "open", firstAskedAt: ago(2 * 24 * H), lastAskedAt: ago(2 * 24 * H), lastConversationId: "0199b000-0000-7000-8000-000000001004", answerSourceId: null },
  { id: randomUUID(), question: "شماره کارت بدید", count: 2, status: "dismissed", firstAskedAt: ago(9 * 24 * H), lastAskedAt: ago(8 * 24 * H), lastConversationId: "0199b000-0000-7000-8000-000000001005", answerSourceId: null },
];
const traceSummary = ({ id, conversationId, messageId, input, intent, outcome, handoffReason, reply, confidence, threshold, latencyMs, createdAt }) => ({ id, conversationId, messageId, input, intent, outcome, handoffReason, reply, confidence, threshold, latencyMs, createdAt });

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

// Knowledge (BE-1.4 part 1): FAQ and text sources, plus one source per active product. Indexing finishes after a moment.
const kbSource = (kind, title, body, extra = {}) => ({ id: randomUUID(), kind, title, question: kind === "faq" ? title : null, body, productId: null, enabled: true, status: "indexed", revision: 1, indexedRevision: 1, chunkCount: 1, error: null, indexedAt: ago(2 * H), createdAt: ago(5 * 24 * H), updatedAt: ago(2 * H), ...extra });
let kbSources = [
  kbSource("faq", "ارسال به شهرستان چند روز طول می‌کشد؟", "ارسال به شهرستان‌ها با پست پیشتاز دو تا چهار روز کاری است."),
  kbSource("faq", "امکان مرجوعی هست؟", "تا هفت روز پس از تحویل، اگر برچسب کالا جدا نشده باشد، مرجوعی رایگان است."),
  kbSource("text", "راهنمای سایز", "سایز S برای قد تا ۱۶۰، M تا ۱۶۸ و L تا ۱۷۵ سانتی‌متر مناسب است.", { chunkCount: 2, status: "failed", error: "knowledge.embedding_failed", revision: 2 }),
  ...products.filter((p) => p.status === "active").map((p) => kbSource("product", p.title, `${p.title}. ${p.description ?? ""} قیمت ${p.price ? p.price.amount / 10 : "—"} تومان.`, { productId: p.id })),
];
const kbIndex = (src) => {
  Object.assign(src, { status: "pending", revision: src.revision + 1, error: null, updatedAt: iso(now()) });
  setTimeout(() => Object.assign(src, { status: "indexed", indexedRevision: src.revision, chunkCount: Math.max(1, Math.ceil(src.body.length / 400)), indexedAt: iso(now()) }), 1200);
};
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
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/contacts$/, (req, res, url) => {
    const q = url.searchParams.get("q") ?? "";
    const tag = url.searchParams.get("tag");
    const segment = crmSegments.find((x) => x.id === url.searchParams.get("segmentId"));
    const hasPhone = url.searchParams.get("hasPhone");
    const consent = url.searchParams.get("consent");
    const items = crmContacts.filter((c) => (!q || `${c.displayName ?? ""} ${c.username ?? ""}`.includes(q)) && (!tag || c.tags.includes(tag)) && (!segment || segmentMatches(segment.rule, c)) && hasPhone !== "true" && (!consent || consentState(c.id).current[consent] === true));
    send(res, 200, page(items, url.searchParams.get("cursor"), Number(url.searchParams.get("limit") ?? 30)));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/contacts\/exports$/, (req, res) => send(res, 200, [...crmExports].reverse())],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/contacts\/exports$/, async (req, res) => {
    await readBody(req);
    if (crmExports.filter((x) => x.status === "pending").length >= 3) return problem(res, 409, "crm.export.too_many");
    const x = { id: randomUUID(), status: "pending", rowCount: null, error: null, createdAt: iso(now()), completedAt: null, expiresAt: null };
    crmExports.push(x);
    // The worker: ready after a moment, with an in-app notification that links back to the list.
    setTimeout(() => {
      Object.assign(x, { status: "ready", rowCount: crmContacts.length, completedAt: iso(now()), expiresAt: iso(new Date(Date.now() + 24 * H)) });
      notifications.unshift({ id: randomUUID(), kind: "crm_export", title: "خروجی اکسل مشتری‌ها آماده است", body: `${crmContacts.length} مشتری`, link: `/contacts?export=${x.id}`, createdAt: iso(now()), readAt: null });
    }, 1500);
    send(res, 202, x);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/contacts\/exports\/([^/]+)$/, (req, res, url, [id]) => {
    const x = crmExports.find((e) => e.id === id);
    return x ? send(res, 200, x) : problem(res, 404, "common.not_found");
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/contacts\/exports\/([^/]+)\/download$/, (req, res, url, [id]) => {
    const x = crmExports.find((e) => e.id === id);
    if (!x) return problem(res, 404, "common.not_found");
    if (x.status === "pending") return problem(res, 409, "crm.export.not_ready");
    if (x.status !== "ready") return problem(res, 409, "crm.export.gone");
    x.status = "downloaded";
    send(res, 200, { url: `http://localhost:${port}/files/exports/${id}.xlsx` });
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/contacts\/([^/]+)\/consents$/, (req, res, url, [id]) => send(res, 200, consentState(id))],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/contacts\/([^/]+)\/consents$/, async (req, res, url, [id]) => {
    const body = await readBody(req);
    if (!["sms", "phone", "bale"].includes(body.channel)) return problem(res, 400, "validation", { channel: ["validation.consent.channel"] });
    crmConsents.set(id, [{ id: randomUUID(), channel: body.channel, granted: Boolean(body.granted), source: "manual", evidence: body.evidence ?? null, recordedBy: me.id, createdAt: iso(now()) }, ...(crmConsents.get(id) ?? [])]);
    send(res, 201, consentState(id));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/contacts\/([^/]+)\/submissions$/, (req, res, url, [id]) => send(res, 200, crmSubmissions.filter((x) => x.contactId === id))],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/crm\/forms$/, (req, res) => send(res, 200, [{ flowId: orderFlowId, flowName: "فرم سفارش", submissionCount: crmSubmissions.length, lastSubmittedAt: crmSubmissions[0].submittedAt, fields: ["size", "city", "phone"] }])],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/crm\/forms\/([^/]+)\/submissions$/, (req, res, url, [flowId]) => send(res, 200, page(crmSubmissions.filter((x) => x.flowId === flowId), url.searchParams.get("cursor"), Number(url.searchParams.get("limit") ?? 30)))],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/contacts\/([^/]+)$/, (req, res, url, [id]) => {
    const contact = crmContacts.find((c) => c.id === id);
    if (!contact) return problem(res, 404, "common.not_found");
    send(res, 200, { contact, conversations: conversations.filter((c) => c.contactId === id).map((c) => ({ id: c.id, channelAccountId: c.channelAccountId, channelKind: "instagram", status: c.status, lastInboundAt: c.lastInboundAt, lastMessagePreview: c.lastMessagePreview })) });
  }],
  ["PATCH", /^\/api\/v1\/workspaces\/[^/]+\/contacts\/([^/]+)$/, async (req, res, url, [id]) => {
    const contact = crmContacts.find((c) => c.id === id);
    if (!contact) return problem(res, 404, "common.not_found");
    const body = await readBody(req);
    const errors = {};
    for (const [k, v] of Object.entries(body.fields ?? {})) {
      const def = crmFields.find((f) => f.key === k);
      if (v !== null && def?.type === "number" && !/^-?\d+(\.\d+)?$/.test(v)) errors[`fields.${k}`] = ["validation.contact.field_value"];
    }
    if (Object.keys(errors).length) return problem(res, 400, "validation.failed", errors);
    if (body.clearDisplayName) contact.displayName = null;
    else if (body.displayName) contact.displayName = body.displayName.trim();
    if (body.tags) contact.tags = [...new Set(body.tags.map((t) => t.trim()).filter(Boolean))];
    for (const [k, v] of Object.entries(body.fields ?? {})) { if (v === null) delete contact.fields[k]; else contact.fields[k] = v; }
    const conv = conversations.find((c) => c.contactId === id);
    if (conv) conv.contact.displayName = contact.displayName;
    send(res, 200, contact);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/crm\/tags$/, (req, res) => send(res, 200, tagList())],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/crm\/tags\/([^/]+)$/, async (req, res, url, [raw]) => {
    const name = decodeURIComponent(raw).trim();
    const body = await readBody(req);
    if (!name || name.length > 50) return problem(res, 400, "validation.failed", { name: ["validation.tag.name"] });
    crmTagDefs.set(name, { color: body.color ?? null, description: body.description ?? null });
    send(res, 200, tagList().find((t) => t.name === name));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/crm\/tags\/([^/]+)\/rename$/, async (req, res, url, [raw]) => {
    const name = decodeURIComponent(raw);
    const { newName } = await readBody(req);
    if (!tagList().some((t) => t.name === name)) return problem(res, 404, "crm.tag.not_found");
    for (const c of crmContacts) if (c.tags.includes(name)) c.tags = [...new Set(c.tags.map((t) => (t === name ? newName : t)))];
    if (!crmTagDefs.has(newName) && crmTagDefs.has(name)) crmTagDefs.set(newName, crmTagDefs.get(name));
    crmTagDefs.delete(name);
    send(res, 200, tagList().find((t) => t.name === newName));
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/crm\/tags\/([^/]+)$/, (req, res, url, [raw]) => {
    const name = decodeURIComponent(raw);
    crmTagDefs.delete(name);
    for (const c of crmContacts) c.tags = c.tags.filter((t) => t !== name);
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/crm\/fields$/, (req, res) => send(res, 200, [...crmFields].sort((a, b) => a.sortOrder - b.sortOrder))],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/crm\/fields$/, async (req, res) => {
    const body = await readBody(req);
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(body.key ?? "")) return problem(res, 400, "validation.failed", { key: ["validation.field.key"] });
    if (crmFields.some((f) => f.key === body.key)) return problem(res, 409, "crm.field.key_taken");
    const field = { id: randomUUID(), key: body.key, label: body.label, type: body.type, options: body.options ?? [], sortOrder: body.sortOrder };
    crmFields.push(field);
    send(res, 201, field);
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/crm\/fields\/([^/]+)$/, async (req, res, url, [id]) => {
    const field = crmFields.find((f) => f.id === id);
    if (!field) return problem(res, 404, "common.not_found");
    const body = await readBody(req);
    Object.assign(field, { label: body.label, type: body.type, options: body.options ?? [], sortOrder: body.sortOrder });
    send(res, 200, field);
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/crm\/fields\/([^/]+)$/, (req, res, url, [id]) => {
    const i = crmFields.findIndex((f) => f.id === id);
    if (i >= 0) crmFields.splice(i, 1);
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/crm\/segments$/, (req, res) => send(res, 200, crmSegments.map(toSegment))],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/crm\/segments\/preview$/, async (req, res) => {
    const rule = await readBody(req);
    const errors = validRule(rule);
    if (Object.keys(errors).length) return problem(res, 400, "validation.failed", errors);
    send(res, 200, { contactCount: crmContacts.filter((c) => segmentMatches(rule, c)).length });
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/crm\/segments$/, async (req, res) => {
    const body = await readBody(req);
    if (crmSegments.some((x) => x.name === body.name)) return problem(res, 409, "crm.segment.name_taken");
    const segment = { id: randomUUID(), name: body.name, rule: body.rule, updatedAt: iso(now()) };
    crmSegments.push(segment);
    send(res, 201, toSegment(segment));
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/crm\/segments\/([^/]+)$/, async (req, res, url, [id]) => {
    const segment = crmSegments.find((x) => x.id === id);
    if (!segment) return problem(res, 404, "crm.segment.not_found");
    const body = await readBody(req);
    Object.assign(segment, { name: body.name, rule: body.rule, updatedAt: iso(now()) });
    send(res, 200, toSegment(segment));
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/crm\/segments\/([^/]+)$/, (req, res, url, [id]) => {
    const i = crmSegments.findIndex((x) => x.id === id);
    if (i >= 0) crmSegments.splice(i, 1);
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
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/agent\/sandbox$/, async (req, res) => {
    const b = await readBody(req);
    if (!b.text?.trim()) return problem(res, 400, "validation.failed", { text: ["validation.agent.text"] });
    const text = b.text.trim();
    const words = text.replace(/[؟?!.،]/g, " ").split(/\s+/).filter((w) => w.length > 2);
    const hit = kbSources.filter((x) => x.enabled && x.status === "indexed").map((x) => ({ x, n: words.filter((w) => `${x.title} ${x.body}`.includes(w)).length })).sort((a, c) => c.n - a.n)[0];
    const profile = agentProfile ?? agentDefaults;
    const vip = (b.tags ?? []).some((tag) => profile.handoff.vipTags.includes(tag));
    const reason = vip ? "vip" : text.includes("تخفیف") ? "discount_request" : hit?.n ? null : "missing_knowledge";
    const facts = hit?.n ? [{ chunkId: randomUUID(), sourceId: hit.x.id, sourceKind: hit.x.kind, title: hit.x.title, score: 0.03, similarity: 0.88 }] : [];
    const reply = reason ? null : hit.x.body;
    const trace = { ...traceBase, id: randomUUID(), conversationId: "00000000-0000-0000-0000-000000000000", input: text, intent: reason === "discount_request" ? "discount_request" : hit?.n ? "shipping" : "other", outcome: reason ? "handed_off" : "sent", handoffReason: reason, reply, confidence: reason ? null : 0.86, threshold: profile.confidenceThreshold, facts, createdAt: iso(now()) };
    send(res, 200, { outcome: trace.outcome, messages: reply ? [reply] : profile.handoffMessage ? [profile.handoffMessage] : [], handoffReason: reason, suggestedReply: null, unansweredQuestion: reason === "missing_knowledge" ? text : null, trace });
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/unanswered$/, (req, res, url) => {
    const status = url.searchParams.get("status") ?? "open";
    const items = kbUnanswered.filter((q) => q.status === status).sort((a, c) => c.lastAskedAt.localeCompare(a.lastAskedAt));
    send(res, 200, page(items, url.searchParams.get("cursor"), Number(url.searchParams.get("limit") ?? 30)));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/unanswered\/([^/]+)\/answer$/, async (req, res, url, [id]) => {
    const q = kbUnanswered.find((x) => x.id === id);
    if (!q) return problem(res, 404, "common.not_found");
    if (q.status === "answered") return problem(res, 409, "knowledge.unanswered.already_answered");
    const b = await readBody(req);
    if (!b.answer?.trim()) return problem(res, 400, "validation.failed", { answer: ["validation.knowledge.answer"] });
    const src = kbSource("faq", (b.question ?? q.question).trim(), b.answer.trim(), { revision: 0, createdAt: iso(now()) });
    kbSources.unshift(src);
    kbIndex(src);
    Object.assign(q, { status: "answered", answerSourceId: src.id });
    send(res, 201, { question: q, source: src });
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/unanswered\/([^/]+)\/dismiss$/, (req, res, url, [id]) => {
    const q = kbUnanswered.find((x) => x.id === id);
    if (!q) return problem(res, 404, "common.not_found");
    q.status = "dismissed";
    send(res, 200, q);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/agent\/profile$/, (req, res) => send(res, 200, { profile: agentProfile ?? agentDefaults, isDefault: agentProfile === null, updatedAt: agentProfileUpdatedAt })],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/agent\/profile$/, async (req, res) => {
    const b = await readBody(req);
    const errors = {};
    if (!b.name?.trim() || b.name.trim().length > 60) errors.name = ["validation.agent.name"];
    if (!["friendly", "formal", "playful"].includes(b.tone)) errors.tone = ["validation.agent.tone"];
    if (!(b.confidenceThreshold >= 0.3 && b.confidenceThreshold <= 0.95)) errors.confidenceThreshold = ["validation.agent.threshold"];
    const domains = (b.allowedDomains ?? []).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""));
    if (domains.some((d) => !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d))) errors.allowedDomains = ["validation.agent.domain"];
    if (Object.keys(errors).length) return problem(res, 400, "validation.failed", errors);
    agentProfile = { ...b, name: b.name.trim(), allowedDomains: [...new Set(domains)] };
    agentProfileUpdatedAt = iso(now());
    send(res, 200, { profile: agentProfile, isDefault: false, updatedAt: agentProfileUpdatedAt });
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/agent\/traces$/, (req, res, url) => {
    const outcome = url.searchParams.get("outcome");
    const conversationId = url.searchParams.get("conversationId");
    if (outcome && !["sent", "handed_off", "failed"].includes(outcome)) return problem(res, 400, "validation.failed", { outcome: ["validation.agent.outcome"] });
    const items = agentTraces.filter((x) => (!outcome || x.outcome === outcome) && (!conversationId || x.conversationId === conversationId)).map(traceSummary);
    send(res, 200, page(items, url.searchParams.get("cursor"), Number(url.searchParams.get("limit") ?? 30)));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/agent\/traces\/([^/]+)$/, (req, res, url, [id]) => {
    const x = agentTraces.find((t) => t.id === id);
    return x ? send(res, 200, x) : problem(res, 404, "common.not_found");
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
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/sources$/, (req, res, url) => {
    const q = url.searchParams.get("q") ?? "";
    const kind = url.searchParams.get("kind");
    const status = url.searchParams.get("status");
    const items = kbSources.filter((x) => (!q || `${x.title} ${x.body}`.includes(q)) && (!kind || x.kind === kind) && (!status || x.status === status));
    send(res, 200, page(items, url.searchParams.get("cursor"), Number(url.searchParams.get("limit") ?? 30)));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/sources$/, async (req, res) => {
    const b = await readBody(req);
    const faq = b.kind === "faq";
    const errors = {};
    if (faq && !b.question?.trim()) errors.question = ["validation.knowledge.question"];
    if (faq && !b.answer?.trim()) errors.answer = ["validation.knowledge.answer"];
    if (!faq && !b.title?.trim()) errors.title = ["validation.knowledge.title"];
    if (!faq && !b.body?.trim()) errors.body = ["validation.knowledge.body"];
    if (Object.keys(errors).length) return problem(res, 400, "validation.failed", errors);
    const src = kbSource(b.kind, faq ? b.question.trim() : b.title.trim(), faq ? b.answer.trim() : b.body.trim(), { revision: 0, createdAt: iso(now()) });
    kbSources.unshift(src);
    kbIndex(src);
    send(res, 201, src);
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/sources\/([^/]+)$/, async (req, res, url, [id]) => {
    const src = kbSources.find((x) => x.id === id);
    if (!src) return problem(res, 404, "common.not_found");
    const b = await readBody(req);
    const edits = b.title ?? b.question ?? b.answer ?? b.body;
    if (src.kind === "product" && edits != null) return problem(res, 400, "validation.failed", { kind: ["validation.knowledge.product_managed"] });
    if (b.enabled != null) src.enabled = b.enabled;
    if (edits != null) {
      if (src.kind === "faq") Object.assign(src, { title: b.question ?? src.title, question: b.question ?? src.question, body: b.answer ?? src.body });
      else Object.assign(src, { title: b.title ?? src.title, body: b.body ?? src.body });
      kbIndex(src);
    } else src.updatedAt = iso(now());
    send(res, 200, src);
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/sources\/([^/]+)$/, (req, res, url, [id]) => {
    const src = kbSources.find((x) => x.id === id);
    if (!src) return problem(res, 404, "common.not_found");
    if (src.kind === "product") return problem(res, 409, "knowledge.product_managed");
    kbSources = kbSources.filter((x) => x.id !== id);
    send(res, 204);
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/sources\/([^/]+)\/reindex$/, (req, res, url, [id]) => {
    const src = kbSources.find((x) => x.id === id);
    if (!src) return problem(res, 404, "common.not_found");
    kbIndex(src);
    send(res, 202, src);
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/search$/, async (req, res) => {
    const b = await readBody(req);
    if (!b.query?.trim()) return problem(res, 400, "validation.failed", { query: ["validation.knowledge.query"] });
    const words = b.query.replace(/[؟?!.،]/g, " ").split(/\s+/).filter((w) => w.length > 2);
    const hits = kbSources
      .filter((x) => x.enabled && x.status === "indexed")
      .map((x) => ({ x, n: words.filter((w) => `${x.title} ${x.body}`.includes(w)).length }))
      .filter((h) => h.n > 0)
      .sort((a, b2) => b2.n - a.n)
      .slice(0, b.limit ?? 5)
      .map(({ x, n }) => ({ chunkId: randomUUID(), sourceId: x.id, sourceKind: x.kind, title: x.title, text: x.body, score: n / 10, similarity: Math.min(0.95, 0.5 + n / 10), productId: x.productId }));
    send(res, 200, hits);
  }],
  // Stands in for the presigned object-store link of a contacts export.
  ["GET", /^\/files\/exports\/([^/]+)$/, (req, res, url, [name]) => {
    res.writeHead(200, { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}"` });
    res.end("mock");
  }],
];

const anonymous = [/^\/files\/exports\//, /^\/api\/v1\/public\//, /^\/api\/v1\/auth\/(otp|token)\//, /^\/api\/v1\/auth\/support-session$/];

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

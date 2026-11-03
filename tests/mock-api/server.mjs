// A small stand-in for the Pishkhan Api host, for UI work and smoke tests without the .NET stack.
// It follows backend/openapi/api.v1.json for the endpoints the panel uses, with fake Iranian data
// (phones 0912000xxxx). OTP code is always 123456. Not a contract test: the real backend is the source of truth.
//
//   node tests/mock-api/server.mjs            # listens on :5080 (PISHKHAN_API_URL default)
//   MOCK_PORT=5099 node tests/mock-api/server.mjs
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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
const profilePic = svgThumb(330, "ن");

const conversations = Array.from({ length: 24 }, (_, i) => {
  const lastInbound = new Date(Date.now() - (i * 3 + 0.2) * H);
  return {
    id: `0199b000-0000-7000-8000-${String(1000 + i).padStart(12, "0")}`,
    channelAccountId: channel.id,
    channelKind: "instagram",
    contactId: `0199b000-0000-7000-9000-${String(5000 + i * 7).padStart(12, "0")}`,
    // The first customer has an Instagram photo (BE contact profiles); the rest fall back to initials.
    contact: { id: `0199b000-0000-7000-9000-${String(5000 + i * 7).padStart(12, "0")}`, displayName: contacts[i % contacts.length][0], username: contacts[i % contacts.length][1], profilePicUrl: i % contacts.length === 0 ? profilePic : null },
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
      // Conversation 16's voice note could not be transcribed (BE-2.4), so it went to the team.
      : i === 16 ? { reason: "voice_unavailable", suggestedReply: null, at: iso(lastInbound) }
      : i === 8 ? { reason: "ai:low_confidence", suggestedReply: "سلام! سایز M برای قد ۱۶۵ مناسب است.", at: iso(lastInbound) }
      : { reason: "مشتری درخواست تخفیف عمده دارد", suggestedReply: "سلام! برای خرید عمده ۱۰٪ تخفیف داریم، چند عدد لازم دارید؟", at: iso(lastInbound) },
  };
});

// CRM (BE-1.7): one contact per conversation contact, plus tags, field definitions and segments.
const crmContacts = [...new Map(conversations.map((c, i) => [c.contactId, {
  id: c.contactId, displayName: c.contact.displayName, username: c.contact.username, profilePicUrl: c.contact.profilePicUrl,
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

const pushSubscriptions = [
  { id: randomUUID(), endpoint: "https://updates.push.services.mozilla.com/wpush/v2/e2e-firefox", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0", createdAt: iso(new Date(Date.now() - 86_400_000 * 3)), lastDeliveredAt: iso(new Date(Date.now() - 3_600_000)) },
  { id: randomUUID(), endpoint: "https://web.push.apple.com/e2e-iphone", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", createdAt: iso(new Date(Date.now() - 86_400_000 * 9)), lastDeliveredAt: null },
];
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
    m(-30, "inbound", "rang kerem ham darid?", { kind: "text" }),
    m(-29, "outbound", "برای دیدن رنگ‌ها کلمه «رنگ» رو بفرستید.", { handledBy: "rule" }),
    m(-40, "inbound", null, { kind: "attachment", attachments: [{ type: "image", url: svgThumb(330, "عکس مشتری") }] }),
    m(-5, "inbound", "این استوری رو می‌خوام", { kind: "story_reply", attachments: [{ type: "story_reply", url: svgThumb(20, "استوری") }] }),
    m(-2, "outbound", "بله کرم موجوده، براتون رزرو کنم؟", { handledBy: "human", sentBy: teammate.userId }),
    m(0, "inbound", c.lastMessagePreview),
  ].reverse());
}
// Voice notes (BE-2.4) in conversation 16: one transcribed, one still being transcribed, one that failed.
{
  const c = conversations[16];
  const base = new Date(c.lastInboundAt).getTime();
  const voice = (offsetMin, transcriptStatus, transcript = null) => ({
    id: randomUUID(), createdAt: iso(new Date(base + offsetMin * 60_000)), direction: "inbound", kind: "audio", text: null, status: "received", errorCode: null,
    handledBy: null, sentBy: null, tag: null, sentAt: null, readAt: null, attachments: [{ type: "audio", url: "https://cdn.instagram.example/voice/note.mp4" }],
    transcript, transcriptStatus,
  });
  messages.get(c.id).unshift(voice(3, "failed"), voice(2, "pending"), voice(1, "done", "سلام، این مانتو سایز ال داره؟ برای شیراز هم می‌فرستید؟"));
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
  // A Finglish turn (BE-2.3): the AI read it in Persian script.
  { ...traceBase, id: randomUUID(), language: "finglish", conversationId: "0199b000-0000-7000-8000-000000001004", input: "salam gheymatesh chande?", intent: "price_question", outcome: "sent", handoffReason: null, reply: "سلام! قیمت مانتو کتان ۸۹۰ هزار تومانه 🌸", confidence: 0.82, facts: [], createdAt: ago(20 * 60_000) },
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
// Bulk price changes (BE-2.6): preview and apply share one plan; a batch can be undone for 24 hours.
let priceChanges = [];
const PRICE_STEPS = [1, 100, 500, 1000, 5000, 10000, 50000, 100000];
const variantLabel = (v) => Object.values(v.attributes ?? {}).join(" / ") || null;
function parsePriceChange(body) {
  const errors = {};
  const s = body.scope;
  const tag = s?.tag?.trim() || null;
  if (!s || (!s.productIds?.length && !s.categoryId && !tag && !s.status && !s.all)) errors.scope = ["catalog.price_change_scope_required"];
  if (s?.categoryId && !categories.some((c) => c.id === s.categoryId)) errors["scope.categoryId"] = ["catalog.category_not_found"];
  let value = 0;
  if (body.kind === "percent") {
    const p = body.percent;
    if (typeof p !== "number" || p === 0 || p < -90 || p > 500 || Math.round(p * 100) !== p * 100) errors.percent = ["catalog.price_change_percent_invalid"];
    else value = p;
  } else if (body.kind === "amount") {
    if (!body.amount?.amount || body.amount.currency !== "IRR") errors.amount = ["catalog.price_change_amount_invalid"];
    else value = body.amount.amount;
  } else errors.kind = ["catalog.price_change_kind_invalid"];
  const roundTo = body.roundTo ?? 1;
  const roundMode = body.roundMode ?? "nearest";
  if (!PRICE_STEPS.includes(roundTo) || !["nearest", "up", "down"].includes(roundMode)) errors.roundTo = ["catalog.price_change_rounding_invalid"];
  if (Object.keys(errors).length) return { errors };
  return { scope: { productIds: s.productIds ?? null, categoryId: s.categoryId ?? null, tag, status: s.status ?? null, all: Boolean(s.all) }, rule: { kind: body.kind, value, roundTo, roundMode } };
}
function applyRule(rule, rial) {
  const raw = rule.kind === "percent" ? rial * (1 + rule.value / 100) : rial + rule.value;
  const step = rule.roundTo * 10;
  const steps = raw / step;
  const r = rule.roundMode === "up" ? Math.ceil(steps - 1e-9) : rule.roundMode === "down" ? Math.floor(steps + 1e-9) : Math.round(steps);
  const result = r * step;
  return result <= 0 ? null : result;
}
function planPriceChange({ scope, rule }) {
  const branch = new Set(scope.categoryId ? [scope.categoryId] : []);
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of categories) if (c.parentId && branch.has(c.parentId) && !branch.has(c.id)) { branch.add(c.id); grew = true; }
  }
  const matched = products.filter((p) =>
    (!scope.productIds?.length || scope.productIds.includes(p.id)) && (!scope.categoryId || branch.has(p.categoryId)) && (!scope.tag || p.tags.includes(scope.tag)) && (!scope.status || p.status === scope.status));
  const items = [];
  const invalid = [];
  for (const p of matched) {
    const own = [...(p.price ? [[null, p.price.amount, null]] : []), ...p.variants.filter((x) => x.price).map((x) => [x.id, x.price.amount, variantLabel(x)])];
    for (const [variantId, old, label] of own) {
      const next = applyRule(rule, old);
      const line = { productId: p.id, title: p.title, variantId, variantLabel: label, oldPrice: { amount: old, currency: "IRR" }, newPrice: next === null ? null : { amount: next, currency: "IRR" } };
      if (next === null) invalid.push(line);
      else if (next !== old) items.push(line);
    }
  }
  const fingerprint = createHash("sha256").update(matched.map((p) => `${p.id}:${p.revision}`).join(";") + items.map((i) => `${i.productId}/${i.variantId}=${i.newPrice.amount}`).join(";")).digest("hex").slice(0, 32);
  return { matched, items, invalid, fingerprint };
}
const ownPrice = (p, variantId) => (variantId ? p.variants.find((x) => x.id === variantId)?.price : p.price);
function setOwnPrice(p, variantId, rial) {
  const target = variantId ? p.variants.find((x) => x.id === variantId) : p;
  if (!target) return false;
  target.price = { amount: rial, currency: "IRR" };
  p.revision += 1;
  p.updatedAt = iso(now());
  return true;
}
priceChanges.push({
  id: randomUUID(), scope: { productIds: null, categoryId: categories[1].id, tag: null, status: null, all: false }, kind: "percent", percent: 10, amount: null, roundTo: 10000, roundMode: "up",
  productCount: 1, priceCount: 1, createdBy: me.id, createdAt: ago(3 * 24 * H), undoneAt: null, undoneBy: null, undoSkipped: 0,
  items: [{ productId: products[1].id, title: products[1].title, variantId: null, variantLabel: null, oldPrice: money(1_130_000), newPrice: money(1_250_000) }],
});
const batchView = (b, withItems) => {
  const canUndo = !b.undoneAt && Date.now() - Date.parse(b.createdAt) <= 24 * H;
  return { ...b, items: withItems ? b.items.map((i) => ({ ...i, title: products.find((p) => p.id === i.productId)?.title ?? i.title })) : null, canUndo, undoDeadline: iso(new Date(Date.parse(b.createdAt) + 24 * H)) };
};

// Knowledge (BE-1.4 part 1): FAQ and text sources, plus one source per active product. Indexing finishes after a moment.
// Orders (BE-2.1): numbers count up per workspace; catalog lines are priced from the catalog.
const provinces = [
  { code: "THR", name: "تهران", cities: ["تهران", "شهریار", "اسلامشهر"] },
  { code: "FRS", name: "فارس", cities: ["شیراز", "مرودشت", "کازرون"] },
  { code: "ESF", name: "اصفهان", cities: ["اصفهان", "کاشان", "نجف‌آباد"] },
];
const orderNext = {
  draft: ["awaiting_payment", "cancelled"], awaiting_payment: ["draft", "paid", "cancelled"], paid: ["preparing", "shipped", "refunded"],
  preparing: ["shipped", "refunded"], shipped: ["delivered", "returned"], delivered: ["completed", "returned"], completed: ["returned"],
  returned: ["refunded"], cancelled: [], refunded: [],
};
const orderStatusFa = { draft: "پیش‌نویس", awaiting_payment: "در انتظار پرداخت", paid: "پرداخت‌شده", preparing: "در حال آماده‌سازی", shipped: "ارسال‌شده", delivered: "تحویل‌شده", completed: "تکمیل‌شده", cancelled: "لغوشده", refunded: "مسترد‌شده", returned: "مرجوعی" };
let orderSeq = 1000;
const orders = [];
const orderEvents = new Map();
const faDigits = (x) => String(x).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
const faToman = (rial) => `${faDigits(Math.round(rial / 10).toLocaleString("en-US")).replace(/,/g, "٬")} تومان`;
const orderMissing = (o) => [!o.address?.line ? "address" : null, o.address?.line && !o.address.city ? "city" : null, !o.address?.postalCode ? "postalCode" : null, !o.phone ? "phone" : null].filter(Boolean);
const orderView = (o) => {
  const subtotal = o.items.reduce((sum, l) => sum + l.lineTotal.amount, 0);
  const total = Math.max(0, subtotal + o.shippingFee.amount - o.discount.amount);
  return { ...o, nextStatuses: orderNext[o.status], subtotal: { amount: subtotal, currency: "IRR" }, total: { amount: total, currency: "IRR" }, missing: orderMissing(o) };
};
const addOrderEvent = (o, kind, actorType, extra = {}) => {
  const list = orderEvents.get(o.id) ?? [];
  list.push({ id: randomUUID(), kind, fromStatus: null, toStatus: kind === "created" || kind === "status_changed" ? o.status : null, actorType, actorId: actorType === "user" ? me.id : null, note: null, at: iso(now()), ...extra });
  orderEvents.set(o.id, list);
};
/** Prices lines like the backend: catalog lines from the catalog, custom lines from the request. Returns [items, errors]. */
const priceOrderLines = (lines) => {
  const errors = {};
  const items = (lines ?? []).map((l, i) => {
    const qty = Number(l.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) errors[`items[${i}]`] = ["orders.quantity_invalid"];
    if (!l.productId) {
      if (!l.title?.trim()) errors[`items[${i}]`] = ["orders.title_invalid"];
      if (!l.unitPrice?.amount) errors[`items[${i}]`] = ["orders.price_invalid"];
      const unit = l.unitPrice?.amount ?? 0;
      return { productId: null, variantId: null, title: l.title?.trim() ?? "", variantLabel: null, sku: null, unitPrice: { amount: unit, currency: "IRR" }, quantity: qty, lineTotal: { amount: unit * qty, currency: "IRR" } };
    }
    const p = products.find((x) => x.id === l.productId && x.status === "active");
    if (!p) { errors[`items[${i}]`] = ["orders.product_not_found"]; return null; }
    const view = productView(p);
    let variant = null;
    if (view.variants.length > 1 || (view.variants.length === 1 && l.variantId)) {
      if (!l.variantId) { errors[`items[${i}]`] = ["orders.variant_required"]; return null; }
      variant = view.variants.find((v) => v.id === l.variantId);
      if (!variant) { errors[`items[${i}]`] = ["orders.variant_not_found"]; return null; }
    }
    if (variant ? !variant.inStock : !view.inStock) errors[`items[${i}]`] = ["orders.out_of_stock"];
    const unit = (variant?.effectivePrice ?? p.price)?.amount;
    if (!unit) { errors[`items[${i}]`] = ["orders.price_missing"]; return null; }
    return { productId: p.id, variantId: variant?.id ?? null, title: p.title, variantLabel: variant ? Object.values(variant.attributes).join(" / ") : null, sku: variant?.sku ?? null, unitPrice: { amount: unit, currency: "IRR" }, quantity: qty, lineTotal: { amount: unit * qty, currency: "IRR" } };
  });
  return [items, errors];
};
const orderAddress = (a, errors) => {
  if (!a) return null;
  if (!a.line?.trim()) { errors["address.line"] = ["orders.address_line_required"]; return null; }
  const prov = a.province ? provinces.find((p) => p.code === a.province || p.name === a.province) : null;
  if (a.province && !prov) errors["address.province"] = ["orders.province_unknown"];
  if (a.postalCode && !/^\d{10}$/.test(a.postalCode)) errors["address.postalCode"] = ["orders.postal_code_invalid"];
  return { recipient: a.recipient ?? null, provinceCode: prov?.code ?? null, province: prov?.name ?? null, city: a.city ?? null, line: a.line.trim(), postalCode: a.postalCode ?? null };
};
const orderPhone = (text, errors) => {
  if (!text) return null;
  const d = String(text).replace(/\D/g, "").replace(/^0098|^98(?=9\d{9}$)|^0/, "");
  if (!/^9\d{9}$/.test(d)) { errors.phone = ["orders.phone_invalid"]; return null; }
  return `+98${d}`;
};
// Conversation 1000 (Niloofar) has a draft the AI saved; one older order is already paid.
{
  const c = conversations[0];
  const coat = productView(products[0]);
  const m = coat.variants[0];
  const ai = { id: "0199b000-0000-7000-a000-000000000001", number: ++orderSeq, source: "ai", status: "draft", contactId: c.contactId, conversationId: c.id, customerName: "نیلوفر احمدی", phone: "+989121112233", address: { recipient: null, provinceCode: "FRS", province: "فارس", city: "شیراز", line: "خیابان زند، کوچهٔ ۱۲، پلاک ۴", postalCode: null },
    items: [{ productId: products[0].id, variantId: m.id, title: products[0].title, variantLabel: "M", sku: null, unitPrice: m.effectivePrice, quantity: 1, lineTotal: m.effectivePrice }],
    shippingFee: { amount: 500_000, currency: "IRR" }, discount: { amount: 0, currency: "IRR" }, note: null, revision: 1, createdAt: ago(40 * 60_000), updatedAt: ago(40 * 60_000), paidAt: null, closedAt: null };
  const paid = { id: "0199b000-0000-7000-a000-000000000002", number: ++orderSeq, source: "panel", status: "paid", contactId: c.contactId, conversationId: null, customerName: "نیلوفر احمدی", phone: "+989121112233", address: { recipient: null, provinceCode: "FRS", province: "فارس", city: "شیراز", line: "خیابان زند، کوچهٔ ۱۲، پلاک ۴", postalCode: "7134567890" },
    items: [{ productId: products[1].id, variantId: null, title: products[1].title, variantLabel: null, sku: null, unitPrice: money(1_250_000), quantity: 2, lineTotal: money(2_500_000) }],
    shippingFee: money(0), discount: money(100_000), note: "بسته‌بندی کادویی", revision: 2, createdAt: ago(3 * 24 * H), updatedAt: ago(2 * 24 * H), paidAt: ago(2 * 24 * H), closedAt: null };
  orders.unshift(ai, paid);
  addOrderEvent(paid, "created", "user", { toStatus: "draft", at: paid.createdAt });
  addOrderEvent(paid, "status_changed", "user", { fromStatus: "awaiting_payment", toStatus: "paid", at: paid.paidAt });
  addOrderEvent(ai, "created", "ai", { at: ai.createdAt });
}
// Billing checkout (BE-2.8): plans on sale, the workspace's subscriptions and checkouts paid to Pishkhan's Zarinpal account.
const panelUrl = process.env.MOCK_PANEL_URL ?? "http://localhost:3001";
const D = 24 * H;
const feature = (key, label, limit = null) => ({ key, label, included: true, limit });
const salePlans = [
  { id: "0199c000-0000-7000-8000-000000000001", code: "free", name: "رایگان", tagline: "برای شروع و آشنایی", description: null, monthly: money(0), annual: null, aiConversations: 50, overagePerConversation: null, channelAccounts: 1, seats: 1, highlighted: false, isFree: true, limits: { ai_conversations: 50, channel_accounts: 1, seats: 1 }, features: [feature("inbox", "صندوق دایرکت")] },
  { id: "0199c000-0000-7000-8000-000000000002", code: "starter", name: "پایه", tagline: "برای فروشگاه‌های تازه‌کار", description: null, monthly: money(390_000), annual: money(3_900_000), aiConversations: 300, overagePerConversation: money(700), channelAccounts: 1, seats: 2, highlighted: false, isFree: false, limits: { ai_conversations: 300, channel_accounts: 1, seats: 2 }, features: [feature("inbox", "صندوق دایرکت"), feature("automations", "پاسخ خودکار")] },
  { id: "0199c000-0000-7000-8000-000000000003", code: "growth", name: "رشد", tagline: "محبوب‌ترین برای فروشگاه‌های اینستاگرامی", description: null, monthly: money(890_000), annual: money(8_900_000), aiConversations: 1000, overagePerConversation: money(500), channelAccounts: 2, seats: 5, highlighted: true, isFree: false, limits: { ai_conversations: 1000, channel_accounts: 2, seats: 5 }, features: [feature("inbox", "صندوق دایرکت"), feature("automations", "پاسخ خودکار"), feature("orders", "سفارش و لینک پرداخت")] },
  { id: "0199c000-0000-7000-8000-000000000004", code: "pro", name: "حرفه‌ای", tagline: "برای تیم‌های فروش", description: null, monthly: money(1_890_000), annual: null, aiConversations: null, overagePerConversation: null, channelAccounts: 5, seats: null, highlighted: false, isFree: false, limits: { ai_conversations: null, channel_accounts: 5, seats: null }, features: [feature("inbox", "صندوق دایرکت"), feature("automations", "پاسخ خودکار"), feature("orders", "سفارش و لینک پرداخت"), feature("support", "پشتیبانی تلفنی")] },
];
let subscriptions = [];
let checkouts = [];
let invoiceSeq = 1000;
const resetBilling = () => {
  // A 12-day trial of «رشد», as the Billing v1 e2e test expects.
  const growth = salePlans[2];
  subscriptions = [{ id: randomUUID(), planId: growth.id, planCode: growth.code, planVersion: 2, state: "trialing", trial: true, startsAt: ago(2 * D), endsAt: iso(new Date(Date.now() + 12 * D)), endedAt: null, endReason: null, cycle: null, checkoutId: null }];
  checkouts = [];
  invoiceSeq = 1000;
};
resetBilling();
const currentSub = () => subscriptions.find((s) => s.state === "active" || s.state === "trialing") ?? null;
const scheduledSubs = () => subscriptions.filter((s) => s.state === "scheduled").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
const planPrice = (p, cycle) => (cycle === "annual" ? p.annual?.amount : p.monthly.amount) || null;
const perMonth = (p) => (p.monthly.amount > 0 ? p.monthly.amount : (p.annual?.amount ?? 0) / 12);
// Mirrors the backend's CheckoutPlanner.Quote.
const quoteFor = (p, cycle) => {
  if (p.isFree) return { error: "billing.checkout.plan_not_for_sale" };
  const price = planPrice(p, cycle);
  if (!price) return { error: "billing.checkout.cycle_not_offered" };
  const length = (cycle === "annual" ? 365 : 30) * D;
  const nowMs = Date.now();
  const cur = currentSub();
  const curPlan = cur && salePlans.find((x) => x.code === cur.planCode);
  const quote = (kind, credit, startMs) => ({ kind, planId: p.id, planCode: p.code, planName: p.name, cycle, price: { amount: price, currency: "IRR" }, credit: { amount: credit, currency: "IRR" }, amount: { amount: Math.max(price - credit, 10_000), currency: "IRR" }, startsAt: iso(new Date(startMs)), endsAt: iso(new Date(startMs + length)) });
  if (!cur || cur.trial || !curPlan) return { quote: quote("new", 0, nowMs) };
  if (!cur.endsAt) return { error: "billing.checkout.managed_subscription" };
  const lastEnd = Math.max(new Date(cur.endsAt).getTime(), ...scheduledSubs().map((s) => new Date(s.endsAt).getTime()));
  if (p.code !== cur.planCode && perMonth(p) > perMonth(curPlan)) {
    if (scheduledSubs().length) return { error: "billing.checkout.scheduled_pending" };
    const paid = checkouts.find((c) => c.id === cur.checkoutId);
    const start = new Date(cur.startsAt).getTime();
    const end = new Date(cur.endsAt).getTime();
    const unused = paid ? Math.floor((paid.amount.amount * Math.max(0, end - nowMs)) / (end - start)) : 0;
    return { quote: quote("upgrade", Math.min(unused, price), nowMs) };
  }
  return { quote: quote(p.code === cur.planCode ? "renewal" : "downgrade", 0, lastEnd) };
};
const checkoutView = (c) => {
  // The gateway authority, the period and the idempotency key are the mock's own bookkeeping, not part of the response.
  const view = { ...c, authority: undefined, startsAt: undefined, endsAt: undefined, idempotencyKey: undefined };
  return { ...view, status: c.status === "pending" && Date.now() - new Date(c.createdAt).getTime() > H ? "expired" : c.status };
};
const currentPlanView = () => {
  const cur = currentSub();
  const p = cur && salePlans.find((x) => x.code === cur.planCode);
  if (!cur || !p) return { source: "free", planId: salePlans[0].id, planCode: "free", planName: "رایگان", planVersion: 1, trial: false, endsAt: null, limits: salePlans[0].limits, subscription: null, upcoming: [] };
  return { source: "subscription", planId: p.id, planCode: p.code, planName: p.name, planVersion: cur.planVersion, trial: cur.trial, endsAt: cur.endsAt, limits: { seats: 3, channel_accounts: 1, ai_conversations: 500, sms: null }, subscription: cur, upcoming: scheduledSubs() };
};
// What the backend does when Zarinpal confirms: start the subscription now (new, upgrade) or schedule it (renewal, downgrade).
const settleCheckout = (c, outcome) => {
  if (c.status !== "pending") return;
  if (outcome === "cancelled") return Object.assign(c, { status: "failed", error: "cancelled" });
  if (outcome === "failed") return Object.assign(c, { status: "failed", error: "-51" });
  if (outcome === "pending") return;
  const later = c.kind === "renewal" || c.kind === "downgrade";
  const sub = { id: randomUUID(), planId: c.planId, planCode: c.planCode, planVersion: c.planVersion, state: later ? "scheduled" : "active", trial: false, startsAt: c.startsAt, endsAt: c.endsAt, endedAt: null, endReason: null, cycle: c.cycle, checkoutId: c.id };
  if (!later) for (const s of subscriptions) if (s.state === "active" || s.state === "trialing") Object.assign(s, { state: "ended", endedAt: iso(now()), endReason: "replaced" });
  subscriptions.push(sub);
  Object.assign(c, { status: "paid", invoiceNumber: ++invoiceSeq, referenceId: String(70_000_000 + invoiceSeq), cardMask: "6219-86**-****-4321", subscriptionId: sub.id, paidAt: iso(now()) });
};
const gatewayPage = (c) => `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>درگاه آزمایشی زرین‌پال</title></head>
<body style="font-family:sans-serif;max-width:28rem;margin:2rem auto;padding:0 1rem"><main><h1>درگاه آزمایشی زرین‌پال</h1><p>پرداخت ${(c.amount.amount / 10).toLocaleString("fa-IR")} تومان به پیشخوان</p>
<ul style="list-style:none;padding:0;display:grid;gap:.5rem">
<li><a href="/__mock/zarinpal/${c.authority}/done?outcome=paid">پرداخت</a></li>
<li><a href="/__mock/zarinpal/${c.authority}/done?outcome=cancelled">انصراف</a></li>
<li><a href="/__mock/zarinpal/${c.authority}/done?outcome=failed">خطای بانک</a></li>
<li><a href="/__mock/zarinpal/${c.authority}/done?outcome=pending">بدون پاسخ (در انتظار)</a></li>
</ul></main></body></html>`;
// Industry templates (BE-2.9): the backend's built-in seeds (tests/mock-api/fixtures, made from Seeds/*.json), applied by key.
const seedTemplates = JSON.parse(readFileSync(new URL("./fixtures/industry-templates.json", import.meta.url), "utf8")).map((x, i) => ({
  ...x, id: `0199f000-0000-7000-8000-00000000000${i + 1}`, version: 1,
}));
let templateApplications = [];
let templateKeys = new Set();
let agentProfileSet = false;
const templateSummary = (x) => {
  const last = templateApplications.find((a) => a.templateId === x.id);
  return { id: x.id, industry: x.industry, version: x.version, name: x.name, description: x.description, requiredFacts: x.requiredFacts.length, faqs: x.faqs.length, flows: x.flows.length, rules: x.rules.length, hasAgentProfile: Boolean(x.agentProfile), recommended: x.industry === ws.industry, lastApplied: last?.appliedAt ?? null };
};
const applyTemplate = (x) => {
  const add = (kind, items) => items.filter((i) => !templateKeys.has(`${kind}:${i.key}`)).map((i) => templateKeys.add(`${kind}:${i.key}`)).length;
  const newFaqs = x.faqs.filter((f) => !templateKeys.has(`faq:${f.key}`));
  const faqsAdded = add("faq", x.faqs);
  const flowsAdded = add("flow", x.flows);
  const rulesAdded = add("rule", x.rules);
  // The FAQs land in the knowledge base switched off, with their blanks.
  for (const f of newFaqs) kbSources.unshift(kbSource("faq", f.question, f.answer, { enabled: false }));
  const profileApplied = Boolean(x.agentProfile) && !agentProfileSet;
  if (profileApplied) agentProfileSet = true;
  const total = x.faqs.length + x.flows.length + x.rules.length;
  const app = { id: randomUUID(), templateId: x.id, industry: x.industry, version: x.version, faqsAdded, flowsAdded, rulesAdded, profileApplied, skipped: total - faqsAdded - flowsAdded - rulesAdded, appliedAt: iso(now()) };
  templateApplications.unshift(app);
  return app;
};

// Payments (BE-2.2): the seller's Zarinpal account and payment links (3 days, newest first).
let merchant = { configured: false, provider: null, merchantIdHint: null, sandbox: false, enabled: true, updatedAt: null };
const paymentLinks = [];
const expirePaymentLinks = (orderId) => {
  for (const l of paymentLinks) if (l.orderId === orderId && l.status === "active") l.status = "cancelled";
};

const kbSource = (kind, title, body, extra = {}) => ({ id: randomUUID(), kind, title, question: kind === "faq" ? title : null, body, factKey: null, productId: null, fileId: null, url: null, enabled: true, status: "indexed", revision: 1, indexedRevision: 1, chunkCount: 1, error: null, indexedAt: ago(2 * H), createdAt: ago(5 * 24 * H), updatedAt: ago(2 * H), ...extra });
let kbSources = [
  kbSource("faq", "ارسال به شهرستان چند روز طول می‌کشد؟", "ارسال به شهرستان‌ها با پست پیشتاز دو تا چهار روز کاری است.", { factKey: "shipping_time" }),
  kbSource("faq", "امکان مرجوعی هست؟", "تا هفت روز پس از تحویل، اگر برچسب کالا جدا نشده باشد، مرجوعی رایگان است."),
  kbSource("text", "راهنمای سایز", "سایز S برای قد تا ۱۶۰، M تا ۱۶۸ و L تا ۱۷۵ سانتی‌متر مناسب است.", { chunkCount: 2, status: "failed", error: "knowledge.embedding_failed", revision: 2 }),
  ...products.filter((p) => p.status === "active").map((p) => kbSource("product", p.title, `${p.title}. ${p.description ?? ""} قیمت ${p.price ? p.price.amount / 10 : "—"} تومان.`, { productId: p.id })),
];
// Knowledge score and onboarding interview (BE-1.9): the required facts of the workspace's industry, from the backend's template
// seeds (tests/mock-api/fixtures/required-facts.json). Scored like the backend: facts 60, products 25, unanswered 15.
const requiredFacts = JSON.parse(readFileSync(new URL("./fixtures/required-facts.json", import.meta.url), "utf8"));
const factsOf = () => requiredFacts[ws.industry] ?? [];
const knowledgeScore = () => {
  const facts = factsOf().map((f) => {
    const src = kbSources.find((s) => s.enabled && s.factKey === f.key);
    return { ...f, covered: Boolean(src), sourceId: src?.id ?? null };
  });
  facts.sort((a, b) => Number(a.covered) - Number(b.covered));
  const active = products.filter((p) => p.status === "active");
  const priced = active.filter((p) => p.price || p.variants.some((v) => v.price)).length;
  const inStock = active.filter((p) => p.variants.some((v) => v.stockPolicy === "unlimited" || (v.stock ?? 0) > 0)).length;
  const covered = facts.filter((f) => f.covered).length;
  const factPoints = facts.length ? Math.round((60 * covered) / facts.length) : 0;
  const productPoints = active.length ? Math.round(12.5 * (priced / active.length) + 12.5 * (inStock / active.length)) : 0;
  const open = kbUnanswered.filter((q) => q.status === "open").length;
  const unansweredPoints = Math.max(0, Math.round(15 * (1 - open / 10)));
  const suggestions = [];
  if (covered < facts.length) suggestions.push("knowledge.suggest.answer_facts");
  if (!active.length) suggestions.push("knowledge.suggest.add_products");
  else {
    if (priced < active.length) suggestions.push("knowledge.suggest.add_prices");
    if (inStock < active.length) suggestions.push("knowledge.suggest.add_stock");
  }
  if (open) suggestions.push("knowledge.suggest.answer_unanswered");
  return {
    score: factPoints + productPoints + unansweredPoints, industry: ws.industry,
    parts: [{ key: "facts", points: factPoints, max: 60 }, { key: "products", points: productPoints, max: 25 }, { key: "unanswered", points: unansweredPoints, max: 15 }],
    facts, products: { active: active.length, priced, inStock }, openUnanswered: open, suggestions,
  };
};
// The AI turns the owner's words into a customer-facing FAQ; a «بدون هوش» prefix in the answer makes the mock fall back like the backend with no model.
const draftFaq = (fact, answer) => {
  if (answer.startsWith("بدون هوش")) return { factKey: fact.key, question: fact.prompt, answer, drafted: "fallback" };
  const question = { shipping_cost: "هزینه ارسال چقدره؟", shipping_time: "کی به دستم می‌رسه؟", payment_methods: "چطور پرداخت کنم؟", return_policy: "می‌تونم پس بدم؟" }[fact.key] ?? `${fact.label} چطوره؟`;
  return { factKey: fact.key, question, answer: `${answer.replace(/[.،\s]+$/, "")}. اگر سؤال دیگری دارید، همین‌جا بپرسید 🌸`, drafted: "ai" };
};

const kbPages = { "https://niloofar.example/shipping": { title: "قوانین ارسال", body: "ارسال رایگان برای خرید بالای یک میلیون تومان. تهران یک روزه." } };
const kbIndex = (src) => {
  Object.assign(src, { status: "pending", revision: src.revision + 1, error: null, updatedAt: iso(now()) });
  setTimeout(() => {
    if (src.kind === "url") {
      const pageInfo = kbPages[src.url];
      if (!pageInfo) return Object.assign(src, { status: "failed", indexedRevision: src.revision, error: "knowledge.page_unreachable" });
      Object.assign(src, { body: pageInfo.body, title: src.titleSet ? src.title : pageInfo.title });
    }
    if (src.kind === "file") src.body ||= "متن سند: جدول سایزبندی مانتوها و شلوارها.";
    Object.assign(src, { status: "indexed", indexedRevision: src.revision, chunkCount: Math.max(1, Math.ceil(src.body.length / 400)), indexedAt: iso(now()) });
  }, 1200);
};
const imports = new Map();

/** A small stand-in for backend `FlowValidator`: enough for the editor to show errors and warnings. */
// Follow-ups (BE-1.8): scheduled by rules and flows, sent later inside the 24-hour window unless replied or bought first.
const followUpProblem = (a) =>
  !Number.isInteger(a.delaySeconds) || a.delaySeconds < 60 || a.delaySeconds > 82_800 ? ["delaySeconds", "automation.followup_delay_invalid"]
  : !a.message?.text?.trim() ? ["message", "validation.message.empty"] : null;
const followUp = (i, status, dueInMinutes, text, reason = null) => ({
  id: `0199f100-0000-7000-8000-${String(i).padStart(12, "0")}`, conversationId: conversations[i % conversations.length].id, source: i % 2 ? `flow:${randomUUID()}` : `rule:${randomUUID()}`,
  ruleId: null, flowId: null, message: { text }, dueAt: iso(new Date(Date.now() + dueInMinutes * 60_000)), cancelOnReply: true, cancelOnPurchase: i !== 3,
  status, reason, createdAt: iso(new Date(Date.now() + (dueInMinutes - 60) * 60_000)), completedAt: status === "pending" ? null : iso(new Date(Date.now() + Math.min(dueInMinutes, 0) * 60_000)),
});
let followUps = [];
const resetFollowUps = () => {
  followUps = [
    followUp(0, "pending", 45, "سلام نیلوفر جان، هنوز به مانتو کتان فکر می‌کنی؟ سایز M موجوده 🌸"),
    followUp(1, "pending", 180, "کد تخفیف ۱۰٪ شما تا امشب معتبره: NILOO10"),
    followUp(2, "sent", -120, "سفارشت ثبت شد؟ اگه سؤالی داری همین‌جا بپرس."),
    followUp(3, "cancelled", -30, "هنوز به این مدل فکر می‌کنی؟", "replied"),
    followUp(4, "cancelled", -300, "موجودی شلوار بگ جین رو برات نگه داشتیم.", "purchased"),
    followUp(5, "skipped", -1500, "سلام! پیامت رو دیدیم، جواب بدی ادامه بدیم؟", "window_closed"),
  ];
};
resetFollowUps();

const validateFlow = (graph) => {
  const errors = [];
  const warnings = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (!ids.has(graph.start)) errors.push({ code: "flow.start_missing", nodeId: null });
  for (const n of graph.nodes) {
    if ((n.type === "message" || n.type === "question") && !n.message?.text?.trim()) errors.push({ code: n.type === "message" ? "flow.message_required" : "flow.prompt_required", nodeId: n.id });
    if (n.type === "question" && !/^[a-z][a-z0-9_]{0,39}$/.test(n.variable ?? "")) errors.push({ code: "flow.variable_invalid", nodeId: n.id });
    if (n.type === "follow_gate" && !n.message?.text?.trim()) errors.push({ code: "flow.message_required", nodeId: n.id });
    if ((n.type === "follow_gate" || n.type === "question") && (n.maxRetries ?? 0) > 5) errors.push({ code: "flow.max_retries_invalid", nodeId: n.id });
    if (n.type === "action" && (n.actions ?? []).some((a) => a.kind === "schedule_followup" && followUpProblem(a))) errors.push({ code: "flow.followup_invalid", nodeId: n.id });
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
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/billing\/subscription$/, (req, res) => send(res, 200, currentPlanView())],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/billing\/plans$/, (req, res) => {
    const cur = currentSub();
    send(res, 200, salePlans.map((p) => {
      let r = quoteFor(p, "monthly");
      if (r.error === "billing.checkout.cycle_not_offered") r = quoteFor(p, "annual");
      return { plan: p, current: cur && !cur.trial ? cur.planCode === p.code : p.isFree, kind: r.quote?.kind ?? null, unavailable: r.error ?? null };
    }));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/billing\/checkout\/quote$/, async (req, res) => {
    const b = await readBody(req);
    const cycle = b.cycle ?? "monthly";
    if (!["monthly", "annual"].includes(cycle)) return problem(res, 400, "validation.failed", { cycle: ["billing.checkout.cycle_invalid"] });
    const p = salePlans.find((x) => x.id === b.planId);
    if (!p) return problem(res, 404, "billing.plan.not_found");
    const r = quoteFor(p, cycle);
    if (r.error) return problem(res, r.error.endsWith("_pending") || r.error.endsWith("managed_subscription") ? 409 : 422, r.error);
    send(res, 200, r.quote);
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/billing\/checkout$/, async (req, res) => {
    const key = req.headers["idempotency-key"];
    const seen = key && checkouts.find((c) => c.idempotencyKey === key);
    if (seen) return send(res, 201, { checkout: checkoutView(seen), paymentUrl: `http://localhost:${port}/__mock/zarinpal/${seen.authority}` });
    const b = await readBody(req);
    const cycle = b.cycle ?? "monthly";
    const p = salePlans.find((x) => x.id === b.planId);
    if (!p) return problem(res, 404, "billing.plan.not_found");
    const r = quoteFor(p, cycle);
    if (r.error) return problem(res, r.error.endsWith("_pending") || r.error.endsWith("managed_subscription") ? 409 : 422, r.error);
    const q = r.quote;
    const c = { id: randomUUID(), kind: q.kind, planId: p.id, planCode: p.code, planName: p.name, planVersion: 2, cycle, price: q.price, credit: q.credit, amount: q.amount, status: "pending", error: null, invoiceNumber: null, referenceId: null, cardMask: null, subscriptionId: null, createdBy: me.id, createdAt: iso(now()), paidAt: null, authority: `A${randomUUID().replace(/-/g, "").slice(0, 35)}`, startsAt: q.startsAt, endsAt: q.endsAt, idempotencyKey: key ?? null };
    checkouts.unshift(c);
    send(res, 201, { checkout: checkoutView(c), paymentUrl: `http://localhost:${port}/__mock/zarinpal/${c.authority}` });
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/billing\/checkouts$/, (req, res) => send(res, 200, checkouts.slice(0, 100).map(checkoutView))],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/billing\/checkouts\/([^/]+)$/, (req, res, url, [id]) => {
    const c = checkouts.find((x) => x.id === id);
    if (!c) return problem(res, 404, "common.not_found");
    send(res, 200, checkoutView(c));
  }],
  // Stand-in for Zarinpal's payment page, and the backend callback that verifies and redirects (303) to the panel's /billing.
  ["GET", /^\/__mock\/zarinpal\/([^/]+)$/, (req, res, url, [authority]) => {
    const c = checkouts.find((x) => x.authority === authority);
    if (!c) return problem(res, 404, "common.not_found");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(gatewayPage(c));
  }],
  ["GET", /^\/__mock\/zarinpal\/([^/]+)\/done$/, (req, res, url, [authority]) => {
    const c = checkouts.find((x) => x.authority === authority);
    if (!c) return problem(res, 404, "common.not_found");
    settleCheckout(c, url.searchParams.get("outcome") ?? "paid");
    res.writeHead(303, { location: `${panelUrl}/billing?checkout=${c.id}&status=${c.status}`, "cache-control": "no-store" });
    res.end();
  }],
  // Test hooks: settle a pending checkout later (Zarinpal reachable again), and start billing over (a trial of «رشد»).
  ["POST", /^\/__mock\/billing\/checkouts\/([^/]+)\/settle$/, (req, res, url, [id]) => {
    const c = checkouts.find((x) => x.id === id);
    if (!c) return problem(res, 404, "common.not_found");
    settleCheckout(c, url.searchParams.get("outcome") ?? "paid");
    send(res, 200, checkoutView(c));
  }],
  ["POST", /^\/__mock\/billing\/reset$/, (req, res) => {
    resetBilling();
    send(res, 204);
  }],
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
  // Web push (BE-1.14): per user, one row per browser.
  ["GET", /^\/api\/v1\/me\/push\/key$/, (req, res) => send(res, 200, { publicKey: "BNbxGYNMhEIi9zrneh7mqV4EUanjLUK3m-mYZBc62frMKrEoMk88r3Lk596T0ck9xlT-mWHVbdkB_3zPxTzBO0E" })],
  ["GET", /^\/api\/v1\/me\/push-subscriptions$/, (req, res) => send(res, 200, pushSubscriptions)],
  ["PUT", /^\/api\/v1\/me\/push-subscriptions$/, async (req, res) => {
    const body = await readBody(req);
    if (!/^https:\/\//.test(body.endpoint ?? "")) return problem(res, 400, "validation.failed", { endpoint: ["validation.push.endpoint"] });
    let row = pushSubscriptions.find((x) => x.endpoint === body.endpoint);
    if (!row) pushSubscriptions.push((row = { id: randomUUID(), endpoint: body.endpoint, userAgent: req.headers["user-agent"] ?? null, createdAt: iso(now()), lastDeliveredAt: null }));
    send(res, 200, row);
  }],
  ["DELETE", /^\/api\/v1\/me\/push-subscriptions$/, (req, res, url) => {
    const i = pushSubscriptions.findIndex((x) => x.endpoint === url.searchParams.get("endpoint"));
    if (i >= 0) pushSubscriptions.splice(i, 1);
    send(res, 204);
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
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/automation\/followups$/, (req, res, url) => {
    const status = url.searchParams.get("Status");
    const conversationId = url.searchParams.get("ConversationId");
    const limit = Math.min(200, Number(url.searchParams.get("Limit") ?? 50));
    const list = followUps.filter((f) => (!status || f.status === status) && (!conversationId || f.conversationId === conversationId));
    list.sort((a, b) => (status === "pending" ? a.dueAt.localeCompare(b.dueAt) : b.createdAt.localeCompare(a.createdAt)));
    send(res, 200, list.slice(0, limit));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/automation\/followups\/([^/]+)\/cancel$/, (req, res, url, [id]) => {
    const f = followUps.find((x) => x.id === id);
    if (!f) return problem(res, 404, "common.not_found");
    if (f.status !== "pending") return problem(res, 409, "automation.followup_not_pending");
    Object.assign(f, { status: "cancelled", reason: "owner", completedAt: iso(now()) });
    send(res, 200, f);
  }],
  ["POST", /^\/__mock\/followups\/reset$/, (req, res) => {
    resetFollowUps();
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/automation\/rules$/, (req, res) => send(res, 200, rules)],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/automation\/rules$/, async (req, res) => {
    const body = await readBody(req);
    if (["dm_keyword", "comment_keyword"].includes(body.triggerKind) && !body.trigger?.keywords?.length && !body.trigger?.pattern)
      return problem(res, 400, "validation.failed", { "trigger.keywords": ["automation.keywords_required"] });
    const fu = (body.actions ?? []).map((a, i) => [a, i]).filter(([a]) => a.kind === "schedule_followup");
    if (fu.length > 1) return problem(res, 400, "validation.failed", { actions: ["automation.one_followup"] });
    for (const [a, i] of fu) {
      const bad = followUpProblem(a);
      if (bad) return problem(res, 400, "validation.failed", { [`actions[${i}].${bad[0]}`]: [bad[1]] });
    }
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
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/price-changes\/preview$/, async (req, res) => {
    const parsed = parsePriceChange(await readBody(req));
    if (parsed.errors) return problem(res, 400, "validation.failed", parsed.errors);
    const plan = planPriceChange(parsed);
    if (plan.matched.length > 5000) return problem(res, 422, "catalog.price_change_too_large");
    send(res, 200, { fingerprint: plan.fingerprint, productCount: new Set(plan.items.map((i) => i.productId)).size, priceCount: plan.items.length, items: plan.items, invalid: plan.invalid });
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/price-changes$/, async (req, res) => {
    const body = await readBody(req);
    const parsed = parsePriceChange(body);
    if (parsed.errors) return problem(res, 400, "validation.failed", parsed.errors);
    const plan = planPriceChange(parsed);
    if (body.fingerprint && body.fingerprint !== plan.fingerprint) return problem(res, 409, "catalog.price_change_stale");
    if (plan.invalid.length) return problem(res, 422, "catalog.price_change_below_zero");
    if (!plan.items.length) return problem(res, 422, "catalog.price_change_empty");
    for (const i of plan.items) setOwnPrice(products.find((p) => p.id === i.productId), i.variantId, i.newPrice.amount);
    const { rule } = parsed;
    const batch = {
      id: randomUUID(), scope: parsed.scope, kind: rule.kind, percent: rule.kind === "percent" ? rule.value : null, amount: rule.kind === "amount" ? { amount: rule.value, currency: "IRR" } : null,
      roundTo: rule.roundTo, roundMode: rule.roundMode, productCount: new Set(plan.items.map((i) => i.productId)).size, priceCount: plan.items.length,
      createdBy: me.id, createdAt: iso(now()), undoneAt: null, undoneBy: null, undoSkipped: 0, items: plan.items,
    };
    priceChanges.unshift(batch);
    send(res, 201, batchView(batch, true));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/price-changes$/, (req, res) => send(res, 200, priceChanges.slice(0, 50).map((b) => batchView(b, false)))],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/price-changes\/([^/]+)$/, (req, res, url, [id]) => {
    const b = priceChanges.find((x) => x.id === id);
    return b ? send(res, 200, batchView(b, true)) : problem(res, 404, "common.not_found");
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/catalog\/price-changes\/([^/]+)\/undo$/, (req, res, url, [id]) => {
    const b = priceChanges.find((x) => x.id === id);
    if (!b) return problem(res, 404, "common.not_found");
    if (b.undoneAt) return problem(res, 409, "catalog.price_change_undone");
    if (!batchView(b, false).canUndo) return problem(res, 409, "catalog.price_change_undo_expired");
    let skipped = 0;
    for (const i of b.items) {
      const p = products.find((x) => x.id === i.productId);
      if (p && ownPrice(p, i.variantId)?.amount === i.newPrice.amount) setOwnPrice(p, i.variantId, i.oldPrice.amount);
      else skipped++;
    }
    Object.assign(b, { undoneAt: iso(now()), undoneBy: me.id, undoSkipped: skipped });
    send(res, 200, batchView(b, true));
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
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/score$/, (req, res) => send(res, 200, knowledgeScore())],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/onboarding\/draft$/, async (req, res) => {
    const b = await readBody(req);
    const fact = factsOf().find((f) => f.key === b.factKey);
    if (!fact) return problem(res, 422, "knowledge.fact_unknown");
    if (!b.answer?.trim() || b.answer.length > 1000) return problem(res, 400, "validation.failed", { answer: ["validation.knowledge.answer"] });
    send(res, 200, draftFaq(fact, b.answer.trim()));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/onboarding\/confirm$/, async (req, res) => {
    const b = await readBody(req);
    const fact = factsOf().find((f) => f.key === b.factKey);
    if (!fact) return problem(res, 422, "knowledge.fact_unknown");
    if (!b.question?.trim() || !b.answer?.trim()) return problem(res, 400, "validation.failed", { answer: ["validation.knowledge.answer"] });
    let src = kbSources.find((s) => s.kind === "faq" && s.factKey === fact.key);
    if (src) Object.assign(src, { title: b.question, question: b.question, body: b.answer, enabled: true, revision: src.revision + 1, updatedAt: iso(now()) });
    else kbSources.unshift((src = kbSource("faq", b.question, b.answer, { factKey: fact.key, createdAt: iso(now()), updatedAt: iso(now()) })));
    send(res, 200, { source: src, score: knowledgeScore() });
  }],
  ["POST", /^\/__mock\/knowledge\/reset-facts$/, (req, res) => {
    kbSources = kbSources.filter((s) => !s.factKey || s.factKey === "shipping_time");
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/templates$/, (req, res) => {
    const list = seedTemplates.map(templateSummary);
    send(res, 200, [...list.filter((x) => x.recommended), ...list.filter((x) => !x.recommended)]);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/templates\/applications$/, (req, res) => send(res, 200, templateApplications.slice(0, 50).map((a) => ({ ...a, idempotencyKey: undefined })))],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/templates\/([^/]+)$/, (req, res, url, [id]) => {
    const x = seedTemplates.find((t) => t.id === id);
    if (!x) return problem(res, 404, "common.not_found");
    send(res, 200, { template: templateSummary(x), requiredFacts: x.requiredFacts, faqs: x.faqs, flows: x.flows, rules: x.rules, agentProfile: x.agentProfile ?? null });
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/templates\/([^/]+)\/apply$/, (req, res, url, [id]) => {
    const x = seedTemplates.find((t) => t.id === id);
    if (!x) return problem(res, 404, "common.not_found");
    const key = req.headers["idempotency-key"];
    const seen = key && templateApplications.find((a) => a.idempotencyKey === key);
    if (seen) return send(res, 200, { ...seen, idempotencyKey: undefined });
    const app = applyTemplate(x);
    app.idempotencyKey = key ?? null;
    send(res, 200, { ...app, idempotencyKey: undefined });
  }],
  // Test hook: forget every apply.
  ["POST", /^\/__mock\/templates\/reset$/, (req, res) => {
    templateApplications = [];
    templateKeys = new Set();
    agentProfileSet = false;
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/payments\/merchant-account$/, (req, res) => send(res, 200, merchant)],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/payments\/merchant-account$/, async (req, res) => {
    const b = await readBody(req);
    if (b.merchantId != null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.merchantId)) return problem(res, 400, "payments.merchant_id_invalid", { merchantId: ["payments.merchant_id_invalid"] });
    if (b.merchantId == null && !merchant.configured) return problem(res, 400, "payments.merchant_id_required", { merchantId: ["payments.merchant_id_required"] });
    merchant = { configured: true, provider: "zarinpal", merchantIdHint: b.merchantId ? b.merchantId.slice(-4) : merchant.merchantIdHint, sandbox: Boolean(b.sandbox), enabled: b.enabled !== false, updatedAt: iso(now()) };
    send(res, 200, merchant);
  }],
  ["DELETE", /^\/api\/v1\/workspaces\/[^/]+\/payments\/merchant-account$/, (req, res) => {
    merchant = { configured: false, provider: null, merchantIdHint: null, sandbox: false, enabled: true, updatedAt: null };
    for (const l of paymentLinks) if (l.status === "active") l.status = "cancelled";
    send(res, 204);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/orders\/([^/]+)\/payment-links$/, (req, res, url, [id]) => {
    if (!orders.some((o) => o.id === id)) return problem(res, 404, "common.not_found");
    send(res, 200, paymentLinks.filter((l) => l.orderId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/orders\/([^/]+)\/payment-links$/, (req, res, url, [id]) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return problem(res, 404, "common.not_found");
    if (!merchant.configured || !merchant.enabled) return problem(res, 422, "payments.merchant_missing");
    if (!["draft", "awaiting_payment"].includes(o.status)) return problem(res, 409, "orders.not_payable");
    const total = orderView(o).total;
    if (!o.items.length || total.amount <= 0) return problem(res, 400, "orders.incomplete", { items: ["orders.incomplete"] });
    if (o.status === "draft") {
      Object.assign(o, { status: "awaiting_payment", revision: o.revision + 1, updatedAt: iso(now()) });
      addOrderEvent(o, "status_changed", "user", { fromStatus: "draft" });
    }
    expirePaymentLinks(o.id);
    const token = randomUUID().replace(/-/g, "");
    const link = { id: randomUUID(), orderId: o.id, orderNumber: o.number, url: `https://pay.pishkhan.example/pay/${token}`, amount: total, provider: "zarinpal", status: "active", attempts: 0, lastError: null, expiresAt: iso(new Date(Date.now() + 3 * 24 * H)), createdAt: iso(now()), paidAt: null, referenceId: null, cardMask: null };
    paymentLinks.push(link);
    send(res, 201, link);
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/payment-links\/([^/]+)\/cancel$/, (req, res, url, [id]) => {
    const l = paymentLinks.find((x) => x.id === id);
    if (!l) return problem(res, 404, "common.not_found");
    if (l.status !== "active") return problem(res, 409, "payments.link_not_active");
    l.status = "cancelled";
    send(res, 200, l);
  }],
  // Test hook: the customer pays the order's active link at Zarinpal (the backend's verified callback).
  ["POST", /^\/__mock\/orders\/([^/]+)\/pay$/, (req, res, url, [orderId]) => {
    const l = paymentLinks.find((x) => x.orderId === orderId && x.status === "active");
    const o = orders.find((x) => x.id === orderId);
    if (!l || !o) return problem(res, 404, "common.not_found");
    Object.assign(l, { status: "paid", attempts: l.attempts + 1, paidAt: iso(now()), referenceId: "50123456", cardMask: "6037-99**-****-1234" });
    Object.assign(o, { status: "paid", paidAt: iso(now()), revision: o.revision + 1, updatedAt: iso(now()) });
    addOrderEvent(o, "status_changed", "system", { fromStatus: "awaiting_payment", note: "پرداخت زرین‌پال، کد پیگیری ۵۰۱۲۳۴۵۶" });
    send(res, 200, l);
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/orders\/provinces$/, (req, res) => send(res, 200, provinces)],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/orders\/parse-address$/, async (req, res) => {
    const { text } = await readBody(req);
    if (!text?.trim()) return problem(res, 400, "validation.failed", { text: ["orders.address_invalid"] });
    const latin = text.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
    const prov = provinces.find((p) => latin.includes(p.name) || p.cities.some((c) => latin.includes(c)));
    const city = prov?.cities.find((c) => latin.includes(c)) ?? null;
    const postal = /\b\d{10}\b/.exec(latin.replace(/09\d{9}/, ""))?.[0] ?? null;
    const mobile = /09\d{9}/.exec(latin)?.[0] ?? null;
    let line = latin;
    for (const part of [prov?.name, city, postal, mobile, "کد پستی", "استان", "شهر"]) if (part) line = line.replace(part, " ");
    send(res, 200, { provinceCode: prov?.code ?? null, province: prov?.name ?? null, city, postalCode: postal, mobile: mobile ? `+98${mobile.slice(1)}` : null, line: line.replace(/[،,:\s]+/g, " ").trim() });
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/orders$/, (req, res, url) => {
    const q = url.searchParams;
    const statuses = q.getAll("status");
    let items = orders.filter((o) => (!statuses.length || statuses.includes(o.status)) && (!q.get("contactId") || o.contactId === q.get("contactId")) && (!q.get("conversationId") || o.conversationId === q.get("conversationId")) && (!q.get("number") || String(o.number) === q.get("number")));
    if (q.get("phone")) items = items.filter((o) => o.phone === `+98${q.get("phone").replace(/\D/g, "").replace(/^0/, "")}`);
    const result = page(items, q.get("cursor"), Number(q.get("limit") ?? 30));
    send(res, 200, { ...result, items: result.items.map(orderView) });
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/orders$/, async (req, res) => {
    const b = await readBody(req);
    const errors = {};
    const [items, lineErrors] = priceOrderLines(b.items);
    Object.assign(errors, lineErrors);
    const address = orderAddress(b.address, errors);
    const phone = orderPhone(b.phone, errors);
    const conv = b.conversationId ? conversations.find((c) => c.id === b.conversationId) : null;
    if (b.conversationId && !conv) errors.conversationId = ["orders.conversation_not_found"];
    if (Object.keys(errors).length) return problem(res, 400, Object.values(errors)[0][0], errors);
    const o = { id: randomUUID(), number: ++orderSeq, source: "panel", status: "draft", contactId: conv?.contactId ?? b.contactId ?? null, conversationId: conv?.id ?? null, customerName: b.customerName ?? null, phone, address, items, shippingFee: b.shippingFee ?? money(0), discount: b.discount ?? money(0), note: b.note ?? null, revision: 1, createdAt: iso(now()), updatedAt: iso(now()), paidAt: null, closedAt: null };
    orders.unshift(o);
    addOrderEvent(o, "created", "user");
    send(res, 201, orderView(o));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/orders\/([^/]+)$/, (req, res, url, [id]) => {
    const o = orders.find((x) => x.id === id);
    return o ? send(res, 200, orderView(o)) : problem(res, 404, "common.not_found");
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/orders\/([^/]+)$/, async (req, res, url, [id]) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return problem(res, 404, "common.not_found");
    if (o.status !== "draft") return problem(res, 409, "orders.not_editable");
    const b = await readBody(req);
    const errors = {};
    const [items, lineErrors] = priceOrderLines(b.items);
    Object.assign(errors, lineErrors);
    const address = orderAddress(b.address, errors);
    const phone = orderPhone(b.phone, errors);
    if (Object.keys(errors).length) return problem(res, 400, Object.values(errors)[0][0], errors);
    Object.assign(o, { items, address, phone, customerName: b.customerName ?? null, shippingFee: b.shippingFee ?? money(0), discount: b.discount ?? money(0), note: b.note ?? null, revision: o.revision + 1, updatedAt: iso(now()) });
    addOrderEvent(o, "edited", "user");
    send(res, 200, orderView(o));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/orders\/([^/]+)\/status$/, async (req, res, url, [id]) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return problem(res, 404, "common.not_found");
    const b = await readBody(req);
    if (!orderNext[b.status]) return problem(res, 400, "orders.status_unknown", { status: ["orders.status_unknown"] });
    if (b.status === "awaiting_payment") {
      const missing = [o.items.length ? null : "items", orderView(o).total.amount > 0 ? null : "total"].filter(Boolean);
      if (missing.length) return problem(res, 400, "orders.incomplete", Object.fromEntries(missing.map((m) => [m, ["orders.incomplete"]])));
    }
    if (!orderNext[o.status].includes(b.status)) return problem(res, 409, "orders.status_move_invalid");
    const from = o.status;
    if (from === "awaiting_payment") expirePaymentLinks(o.id);
    Object.assign(o, { status: b.status, revision: o.revision + 1, updatedAt: iso(now()), ...(b.status === "paid" ? { paidAt: iso(now()) } : {}), ...(["cancelled", "refunded", "completed"].includes(b.status) ? { closedAt: iso(now()) } : {}) });
    addOrderEvent(o, "status_changed", "user", { fromStatus: from, note: b.note ?? null });
    send(res, 200, orderView(o));
  }],
  ["POST", /^\/api\/v1\/workspaces\/[^/]+\/orders\/([^/]+)\/notes$/, async (req, res, url, [id]) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return problem(res, 404, "common.not_found");
    const { note } = await readBody(req);
    if (!note?.trim()) return problem(res, 400, "orders.note_invalid", { note: ["orders.note_invalid"] });
    addOrderEvent(o, "note", "user", { note: note.trim() });
    send(res, 201, orderEvents.get(o.id).at(-1));
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/orders\/([^/]+)\/timeline$/, (req, res, url, [id]) => {
    const o = orders.find((x) => x.id === id);
    return o ? send(res, 200, orderEvents.get(o.id) ?? []) : problem(res, 404, "common.not_found");
  }],
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/orders\/([^/]+)\/invoice$/, (req, res, url, [id]) => {
    const found = orders.find((x) => x.id === id);
    if (!found) return problem(res, 404, "common.not_found");
    const o = orderView(found);
    const addr = o.address ? [o.address.province, o.address.city !== o.address.province ? o.address.city : null, o.address.line].filter(Boolean).join("، ") : null;
    send(res, 200, {
      orderId: o.id, number: o.number, numberText: faDigits(o.number), date: "۱۴۰۵/۰۸/۱۰", dateLong: "۱۰ آبان ۱۴۰۵", status: o.status, statusText: orderStatusFa[o.status],
      customerName: o.customerName, phone: o.phone ? faDigits(`0${o.phone.slice(3)}`) : null, address: addr, postalCode: o.address?.postalCode ? faDigits(o.address.postalCode) : null,
      lines: o.items.map((l) => ({ title: l.title, variantLabel: l.variantLabel, quantity: faDigits(l.quantity), unitPrice: faToman(l.unitPrice.amount), lineTotal: faToman(l.lineTotal.amount) })),
      subtotal: faToman(o.subtotal.amount), shippingFee: faToman(o.shippingFee.amount), discount: faToman(o.discount.amount), total: faToman(o.total.amount), totalAmount: o.total, paidDate: o.paidAt ? "۸ آبان ۱۴۰۵" : null,
    });
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
    if (b.kind === "file" || b.kind === "url") {
      const file = b.kind === "file" ? files.get(b.fileId) : null;
      if (b.kind === "file" && (!file || file.status !== "clean" || file.purpose !== "knowledge_document")) return problem(res, 400, "validation.failed", { fileId: ["validation.knowledge.file"] });
      if (b.kind === "url" && !/^https:\/\/[^/]+\.[^/]+/.test(b.url ?? "")) return problem(res, 400, "validation.failed", { url: ["validation.knowledge.url"] });
      const title = b.title?.trim() || (b.kind === "file" ? "سند" : new URL(b.url).host);
      const src = kbSource(b.kind, title, "", { revision: 0, createdAt: iso(now()), fileId: file?.id ?? null, url: b.url ?? null, titleSet: Boolean(b.title?.trim()) });
      kbSources.unshift(src);
      kbIndex(src);
      return send(res, 201, src);
    }
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
  ["GET", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/sources\/([^/]+)$/, (req, res, url, [id]) => {
    const src = kbSources.find((x) => x.id === id);
    return src ? send(res, 200, src) : problem(res, 404, "common.not_found");
  }],
  ["PUT", /^\/api\/v1\/workspaces\/[^/]+\/knowledge\/sources\/([^/]+)$/, async (req, res, url, [id]) => {
    const src = kbSources.find((x) => x.id === id);
    if (!src) return problem(res, 404, "common.not_found");
    const b = await readBody(req);
    const edits = b.title ?? b.question ?? b.answer ?? b.body;
    if (src.kind === "product" && edits != null) return problem(res, 400, "validation.failed", { kind: ["validation.knowledge.product_managed"] });
    if (b.enabled != null) src.enabled = b.enabled;
    if (src.kind === "file" || src.kind === "url") {
      if (b.question != null || b.answer != null || b.body != null) return problem(res, 400, "validation.failed", { body: ["validation.knowledge.extracted"] });
      if (b.url != null && !/^https:\/\/[^/]+\.[^/]+/.test(b.url)) return problem(res, 400, "validation.failed", { url: ["validation.knowledge.url"] });
      if (b.title != null) Object.assign(src, { title: b.title.trim(), titleSet: true });
      if (b.url != null && b.url !== src.url) {
        src.url = b.url;
        kbIndex(src);
      } else src.updatedAt = iso(now());
      return send(res, 200, src);
    }
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

const anonymous = [/^\/__mock\//, /^\/files\/exports\//, /^\/api\/v1\/public\//, /^\/api\/v1\/auth\/(otp|token)\//, /^\/api\/v1\/auth\/support-session$/];

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

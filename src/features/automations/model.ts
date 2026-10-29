import type { ActionKind, MessageButton, OutboundContent, RuleAction } from "@/lib/api/types";
import { commentTriggers } from "@/lib/api/types";

export const MAX_ACTIONS = 10;
export const MAX_PUBLIC_REPLIES = 20;

/** Instagram limits mirrored from backend `MessageValidator`. */
export const messageLimits = { text: 1000, textWithButtons: 640, buttons: 3, quickReplies: 13, title: 20 } as const;

export const baseVariables = ["contact.first_name", "contact.name", "contact.username"] as const;
export const commentVariables = ["comment.username", "comment.text"] as const;

export function emptyMessage(): OutboundContent {
  return { text: "" };
}

/** Client checks matching `MessageValidator`; returns a key under `errors.automation.message`, or null. */
export function messageProblem(m: OutboundContent | null | undefined): string | null {
  if (!m || (!m.text?.trim() && !m.attachment && !m.cards?.length)) return "empty";
  const buttons = m.buttons ?? [];
  if ((m.text?.length ?? 0) > (buttons.length ? messageLimits.textWithButtons : messageLimits.text)) return "textLength";
  if ((m.quickReplies ?? []).some((q) => !q.title.trim() || q.title.length > messageLimits.title)) return "quickReplies";
  if (buttons.some((b) => !b.title.trim() || b.title.length > messageLimits.title || (b.type === "web_url" ? !/^https:\/\/\S+$/i.test(b.url ?? "") : !b.payload?.trim())))
    return "buttons";
  return null;
}

/** Normalizes a builder value before it is sent: empty lists dropped, quick-reply payloads default to their title. */
export function cleanMessage(m: OutboundContent): OutboundContent {
  const quick = (m.quickReplies ?? []).filter((q) => q.title.trim()).map((q) => ({ title: q.title.trim(), payload: q.payload?.trim() || q.title.trim() }));
  const buttons = (m.buttons ?? [])
    .filter((b) => b.title.trim())
    .map((b): MessageButton => (b.type === "web_url" ? { type: "web_url", title: b.title.trim(), url: b.url?.trim() ?? null } : { type: "postback", title: b.title.trim(), payload: b.payload?.trim() || b.title.trim() }));
  return {
    text: m.text ?? "",
    ...(m.attachment ? { attachment: m.attachment } : {}),
    ...(quick.length ? { quickReplies: quick } : {}),
    ...(buttons.length ? { buttons } : {}),
    ...(m.cards?.length ? { cards: m.cards } : {}),
  };
}

const sampleValues: Record<string, string> = {
  "contact.first_name": "سارا",
  "contact.name": "سارا محمدی",
  "contact.username": "sara.m",
  "comment.username": "sara.m",
  "comment.text": "قیمت؟",
};

/** Fills {{name}} and {{name|fallback}} like backend `TemplateRenderer`, with sample values for the preview. */
export function renderSample(text: string): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|([^}]*))?\}\}/g, (_, name: string, fallback?: string) => sampleValues[name] ?? (fallback?.trim() || `«${name.replace(/^flow\./, "")}»`));
}

/**
 * Actions a trigger may use (backend `RuleValidator`): a commenter has no conversation yet, so comment rules reach the DM
 * only through one private reply; DM rules cannot reply to comments.
 */
export function allowedActions(triggerKind: string): ActionKind[] {
  const comment = commentTriggers.includes(triggerKind);
  const common: ActionKind[] = ["add_tag", "remove_tag", "set_field", "handoff", "pause_ai", "notify_team"];
  return comment ? ["private_reply", "public_reply", ...common] : ["send_message", "send_cards", "start_flow", ...common];
}

export function newAction(kind: ActionKind): RuleAction {
  switch (kind) {
    case "send_message":
    case "private_reply":
      return { kind, message: emptyMessage() };
    case "public_reply":
      return { kind, replies: [""] };
    default:
      return { kind };
  }
}


import type { ActionKind, MessageButton, OutboundContent, RuleAction } from "@/lib/api/types";
import { commentTriggers } from "@/lib/api/types";

export const MAX_ACTIONS = 10;

/** Follow-ups must fit inside Meta's 24-hour window (backend `FollowUps.MinDelaySeconds`/`MaxDelaySeconds`). */
export const FOLLOWUP_MIN_SECONDS = 60;
export const FOLLOWUP_MAX_SECONDS = 23 * 3600;
export const FOLLOWUP_DEFAULT_SECONDS = 3600;

export function followUpDelayValid(seconds: number | null | undefined): boolean {
  return typeof seconds === "number" && Number.isInteger(seconds) && seconds >= FOLLOWUP_MIN_SECONDS && seconds <= FOLLOWUP_MAX_SECONDS;
}

/** A delay as minutes or hours for the picker: whole hours show as hours. */
export function splitFollowUpDelay(seconds: number): { amount: number; unit: "minutes" | "hours" } {
  return seconds % 3600 === 0 ? { amount: seconds / 3600, unit: "hours" } : { amount: Math.round(seconds / 60), unit: "minutes" };
}

/** Picker value to seconds, clamped to 1 minute … 23 hours. */
export function followUpSeconds(amount: number, unit: "minutes" | "hours"): number {
  const raw = Math.round(amount) * (unit === "hours" ? 3600 : 60);
  return Math.max(FOLLOWUP_MIN_SECONDS, Math.min(FOLLOWUP_MAX_SECONDS, raw));
}
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
  return comment ? ["private_reply", "public_reply", ...common] : ["send_message", "send_cards", "start_flow", "schedule_followup", ...common];
}

export function newAction(kind: ActionKind): RuleAction {
  switch (kind) {
    case "send_message":
    case "private_reply":
      return { kind, message: emptyMessage() };
    case "public_reply":
      return { kind, replies: [""] };
    case "schedule_followup":
      return { kind, message: emptyMessage(), delaySeconds: FOLLOWUP_DEFAULT_SECONDS, cancelOnReply: true, cancelOnPurchase: true };
    default:
      return { kind };
  }
}


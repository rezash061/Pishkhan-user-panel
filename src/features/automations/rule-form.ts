import type { CommentScope, MatchMode, Rule, RuleAction, RuleRequest, TriggerConfig, TriggerKind } from "@/lib/api/types";
import { commentTriggers } from "@/lib/api/types";
import { compilePattern, isUsableKeyword } from "@/lib/persian/keywords";
import { allowedActions, cleanMessage, MAX_ACTIONS, MAX_PUBLIC_REPLIES, messageProblem } from "./model";

/** Editor state for a rule. Converted to the backend `RuleRequest` only on save. */
export interface RuleForm {
  name: string;
  channelAccountId: string | null;
  triggerKind: TriggerKind;
  match: MatchMode;
  keywords: string[];
  pattern: string;
  scope: CommentScope;
  postId: string | null;
  payload: string;
  cooldownMinutes: number | null;
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
}

export const keywordsRequired = (kind: string) => kind === "dm_keyword" || kind === "comment_keyword";
export const keywordsAllowed = (kind: string) => keywordsRequired(kind) || kind === "story_reply" || kind === "live_comment";
export const isCommentTrigger = (kind: string) => commentTriggers.includes(kind);
/** Live comments have no post to pick (they belong to the live broadcast). */
export const hasPostScope = (kind: string) => kind === "comment_keyword" || kind === "comment_any";

export function emptyRuleForm(triggerKind: TriggerKind = "dm_keyword"): RuleForm {
  return {
    name: "",
    channelAccountId: null,
    triggerKind,
    match: "contains",
    keywords: [],
    pattern: "",
    scope: "all",
    postId: null,
    payload: "",
    cooldownMinutes: null,
    actions: [],
    priority: 0,
    enabled: true,
  };
}

export function formFromRule(rule: Rule): RuleForm {
  const t = rule.trigger;
  return {
    name: rule.name,
    channelAccountId: rule.channelAccountId,
    triggerKind: rule.triggerKind as TriggerKind,
    match: (t.match as MatchMode | null) ?? "contains",
    keywords: t.keywords ?? [],
    pattern: t.pattern ?? "",
    scope: (t.scope as CommentScope | null) ?? "all",
    postId: t.postId ?? null,
    payload: t.payload ?? "",
    cooldownMinutes: t.cooldownMinutes === null || t.cooldownMinutes === undefined ? null : Number(t.cooldownMinutes),
    actions: rule.actions,
    priority: Number(rule.priority),
    enabled: rule.enabled,
  };
}

/** Keeps actions valid for a new trigger: drops the ones it cannot use, so switching DM ↔ comment does not leave errors behind. */
export function withTrigger(form: RuleForm, triggerKind: TriggerKind): RuleForm {
  const allowed = allowedActions(triggerKind);
  const actions = form.actions
    .filter((a) => allowed.includes(a.kind as never))
    .concat(
      // A DM message becomes the private reply (and back), so the text the seller wrote survives the switch.
      form.actions
        .filter((a) => !allowed.includes(a.kind as never) && (a.kind === "send_message" || a.kind === "private_reply"))
        .map((a) => ({ ...a, kind: a.kind === "send_message" ? "private_reply" : "send_message" }))
        .filter((a) => allowed.includes(a.kind as never)),
    );
  return { ...form, triggerKind, actions };
}

export function ruleRequestFromForm(f: RuleForm): RuleRequest {
  const trigger: TriggerConfig = {};
  if (keywordsAllowed(f.triggerKind)) {
    const hasKeywords = f.match === "pattern" ? f.pattern.trim() !== "" : f.keywords.length > 0;
    if (hasKeywords) {
      trigger.match = f.match;
      if (f.match === "pattern") trigger.pattern = f.pattern.trim();
      else trigger.keywords = f.keywords.map((k) => k.trim()).filter(Boolean);
    }
  }
  if (isCommentTrigger(f.triggerKind)) {
    const scope = hasPostScope(f.triggerKind) ? f.scope : "all";
    trigger.scope = scope;
    if (scope === "post") trigger.postId = f.postId;
  }
  if (f.triggerKind === "postback") trigger.payload = f.payload.trim();
  if (f.cooldownMinutes !== null && f.cooldownMinutes > 0) trigger.cooldownMinutes = f.cooldownMinutes;

  const actions = f.actions.map((a): RuleAction => {
    switch (a.kind) {
      case "send_message":
      case "private_reply":
        return { kind: a.kind, message: a.message ? cleanMessage(a.message) : null };
      case "public_reply":
        return { kind: a.kind, replies: (a.replies ?? []).map((r) => r.trim()).filter(Boolean) };
      case "send_cards":
        return { kind: a.kind, cardSetId: a.cardSetId ?? null };
      case "start_flow":
        return { kind: a.kind, flowId: a.flowId ?? null };
      case "add_tag":
      case "remove_tag":
        return { kind: a.kind, tag: a.tag?.trim() ?? null };
      case "set_field":
        return { kind: a.kind, field: a.field?.trim() ?? null, value: a.value ?? null };
      case "handoff":
        return { kind: a.kind, reason: a.reason?.trim() || null };
      case "notify_team":
        return { kind: a.kind, title: a.title?.trim() || null };
      default:
        return { kind: a.kind };
    }
  });

  return {
    name: f.name.trim(),
    channelAccountId: f.channelAccountId,
    triggerKind: f.triggerKind,
    trigger,
    actions,
    priority: f.priority,
    enabled: f.enabled,
  };
}

/**
 * The backend's `RuleValidator` checks, run before saving so the seller sees problems next to the field. Values are the
 * backend's own codes (one Persian catalog for both). The server still validates.
 */
export function ruleProblems(f: RuleForm): Record<string, string> {
  const p: Record<string, string> = {};
  if (!f.name.trim() || f.name.trim().length > 100) p.name = "validation.name.length";

  const usesPattern = f.match === "pattern";
  const hasKeywords = usesPattern ? f.pattern.trim() !== "" : f.keywords.length > 0;
  if (keywordsRequired(f.triggerKind) && !hasKeywords) p["trigger.keywords"] = "automation.keywords_required";
  if (hasKeywords && keywordsAllowed(f.triggerKind)) {
    if (usesPattern && compilePattern(f.pattern) === null) p["trigger.pattern"] = "automation.pattern_invalid";
    if (!usesPattern && (f.keywords.length > 50 || f.keywords.some((k) => !isUsableKeyword(k)))) p["trigger.keywords"] = "automation.keywords_invalid";
  }
  if (hasPostScope(f.triggerKind)) {
    if (f.scope === "post" && !f.postId) p["trigger.postId"] = "automation.post_required";
    if (f.scope !== "all" && !f.channelAccountId) p.channelAccountId = "automation.channel_required";
  }
  if (f.triggerKind === "postback" && !f.payload.trim()) p["trigger.payload"] = "automation.payload_required";

  if (f.actions.length === 0 || f.actions.length > MAX_ACTIONS) p.actions = "automation.actions_count";
  const allowed = allowedActions(f.triggerKind);
  f.actions.forEach((a, i) => {
    const at = `actions[${i}]`;
    if (!allowed.includes(a.kind as never)) p[at] = isCommentTrigger(f.triggerKind) ? "automation.action_needs_conversation" : "automation.action_needs_comment";
    if (a.kind === "send_message" || a.kind === "private_reply") {
      const problem = messageProblem(a.message);
      if (problem) p[`${at}.message`] = `automation.message.${problem}`;
    }
    if (a.kind === "public_reply") {
      const replies = (a.replies ?? []).filter((r) => r.trim());
      if (!replies.length || replies.length > MAX_PUBLIC_REPLIES || replies.some((r) => r.length > 300)) p[`${at}.replies`] = "automation.replies_invalid";
    }
    if (a.kind === "send_cards" && !a.cardSetId) p[`${at}.cardSetId`] = "automation.card_set_required";
    if (a.kind === "start_flow" && !a.flowId) p[`${at}.flowId`] = "automation.flow_required";
    if ((a.kind === "add_tag" || a.kind === "remove_tag") && (!a.tag?.trim() || a.tag.length > 50)) p[`${at}.tag`] = "automation.tag_invalid";
    if (a.kind === "set_field" && (!a.field?.trim() || a.field.length > 40)) p[`${at}.field`] = "automation.field_invalid";
  });
  return p;
}

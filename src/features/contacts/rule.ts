import type { SegmentCondition, SegmentRule } from "@/lib/api/types";

/** Condition fields and their operators, mirroring the backend's segment SQL builder (BE-1.7). */
export const conditionFields = ["tag", "field", "name", "username", "channel_account", "last_seen", "created", "has_phone", "consent"] as const;
export type ConditionField = (typeof conditionFields)[number];

export const opsByField: Record<ConditionField, readonly string[]> = {
  tag: ["has", "not_has"],
  field: ["eq", "neq", "contains", "exists", "not_exists", "gt", "lt"],
  name: ["contains", "exists", "not_exists"],
  username: ["contains", "exists", "not_exists"],
  channel_account: ["eq", "neq"],
  last_seen: ["within_days", "not_within_days"],
  created: ["within_days", "not_within_days"],
  has_phone: ["is"],
  consent: ["granted", "not_granted"],
};

export const MAX_CONDITIONS = 20;

/** What the value box needs: nothing, text, a number of days, a yes/no, a tag, a channel or a consent channel. */
export type ValueKind = "none" | "text" | "days" | "boolean" | "tag" | "channel" | "consent";

/** Consent channels the backend records (sms, phone call, Bale). */
export const consentValues = ["sms", "phone", "bale"] as const;

export function valueKind(c: Pick<SegmentCondition, "field" | "op">): ValueKind {
  if (c.op === "exists" || c.op === "not_exists") return "none";
  switch (c.field) {
    case "tag":
      return "tag";
    case "channel_account":
      return "channel";
    case "last_seen":
    case "created":
      return "days";
    case "has_phone":
      return "boolean";
    case "consent":
      return "consent";
    default:
      return "text";
  }
}

/** A fresh condition for `field` with its first operator and a sensible default value. */
export function newCondition(field: ConditionField = "tag"): SegmentCondition {
  const op = opsByField[field][0]!;
  const kind = valueKind({ field, op });
  return { field, op, key: null, value: kind === "days" ? 30 : kind === "boolean" ? true : kind === "consent" ? "sms" : "" };
}

/** Switching the field keeps the operator when it still applies, and resets the value when its kind changes. */
export function withField(c: SegmentCondition, field: ConditionField): SegmentCondition {
  const op = opsByField[field].includes(c.op) ? c.op : opsByField[field][0]!;
  const next = { ...c, field, op, key: field === "field" ? c.key : null };
  return valueKind(next) === valueKind(c) ? next : { ...next, value: newCondition(field).value };
}

export function withOp(c: SegmentCondition, op: string): SegmentCondition {
  const next = { ...c, op };
  if (valueKind(next) === valueKind(c)) return next;
  return { ...next, value: valueKind(next) === "none" ? null : valueKind(c) === "none" ? newCondition(c.field as ConditionField).value : c.value };
}

/** True when every condition has what the backend will ask for, so the rule can be previewed and saved. */
export function isComplete(c: SegmentCondition): boolean {
  if (!(conditionFields as readonly string[]).includes(c.field) || !opsByField[c.field as ConditionField].includes(c.op)) return false;
  if (c.field === "field" && !/^[a-z][a-z0-9_]{0,39}$/.test(c.key ?? "")) return false;
  switch (valueKind(c)) {
    case "none":
      return true;
    case "days":
      return Number.isInteger(c.value) && (c.value as number) >= 1 && (c.value as number) <= 3650;
    case "boolean":
      return typeof c.value === "boolean";
    case "consent":
      return (consentValues as readonly unknown[]).includes(c.value);
    default:
      return typeof c.value === "string" && c.value.trim().length > 0;
  }
}

export function ruleIsComplete(rule: SegmentRule): boolean {
  return rule.conditions.length > 0 && rule.conditions.length <= MAX_CONDITIONS && rule.conditions.every(isComplete);
}

/** The rule as sent: values trimmed, no value for exists/not_exists, no key unless the condition is on a custom field. */
export function cleanRule(rule: SegmentRule): SegmentRule {
  return {
    match: rule.match === "any" ? "any" : "all",
    conditions: rule.conditions.map((c) => ({
      field: c.field,
      op: c.op,
      key: c.field === "field" ? c.key : null,
      value: valueKind(c) === "none" ? null : typeof c.value === "string" ? c.value.trim() : c.value,
    })),
  };
}

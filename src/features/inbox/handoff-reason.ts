"use client";

import { useTranslations } from "next-intl";

/**
 * Persian label for a handoff reason. Rules hand off as «automation», people as «manual», and the AI agent as
 * «ai:<reason>» (low_confidence, guard_price, missing_knowledge, …). Anything unknown is shown as written.
 */
export function useHandoffReason() {
  const t = useTranslations("inbox.handoff.reasons");
  return (reason: string | null | undefined): string | null => {
    if (!reason) return null;
    const key = reason.startsWith("ai:") ? `ai.${reason.slice(3)}` : reason;
    if (t.has(key)) return t(key as "manual");
    if (reason.startsWith("ai:")) return reason.startsWith("ai:guard_") ? t("ai.guard") : t("ai.other");
    return reason;
  };
}

/** The AI hands off with its own draft as the suggested reply when it was not sure enough. */
export const isAiDraft = (reason: string | null | undefined) => reason === "ai:low_confidence" || reason === "ai:repeated_low_confidence";

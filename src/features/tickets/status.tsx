"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

const tones = { open: "warning", answered: "primary", closed: "neutral" } as const;

/** open: waiting on Pishkhan; answered: waiting on the seller; closed. */
export function TicketStatusBadge({ status }: { status: string }) {
  const t = useTranslations("tickets.status");
  return <Badge tone={tones[status as keyof typeof tones] ?? "neutral"}>{t.has(status) ? t(status) : status}</Badge>;
}

export function useCategoryLabel() {
  const t = useTranslations("tickets.categories");
  return (category: string) => (t.has(category) ? t(category) : category);
}

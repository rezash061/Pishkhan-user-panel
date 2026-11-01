"use client";

import { useTranslations } from "next-intl";
import { SectionTabs } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";
import { useUnanswered } from "./data";

/** «منابع» and «سؤال‌های بی‌جواب», with the number of open questions on the second tab. */
export function KnowledgeTabs() {
  const t = useTranslations("knowledge.tabs");
  const { workspace } = useWorkspace();
  const base = `/w/${workspace.id}/knowledge`;
  const open = useUnanswered(workspace.id, "open");
  const count = open.data?.pages[0]?.items.length ?? 0;
  const more = Boolean(open.data?.pages[0]?.nextCursor);
  return (
    <SectionTabs
      tabs={[
        { href: base, label: t("sources") },
        { href: `${base}/unanswered`, label: count ? t("unansweredCount", { n: more ? `${count}+` : String(count) }) : t("unanswered") },
      ]}
    />
  );
}

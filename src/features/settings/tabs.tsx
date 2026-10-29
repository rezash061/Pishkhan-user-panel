"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/features/workspace/context";
import { cn } from "@/lib/cn";
import { P } from "@/lib/permissions";

export function SettingsTabs() {
  const t = useTranslations("settings");
  const { workspace, can } = useWorkspace();
  const pathname = usePathname();
  const base = `/w/${workspace.id}/settings`;
  const tabs = [
    { href: base, label: t("general") },
    { href: `${base}/business-hours`, label: t("businessHours") },
    ...(can(P.inboxRead) ? [{ href: `${base}/quick-replies`, label: t("quickReplies") }] : []),
  ];
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn("shrink-0 border-b-2 px-3 py-2.5 text-sm", active ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

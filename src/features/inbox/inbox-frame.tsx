"use client";

import { MessagesSquare } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { ConversationList } from "./conversation-list";

/** Desktop: list and thread side by side. Phone: the list, or the open thread full screen (plan 3.3 layout). */
export function InboxFrame({ children }: { children: ReactNode }) {
  const params = useParams<{ conversationId?: string }>();
  const open = Boolean(params.conversationId);
  return (
    <div className="flex h-full min-h-0">
      <div className={cn("w-full shrink-0 border-e bg-surface lg:block lg:w-80 xl:w-96", open && "hidden")}>
        <Suspense>
          <ConversationList />
        </Suspense>
      </div>
      <div className={cn("min-w-0 flex-1", !open && "hidden lg:block")}>
        <Suspense>{children}</Suspense>
      </div>
    </div>
  );
}

export function InboxPlaceholder() {
  const t = useTranslations("inbox");
  return (
    <div className="grid h-full place-items-center">
      <EmptyState icon={<MessagesSquare />} title={t("selectConversation")} body={t("shortcuts")} />
    </div>
  );
}

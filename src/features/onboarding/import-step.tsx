"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { FeedImportReview, FeedImportStart } from "@/features/knowledge/feed-import";
import { can, P } from "@/lib/permissions";
import { Stepper } from "./stepper";

/** Onboarding step 4 (plan 3.1 import, UP-2.5): read past posts into product and FAQ suggestions, review them, or skip. */
export function ImportStep({ workspaceId, role }: { workspaceId: string; role: string }) {
  const t = useTranslations("onboarding.import");
  const [importId, setImportId] = useState<string | null>(null);
  const next = `/onboarding/teach?ws=${workspaceId}`;
  const writable = can(role, P.knowledgeWrite);
  return (
    <div className="space-y-6">
      <Stepper step={4} />
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      {!writable ? (
        <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
      ) : importId ? (
        <FeedImportReview ws={workspaceId} importId={importId} canEdit={writable} canAccept={writable && can(role, P.catalogWrite)} />
      ) : (
        <FeedImportStart ws={workspaceId} onStarted={(imp) => setImportId(imp.id)} />
      )}
      <Link href={next} className={buttonVariants({ variant: importId ? "primary" : "ghost", size: importId ? "lg" : "md", className: "w-full" })}>
        {importId ? t("done") : t("skip")}
      </Link>
    </div>
  );
}

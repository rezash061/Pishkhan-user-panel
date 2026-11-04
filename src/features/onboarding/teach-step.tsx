"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Interview } from "@/features/knowledge/interview";
import { can, P } from "@/lib/permissions";
import { Stepper } from "./stepper";

/** Onboarding «آموزش دستیار» (plan 3.1 teach, UP-1.1): answer the missing facts one by one, or skip to the panel. */
export function TeachStep({ workspaceId, role }: { workspaceId: string; role: string }) {
  const t = useTranslations("onboarding.teach");
  const router = useRouter();
  const home = `/w/${workspaceId}`;
  return (
    <div className="space-y-6">
      <Stepper step={5} />
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      {can(role, P.knowledgeWrite) ? (
        <Interview ws={workspaceId} onFinished={() => router.push(home)} finishLabel={t("done")} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
      )}
      <Link href={home} className={buttonVariants({ variant: "ghost", className: "w-full" })}>
        {t("skip")}
      </Link>
    </div>
  );
}

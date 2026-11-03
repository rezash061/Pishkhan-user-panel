"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { TemplatePicker } from "@/features/templates/template-picker";
import { can, P } from "@/lib/permissions";
import { Stepper } from "./stepper";

/** Step 3 (UP-2.5, plan 3.1): start from the industry's template, or skip. */
export function TemplateStep({ workspaceId, role }: { workspaceId: string; role: string }) {
  const t = useTranslations("onboarding.template");
  const [applied, setApplied] = useState(false);
  return (
    <div className="space-y-6">
      <Stepper step={3} />
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <TemplatePicker ws={workspaceId} writable={can(role, P.settingsWrite)} onApplied={() => setApplied(true)} />
      <Link href={`/w/${workspaceId}`} className={buttonVariants({ variant: applied ? "primary" : "ghost", size: applied ? "lg" : "md", className: "w-full" })}>
        {applied ? t("done") : t("skip")}
      </Link>
    </div>
  );
}

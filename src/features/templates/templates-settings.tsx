"use client";

import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useTemplateApplications, useTemplates } from "./data";
import { resultLines } from "./model";
import { TemplatePicker } from "./template-picker";

/** Settings «قالب صنف»: apply an industry template later, and the history of applies (BE-2.9). */
export function TemplatesSettings() {
  const t = useTranslations("templates");
  const { workspace, can } = useWorkspace();
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t("settingsTitle")} description={t("settingsSubtitle")} />
        <CardBody>
          <TemplatePicker ws={workspace.id} writable={can(P.settingsWrite)} />
        </CardBody>
      </Card>
      <Applications ws={workspace.id} />
    </div>
  );
}

function Applications({ ws }: { ws: string }) {
  const t = useTranslations("templates");
  const errorMessage = useErrorMessage();
  const apps = useTemplateApplications(ws);
  const templates = useTemplates(ws);
  const nameOf = (id: string, industry: string) =>
    templates.data?.find((x) => x.id === id)?.name ?? templates.data?.find((x) => x.industry === industry)?.name ?? industry;

  return (
    <Card>
      <CardHeader title={t("historyTitle")} />
      <CardBody>
        {apps.isPending ? (
          <Skeleton className="h-16" />
        ) : apps.isError ? (
          <p className="text-sm text-danger">{errorMessage(apps.error)}</p>
        ) : apps.data.length === 0 ? (
          <EmptyState icon={<History />} title={t("historyEmpty")} />
        ) : (
          <ul className="divide-y text-sm">
            {apps.data.map((a) => (
              <li key={a.id} className="space-y-0.5 py-2.5">
                <p className="font-medium">
                  {nameOf(a.templateId, a.industry)} <span className="text-xs font-normal text-muted-foreground">{t("version", { v: toPersianDigits(a.version) })}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={a.appliedAt}>{formatDateTime(a.appliedAt)}</time> ·{" "}
                  {resultLines(a)
                    .map(([key, n]) => t(`result.${key}`, { n: toPersianDigits(n) }))
                    .join("، ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

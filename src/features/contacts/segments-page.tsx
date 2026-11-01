"use client";

import { Filter, Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatNumber, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useSegments } from "./data";

export function SegmentsPage() {
  const t = useTranslations("contacts.segments");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const base = `/w/${workspace.id}/contacts`;
  const segments = useSegments(workspace.id);
  const list = segments.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        {can(P.crmWrite) ? (
          <Link href={`${base}/segments/new`} className={buttonVariants()}>
            <Plus aria-hidden />
            {t("new")}
          </Link>
        ) : null}
      </div>
      <Card className="divide-y overflow-hidden">
        {segments.isPending ? (
          <div className="p-4">
            <Skeleton className="h-24" />
          </div>
        ) : segments.isError ? (
          <EmptyState title={errorMessage(segments.error)} />
        ) : list.length === 0 ? (
          <EmptyState icon={<Filter />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          list.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 sm:p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <Link href={`${base}/segments/${s.id}`} className="font-medium hover:underline" dir="auto">
                  {s.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {t(s.rule.match === "any" ? "summaryAny" : "summaryAll", { n: toPersianDigits(s.rule.conditions.length) })} · {t("updated", { when: formatRelative(s.updatedAt) })}
                </p>
              </div>
              <Link href={`${base}?segment=${s.id}`} className="shrink-0 text-sm text-primary hover:underline">
                {t("contactCount", { n: formatNumber(s.contactCount) })}
              </Link>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

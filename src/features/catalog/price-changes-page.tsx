"use client";

import { History, Percent, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useMembers } from "@/features/team/data";
import { useWorkspace } from "@/features/workspace/context";
import type { PriceChangeBatch } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatNumber, formatRelative, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { P } from "@/lib/permissions";
import { categoryLabels, useCategories } from "./data";
import { PriceChangeDialog, PriceLines } from "./price-change-dialog";
import { usePriceChange, usePriceChanges, useUndoPriceChange } from "./price-changes-data";

/** «تغییر قیمت‌ها»: the last 50 bulk price changes, each with what it changed and an undo for 24 hours. */
export function PriceChangesPage() {
  const t = useTranslations("catalog.prices");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.catalogWrite);
  const batches = usePriceChanges(ws);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("historyHint")}</p>
        {writable ? (
          <Button onClick={() => setOpen(true)}>
            <Percent aria-hidden />
            {t("open")}
          </Button>
        ) : null}
      </div>
      <Card className="divide-y overflow-hidden">
        {batches.isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : batches.isError ? (
          <EmptyState title={errorMessage(batches.error)} action={<Button variant="outline" onClick={() => batches.refetch()}>{t("retry")}</Button>} />
        ) : batches.data.length === 0 ? (
          <EmptyState icon={<History />} title={t("historyEmpty")} body={t("historyEmptyBody")} />
        ) : (
          batches.data.map((b) => <BatchRow key={b.id} batch={b} writable={writable} />)
        )}
      </Card>
      {open ? <PriceChangeDialog open onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function BatchRow({ batch: b, writable }: { batch: PriceChangeBatch; writable: boolean }) {
  const t = useTranslations("catalog.prices");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const describe = useDescribeBatch();
  const members = useMembers(ws, can(P.membersRead));
  const undo = useUndoPriceChange(ws);
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const details = usePriceChange(ws, b.id, expanded);
  const who = b.createdBy ? members.data?.find((m) => m.userId === b.createdBy)?.displayName : null;

  return (
    <div className="space-y-2 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{describe.rule(b)}</p>
          <p className="text-xs text-muted-foreground">
            {[describe.scope(b), t("counts", { prices: formatNumber(b.priceCount), products: formatNumber(b.productCount) }), who, formatRelative(b.createdAt)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {b.undoneAt ? (
            <Badge>{t("undone")}</Badge>
          ) : b.canUndo && writable ? (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              <Undo2 aria-hidden />
              {t("undo")}
            </Button>
          ) : null}
        </div>
      </div>
      {b.undoneAt ? (
        <p className="text-xs text-muted-foreground">
          {t("undoneAt", { when: formatDateTime(b.undoneAt) })}
          {b.undoSkipped > 0 ? ` · ${t("undoSkipped", { n: formatNumber(b.undoSkipped) })}` : null}
        </p>
      ) : b.canUndo ? (
        <p className="text-xs text-muted-foreground">{t("undoUntil", { when: formatDateTime(b.undoDeadline) })}</p>
      ) : null}
      <details className="text-sm" onToggle={(e) => setExpanded(e.currentTarget.open)}>
        <summary className="cursor-pointer text-muted-foreground">{t("details")}</summary>
        <div className="mt-2">
          {details.isPending ? <Skeleton className="h-24" /> : details.isError ? <p className="text-danger">{errorMessage(details.error)}</p> : <PriceLines lines={details.data.items ?? []} />}
        </div>
      </details>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("undoTitle")}
        body={t("undoBody")}
        confirmLabel={t("undo")}
        loading={undo.isPending}
        onConfirm={() =>
          undo.mutate(b.id, {
            onSuccess: (r) => {
              setConfirming(false);
              toast.success(r.undoSkipped > 0 ? t("undoDoneSkipped", { n: formatNumber(r.undoSkipped) }) : t("undoDone"));
            },
            onError: (err) => {
              setConfirming(false);
              toast.error(errorMessage(err));
            },
          })
        }
      />
    </div>
  );
}

/** «۱۰٪ افزایش، گرد به ۱٬۰۰۰ تومان» and «دستهٔ مانتو، فعال» for a batch. */
function useDescribeBatch() {
  const t = useTranslations("catalog.prices");
  const tc = useTranslations("catalog");
  const { workspace } = useWorkspace();
  const labels = categoryLabels(useCategories(workspace.id).data ?? []);
  return {
    rule: (b: PriceChangeBatch) => {
      const up = b.kind === "percent" ? (b.percent ?? 0) > 0 : (rialOf(b.amount) ?? 0) > 0;
      const size = b.kind === "percent" ? `${toPersianDigits(Math.abs(b.percent ?? 0)).replace(".", "٫")}٪` : formatToman(Math.abs(rialOf(b.amount) ?? 0));
      const change = up ? t("ruleUp", { size }) : t("ruleDown", { size });
      return b.roundTo > 1 ? `${change}، ${t("ruleRound", { n: formatNumber(b.roundTo), mode: t(`modes.${b.roundMode}` as "modes.nearest") })}` : change;
    },
    scope: (b: PriceChangeBatch) => {
      const s = b.scope;
      if (s.all) return t("scopeAll");
      const parts = [
        s.productIds?.length ? t("scopeProducts", { n: formatNumber(s.productIds.length) }) : null,
        s.categoryId ? t("scopeCategory", { name: labels.get(s.categoryId) ?? t("deletedCategory") }) : null,
        s.status ? tc(`statuses.${s.status}` as "statuses.active") : null,
        s.tag ? t("scopeTag", { tag: s.tag }) : null,
      ];
      return parts.filter(Boolean).join("، ");
    },
  };
}

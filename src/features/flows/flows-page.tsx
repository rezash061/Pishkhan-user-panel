"use client";

import { GitBranch, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useDeleteFlow, useFlows, useSaveFlow } from "@/features/automations/data";
import { useWorkspace } from "@/features/workspace/context";
import type { Flow } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatNumber, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { starterGraph } from "./model";

export function FlowStatus({ flow }: { flow: Flow }) {
  const t = useTranslations("flows");
  const published = flow.publishedVersion !== null && flow.publishedVersion !== undefined;
  const dirty = published && flow.publishedAt !== null && new Date(flow.updatedAt) > new Date(flow.publishedAt!);
  return (
    <span className="inline-flex flex-wrap gap-1">
      {published ? <Badge tone="success">{t("published", { v: toPersianDigits(Number(flow.publishedVersion)) })}</Badge> : <Badge>{t("draft")}</Badge>}
      {dirty ? <Badge tone="warning">{t("unpublishedChanges")}</Badge> : null}
      {flow.validation.errors.length ? <Badge tone="danger">{t("errorCount", { n: formatNumber(flow.validation.errors.length) })}</Badge> : null}
    </span>
  );
}

export function FlowsPage() {
  const t = useTranslations("flows");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.automationWrite);
  const flows = useFlows(ws);
  const create = useSaveFlow(ws);
  const remove = useDeleteFlow(ws);
  const [deleting, setDeleting] = useState<Flow | null>(null);

  const newFlow = () =>
    create.mutate(
      { name: t("untitled", { n: toPersianDigits((flows.data?.length ?? 0) + 1) }), graph: starterGraph(t("starterText")) },
      { onSuccess: (flow) => router.push(`/w/${ws}/automations/flows/${flow.id}`), onError: (e) => toast.error(errorMessage(e)) },
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        {writable ? (
          <Button onClick={newFlow} loading={create.isPending}>
            <Plus aria-hidden />
            {t("new")}
          </Button>
        ) : null}
      </div>
      <Card className="divide-y overflow-hidden">
        {flows.isPending ? (
          <div className="p-4">
            <Skeleton className="h-12" />
          </div>
        ) : flows.isError ? (
          <EmptyState title={errorMessage(flows.error)} />
        ) : flows.data.length === 0 ? (
          <EmptyState icon={<GitBranch />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          flows.data.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-3 sm:p-4">
              <Link href={`/w/${ws}/automations/flows/${f.id}`} className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-medium">{f.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <FlowStatus flow={f} />
                  <span>{t("steps", { n: formatNumber(f.graph.nodes.length) })}</span>
                  <span>· {formatRelative(f.updatedAt)}</span>
                </div>
              </Link>
              {writable ? (
                <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={t("delete", { name: f.name })} onClick={() => setDeleting(f)}>
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        danger
        title={t("deleteConfirm")}
        body={deleting ? `${deleting.name} — ${t("deleteHint")}` : null}
        confirmLabel={t("deleteAction")}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null), onError: (e) => toast.error(errorMessage(e)) })}
      />
    </div>
  );
}

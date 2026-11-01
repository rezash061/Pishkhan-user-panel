"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import type { ContactExport } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { useDownloadExport, useExports, useStartExport, type ContactFilter } from "./data";

const tones = { pending: "primary", ready: "success", failed: "danger", downloaded: "neutral", expired: "neutral" } as const;

/**
 * Excel export of the filtered list (BE-1.7 part 2). The file is written in the background; the member gets a
 * «crm_export» notification that links back here with ?export={id}. Each file downloads once, through a 5-minute link.
 */
export function ExportsDialog({ open, onClose, filter, filtered, highlight }: { open: boolean; onClose: () => void; filter: ContactFilter; filtered: boolean; highlight?: string }) {
  const t = useTranslations("contacts.exports");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const exports = useExports(workspace.id, open);
  const start = useStartExport(workspace.id);

  const begin = () =>
    start.mutate(filter, {
      onSuccess: () => toast.success(t("started")),
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <Dialog open={open} onClose={onClose} variant="sheet" title={t("title")} description={t("intro")}>
      <div className="space-y-4">
        <div className="space-y-2 rounded-xl bg-surface-muted/60 p-3">
          <p className="text-sm">{filtered ? t("withFilters") : t("all")}</p>
          <Button onClick={begin} loading={start.isPending}>
            <FileSpreadsheet aria-hidden />
            {t("start")}
          </Button>
        </div>
        <section aria-labelledby="exports-list-title" className="space-y-2">
          <h3 id="exports-list-title" className="text-xs font-semibold text-muted-foreground">
            {t("list")}
          </h3>
          {exports.isPending ? (
            <Skeleton className="h-14" />
          ) : exports.isError ? (
            <p className="text-sm text-danger">{errorMessage(exports.error)}</p>
          ) : exports.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {exports.data.map((e) => (
                <ExportRow key={e.id} item={e} highlight={e.id === highlight} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}

function ExportRow({ item: e, highlight }: { item: ContactExport; highlight: boolean }) {
  const t = useTranslations("contacts.exports");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const download = useDownloadExport(workspace.id);

  const get = () =>
    download.mutate(e.id, {
      // Same tab: the file is served as an attachment, so the panel stays where it is (a new tab after an await is blocked).
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <li className={cn("flex flex-wrap items-center gap-3 p-3", highlight && "bg-primary-soft/40")}>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <time dateTime={e.createdAt} title={formatDateTime(e.createdAt)}>
            {formatRelative(e.createdAt)}
          </time>
          <Badge tone={tones[e.status as keyof typeof tones] ?? "neutral"}>{t.has(`status.${e.status}`) ? t(`status.${e.status}` as "status.ready") : e.status}</Badge>
        </p>
        <p className="text-xs text-muted-foreground">
          {e.status === "pending"
            ? t("pendingHint")
            : e.status === "failed"
              ? t("failedHint")
              : e.rowCount !== null
                ? t("rows", { n: toPersianDigits(e.rowCount) })
                : null}
          {e.status === "ready" && e.expiresAt ? ` · ${t("expires", { when: formatRelative(e.expiresAt) })}` : null}
        </p>
      </div>
      {e.status === "ready" ? (
        <Button size="sm" variant="secondary" onClick={get} loading={download.isPending}>
          <Download aria-hidden />
          {t("download")}
        </Button>
      ) : null}
    </li>
  );
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import { uploadFile, waitUntilScanned } from "@/lib/api/upload";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatNumber } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";

type Phase = "pick" | "uploading" | "scanning" | "importing" | "done" | "failed";

/**
 * Excel import (plan 3.7): download the template, upload the sheet (virus-scanned like every file), then the backend
 * imports it in the background; this dialog follows the job and lists rows it skipped.
 */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("catalog.importer");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const [step, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);

  const job = useQuery({
    queryKey: qk.catalogImport(ws, importId ?? "none"),
    enabled: Boolean(importId),
    queryFn: async () => {
      const result = unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/catalog/imports/{importId}", { params: { path: { workspaceId: ws, importId: importId! } } }));
      if (result.status === "completed") {
        void qc.invalidateQueries({ queryKey: qk.productLists(ws) });
        void qc.invalidateQueries({ queryKey: qk.categories(ws) });
      }
      return result;
    },
    refetchInterval: (query) => (query.state.data?.status === "completed" || query.state.data?.status === "failed" ? false : 1500),
  });
  // The job's own status finishes the importing step.
  const phase: Phase = step === "importing" && job.data?.status === "completed" ? "done" : step === "importing" && job.data?.status === "failed" ? "failed" : step;

  const start = async (file: File) => {
    setError(null);
    try {
      setPhase("uploading");
      const uploaded = await uploadFile(ws, "import_sheet", file);
      setPhase("scanning");
      const clean = await waitUntilScanned(ws, uploaded.id);
      setPhase("importing");
      const created = unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/catalog/import", { params: { path: { workspaceId: ws } }, body: { fileId: clean.id } }));
      setImportId(created.id);
    } catch (e) {
      setError(errorMessage(e));
      setPhase("failed");
    }
  };

  const busy = phase === "uploading" || phase === "scanning" || phase === "importing";
  const result = job.data;

  return (
    <Dialog
      open
      onClose={busy ? () => undefined : onClose}
      variant="sheet"
      title={t("title")}
      description={t("subtitle")}
      footer={
        <Button variant={phase === "done" ? "primary" : "outline"} onClick={onClose} disabled={busy}>
          {phase === "done" ? t("done") : t("close")}
        </Button>
      }
    >
      <div className="space-y-4">
        <a href={`/api/bff/workspaces/${ws}/catalog/import-template`} download className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <Download aria-hidden />
          {t("template")}
        </a>
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
        </ol>

        {phase === "pick" || phase === "failed" ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center hover:border-primary/50">
            <FileSpreadsheet className="size-8 text-primary" aria-hidden />
            <span className="text-sm font-medium">{t("pick")}</span>
            <span className="text-xs text-muted-foreground">{t("pickHint")}</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void start(file);
              }}
            />
          </label>
        ) : null}

        {busy ? <Spinner label={t(`phase.${phase}`)} /> : null}

        {error || (phase === "failed" && result?.error) ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {error ?? codeMessage(result?.error) ?? t("failed")}
          </p>
        ) : null}

        {result && phase === "done" ? (
          <div className="space-y-3" role="status">
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              {t("summary", { rows: formatNumber(Number(result.rows)), created: formatNumber(Number(result.created)), updated: formatNumber(Number(result.updated)), skipped: formatNumber(Number(result.skipped)) })}
            </p>
            {result.errors.length ? (
              <div className="max-h-56 overflow-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">{t("row")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("column")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("problem")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 tabular-nums">{toPersianDigits(Number(e.row))}</td>
                        <td className="px-3 py-2">{e.column}</td>
                        <td className="px-3 py-2 text-danger">{codeMessage(e.code) ?? e.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

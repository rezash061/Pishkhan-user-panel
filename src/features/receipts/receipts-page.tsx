"use client";

import { FileCheck2, Receipt as ReceiptIcon, Settings, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { Receipt } from "@/lib/api/types";
import { uploadFile, waitUntilScanned } from "@/lib/api/upload";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { P } from "@/lib/permissions";
import { useReceipts, useSubmitReceipt } from "./data";
import { ReceiptDialog, ReceiptStatusBadge } from "./receipt-view";

const tabs = ["needs_review", "auto_approved", "approved", "rejected", "all"] as const;
type Tab = (typeof tabs)[number];

/** «رسیدهای کارت به کارت» (UP-2.3, plan 3.8): the review queue, newest first; `?receipt=` opens one. */
export function ReceiptsPage() {
  const t = useTranslations("receipts");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = params.get("status") as Tab | null;
  const tab: Tab = tabParam && tabs.includes(tabParam) ? tabParam : "needs_review";
  const open = params.get("receipt");
  const [uploading, setUploading] = useState(false);
  const receipts = useReceipts(ws, tab === "all" ? {} : { status: tab });
  const items = receipts.data?.pages.flatMap((p) => p.items) ?? [];

  const replace = (change: (sp: URLSearchParams) => void) => {
    const sp = new URLSearchParams(params);
    change(sp);
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <div className="flex flex-wrap gap-2">
            {can(P.settingsRead) ? (
              <Link href={`/w/${ws}/settings/payments`} className={buttonVariants({ variant: "outline" })}>
                <Settings aria-hidden />
                {t("settingsLink")}
              </Link>
            ) : null}
            {can(P.ordersWrite) && can(P.filesUpload) ? (
              <Button onClick={() => setUploading(true)}>
                <Upload aria-hidden />
                {t("upload")}
              </Button>
            ) : null}
          </div>
        }
      />
      <div role="tablist" aria-label={t("tabsLabel")} className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 scrollbar-thin sm:mx-0 sm:px-0">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => replace((sp) => (key === "needs_review" ? sp.delete("status") : sp.set("status", key)))}
            className={cn("shrink-0 border-b-2 px-3 py-2.5 text-sm", tab === key ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>
      <Card className="divide-y overflow-hidden">
        {receipts.isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : receipts.isError ? (
          <EmptyState title={errorMessage(receipts.error)} action={<Button variant="outline" onClick={() => receipts.refetch()}>{t("retry")}</Button>} />
        ) : items.length === 0 ? (
          <EmptyState icon={<ReceiptIcon />} title={tab === "needs_review" ? t("emptyReview") : t("empty")} body={t("emptyBody")} />
        ) : (
          items.map((r) => <ReceiptRow key={r.id} receipt={r} onOpen={() => replace((sp) => sp.set("receipt", r.id))} />)
        )}
      </Card>
      {receipts.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => receipts.fetchNextPage()} loading={receipts.isFetchingNextPage}>
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
      {open ? <ReceiptDialog receiptId={open} onClose={() => replace((sp) => sp.delete("receipt"))} /> : null}
      {uploading ? <UploadReceiptDialog onClose={() => setUploading(false)} onSubmitted={(id) => replace((sp) => sp.set("receipt", id))} /> : null}
    </PageContainer>
  );
}

/** One row: amount, status, a short reason when checks failed, and when. */
export function ReceiptRow({ receipt: r, onOpen }: { receipt: Receipt; onOpen: () => void }) {
  const t = useTranslations("receipts");
  const amount = rialOf(r.amount);
  const failed = r.checks.filter((c) => c.result === "fail").map((c) => (t.has(`check.${c.key}`) ? t(`check.${c.key}` as "check.amount") : c.key));
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 p-3 text-start hover:bg-surface-muted/50 sm:p-4">
      <FileCheck2 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{amount !== null ? formatToman(amount) : t("fields.unread")}</span>
          <ReceiptStatusBadge receipt={r} />
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {[t(`source.${r.source === "message" ? "message" : "panel"}`), failed.length ? t("failedChecks", { list: failed.join("، ") }) : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <time dateTime={r.createdAt} title={formatDateTime(r.createdAt)} className="shrink-0 text-xs text-muted-foreground">
        {formatRelative(r.createdAt)}
      </time>
    </button>
  );
}

/** Upload a receipt image or PDF (purpose `receipt`), wait for the virus scan, then submit it for an optional order. */
export function UploadReceiptDialog({ orderId, onClose, onSubmitted }: { orderId?: string; onClose: () => void; onSubmitted?: (receiptId: string) => void }) {
  const t = useTranslations("receipts");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const submit = useSubmitReceipt(workspace.id);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "scanning">("idle");
  const [error, setError] = useState<string | null>(null);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setFile(e.target.files?.[0] ?? null);
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setError(t("fileRequired"));
    try {
      setPhase("uploading");
      const uploaded = await uploadFile(workspace.id, "receipt", file);
      setPhase("scanning");
      await waitUntilScanned(workspace.id, uploaded.id);
      const receipt = await submit.mutateAsync({ fileId: uploaded.id, orderId: orderId ?? null });
      toast.success(t("submitted"));
      onClose();
      onSubmitted?.(receipt.id);
    } catch (err) {
      setPhase("idle");
      setError(err instanceof ApiError ? errorMessage(err) : t("uploadFailed"));
    }
  };

  const busy = phase !== "idle";
  return (
    <Dialog
      open
      onClose={busy ? () => undefined : onClose}
      title={t("uploadTitle")}
      description={t("uploadHint")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="receipt-upload" loading={busy}>
            {t("submit")}
          </Button>
        </div>
      }
    >
      <form id="receipt-upload" onSubmit={send} className="space-y-3">
        <Field label={t("file")} htmlFor="receipt-file" error={error ?? undefined}>
          <Input id="receipt-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onPick} disabled={busy} />
        </Field>
        {phase === "scanning" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("scanning")}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

/** The receipts of one order, on its page (newest first); a row opens it in the queue. */
export function OrderReceipts({ orderId, orderStatus }: { orderId: string; orderStatus: string }) {
  const t = useTranslations("receipts");
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const receipts = useReceipts(ws, { orderId });
  const items = receipts.data?.pages.flatMap((p) => p.items) ?? [];
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const canUpload = can(P.ordersWrite) && can(P.filesUpload) && orderStatus === "awaiting_payment";
  if (!items.length && !canUpload) return null;
  return (
    <Card>
      <CardHeader
        title={t("forOrder")}
        action={
          canUpload ? (
            <Button variant="outline" size="sm" onClick={() => setUploading(true)}>
              <Upload aria-hidden />
              {t("upload")}
            </Button>
          ) : null
        }
      />
      <CardBody className="p-0 sm:p-0">
        {receipts.isPending ? (
          <Skeleton className="m-4 h-12" />
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("noneForOrder")}</p>
        ) : (
          <div className="divide-y">
            {items.map((r) => (
              <ReceiptRow key={r.id} receipt={r} onOpen={() => router.push(`/w/${ws}/orders/receipts?status=all&receipt=${r.id}`)} />
            ))}
          </div>
        )}
      </CardBody>
      {uploading ? (
        <UploadReceiptDialog orderId={orderId} onClose={() => setUploading(false)} onSubmitted={(id) => router.push(`/w/${ws}/orders/receipts?status=all&receipt=${id}`)} />
      ) : null}
    </Card>
  );
}

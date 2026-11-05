"use client";

import { AlertTriangle, CheckCircle2, CircleHelp, ExternalLink, ImageOff, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import { useOrders } from "@/features/orders/data";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { Receipt, ReceiptCheck } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { P } from "@/lib/permissions";
import { canDecide, isAutoDuplicate, isWorking, receiptCheckKeys, receiptLimits, useApproveReceipt, useReceipt, useRejectReceipt } from "./data";

type Tone = "neutral" | "success" | "warning" | "danger";

/** The status badge; an automatic duplicate rejection and an unsafe file are told apart from a member's rejection. */
export function ReceiptStatusBadge({ receipt: r }: { receipt: Pick<Receipt, "status" | "rejectReason" | "decidedBy"> }) {
  const t = useTranslations("receipts.status");
  const key = isAutoDuplicate(r) ? "duplicate" : r.status === "rejected" && r.rejectReason === "unsafe_file" ? "unsafe" : r.status;
  const tone: Tone = r.status === "approved" || r.status === "auto_approved" ? "success" : r.status === "needs_review" ? "warning" : r.status === "rejected" ? "danger" : "neutral";
  return (
    <Badge tone={tone}>
      {isWorking(r) ? <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
      {t.has(key) ? t(key as "needs_review") : key}
    </Badge>
  );
}

const resultIcon = { pass: CheckCircle2, fail: XCircle, unknown: CircleHelp } as const;

/** The checks as marks with words (never colour alone), in the backend's order. */
export function ReceiptChecks({ checks }: { checks: ReceiptCheck[] }) {
  const t = useTranslations("receipts");
  const sorted = [...checks].sort((a, b) => receiptCheckKeys.indexOf(a.key as never) - receiptCheckKeys.indexOf(b.key as never));
  if (!sorted.length) return null;
  return (
    <ul aria-label={t("checksTitle")} className="space-y-1.5 text-sm">
      {sorted.map((c) => {
        const Icon = resultIcon[c.result as keyof typeof resultIcon] ?? CircleHelp;
        const result = t.has(`result.${c.result}`) ? t(`result.${c.result}` as "result.pass") : c.result;
        return (
          <li key={c.key} className="flex items-start gap-2">
            <Icon className={cn("mt-0.5 size-4 shrink-0", c.result === "pass" ? "text-success" : c.result === "fail" ? "text-danger" : "text-muted-foreground")} aria-hidden />
            <span>
              <span className="font-medium">{t.has(`check.${c.key}`) ? t(`check.${c.key}` as "check.amount") : c.key}</span>
              {": "}
              <span>{result}</span>
              {c.detail && t.has(`detail.${c.detail}`) ? <span className="text-muted-foreground"> ({t(`detail.${c.detail}` as "detail.less")})</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end break-words">{children}</dd>
    </div>
  );
}

const ltr = (value: string) => (
  <span dir="ltr" className="font-mono">
    {value}
  </span>
);

/** What was read off the receipt; a field that could not be read says so. */
export function ReceiptFields({ receipt: r }: { receipt: Receipt }) {
  const t = useTranslations("receipts.fields");
  const amount = rialOf(r.amount);
  const none = <span className="text-muted-foreground">{t("unread")}</span>;
  return (
    <dl className="divide-y">
      <Row label={t("amount")}>{amount !== null ? formatToman(amount) : none}</Row>
      <Row label={t("paidAt")}>{r.paidAt ? formatDateTime(r.paidAt) : none}</Row>
      <Row label={t("reference")}>{r.reference ? ltr(r.reference) : none}</Row>
      <Row label={t("destination")}>{r.destinationCard ? ltr(r.destinationCard) : r.destinationSheba ? ltr(r.destinationSheba) : none}</Row>
      <Row label={t("source")}>{r.sourceCard ? ltr(r.sourceCard) : none}</Row>
      <Row label={t("bank")}>{r.bank ?? none}</Row>
      <Row label={t("confidence")}>{r.confidence !== null ? `${toPersianDigits(Math.round(r.confidence * 100))}٪` : none}</Row>
    </dl>
  );
}

/** One receipt: image, fields, checks, links, and approve or reject when it is still the seller's to decide. */
export function ReceiptDialog({ receiptId, onClose }: { receiptId: string; onClose: () => void }) {
  const t = useTranslations("receipts");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const query = useReceipt(workspace.id, receiptId);
  const r = query.data;
  return (
    <Dialog open onClose={onClose} variant="sheet" className="max-w-3xl" title={t("detailTitle")} description={r ? <ReceiptStatusBadge receipt={r} /> : undefined}>
      {query.isPending ? (
        <Skeleton className="h-80" />
      ) : query.isError || !r ? (
        <p className="text-sm text-danger">{errorMessage(query.error)}</p>
      ) : (
        <ReceiptDetail receipt={r} onDone={onClose} />
      )}
    </Dialog>
  );
}

function ReceiptDetail({ receipt: r, onDone }: { receipt: Receipt; onDone: () => void }) {
  const t = useTranslations("receipts");
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const [broken, setBroken] = useState(false);
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const pdf = r.imageUrl && /\.pdf(\?|$)/i.test(r.imageUrl);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-2">
        {r.imageUrl && !broken && !pdf ? (
          // A signed, short-lived URL of the clean (scanned) file.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.imageUrl} alt={t("imageAlt")} className="max-h-[60dvh] w-full rounded-xl border object-contain" onError={() => setBroken(true)} />
        ) : r.imageUrl && pdf ? (
          <a href={r.imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ExternalLink className="size-4" aria-hidden />
            {t("openFile")}
          </a>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            <ImageOff className="size-4" aria-hidden />
            {isWorking(r) ? t("working") : t("imageUnavailable")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t(`source.${r.source === "message" ? "message" : "panel"}`)} · {formatDateTime(r.createdAt)}
        </p>
      </div>
      <div className="space-y-4">
        <ReceiptFields receipt={r} />
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("checksTitle")}</h3>
          {isWorking(r) ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              {t("working")}
            </p>
          ) : (
            <ReceiptChecks checks={r.checks} />
          )}
        </section>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {r.orderId ? (
            <Link href={`/w/${ws}/orders/${r.orderId}`} className="text-primary hover:underline">
              {t("openOrder")}
            </Link>
          ) : (
            <span className="text-muted-foreground">{t("noOrder")}</span>
          )}
          {r.conversationId && can(P.inboxRead) ? (
            <Link href={`/w/${ws}/inbox/${r.conversationId}`} className="text-primary hover:underline">
              {t("openConversation")}
            </Link>
          ) : null}
          {r.duplicateOfId ? (
            <Link href={`/w/${ws}/orders/receipts?receipt=${r.duplicateOfId}`} className="text-primary hover:underline">
              {t("duplicateOf")}
            </Link>
          ) : null}
        </div>
        {r.status === "rejected" && r.rejectReason && !isAutoDuplicate(r) ? (
          <p className="rounded-xl bg-surface-muted p-3 text-sm">
            {t("rejectedBecause")}{" "}
            {r.rejectReason === "unsafe_file" ? t("status.unsafe") : <span dir="auto">{r.rejectReason}</span>}
          </p>
        ) : null}
        {isAutoDuplicate(r) ? (
          <p role="note" className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft/60 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {t("duplicateNote")}
          </p>
        ) : null}
        {canDecide(r) && can(P.ordersWrite) ? (
          mode === "approve" ? (
            <ApproveForm receipt={r} onCancel={() => setMode(null)} onDone={onDone} />
          ) : mode === "reject" ? (
            <RejectForm receipt={r} onCancel={() => setMode(null)} onDone={onDone} />
          ) : (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button onClick={() => setMode("approve")}>{t("approve")}</Button>
              {r.status === "needs_review" ? (
                <Button variant="outline" className="text-danger" onClick={() => setMode("reject")}>
                  {t("reject")}
                </Button>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function ApproveForm({ receipt: r, onCancel, onDone }: { receipt: Receipt; onCancel: () => void; onDone: () => void }) {
  const t = useTranslations("receipts");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const approve = useApproveReceipt(workspace.id);
  // Without an order on the receipt, the seller picks one of the orders awaiting payment (the customer's first).
  const awaiting = useOrders(workspace.id, { statuses: ["awaiting_payment"], ...(r.contactId ? { contactId: r.contactId } : {}) }, { enabled: !r.orderId, limit: 50 });
  const options = awaiting.data?.pages.flatMap((p) => p.items) ?? [];
  const [orderId, setOrderId] = useState<string>("");
  const chosen = r.orderId ?? (orderId || null);

  const submit = () =>
    approve.mutate(
      { id: r.id, orderId: r.orderId ? null : chosen },
      {
        onSuccess: () => {
          toast.success(t("approved"));
          onDone();
        },
        onError: (err) => toast.error(err instanceof ApiError && err.code === "payments.receipt.order_required" ? t("pickOrderHint") : errorMessage(err)),
      },
    );

  return (
    <div className="space-y-3 border-t pt-4">
      {!r.orderId ? (
        <Field label={t("pickOrder")} htmlFor="receipt-order" hint={options.length ? t("pickOrderHint") : undefined}>
          {awaiting.isPending ? (
            <Skeleton className="h-10" />
          ) : options.length ? (
            <Select id="receipt-order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">{t("pickOrderPlaceholder")}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {t("orderOption", { number: toPersianDigits(o.number), total: formatToman(rialOf(o.total) ?? 0), name: o.customerName ?? "—" })}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noAwaiting")}</p>
          )}
        </Field>
      ) : null}
      <p className="text-sm">{t("approveBody")}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} loading={approve.isPending} disabled={!chosen}>
          {t("approveConfirm")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {tc("cancel")}
        </Button>
      </div>
    </div>
  );
}

function RejectForm({ receipt: r, onCancel, onDone }: { receipt: Receipt; onCancel: () => void; onDone: () => void }) {
  const t = useTranslations("receipts");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const reject = useRejectReceipt(workspace.id);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const text = reason.trim();
    if (!text) return setError(t("reasonRequired"));
    reject.mutate(
      { id: r.id, reason: text },
      {
        onSuccess: () => {
          toast.success(t("rejected"));
          onDone();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <Field label={t("reason")} htmlFor="receipt-reason" hint={t("reasonHint")} error={error ?? undefined}>
        <Textarea id="receipt-reason" rows={3} maxLength={receiptLimits.reason} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={Boolean(error) || undefined} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="text-danger" onClick={submit} loading={reject.isPending}>
          {t("rejectConfirm")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {tc("cancel")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { AlertTriangle, ArrowRight, MessageCircle, Pencil, Printer, UserRound } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useMembers } from "@/features/team/data";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { Order, OrderAddress } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatNumber, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { P } from "@/lib/permissions";
import { groupMobile } from "@/lib/phone";
import { orderLimits, useAddOrderNote, useMoveOrder, useOrder, useOrderTimeline } from "./data";
import { OrderSourceBadge, OrderStatusBadge, useStatusLabel } from "./status";

/** E.164 (+98912…) to the national form people read (0912 …). */
export function nationalMobile(phone: string | null): string | null {
  if (!phone) return null;
  const national = phone.startsWith("+98") ? `0${phone.slice(3)}` : phone;
  return toPersianDigits(groupMobile(national));
}

export function addressText(a: OrderAddress | null): string | null {
  if (!a) return null;
  return [a.province, a.city && a.city !== a.province ? a.city : null, a.line].filter((x) => x && x.trim()).join("، ");
}

/** Moves that end an order or take money back are styled as dangerous. */
const dangerMoves = new Set(["cancelled", "refunded", "returned"]);
const closedStatuses = new Set(["cancelled", "refunded", "returned", "completed"]);

export function OrderPage({ orderId }: { orderId: string }) {
  const t = useTranslations("orders");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const order = useOrder(workspace.id, orderId);
  const back = `/w/${workspace.id}/orders`;

  return (
    <PageContainer className="space-y-5">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" aria-hidden />
        {t("backToList")}
      </Link>
      {order.isPending ? (
        <Skeleton className="h-64" />
      ) : order.isError ? (
        <EmptyState title={order.error instanceof ApiError && order.error.status === 404 ? t("notFound") : errorMessage(order.error)} />
      ) : (
        <Loaded order={order.data} />
      )}
    </PageContainer>
  );
}

function Loaded({ order: o }: { order: Order }) {
  const t = useTranslations("orders");
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.ordersWrite);
  const [moving, setMoving] = useState<string | null>(null);
  const label = useStatusLabel();
  const showMissing = o.missing.length > 0 && !closedStatuses.has(o.status) && o.status !== "shipped" && o.status !== "delivered";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">
            {t("number", { n: toPersianDigits(o.number) })}
            <OrderStatusBadge status={o.status} />
            <OrderSourceBadge order={o} />
          </h1>
          <p className="text-sm text-muted-foreground">{t("createdAt", { when: formatDateTime(o.createdAt) })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {writable && o.status === "draft" ? (
            <Link href={`/w/${ws}/orders/${o.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil aria-hidden />
              {t("edit")}
            </Link>
          ) : null}
          <Link href={`/w/${ws}/orders/${o.id}/invoice`} className={buttonVariants({ variant: "outline" })}>
            <Printer aria-hidden />
            {t("invoice.open")}
          </Link>
        </div>
      </header>

      {writable && o.nextStatuses.length > 0 ? (
        <section aria-labelledby="order-moves" className="space-y-2">
          <h2 id="order-moves" className="text-sm font-semibold">
            {t("moves.title")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {o.nextStatuses.map((s) => (
              <Button key={s} variant={dangerMoves.has(s) ? "outline" : "secondary"} className={dangerMoves.has(s) ? "text-danger" : undefined} onClick={() => setMoving(s)}>
                {t("moves.to", { status: label(s) })}
              </Button>
            ))}
          </div>
          {o.status === "awaiting_payment" ? <p className="text-xs text-muted-foreground">{t("moves.backToDraftHint")}</p> : null}
        </section>
      ) : null}

      {showMissing ? (
        <div role="note" className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft/60 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>{t("missing.line", { list: o.missing.map((m) => (t.has(`missing.${m}`) ? t(`missing.${m}` as "missing.phone") : m)).join("، ") })}</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <ItemsCard order={o} />
          <Timeline order={o} writable={writable} />
        </div>
        <CustomerCard order={o} />
      </div>

      {moving ? <MoveDialog order={o} status={moving} onClose={() => setMoving(null)} /> : null}
    </div>
  );
}

function ItemsCard({ order: o }: { order: Order }) {
  const t = useTranslations("orders");
  const money = (m: Order["total"]) => formatToman(rialOf(m) ?? 0);
  return (
    <Card>
      <CardHeader title={t("items.title")} />
      <CardBody className="space-y-4">
        {o.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noItems")}</p>
        ) : (
          <ul className="divide-y">
            {o.items.map((line, i) => (
              <li key={i} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="font-medium" dir="auto">
                    {line.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[line.variantLabel, line.sku ? t("items.sku", { sku: line.sku }) : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="text-muted-foreground">
                  {t("items.qtyTimes", { n: formatNumber(line.quantity), price: money(line.unitPrice) })}
                </p>
                <p className="w-28 text-end font-medium">{money(line.lineTotal)}</p>
              </li>
            ))}
          </ul>
        )}
        <dl className="space-y-1.5 border-t pt-3 text-sm">
          <Total label={t("totals.subtotal")}>{money(o.subtotal)}</Total>
          <Total label={t("totals.shipping")}>{money(o.shippingFee)}</Total>
          {(rialOf(o.discount) ?? 0) > 0 ? <Total label={t("totals.discount")}>{`− ${money(o.discount)}`}</Total> : null}
          <Total label={t("totals.total")} strong>
            {money(o.total)}
          </Total>
        </dl>
        {o.note ? (
          <p className="rounded-xl bg-surface-muted p-3 text-sm whitespace-pre-wrap" dir="auto">
            <span className="mb-1 block text-xs text-muted-foreground">{t("note")}</span>
            {o.note}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Total({ label, strong, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className={strong ? "flex justify-between text-base font-bold" : "flex justify-between text-muted-foreground"}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function CustomerCard({ order: o }: { order: Order }) {
  const t = useTranslations("orders");
  const { workspace, can } = useWorkspace();
  const phone = nationalMobile(o.phone);
  const address = addressText(o.address);
  return (
    <Card className="h-fit">
      <CardHeader title={t("customer.title")} />
      <CardBody>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t("customer.name")}</dt>
            <dd dir="auto">{o.customerName || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("customer.phone")}</dt>
            <dd>
              {phone ? (
                <a href={`tel:${o.phone}`} dir="ltr" className="text-primary hover:underline">
                  {phone}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("customer.address")}</dt>
            <dd dir="auto" className="whitespace-pre-wrap">
              {address || "—"}
            </dd>
          </div>
          {o.address?.recipient ? (
            <div>
              <dt className="text-xs text-muted-foreground">{t("customer.recipient")}</dt>
              <dd dir="auto">{o.address.recipient}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted-foreground">{t("customer.postalCode")}</dt>
            <dd dir="ltr" className="text-end">
              {o.address?.postalCode ? toPersianDigits(o.address.postalCode) : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {o.conversationId && can(P.inboxRead) ? (
            <Link href={`/w/${workspace.id}/inbox/${o.conversationId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <MessageCircle className="size-4" aria-hidden />
              {t("customer.conversation")}
            </Link>
          ) : null}
          {o.contactId && can(P.crmRead) ? (
            <Link href={`/w/${workspace.id}/contacts/${o.contactId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <UserRound className="size-4" aria-hidden />
              {t("customer.profile")}
            </Link>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function MoveDialog({ order: o, status, onClose }: { order: Order; status: string; onClose: () => void }) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const move = useMoveOrder(workspace.id, o.id);
  const label = useStatusLabel();
  const [note, setNote] = useState("");
  const danger = dangerMoves.has(status);
  const hint = t.has(`moves.hints.${status}`) ? t(`moves.hints.${status}` as "moves.hints.paid") : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    move.mutate(
      { status, note: note.trim() || null },
      {
        onSuccess: () => {
          toast.success(t("moves.done", { status: label(status) }));
          onClose();
        },
        onError: (err) => {
          // «awaiting_payment» lists what is missing on each field; say it in one line.
          if (err instanceof ApiError && err.status === 400 && err.code === "orders.incomplete") {
            const fields = ["items", "total"].filter((f) => err.field(f));
            return toast.error(t("moves.incomplete", { list: fields.map((f) => t(`moves.missing.${f}` as "moves.missing.items")).join("، ") }));
          }
          toast.error(errorMessage(err));
          if (err instanceof ApiError && err.status === 409) onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("moves.confirmTitle", { number: toPersianDigits(o.number), status: label(status) })}
      description={hint ?? undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="order-move-form" variant={danger ? "danger" : "primary"} loading={move.isPending}>
            {t("moves.to", { status: label(status) })}
          </Button>
        </>
      }
    >
      <form id="order-move-form" onSubmit={submit}>
        <Field label={t("moves.note")} htmlFor="order-move-note" hint={t("moves.noteHint")}>
          <Textarea id="order-move-note" dir="auto" maxLength={orderLimits.note} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}

function Timeline({ order: o, writable }: { order: Order; writable: boolean }) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { workspace, me, can } = useWorkspace();
  const timeline = useOrderTimeline(workspace.id, o.id);
  const members = useMembers(workspace.id, can(P.membersRead));
  const add = useAddOrderNote(workspace.id, o.id);
  const label = useStatusLabel();
  const [text, setText] = useState("");

  const actor = (type: string, id: string | null) => {
    if (type === "ai") return t("timeline.ai");
    if (type === "system") return t("timeline.system");
    if (id === me.id) return tc("you");
    return members.data?.find((m) => m.userId === id)?.displayName ?? t("timeline.member");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    add.mutate(text.trim(), { onSuccess: () => setText(""), onError: (err) => toast.error(errorMessage(err)) });
  };

  return (
    <Card>
      <CardHeader title={t("timeline.title")} />
      <CardBody className="space-y-4">
        {timeline.isPending ? (
          <Skeleton className="h-24" />
        ) : timeline.isError ? (
          <p className="text-sm text-danger">{errorMessage(timeline.error)}</p>
        ) : (
          <ol className="space-y-3 border-s ps-4">
            {timeline.data.map((ev) => (
              <li key={ev.id} className="relative text-sm">
                <span className="absolute -start-[1.32rem] top-1.5 size-2 rounded-full bg-primary" aria-hidden />
                <p>
                  <span className="font-medium">{actor(ev.actorType, ev.actorId)}</span>{" "}
                  {ev.kind === "created"
                    ? t("timeline.created", { status: label(ev.toStatus ?? "draft") })
                    : ev.kind === "status_changed"
                      ? t("timeline.moved", { from: label(ev.fromStatus ?? ""), to: label(ev.toStatus ?? "") })
                      : ev.kind === "edited"
                        ? t("timeline.edited")
                        : t("timeline.noted")}
                </p>
                {ev.note ? (
                  <p className="mt-1 rounded-lg bg-surface-muted px-2.5 py-1.5 whitespace-pre-wrap" dir="auto">
                    {ev.note}
                  </p>
                ) : null}
                <time dateTime={ev.at} className="text-xs text-muted-foreground">
                  {formatDateTime(ev.at)}
                </time>
              </li>
            ))}
          </ol>
        )}
        {writable ? (
          <form onSubmit={submit} className="space-y-2">
            <label htmlFor="order-note" className="sr-only">
              {t("timeline.addNote")}
            </label>
            <Textarea id="order-note" dir="auto" maxLength={orderLimits.note} placeholder={t("timeline.notePlaceholder")} value={text} onChange={(e) => setText(e.target.value)} />
            <Button type="submit" size="sm" variant="secondary" loading={add.isPending} disabled={!text.trim()}>
              {t("timeline.addNote")}
            </Button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}

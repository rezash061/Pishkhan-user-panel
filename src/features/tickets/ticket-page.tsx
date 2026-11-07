"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { ticketLimits, useCloseTicket, useReplyTicket, useTicket } from "./data";
import { TicketStatusBadge, useCategoryLabel } from "./status";

/** One ticket: the conversation with Pishkhan's support team, a reply box, and «مشکل حل شد» to close it. */
export function TicketPage({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const categoryLabel = useCategoryLabel();
  const { workspace } = useWorkspace();
  const ticket = useTicket(workspace.id, ticketId);
  const reply = useReplyTicket(workspace.id, ticketId);
  const close = useCloseTicket(workspace.id, ticketId);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const back = `/w/${workspace.id}/support`;

  const backLink = (
    <Link href={back} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowRight className="size-4" aria-hidden />
      {t("back")}
    </Link>
  );

  if (ticket.isPending) {
    return (
      <PageContainer className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </PageContainer>
    );
  }
  if (ticket.isError) {
    return (
      <PageContainer>
        {backLink}
        <Card>
          <EmptyState title={ticket.error instanceof ApiError && ticket.error.status === 404 ? t("notFound") : errorMessage(ticket.error)} />
        </Card>
      </PageContainer>
    );
  }

  const { ticket: x, messages } = ticket.data;
  const closed = x.status === "closed";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return setError(t("bodyRequired"));
    setError(null);
    reply.mutate(text, {
      onSuccess: () => {
        setBody("");
        toast.success(t("replied"));
      },
      onError: (err) => setError(err instanceof ApiError && err.field("body") ? t("bodyRequired") : errorMessage(err)),
    });
  };

  return (
    <PageContainer>
      {backLink}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-xl font-bold sm:text-2xl">{x.subject}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground" data-testid="ticket-summary">
            <span>{t("number", { number: toPersianDigits(x.number) })}</span>
            <TicketStatusBadge status={x.status} />
            <span>{categoryLabel(x.category)}</span>
            <span>{t("openedAt", { date: formatDateTime(x.createdAt) })}</span>
          </p>
        </div>
        {!closed ? (
          <Button variant="outline" onClick={() => setConfirmClose(true)}>
            <CheckCircle2 aria-hidden />
            {t("close")}
          </Button>
        ) : null}
      </div>

      <ol className="space-y-3" aria-label={t("conversation")} data-testid="ticket-messages">
        {messages.map((m) => {
          const staff = m.authorKind === "staff";
          return (
            <li key={m.id} className={cn("max-w-[90%] rounded-2xl border p-3 sm:max-w-[75%]", staff ? "me-auto border-primary/30 bg-primary-soft/60" : "ms-auto bg-surface")}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.authorName ?? (staff ? t("staff") : t("you"))}</span>
                <time dateTime={m.createdAt}>{formatDateTime(m.createdAt)}</time>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7">{m.body}</p>
            </li>
          );
        })}
      </ol>

      <Card className="mt-6">
        <CardBody>
          <form className="space-y-3" onSubmit={submit} noValidate>
            {closed ? <p className="rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">{t("closedNote")}</p> : null}
            <Field label={t("reply")} htmlFor="ticket-reply" error={error} hint={t("replyHint")}>
              <Textarea
                id="ticket-reply"
                rows={4}
                value={body}
                maxLength={ticketLimits.body}
                onChange={(e) => setBody(e.target.value)}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? "ticket-reply-error" : "ticket-reply-hint"}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={reply.isPending}>
                {t("send")}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title={t("closeTitle")}
        body={t("closeBody")}
        confirmLabel={t("close")}
        loading={close.isPending}
        onConfirm={() =>
          close.mutate(undefined, {
            onSuccess: () => {
              setConfirmClose(false);
              toast.success(t("closed"));
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </PageContainer>
  );
}

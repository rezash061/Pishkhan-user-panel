"use client";

import { ChevronLeft, ChevronRight, LifeBuoy, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { Segmented } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { TICKETS_PAGE_SIZE, ticketCategories, ticketLimits, useOpenTicket, useTickets } from "./data";
import { TicketStatusBadge, useCategoryLabel } from "./status";

const filters = ["", "open", "answered", "closed"] as const;
type Filter = (typeof filters)[number];

/** «پشتیبانی» (UP-1.18): the workspace's tickets with Pishkhan's support team, and a form to open one. */
export function TicketsPage() {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const categoryLabel = useCategoryLabel();
  const { workspace } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("status") ?? "";
  const status: Filter = (filters as readonly string[]).includes(raw) ? (raw as Filter) : "";
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(params.get("new") === "1");
  const tickets = useTickets(workspace.id, status, page);
  const base = `/w/${workspace.id}/support`;
  const pages = tickets.data ? Math.max(1, Math.ceil(tickets.data.totalCount / TICKETS_PAGE_SIZE)) : 1;
  const items = tickets.data?.items ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            {t("new")}
          </Button>
        }
      />
      <Segmented
        label={t("filter")}
        value={status}
        onChange={(v) => {
          setPage(1);
          router.replace(v ? `${base}?status=${v}` : base);
        }}
        options={filters.map((f) => ({ value: f, label: t(`filters.${f || "all"}`) }))}
        className="mb-4"
      />

      {tickets.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : tickets.isError ? (
        <Card className="p-6 text-sm text-danger">{errorMessage(tickets.error)}</Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LifeBuoy />}
            title={status ? t("emptyFiltered") : t("empty")}
            body={status ? undefined : t("emptyBody")}
            action={status ? undefined : <Button onClick={() => setCreating(true)}>{t("new")}</Button>}
          />
        </Card>
      ) : (
        <ul className="space-y-2" aria-label={t("title")}>
          {items.map((x) => (
            <li key={x.id}>
              <Link
                href={`${base}/${x.id}`}
                data-testid="ticket-row"
                className="flex flex-col gap-1.5 rounded-2xl border bg-surface p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t("number", { number: toPersianDigits(x.number) })}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{x.subject}</span>
                  <TicketStatusBadge status={x.status} />
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{categoryLabel(x.category)}</span>
                  <span>{t(x.lastMessageBy === "staff" ? "lastByStaff" : "lastBySeller", { when: formatRelative(x.lastMessageAt) })}</span>
                  <span>{t("messageCount", { count: x.messageCount })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t("previous")}>
            <ChevronRight />
          </Button>
          <span>{t("page", { page: toPersianDigits(page), pages: toPersianDigits(pages) })}</span>
          <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={t("next")}>
            <ChevronLeft />
          </Button>
        </div>
      ) : null}

      <NewTicketDialog
        open={creating}
        onClose={() => setCreating(false)}
        onOpened={(id) => {
          setCreating(false);
          toast.success(t("opened"));
          router.push(`${base}/${id}`);
        }}
        categories={ticketCategories.map((c) => ({ value: c, label: categoryLabel(c) }))}
        errorMessage={errorMessage}
      />
    </PageContainer>
  );
}

function NewTicketDialog({
  open,
  onClose,
  onOpened,
  categories,
  errorMessage,
}: {
  open: boolean;
  onClose: () => void;
  onOpened: (id: string) => void;
  categories: { value: string; label: string }[];
  errorMessage: (e: unknown) => string;
}) {
  const t = useTranslations("tickets");
  const { workspace } = useWorkspace();
  const create = useOpenTicket(workspace.id);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ subject?: string; category?: string; body?: string; form?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (subject.trim().length < ticketLimits.subjectMin) next.subject = t("subjectRequired");
    if (!category) next.category = t("categoryRequired");
    if (!body.trim()) next.body = t("bodyRequired");
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate(
      { subject: subject.trim(), category, body: body.trim() },
      {
        onSuccess: (detail) => {
          setSubject("");
          setCategory("");
          setBody("");
          onOpened(detail.ticket.id);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === "support.ticket.too_many_open") return setErrors({ form: t("tooManyOpen") });
          if (err instanceof ApiError && Object.keys(err.fields).length) {
            return setErrors({
              subject: err.field("subject") ? t("subjectRequired") : undefined,
              category: err.field("category") ? t("categoryRequired") : undefined,
              body: err.field("body") ? t("bodyRequired") : undefined,
            });
          }
          setErrors({ form: errorMessage(err) });
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("new")}
      description={t("newHint")}
      variant="sheet"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="new-ticket" loading={create.isPending}>
            {t("send")}
          </Button>
        </>
      }
    >
      <form id="new-ticket" className="space-y-4" onSubmit={submit} noValidate>
        <Field label={t("subject")} htmlFor="ticket-subject" error={errors.subject}>
          <Input
            id="ticket-subject"
            value={subject}
            maxLength={ticketLimits.subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-invalid={!!errors.subject || undefined}
            aria-describedby={errors.subject ? "ticket-subject-error" : undefined}
          />
        </Field>
        <Field label={t("category")} htmlFor="ticket-category" error={errors.category}>
          <Select
            id="ticket-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-invalid={!!errors.category || undefined}
            aria-describedby={errors.category ? "ticket-category-error" : undefined}
          >
            <option value="">{t("categoryPick")}</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("body")} htmlFor="ticket-body" error={errors.body} hint={t("bodyHint")}>
          <Textarea
            id="ticket-body"
            rows={6}
            value={body}
            maxLength={ticketLimits.body}
            onChange={(e) => setBody(e.target.value)}
            aria-invalid={!!errors.body || undefined}
            aria-describedby={errors.body ? "ticket-body-error" : "ticket-body-hint"}
          />
        </Field>
        {errors.form ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {errors.form}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

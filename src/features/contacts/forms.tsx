"use client";

import { ArrowRight, ClipboardList, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import type { FormSubmission } from "@/lib/api/types";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { contactLabel } from "./contacts-page";
import { useContactSubmissions, useFormSubmissions, useForms } from "./data";

/** Flows whose questions collected answers. A «form» is a flow, so there is nothing to create here: forms are built in automations. */
export function FormsPage() {
  const t = useTranslations("contacts.forms");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const forms = useForms(workspace.id);
  const base = `/w/${workspace.id}/contacts/forms`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("intro")}{" "}
        {can(P.automationWrite) ? (
          <Link href={`/w/${workspace.id}/automations/flows`} className="text-primary underline underline-offset-2">
            {t("toFlows")}
          </Link>
        ) : null}
      </p>
      <Card className="divide-y overflow-hidden">
        {forms.isPending ? (
          <div className="p-4">
            <Skeleton className="h-24" />
          </div>
        ) : forms.isError ? (
          <EmptyState title={errorMessage(forms.error)} />
        ) : forms.data.length === 0 ? (
          <EmptyState icon={<ClipboardList />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          forms.data.map((f) => (
            <Link key={f.flowId} href={`${base}/${f.flowId}`} className="flex items-center gap-3 p-3 hover:bg-surface-muted/50 sm:p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium" dir="auto">
                  {f.flowName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t("questions", { n: formatNumber(f.fields.length) })} · {t("last", { when: formatRelative(f.lastSubmittedAt) })}
                </p>
              </div>
              <span className="shrink-0 text-sm text-primary">{t("count", { n: formatNumber(f.submissionCount) })}</span>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}

export function FormSubmissionsPage({ flowId }: { flowId: string }) {
  const t = useTranslations("contacts.forms");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const forms = useForms(workspace.id);
  const submissions = useFormSubmissions(workspace.id, flowId);
  const form = forms.data?.find((f) => f.flowId === flowId);
  const items = submissions.data?.pages.flatMap((p) => p.items) ?? [];
  const name = form?.flowName ?? items[0]?.flowName;

  return (
    <div className="space-y-4">
      <Link href={`/w/${workspace.id}/contacts/forms`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" aria-hidden />
        {t("back")}
      </Link>
      {name ? (
        <h2 className="text-lg font-semibold" dir="auto">
          {name}
        </h2>
      ) : null}
      {submissions.isPending ? (
        <Skeleton className="h-40" />
      ) : submissions.isError ? (
        <EmptyState title={errorMessage(submissions.error)} />
      ) : items.length === 0 ? (
        <EmptyState icon={<ClipboardList />} title={t("noSubmissions")} />
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <li key={s.id}>
              <SubmissionCard submission={s} keys={form?.fields} showContact />
            </li>
          ))}
        </ul>
      )}
      {submissions.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => submissions.fetchNextPage()} loading={submissions.isFetchingNextPage}>
            {t("more")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** One submission: who, when, the conversation it came from, and the answers in the form's question order. */
function SubmissionCard({ submission: s, keys, showContact }: { submission: FormSubmission; keys?: string[]; showContact?: boolean }) {
  const t = useTranslations("contacts.forms");
  const tInbox = useTranslations("inbox");
  const { workspace, can } = useWorkspace();
  const order = [...(keys ?? []).filter((k) => k in s.answers), ...Object.keys(s.answers).filter((k) => !keys?.includes(k))];
  const { title } = contactLabel({ id: s.contactId, displayName: s.contactName, username: s.contactUsername }, (short) => tInbox("customer", { id: short }));

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {showContact ? (
          <Link href={`/w/${workspace.id}/contacts/${s.contactId}`} className="font-medium text-primary underline underline-offset-2" dir="auto">
            {title}
          </Link>
        ) : (
          <span className="font-medium" dir="auto">
            {s.flowName}
          </span>
        )}
        <time dateTime={s.submittedAt} title={formatDateTime(s.submittedAt)} className="text-muted-foreground">
          {formatRelative(s.submittedAt)}
        </time>
        {can(P.inboxRead) ? (
          <Link href={`/w/${workspace.id}/inbox/${s.conversationId}`} className="ms-auto inline-flex items-center gap-1 text-primary underline underline-offset-2">
            <MessageCircle className="size-4" aria-hidden />
            {t("conversation")}
          </Link>
        ) : null}
      </div>
      {order.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noAnswers")}</p>
      ) : (
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {order.map((k) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground" dir="ltr">
                {k}
              </dt>
              <dd className="break-words text-sm whitespace-pre-wrap" dir="auto">
                {s.answers[k] || "—"}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

/** The contact profile's «فرم‌ها» card: everything this customer answered, newest first. */
export function ContactSubmissionsCard({ contactId }: { contactId: string }) {
  const t = useTranslations("contacts.forms");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const submissions = useContactSubmissions(workspace.id, contactId);

  return (
    <Card>
      <CardHeader title={t("contactTitle")} />
      <CardBody className="space-y-3">
        {submissions.isPending ? (
          <Skeleton className="h-16" />
        ) : submissions.isError ? (
          <p className="text-sm text-danger">{errorMessage(submissions.error)}</p>
        ) : submissions.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("contactEmpty")}</p>
        ) : (
          submissions.data.map((s) => <SubmissionCard key={s.id} submission={s} />)
        )}
      </CardBody>
    </Card>
  );
}

"use client";

import { CircleHelp, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { Segmented } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { UnansweredQuestion } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatRelative } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { limits, unansweredStatuses, useAnswerUnanswered, useDismissUnanswered, useUnanswered } from "./data";
import { KnowledgeTabs } from "./tabs";

/**
 * «سؤال‌های بی‌جواب»: what customers asked that the knowledge base could not answer, counted by repeats.
 * Answering one adds it as a FAQ, so the assistant can answer it next time.
 */
export function UnansweredPage() {
  const t = useTranslations("knowledge");
  const tu = useTranslations("knowledge.unanswered");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const [status, setStatus] = useState<(typeof unansweredStatuses)[number]>("open");
  const [answering, setAnswering] = useState<UnansweredQuestion | null>(null);
  const list = useUnanswered(workspace.id, status);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <KnowledgeTabs />
      <p className="text-sm text-muted-foreground">{tu("intro")}</p>
      <Segmented label={tu("status")} value={status} onChange={setStatus} options={unansweredStatuses.map((s) => ({ value: s, label: tu(`statuses.${s}`) }))} />
      <Card className={cn("divide-y overflow-hidden", list.isPlaceholderData && "opacity-60")}>
        {list.isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : list.isError ? (
          <EmptyState title={errorMessage(list.error)} />
        ) : items.length === 0 ? (
          <EmptyState icon={<CircleHelp />} title={tu(`empty.${status}`)} body={status === "open" ? tu("emptyBody") : undefined} />
        ) : (
          items.map((q) => <Row key={q.id} question={q} onAnswer={() => setAnswering(q)} />)
        )}
      </Card>
      {list.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage}>
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
      {answering ? <AnswerDialog key={answering.id} question={answering} onClose={() => setAnswering(null)} /> : null}
    </PageContainer>
  );
}

function Row({ question: q, onAnswer }: { question: UnansweredQuestion; onAnswer: () => void }) {
  const t = useTranslations("knowledge.unanswered");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const dismiss = useDismissUnanswered(workspace.id);

  return (
    <div className="flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap sm:p-4">
      <div className="min-w-0 flex-1 basis-56 space-y-1">
        <p className="font-medium" dir="auto">
          {q.question}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge tone={q.count > 2 ? "warning" : "neutral"}>{t("count", { n: toPersianDigits(q.count) })}</Badge>
          <time dateTime={q.lastAskedAt} title={formatDateTime(q.lastAskedAt)}>
            {t("last", { when: formatRelative(q.lastAskedAt) })}
          </time>
          {can(P.inboxRead) ? (
            <Link href={`/w/${workspace.id}/inbox/${q.lastConversationId}`} className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
              <MessageCircle className="size-3.5" aria-hidden />
              {t("conversation")}
            </Link>
          ) : null}
        </p>
      </div>
      {q.status === "open" ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onAnswer} aria-label={t("answerFor", { question: q.question })}>
            {t("answer")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={dismiss.isPending}
            aria-label={t("dismissFor", { question: q.question })}
            onClick={() => dismiss.mutate(q.id, { onSuccess: () => toast.success(t("dismissed")), onError: (err) => toast.error(errorMessage(err)) })}
          >
            {t("dismiss")}
          </Button>
        </div>
      ) : (
        <Badge tone={q.status === "answered" ? "success" : "neutral"}>{t(`statuses.${q.status === "answered" ? "answered" : "dismissed"}`)}</Badge>
      )}
    </div>
  );
}

function AnswerDialog({ question: q, onClose }: { question: UnansweredQuestion; onClose: () => void }) {
  const t = useTranslations("knowledge.unanswered");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace } = useWorkspace();
  const answer = useAnswerUnanswered(workspace.id);
  const [question, setQuestion] = useState(q.question);
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const reworded = question.trim();
    answer.mutate(
      { id: q.id, answer: text.trim(), question: reworded && reworded !== q.question ? reworded : null },
      {
        onSuccess: () => {
          toast.success(t("answered"));
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 400) {
            const next: Record<string, string> = {};
            for (const f of ["question", "answer"]) {
              const code = err.field(f);
              if (code) next[f] = codeMessage(code) ?? t("invalid");
            }
            if (Object.keys(next).length) return setErrors(next);
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
      variant="sheet"
      title={t("answerTitle")}
      description={t("answerHint")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="kb-unanswered-form" loading={answer.isPending} disabled={!text.trim() || !question.trim()}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form id="kb-unanswered-form" onSubmit={submit} className="space-y-4">
        <Field label={t("question")} htmlFor="kbu-question" hint={t("questionHint")} error={errors.question}>
          <Input id="kbu-question" dir="auto" maxLength={limits.question} value={question} onChange={(e) => setQuestion(e.target.value)} />
        </Field>
        <Field label={t("answerLabel")} htmlFor="kbu-answer" error={errors.answer}>
          <Textarea id="kbu-answer" dir="auto" maxLength={limits.answer} className="min-h-28" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </Field>
      </form>
    </Dialog>
  );
}

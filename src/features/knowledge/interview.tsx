"use client";

import { Bot, Check, PartyPopper, SkipForward, Sparkles, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import type { FactStatus, OnboardingDraft } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { nextFact } from "./score";
import { useConfirmFact, useDraftFact, useKnowledgeScore } from "./score-data";
import { ScoreGauge } from "./score-page";

/** Backend limits: the owner's answer up to 1,000 characters; the FAQ question 300 and answer 2,000. */
const MAX_ANSWER = 1000;
const MAX_QUESTION = 300;
const MAX_FAQ_ANSWER = 2000;

type Turn = { fact: FactStatus; said: string; saved: string };

/**
 * «آموزش دستیار» (plan 3.1 teach chat, UP-1.1, BE-1.9): goes through the missing required facts one at a time. The
 * assistant asks the fact's prompt, the owner answers in their own words, the AI drafts a FAQ the owner can edit, and
 * confirming saves it and raises the score. Skipping moves on; nothing is saved without a confirm.
 */
export function Interview({ ws, startAt, onFinished, finishLabel }: { ws: string; startAt?: string | null; onFinished?: () => void; finishLabel?: string }) {
  const t = useTranslations("knowledge.interview");
  const errorMessage = useErrorMessage();
  const score = useKnowledgeScore(ws);
  const draft = useDraftFact(ws);
  const confirm = useConfirmFact(ws);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [proposal, setProposal] = useState<OnboardingDraft | null>(null);
  const [done, setDone] = useState<Turn[]>([]);
  const [previous, setPrevious] = useState<number | null>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  const facts = score.data?.facts ?? [];
  // `?fact=` from the score page goes first, then the rest in the backend's order.
  const ordered = startAt ? [...facts.filter((f) => f.key === startAt), ...facts.filter((f) => f.key !== startAt)] : facts;
  const fact = nextFact(ordered, skipped);
  const remaining = facts.filter((f) => !f.covered).length;

  useEffect(() => {
    if (fact && !proposal) answerRef.current?.focus();
  }, [fact?.key, proposal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (score.isPending) return <Skeleton className="h-80" />;
  if (score.isError) return <p className="text-sm text-danger">{errorMessage(score.error)}</p>;

  const reset = () => {
    setAnswer("");
    setProposal(null);
    draft.reset();
    confirm.reset();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!fact || !answer.trim()) return;
    draft.mutate({ factKey: fact.key, answer: answer.trim() }, { onSuccess: setProposal });
  };

  const save = () => {
    if (!fact || !proposal) return;
    setPrevious(score.data.score);
    confirm.mutate(
      { factKey: fact.key, question: proposal.question.trim(), answer: proposal.answer.trim() },
      {
        onSuccess: () => {
          setDone((d) => [...d, { fact, said: answer.trim(), saved: proposal.answer.trim() }]);
          reset();
        },
      },
    );
  };

  const skip = () => {
    if (!fact) return;
    setSkipped((s) => [...s, fact.key]);
    reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border p-4">
        <ScoreGauge score={score.data.score} size="sm" />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="font-medium">{remaining ? t("remaining", { n: formatNumber(remaining) }) : t("allDone")}</p>
          {previous !== null && score.data.score > previous ? (
            <p role="status" className="font-medium text-[oklch(0.45_0.12_155)] dark:text-success">
              {t("rose", { from: formatNumber(previous), to: formatNumber(score.data.score) })}
            </p>
          ) : null}
        </div>
      </div>

      <ol aria-label={t("log")} className="space-y-3">
        {done.map((turn) => (
          <li key={turn.fact.key} className="space-y-2">
            <Bubble who="assistant">{turn.fact.prompt}</Bubble>
            <Bubble who="owner">{turn.said}</Bubble>
            <p className="flex items-center gap-1.5 ps-10 text-xs text-[oklch(0.45_0.12_155)] dark:text-success">
              <Check className="size-3.5" aria-hidden />
              {t("saved", { label: turn.fact.label })}
            </p>
          </li>
        ))}
      </ol>

      {fact ? (
        <section aria-labelledby="interview-question" className="space-y-3">
          <Bubble who="assistant" id="interview-question">
            <span className="block text-xs text-muted-foreground">{fact.label}</span>
            {fact.prompt}
          </Bubble>

          {!proposal ? (
            <form onSubmit={submit} className="space-y-2">
              <label htmlFor="interview-answer" className="sr-only">
                {t("answerLabel", { label: fact.label })}
              </label>
              <Textarea
                ref={answerRef}
                id="interview-answer"
                dir="auto"
                rows={3}
                maxLength={MAX_ANSWER}
                value={answer}
                placeholder={t("answerPlaceholder")}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
                }}
              />
              {draft.isError ? (
                <p role="alert" className="text-sm text-danger">
                  {errorMessage(draft.error)}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={draft.isPending} disabled={!answer.trim()}>
                  {t("send")}
                </Button>
                <Button variant="ghost" onClick={skip} disabled={draft.isPending}>
                  <SkipForward aria-hidden />
                  {t("skip")}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <Bubble who="owner">{answer.trim()}</Bubble>
              <div className="space-y-3 rounded-2xl border border-primary/40 p-4">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {t("draftTitle")}
                  {proposal.drafted === "ai" ? (
                    <Badge tone="primary">
                      <Sparkles className="size-3" aria-hidden />
                      {t("draftedAi")}
                    </Badge>
                  ) : (
                    <Badge>{t("draftedOwn")}</Badge>
                  )}
                </p>
                <Field label={t("question")} htmlFor="interview-q">
                  <Input id="interview-q" dir="auto" maxLength={MAX_QUESTION} value={proposal.question} onChange={(e) => setProposal({ ...proposal, question: e.target.value })} />
                </Field>
                <Field label={t("answer")} htmlFor="interview-a" hint={t("answerHint")}>
                  <Textarea id="interview-a" dir="auto" rows={4} maxLength={MAX_FAQ_ANSWER} value={proposal.answer} onChange={(e) => setProposal({ ...proposal, answer: e.target.value })} />
                </Field>
                {confirm.isError ? (
                  <p role="alert" className="text-sm text-danger">
                    {errorMessage(confirm.error)}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={save} loading={confirm.isPending} disabled={!proposal.question.trim() || !proposal.answer.trim()}>
                    <Check aria-hidden />
                    {t("confirm")}
                  </Button>
                  <Button variant="outline" onClick={() => setProposal(null)} disabled={confirm.isPending}>
                    {t("rewrite")}
                  </Button>
                  <Button variant="ghost" onClick={skip} disabled={confirm.isPending}>
                    <SkipForward aria-hidden />
                    {t("skip")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      ) : (
        <div role="status" className="flex flex-col items-center gap-3 rounded-2xl bg-surface-muted p-6 text-center text-sm">
          <PartyPopper className="size-8 text-primary" aria-hidden />
          <p className="font-medium">{remaining ? t("skippedAll", { n: formatNumber(remaining) }) : t("finished")}</p>
          {remaining ? (
            <Button variant="outline" onClick={() => setSkipped([])}>
              {t("again")}
            </Button>
          ) : null}
          {onFinished ? <Button onClick={onFinished}>{finishLabel ?? t("continue")}</Button> : null}
        </div>
      )}
    </div>
  );
}

function Bubble({ who, children, id }: { who: "assistant" | "owner"; children: ReactNode; id?: string }) {
  const t = useTranslations("knowledge.interview");
  const assistant = who === "assistant";
  const Icon = assistant ? Bot : UserRound;
  return (
    <div className={cn("flex items-start gap-2", !assistant && "flex-row-reverse")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", assistant ? "bg-primary-soft text-primary" : "bg-surface-muted")}>
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{t(assistant ? "assistant" : "you")}</span>
      </span>
      <p id={id} dir="auto" className={cn("max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm", assistant ? "rounded-ss-sm bg-surface-muted" : "rounded-se-sm bg-primary text-primary-foreground")}>
        {children}
      </p>
    </div>
  );
}

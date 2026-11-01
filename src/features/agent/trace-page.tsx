"use client";

import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useHandoffReason } from "@/features/inbox/handoff-reason";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { TraceDetail } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useTrace } from "./data";
import { outcomeTone, pct } from "./log-page";

export function TracePage({ traceId }: { traceId: string }) {
  const t = useTranslations("agent.log");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const trace = useTrace(workspace.id, traceId);
  return (
    <div className="space-y-4">
      <Link href={`/w/${workspace.id}/agent/log`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" aria-hidden />
        {t("back")}
      </Link>
      {trace.isPending ? (
        <Skeleton className="h-96" />
      ) : trace.isError ? (
        <EmptyState title={trace.error instanceof ApiError && trace.error.status === 404 ? t("notFound") : errorMessage(trace.error)} />
      ) : (
        <Detail trace={trace.data} />
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end">{children}</dd>
    </div>
  );
}

function Detail({ trace: x }: { trace: TraceDetail }) {
  const t = useTranslations("agent.log");
  const tk = useTranslations("knowledge.kinds");
  const reasonLabel = useHandoffReason();
  const { workspace, can } = useWorkspace();
  const label = (group: "intents" | "sentiments" | "guards", v: string | null) => (v === null ? "—" : t.has(`${group}.${v}`) ? t(`${group}.${v}` as "intents.other") : v);

  return (
    <>
      <Card>
        <CardBody className="space-y-4">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={outcomeTone[x.outcome as keyof typeof outcomeTone] ?? "neutral"}>{t.has(`outcomes.${x.outcome}`) ? t(`outcomes.${x.outcome}` as "outcomes.sent") : x.outcome}</Badge>
            {x.handoffReason ? <span>{reasonLabel(`ai:${x.handoffReason}`)}</span> : null}
            <time dateTime={x.createdAt} className="ms-auto text-xs text-muted-foreground">
              {formatDateTime(x.createdAt)}
            </time>
          </p>
          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-muted-foreground">{t("customer")}</h2>
            <p className="rounded-xl bg-surface-muted p-3 text-sm whitespace-pre-wrap" dir="auto">
              {x.input}
            </p>
          </div>
          {x.reply ? (
            <div className="space-y-1">
              <h2 className="text-xs font-semibold text-muted-foreground">{x.outcome === "sent" ? t("reply") : t("suggestion")}</h2>
              <p className="rounded-xl bg-primary-soft/60 p-3 text-sm whitespace-pre-wrap" dir="auto">
                {x.reply}
              </p>
            </div>
          ) : null}
          {can(P.inboxRead) ? (
            <Link href={`/w/${workspace.id}/inbox/${x.conversationId}`} className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2">
              <MessageCircle className="size-4" aria-hidden />
              {t("openConversation")}
            </Link>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("understanding")} description={t("understandingHint")} />
        <CardBody>
          <dl className="divide-y">
            <Row label={t("confidence")}>
              <span className={x.confidence !== null && x.confidence < x.threshold ? "text-danger" : undefined}>{pct(x.confidence)}</span>
              <span className="text-muted-foreground"> {t("of", { threshold: pct(x.threshold) })}</span>
            </Row>
            <Row label={t("selfConfidence")}>{pct(x.selfConfidence)}</Row>
            <Row label={t("classifierConfidence")}>{pct(x.classifierConfidence)}</Row>
            <Row label={t("intent")}>{label("intents", x.intent)}</Row>
            <Row label={t("sentiment")}>{label("sentiments", x.sentiment)}</Row>
            <Row label={t("language")}>{x.language ? <span dir="ltr">{x.language}</span> : "—"}</Row>
            {x.goal ? (
              <Row label={t("goal")}>
                <span dir="auto">{x.goal}</span>
              </Row>
            ) : null}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("facts")} description={t("factsHint")} />
        <CardBody>
          {x.facts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noFacts")}</p>
          ) : (
            <ol className="space-y-2">
              {x.facts.map((f, i) => (
                <li key={f.chunkId} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{toPersianDigits(i + 1)}.</span>
                  <span className="font-medium" dir="auto">
                    {f.title}
                  </span>
                  <Badge>{tk.has(f.sourceKind) ? tk(f.sourceKind as "faq") : f.sourceKind}</Badge>
                  {f.similarity !== null ? <span className="text-xs text-muted-foreground">{t("similarity", { n: pct(f.similarity) })}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      {x.toolCalls.length > 0 ? (
        <Card>
          <CardHeader title={t("tools")} />
          <CardBody className="space-y-3">
            {x.toolCalls.map((c, i) => (
              <div key={i} className="space-y-1 text-sm">
                <p className="font-medium" dir="ltr">
                  {c.name}
                </p>
                <pre className="overflow-x-auto rounded-lg bg-surface-muted p-2 text-xs" dir="ltr">
                  {c.arguments}
                </pre>
                {c.error ? (
                  <p className="text-xs text-danger" dir="ltr">
                    {c.error}
                  </p>
                ) : c.result ? (
                  <pre className="max-h-40 overflow-auto rounded-lg bg-surface-muted p-2 text-xs whitespace-pre-wrap" dir="auto">
                    {c.result}
                  </pre>
                ) : null}
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {x.guardIssues.length > 0 ? (
        <Card>
          <CardHeader title={t("guard")} description={t("guardHint")} />
          <CardBody>
            <ul className="space-y-1.5 text-sm">
              {x.guardIssues.map((g, i) => (
                <li key={i}>
                  <span className="font-medium">{t("attempt", { n: toPersianDigits(g.attempt) })}</span> {label("guards", g.kind)}
                  {g.detail ? (
                    <span className="text-muted-foreground" dir="auto">
                      {" "}
                      ({g.detail})
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t("technical")} />
        <CardBody>
          <dl className="divide-y">
            <Row label={t("models")}>{x.models ? <span dir="ltr">{x.models}</span> : "—"}</Row>
            <Row label={t("prompts")}>{x.prompts ? <span dir="ltr">{x.prompts}</span> : "—"}</Row>
            <Row label={t("tokens")}>{t("tokensValue", { input: formatNumber(x.inputTokens), output: formatNumber(x.outputTokens) })}</Row>
            <Row label={t("cost")}>{t("toman", { n: formatNumber(Math.round(x.costIrr / 10)) })}</Row>
            <Row label={t("latency")}>{t("seconds", { n: toPersianDigits((x.latencyMs / 1000).toFixed(1)) })}</Row>
          </dl>
        </CardBody>
      </Card>
    </>
  );
}

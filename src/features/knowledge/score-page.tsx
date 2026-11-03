"use client";

import { ArrowLeft, CircleCheck, CircleDashed, Lightbulb, MessageSquarePlus, Package } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useWorkspace } from "@/features/workspace/context";
import type { KnowledgeScore } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { bandOf, gaugeShare, missingFacts, suggestionHref } from "./score";
import { useKnowledgeScore } from "./score-data";
import { KnowledgeTabs } from "./tabs";

const bandColor = { low: "text-danger", mid: "text-[oklch(0.5_0.12_70)] dark:text-warning", high: "text-success" } as const;

/** A half-ring gauge with the score in the middle, for the score page and the interview. */
export function ScoreGauge({ score, size = "lg" }: { score: number; size?: "lg" | "sm" }) {
  const t = useTranslations("knowledge.score");
  const share = gaugeShare(score);
  const band = bandOf(score);
  // A semicircle of radius 40: length π·40.
  const length = Math.PI * 40;
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(score)} aria-valuetext={t("valueText", { score: formatNumber(score), band: t(`bands.${band}`) })} aria-label={t("title")} className={cn("relative", size === "lg" ? "w-56" : "w-32")}>
      <svg viewBox="0 0 100 56" className="w-full" aria-hidden>
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" className="text-surface-muted" />
        <path
          d="M10 50 A40 40 0 0 1 90 50"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${length * share} ${length}`}
          className={cn("transition-[stroke-dasharray] duration-700", bandColor[band])}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className={cn("font-bold tabular-nums", size === "lg" ? "text-4xl" : "text-2xl")}>{formatNumber(score)}</p>
        {size === "lg" ? <p className={cn("text-sm font-medium", bandColor[band])}>{t(`bands.${band}`)}</p> : null}
      </div>
    </div>
  );
}

/** «امتیاز دانش» (plan 3.4, BE-1.9): how ready the assistant is, what is missing and what to do next. */
export function ScorePage() {
  const t = useTranslations("knowledge");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const score = useKnowledgeScore(workspace.id);

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <KnowledgeTabs />
      {score.isPending ? (
        <Skeleton className="h-72" />
      ) : score.isError ? (
        <p className="text-sm text-danger">{errorMessage(score.error)}</p>
      ) : (
        <ScoreBody ws={workspace.id} score={score.data} canTeach={can(P.knowledgeWrite)} />
      )}
    </PageContainer>
  );
}

function ScoreBody({ ws, score: s, canTeach }: { ws: string; score: KnowledgeScore; canTeach: boolean }) {
  const t = useTranslations("knowledge.score");
  const missing = missingFacts(s);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="space-y-5">
        <Card>
          <CardBody className="flex flex-col items-center gap-4">
            <ScoreGauge score={s.score} />
            <ul className="w-full space-y-2 text-sm">
              {s.parts.map((p) => (
                <li key={p.key} className="space-y-1">
                  <div className="flex justify-between gap-2">
                    <span>{t.has(`parts.${p.key}`) ? t(`parts.${p.key}` as "parts.facts") : p.key}</span>
                    <span className="tabular-nums text-muted-foreground">{t("points", { points: formatNumber(p.points), max: formatNumber(p.max) })}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${p.max ? (p.points / p.max) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {missing.length && canTeach ? (
              <Link href={`/w/${ws}/knowledge/interview`} className={buttonVariants({ className: "w-full" })}>
                <MessageSquarePlus aria-hidden />
                {t("startInterview", { n: formatNumber(missing.length) })}
              </Link>
            ) : null}
          </CardBody>
        </Card>
        {s.products ? (
          <Card>
            <CardHeader title={<span className="inline-flex items-center gap-2"><Package className="size-4 text-primary" aria-hidden />{t("products.title")}</span>} />
            <CardBody>
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                {(["active", "priced", "inStock"] as const).map((k) => (
                  <div key={k} className="rounded-xl bg-surface-muted p-2">
                    <dd className="text-lg font-bold tabular-nums">{formatNumber(s.products![k])}</dd>
                    <dt className="text-xs text-muted-foreground">{t(`products.${k}`)}</dt>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <div className="space-y-5">
        {s.suggestions.length ? (
          <Card>
            <CardHeader title={<span className="inline-flex items-center gap-2"><Lightbulb className="size-4 text-primary" aria-hidden />{t("suggestionsTitle")}</span>} />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {s.suggestions.map((key) => {
                  const href = suggestionHref(key, ws);
                  const short = key.replace(/^knowledge\.suggest\./, "");
                  const label = t.has(`suggest.${short}`) ? t(`suggest.${short}` as "suggest.add_faqs", { n: formatNumber(s.openUnanswered) }) : key;
                  return (
                    <li key={key}>
                      {href ? (
                        <Link href={href} className="flex items-center justify-between gap-2 rounded-xl border p-3 hover:bg-surface-muted">
                          <span>{label}</span>
                          <ArrowLeft className="size-4 shrink-0 text-primary" aria-hidden />
                        </Link>
                      ) : (
                        <p className="rounded-xl border p-3">{label}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title={t("factsTitle")} description={s.facts.length ? t("factsSubtitle", { covered: formatNumber(s.facts.length - missing.length), total: formatNumber(s.facts.length) }) : t("noFacts")} />
          <CardBody>
            <ul className="divide-y text-sm">
              {s.facts.map((f) => (
                <li key={f.key} className="flex items-start gap-3 py-2.5">
                  {f.covered ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-label={t("covered")} /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label={t("missing")} />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{f.label}</p>
                    {!f.covered ? <p className="text-xs text-muted-foreground">{f.prompt}</p> : null}
                  </div>
                  {f.covered && f.sourceId ? (
                    <Link href={`/w/${ws}/knowledge?source=${f.sourceId}`} className="shrink-0 text-xs text-primary hover:underline">
                      {t("viewSource")}
                    </Link>
                  ) : !f.covered && canTeach ? (
                    <Link href={`/w/${ws}/knowledge/interview?fact=${encodeURIComponent(f.key)}`} className={buttonVariants({ size: "sm", variant: "outline", className: "shrink-0" })}>
                      {t("answer")}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

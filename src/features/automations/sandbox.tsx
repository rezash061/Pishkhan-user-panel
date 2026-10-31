"use client";

import { Bell, Bot, Clock, ExternalLink, Hand, MessageCircle, MessageSquareReply, Play, RotateCcw, Send, ShoppingBag, Tag, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { FlowTestResult, OutboundContent, Rule, SandboxMessage, SandboxStep } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { useRules, useTestFlow, useTestRules } from "./data";

type Source = "dm" | "comment";
const dmKinds = ["text", "story_reply", "story_mention", "share"] as const;
const commentKinds = ["comment", "live_comment"] as const;

/** The sample event that would fire this rule's trigger, so «test this rule» starts from something that can match. */
type Sample = { source: Source; kind: string; text: string; payload?: string | null; isNewConversation?: boolean };

export function sampleFor(rule: Rule | null): Sample {
  const keyword = rule?.trigger.keywords?.[0] ?? "";
  switch (rule?.triggerKind) {
    case "comment_keyword":
    case "comment_any":
      return { source: "comment", kind: "comment", text: keyword };
    case "live_comment":
      return { source: "comment", kind: "live_comment", text: keyword };
    case "story_reply":
      return { source: "dm", kind: "story_reply", text: keyword };
    case "story_mention":
      return { source: "dm", kind: "story_mention", text: "" };
    case "post_share":
      return { source: "dm", kind: "share", text: "" };
    case "new_conversation":
      return { source: "dm", kind: "text", text: "سلام", isNewConversation: true };
    case "postback":
      return { source: "dm", kind: "text", text: "", payload: rule.trigger.payload ?? null };
    default:
      return { source: "dm", kind: "text", text: keyword };
  }
}

/**
 * «What would happen if…»: runs a sample DM or comment through the real matching, order and business hours, and shows
 * what would be sent. With a rule, only that rule is tested (even when it is off).
 */
export function RuleTester({ rule, open, onClose }: { rule?: Rule; open: boolean; onClose: () => void }) {
  const t = useTranslations("automations.test");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const test = useTestRules(workspace.id);
  const rules = useRules(workspace.id);
  const initial = sampleFor(rule ?? null);
  const [source, setSource] = useState<Source>(initial.source);
  const [kind, setKind] = useState(initial.kind);
  const [text, setText] = useState(initial.text);
  const [isNew, setIsNew] = useState(Boolean(initial.isNewConversation));
  const [at, setAt] = useState("");
  const [name, setName] = useState("");
  const result = test.data;
  const ruleName = (id: string) => rules.data?.find((r) => r.id === id)?.name ?? "…";

  const run = (e?: FormEvent) => {
    e?.preventDefault();
    test.mutate({
      text: text.trim() || null,
      payload: initial.payload ?? null,
      source,
      kind,
      isNewConversation: source === "dm" && isNew,
      at: at ? new Date(at).toISOString() : null,
      ruleId: rule?.id ?? null,
      channelAccountId: rule?.channelAccountId ?? null,
      mediaId: rule?.postId ?? null,
      contact: name.trim() ? { name: name.trim(), username: null, tags: null, fields: null } : null,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="sheet"
      title={rule ? t("ruleTitle", { name: rule.name }) : t("title")}
      description={rule ? t("ruleHint") : t("hint")}
      className="sm:max-w-xl"
    >
      <div className="space-y-4">
        <form id="rule-test" onSubmit={run} className="space-y-3" noValidate>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<Source>
              label={t("source")}
              value={source}
              onChange={(s) => {
                setSource(s);
                setKind(s === "dm" ? "text" : "comment");
              }}
              options={[
                { value: "dm", label: t("sources.dm") },
                { value: "comment", label: t("sources.comment") },
              ]}
            />
            <Select aria-label={t("kind")} className="h-9 w-40" value={kind} onChange={(e) => setKind(e.target.value)}>
              {(source === "dm" ? dmKinds : commentKinds).map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </Select>
          </div>
          <Field label={t("text")} htmlFor="test-text">
            <Textarea id="test-text" dir="auto" rows={2} maxLength={1000} value={text} placeholder={t("textPlaceholder")} onChange={(e) => setText(e.target.value)} />
          </Field>
          <details className="rounded-xl border px-3 py-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground">{t("more")}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t("at")} htmlFor="test-at" hint={t("atHint")}>
                <Input id="test-at" type="datetime-local" dir="ltr" value={at} onChange={(e) => setAt(e.target.value)} />
              </Field>
              <Field label={t("contactName")} htmlFor="test-name">
                <Input id="test-name" dir="auto" maxLength={100} value={name} placeholder="نیلوفر" onChange={(e) => setName(e.target.value)} />
              </Field>
              {source === "dm" ? (
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                  {t("isNew")}
                </label>
              ) : null}
            </div>
          </details>
          <Button type="submit" loading={test.isPending}>
            <Play aria-hidden />
            {t("run")}
          </Button>
        </form>

        {test.isError ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {errorMessage(test.error)}
          </p>
        ) : null}

        {result ? (
          <section aria-live="polite" aria-label={t("result")} className="space-y-3 rounded-2xl border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 font-medium" dir="auto">
                {t(`outcomes.${result.outcome}` as "outcomes.none", { name: result.ruleName ?? "" })}
              </p>
              <Badge tone={result.businessOpen ? "success" : "warning"}>{result.businessOpen ? t("openHours") : t("closedHours")}</Badge>
            </div>
            {result.steps.length ? <StepList steps={result.steps} /> : null}
            {result.flow ? (
              <div className="space-y-2 border-t pt-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Workflow className="size-4 text-primary" aria-hidden />
                  {t("flowStarts")}
                </p>
                <FlowTurns result={result.flow} />
              </div>
            ) : null}
            {result.otherMatches.length ? (
              <p className="text-xs text-muted-foreground">{t("otherMatches", { names: result.otherMatches.map(ruleName).join("، ") })}</p>
            ) : null}
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}

/**
 * Chat with a flow: it runs from the start, then each answer (typed, or a quick-reply tap) is added and the whole run
 * replays, since tests keep no state between calls.
 */
export function FlowTester({ flowId, hasPublished, dirty, open, onClose }: { flowId: string; hasPublished: boolean; dirty: boolean; open: boolean; onClose: () => void }) {
  const t = useTranslations("automations.test");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const test = useTestFlow(workspace.id, flowId);
  const [answers, setAnswers] = useState<SandboxMessage[]>([]);
  const [published, setPublished] = useState(false);
  const [draft, setDraft] = useState("");
  const mutate = test.mutate;

  const run = (next: SandboxMessage[], usePublished = published) => {
    setAnswers(next);
    mutate({ answers: next, published: usePublished });
  };

  // Start the run when the tester opens.
  useEffect(() => {
    if (open) mutate({ answers: [], published: false });
  }, [open, mutate]);

  const result = test.data;
  const waiting = result?.status === "waiting_input";
  const last = result?.turns.at(-1)?.steps.findLast((s) => s.message?.quickReplies?.length || s.message?.buttons?.length)?.message;
  const invalid = test.error instanceof ApiError && test.error.status === 422;

  const answer = (message: SandboxMessage) => {
    setDraft("");
    run([...answers, message]);
  };

  return (
    <Dialog open={open} onClose={onClose} variant="sheet" title={t("flowTitle")} description={dirty ? t("flowDirty") : t("flowHint")} className="sm:max-w-xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {hasPublished ? (
            <Segmented<"draft" | "published">
              label={t("version")}
              value={published ? "published" : "draft"}
              onChange={(v) => {
                setPublished(v === "published");
                run([], v === "published");
              }}
              options={[
                { value: "draft", label: t("draft") },
                { value: "published", label: t("published") },
              ]}
            />
          ) : null}
          <Button variant="outline" size="sm" onClick={() => run([])} disabled={test.isPending}>
            <RotateCcw aria-hidden />
            {t("restart")}
          </Button>
        </div>

        {invalid ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {t("flowInvalid")}
          </p>
        ) : test.isError ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {errorMessage(test.error)}
          </p>
        ) : null}

        <div className="min-h-40 rounded-2xl border bg-surface-muted/40 p-3" aria-live="polite">
          {result ? <FlowTurns result={result} /> : test.isPending ? <Spinner label={t("running")} /> : null}
          {result && test.isPending ? <Spinner label={t("running")} /> : null}
        </div>

        {waiting && !test.isPending ? (
          <div className="space-y-2">
            {last ? (
              <div className="flex flex-wrap gap-1.5">
                {[...(last.quickReplies ?? []).map((q) => ({ title: q.title, payload: q.payload })), ...(last.buttons ?? []).filter((b) => b.type !== "web_url").map((b) => ({ title: b.title, payload: b.payload ?? null }))].map((q, i) => (
                  <button key={i} type="button" className="rounded-full border border-primary/40 bg-surface px-3 py-1 text-xs text-primary hover:bg-primary-soft" onClick={() => answer({ text: q.title, payload: q.payload })}>
                    {q.title}
                  </button>
                ))}
              </div>
            ) : null}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) answer({ text: draft.trim(), payload: null });
              }}
            >
              <Input aria-label={t("answer")} dir="auto" maxLength={1000} value={draft} placeholder={t("answerPlaceholder")} onChange={(e) => setDraft(e.target.value)} />
              <Button type="submit" size="icon" aria-label={t("send")} disabled={!draft.trim()}>
                <Send />
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

function FlowTurns({ result }: { result: FlowTestResult }) {
  const t = useTranslations("automations.test");
  return (
    <div className="space-y-3">
      {result.turns.map((turn, i) => (
        <div key={i} className="space-y-2">
          {turn.input ? (
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-ee-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" dir="auto">
                {turn.input.text || turn.input.payload}
              </p>
            </div>
          ) : null}
          <StepList steps={turn.steps} />
        </div>
      ))}
      <p className="text-center text-xs text-muted-foreground">{t.has(`status.${result.status}`) ? t(`status.${result.status}` as "status.completed") : result.status}</p>
    </div>
  );
}

const stepIcons: Record<string, typeof Tag> = {
  add_tag: Tag,
  remove_tag: Tag,
  set_field: Tag,
  handoff: Hand,
  pause_ai: Bot,
  notify_team: Bell,
  start_flow: Workflow,
  delay: Clock,
  ai: Bot,
  send_cards: ShoppingBag,
  public_reply: MessageSquareReply,
};

export function StepList({ steps }: { steps: SandboxStep[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i}>
          <Step step={s} />
        </li>
      ))}
    </ol>
  );
}

function Step({ step: s }: { step: SandboxStep }) {
  const t = useTranslations("automations.test.steps");
  if (s.message && (s.type === "send_message" || s.type === "private_reply")) {
    return (
      <div className="space-y-1">
        {s.type === "private_reply" ? <p className="text-xs text-muted-foreground">{t("private_reply")}</p> : null}
        <BotMessage message={s.message} />
      </div>
    );
  }
  const Icon = stepIcons[s.type] ?? MessageCircle;
  let body: ReactNode;
  switch (s.type) {
    case "public_reply":
      body = t("public_reply", { replies: (s.replies ?? []).map((r) => `«${r}»`).join(" / ") });
      break;
    case "add_tag":
    case "remove_tag":
      body = t(s.type, { tag: s.tag ?? "" });
      break;
    case "set_field":
      body = t("set_field", { field: s.field ?? "", value: s.value ?? "" });
      break;
    case "handoff":
      body = s.reason ? t("handoffReason", { reason: s.reason }) : t("handoff");
      break;
    case "notify_team":
      body = t("notify_team", { title: s.title ?? "" });
      break;
    case "delay":
      body = t("delay", { until: s.until ? formatDateTime(s.until) : "" });
      break;
    case "ai":
      body = s.goal ? t("aiGoal", { goal: s.goal }) : t("ai");
      break;
    default:
      body = t.has(s.type) ? t(s.type as "pause_ai") : s.type;
  }
  return (
    <p className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2 text-xs text-muted-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
      <span dir="auto">{body}</span>
    </p>
  );
}

/** A message as the customer would get it (variables already filled in by the server). */
function BotMessage({ message }: { message: OutboundContent }) {
  const buttons = message.buttons ?? [];
  const quick = message.quickReplies ?? [];
  return (
    <div className="space-y-1.5">
      {message.text || buttons.length ? (
        <div className="me-auto max-w-[85%] overflow-hidden rounded-2xl rounded-ss-md bg-surface text-sm shadow-sm">
          {message.text ? (
            <p className="px-3 py-2 leading-7 whitespace-pre-wrap" dir="auto">
              {message.text}
            </p>
          ) : null}
          {buttons.map((b, i) => (
            <div key={i} className="flex items-center justify-center gap-1 border-t px-3 py-1.5 text-center text-xs font-medium text-primary">
              {b.title}
              {b.type === "web_url" ? <ExternalLink className="size-3" aria-hidden /> : null}
            </div>
          ))}
        </div>
      ) : null}
      {message.cards?.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {message.cards.map((c, i) => (
            <div key={i} className="w-36 shrink-0 rounded-xl bg-surface p-2 text-xs shadow-sm">
              <p className="truncate font-medium">{c.title}</p>
              {c.subtitle ? <p className="truncate text-muted-foreground">{c.subtitle}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {quick.length ? (
        <div className={cn("flex flex-wrap gap-1.5")}>
          {quick.map((q, i) => (
            <span key={i} className="rounded-full border border-primary/40 bg-surface px-2.5 py-0.5 text-xs text-primary">
              {q.title}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
